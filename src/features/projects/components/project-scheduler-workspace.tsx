"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getProjectScheduler } from "@/features/projects/services/get-project-scheduler";
import { saveProjectScheduler } from "@/features/projects/services/save-project-scheduler";
import type {
  SchedulerActivity,
  SchedulerActivityType as ActivityType,
} from "@/features/projects/types/scheduler";
import type { ProjectRecord } from "@/features/projects/types/project";
import { formatDisplayDate as formatDateForDisplay } from "@/lib/date-format";

type ProjectSchedulerWorkspaceProps = {
  project: ProjectRecord;
  backHref: string;
};

type ScheduledActivity = SchedulerActivity & {
  successorIds: string[];
  computedStartDate: string;
  computedEndDate: string;
  unresolvedPredecessors: string[];
  hasCircularDependency: boolean;
  hasDuplicateId: boolean;
  isLogicDriven: boolean;
  totalFloatDays: number;
  isCritical: boolean;
};

type ScheduleComputation = {
  activities: ScheduledActivity[];
  duplicateIds: string[];
  dateRange: string[];
  projectStart: string;
  projectFinish: string;
  totalCalendarDays: number;
};

type ScheduleComputationOptions = {
  respectManualStartDates?: boolean;
};

type GanttConnection = {
  id: string;
  fromActivityId: string;
  toActivityId: string;
  fromRowIndex: number;
  toRowIndex: number;
  fromOffset: number;
  toOffset: number;
  fromIsMilestone: boolean;
  isCritical: boolean;
};

type GanttScale = "days" | "weeks";

type RelationshipField = "predecessor" | "successor";

type SchedulerSaveStatus = "loading" | "idle" | "saving" | "saved" | "blocked" | "error";

type GanttColumn = {
  id: string;
  startDate: string;
  endDate: string;
  primaryLabel: string;
  secondaryLabel: string;
  isWeekend: boolean;
};

type ActivityLateDates = {
  lateStart: Date;
  lateFinish: Date;
};

type GanttVisualBounds = {
  startX: number;
  endX: number;
  isMilestone: boolean;
};

const dayWidth = 84;
const weekWidth = 92;
const rowHeight = 40;
const activityIdColumnWidth = 120;
const activityNameColumnWidth = 190;
const ganttBarInset = 10;
const ganttArrowWidth = 8;
const ganttLabelTailWidth = 300;
const ganttMilestoneSize = 14;
const ganttMinimumConnectorRun = 30;
const ganttArrowTargetGap = 3;
const ganttTightConnectorLoopWidth = 8;
const ganttTightConnectorLaneOffset = 14;
const activityTypes: ActivityType[] = [
  "Task Dependent",
  "Start Milestone",
  "Finish Milestone",
];
const compactInputClassName = "h-8 rounded-lg px-2 py-1 text-[11px]";
const compactSelectClassName =
  "h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1 text-[11px] text-[var(--foreground)] outline-none transition duration-200 focus:border-[var(--border-strong)]";

export function ProjectSchedulerWorkspace({
  project,
  backHref,
}: ProjectSchedulerWorkspaceProps) {
  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncSourceRef = useRef<"left" | "right" | null>(null);
  const activityNameInputRefs = useRef(new Map<string, HTMLInputElement>());
  const pendingActivityNameFocusRowKeyRef = useRef<string | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSaveRequestRef = useRef(0);
  const hasLoadedSchedulerRef = useRef(false);
  const skipNextAutosaveRef = useRef(false);
  const scheduleIdRef = useRef<string | null>(null);
  const [ganttScale, setGanttScale] = useState<GanttScale>("days");
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [saveStatus, setSaveStatus] =
    useState<SchedulerSaveStatus>("loading");
  const [saveStatusMessage, setSaveStatusMessage] =
    useState("Loading schedule...");
  const [activities, setActivities] = useState<SchedulerActivity[]>([]);
  const [todayDateValue] = useState(() => getTodayInputDate());
  const [relationshipDraftValues, setRelationshipDraftValues] = useState<
    Record<string, string>
  >({});
  const [dateDraftValues, setDateDraftValues] = useState<
    Record<string, string>
  >({});

  const computedSchedule = useMemo(
    () => computeSchedule(activities, project.expected_start_date),
    [activities, project.expected_start_date]
  );
  const ganttColumns = useMemo(
    () => buildGanttColumns(computedSchedule, ganttScale),
    [computedSchedule, ganttScale]
  );
  const ganttCellWidth = ganttScale === "days" ? dayWidth : weekWidth;
  const ganttTimelineWidth = Math.max(
    ganttColumns.length * ganttCellWidth,
    720
  );
  const ganttContentWidth = ganttTimelineWidth + ganttLabelTailWidth;
  const ganttConnections = useMemo(
    () => buildGanttConnections(computedSchedule.activities, ganttColumns),
    [computedSchedule.activities, ganttColumns]
  );
  const ganttVisualBoundsById = useMemo(
    () =>
      buildGanttVisualBounds(
        computedSchedule.activities,
        ganttColumns,
        ganttCellWidth
      ),
    [computedSchedule.activities, ganttColumns, ganttCellWidth]
  );
  const todayMarkerOffset = useMemo(
    () => findGanttDateOffsetForDate(ganttColumns, todayDateValue, "start"),
    [ganttColumns, todayDateValue]
  );
  const todayMarkerLeft =
    todayMarkerOffset === null ? null : todayMarkerOffset * ganttCellWidth;

  useEffect(() => {
    scheduleIdRef.current = scheduleId;
  }, [scheduleId]);

  useEffect(() => {
    let isCancelled = false;

    hasLoadedSchedulerRef.current = false;
    skipNextAutosaveRef.current = true;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      setIsLoadingSchedule(true);
      setSaveStatus("loading");
      setSaveStatusMessage("Loading schedule...");
    });

    getProjectScheduler(project.id)
      .then((schedulerData) => {
        if (isCancelled) {
          return;
        }

        setScheduleId(schedulerData.scheduleId);
        setActivities(schedulerData.activities);
        setRelationshipDraftValues({});
        setDateDraftValues({});
        setSaveStatus(schedulerData.scheduleId ? "saved" : "idle");
        setSaveStatusMessage(
          schedulerData.scheduleId ? "Saved" : "Local draft"
        );
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        console.error("Error loading scheduler:", error);
        setSaveStatus("error");
        setSaveStatusMessage(
          error instanceof Error ? error.message : "Failed to load schedule."
        );
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }

        hasLoadedSchedulerRef.current = true;
        setIsLoadingSchedule(false);
      });

    return () => {
      isCancelled = true;

      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [project.id, project.expected_start_date]);

  useEffect(() => {
    if (!hasLoadedSchedulerRef.current || isLoadingSchedule) {
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    const blockingSaveIssue = getSchedulerBlockingSaveIssue(computedSchedule);

    if (blockingSaveIssue) {
      queueMicrotask(() => {
        setSaveStatus("blocked");
        setSaveStatusMessage(blockingSaveIssue);
      });
      return;
    }

    queueMicrotask(() => {
      setSaveStatus("saving");
      setSaveStatusMessage("Saving...");
    });

    const saveRequestId = latestSaveRequestRef.current + 1;
    latestSaveRequestRef.current = saveRequestId;

    saveDebounceRef.current = setTimeout(() => {
      saveProjectScheduler({
        scheduleId: scheduleIdRef.current,
        projectId: project.id,
        projectName: project.project_name,
        expectedStartDate: project.expected_start_date,
        statusDate: todayDateValue,
        activities: computedSchedule.activities.map((activity) => ({
          ...activity,
          computedEndDate: activity.computedEndDate,
        })),
      })
        .then((result) => {
          if (latestSaveRequestRef.current !== saveRequestId) {
            return;
          }

          scheduleIdRef.current = result.scheduleId;
          setScheduleId(result.scheduleId);
          setSaveStatus("saved");
          setSaveStatusMessage("Saved");
        })
        .catch((error: unknown) => {
          if (latestSaveRequestRef.current !== saveRequestId) {
            return;
          }

          console.error("Error saving scheduler:", error);
          setSaveStatus("error");
          setSaveStatusMessage(
            error instanceof Error ? error.message : "Failed to save schedule."
          );
        });
    }, 800);

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [
    computedSchedule,
    isLoadingSchedule,
    project.expected_start_date,
    project.id,
    project.project_name,
    todayDateValue,
  ]);

  useEffect(() => {
    const rowKey = pendingActivityNameFocusRowKeyRef.current;

    if (!rowKey) {
      return;
    }

    const activityNameInput = activityNameInputRefs.current.get(rowKey);

    if (!activityNameInput) {
      return;
    }

    pendingActivityNameFocusRowKeyRef.current = null;
    activityNameInput.focus();
    activityNameInput.select();
  }, [activities]);

  const syncPaneScroll = useCallback((source: "left" | "right") => {
    const currentPane =
      source === "left" ? leftPaneRef.current : rightPaneRef.current;
    const partnerPane =
      source === "left" ? rightPaneRef.current : leftPaneRef.current;

    if (!currentPane || !partnerPane) {
      return;
    }

    if (
      scrollSyncSourceRef.current &&
      scrollSyncSourceRef.current !== source
    ) {
      return;
    }

    scrollSyncSourceRef.current = source;

    if (Math.abs(partnerPane.scrollTop - currentPane.scrollTop) > 1) {
      partnerPane.scrollTop = currentPane.scrollTop;
    }

    requestAnimationFrame(() => {
      if (scrollSyncSourceRef.current === source) {
        scrollSyncSourceRef.current = null;
      }
    });
  }, []);

  function updateActivity(
    rowKey: string,
    updater: (activity: SchedulerActivity) => SchedulerActivity
  ) {
    setActivities((currentActivities) =>
      currentActivities.map((activity) =>
        activity.rowKey === rowKey ? updater(activity) : activity
      )
    );
  }

  function handleActivityIdChange(rowKey: string, nextValue: string) {
    setActivities((currentActivities) => {
      const currentActivity = currentActivities.find(
        (activity) => activity.rowKey === rowKey
      );

      if (!currentActivity) {
        return currentActivities;
      }

      const previousId = normalizeRelationshipId(currentActivity.activityId);
      const nextId = normalizeRelationshipId(nextValue);

      return currentActivities.map((activity) => {
        if (activity.rowKey === rowKey) {
          return {
            ...activity,
            activityId: nextValue.toUpperCase(),
          };
        }

        if (!previousId || previousId === nextId) {
          return activity;
        }

        return {
          ...activity,
          predecessorIds: activity.predecessorIds.map((predecessorId) =>
            predecessorId === previousId ? nextId : predecessorId
          ),
        };
      });
    });
  }

  function handleSuccessorChange(rowKey: string, nextValue: string) {
    setActivities((currentActivities) => {
      const currentActivity = currentActivities.find(
        (activity) => activity.rowKey === rowKey
      );

      if (!currentActivity) {
        return currentActivities;
      }

      const currentId = normalizeRelationshipId(currentActivity.activityId);

      if (!currentId) {
        return currentActivities;
      }

      const nextSuccessorIds = parseRelationshipIds(nextValue).filter(
        (successorId) => successorId !== currentId
      );
      const existingSuccessorIds =
        buildSuccessorMap(currentActivities).get(currentId) ?? [];

      return currentActivities.map((activity) => {
        const targetId = normalizeRelationshipId(activity.activityId);

        if (!targetId || targetId === currentId) {
          return activity;
        }

        const shouldHaveRelationship = nextSuccessorIds.includes(targetId);
        const hadRelationship = existingSuccessorIds.includes(targetId);

        if (!shouldHaveRelationship && !hadRelationship) {
          return activity;
        }

        let nextPredecessorIds = activity.predecessorIds.filter(
          (predecessorId) => predecessorId !== currentId
        );

        if (shouldHaveRelationship) {
          nextPredecessorIds = mergeRelationshipIds([
            ...nextPredecessorIds,
            currentId,
          ]);
        }

        return {
          ...activity,
          predecessorIds: nextPredecessorIds,
        };
      });
    });
  }

  function handleRelationshipDraftChange(
    rowKey: string,
    field: RelationshipField,
    nextValue: string
  ) {
    const draftKey = buildRelationshipDraftKey(rowKey, field);

    setRelationshipDraftValues((currentDraftValues) => ({
      ...currentDraftValues,
      [draftKey]: nextValue,
    }));
  }

  function clearRelationshipDraft(rowKey: string, field: RelationshipField) {
    const draftKey = buildRelationshipDraftKey(rowKey, field);

    setRelationshipDraftValues((currentDraftValues) => {
      const nextDraftValues = { ...currentDraftValues };
      delete nextDraftValues[draftKey];
      return nextDraftValues;
    });
  }

  function handleStartDateDraftChange(rowKey: string, nextValue: string) {
    setDateDraftValues((currentDraftValues) => ({
      ...currentDraftValues,
      [rowKey]: nextValue,
    }));

    const parsedDate = parseDisplayDateInputToInputDate(nextValue);

    if (!parsedDate) {
      return;
    }

    updateActivity(rowKey, (currentActivity) => ({
      ...currentActivity,
      startDate: parsedDate,
    }));
  }

  function clearStartDateDraft(rowKey: string) {
    setDateDraftValues((currentDraftValues) => {
      const nextDraftValues = { ...currentDraftValues };
      delete nextDraftValues[rowKey];
      return nextDraftValues;
    });
  }

  function handleActivityTypeChange(rowKey: string, nextValue: ActivityType) {
    updateActivity(rowKey, (activity) => ({
      ...activity,
      activityType: nextValue,
      percentComplete: isMilestoneActivityType(nextValue)
        ? 0
        : activity.percentComplete,
      durationDays: isMilestoneActivityType(nextValue)
        ? 0
        : Math.max(clampDuration(activity.durationDays, nextValue), 1),
    }));
  }

  function handleAddActivity() {
    const latestFinish =
      computedSchedule.projectFinish ||
      project.expected_start_date ||
      getTodayInputDate();

    setActivities((currentActivities) => [
      ...currentActivities,
      buildBlankActivity(currentActivities, addDaysToInputDate(latestFinish, 1)),
    ]);
  }

  const handleScheduleActivities = useCallback(() => {
    setActivities((currentActivities) => {
      const logicOnlySchedule = computeSchedule(
        currentActivities,
        project.expected_start_date,
        { respectManualStartDates: false }
      );
      const computedStartDatesByRowKey = new Map(
        logicOnlySchedule.activities.map((activity) => [
          activity.rowKey,
          activity.computedStartDate,
        ])
      );

      return currentActivities.map((activity) => ({
        ...activity,
        startDate:
          computedStartDatesByRowKey.get(activity.rowKey) ??
          activity.startDate,
      }));
    });
    setDateDraftValues({});
  }, [project.expected_start_date]);

  useEffect(() => {
    function handleSchedulerShortcut(event: globalThis.KeyboardEvent) {
      if (
        event.key !== "F9" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.repeat
      ) {
        return;
      }

      event.preventDefault();
      handleScheduleActivities();
    }

    window.addEventListener("keydown", handleSchedulerShortcut);

    return () => {
      window.removeEventListener("keydown", handleSchedulerShortcut);
    };
  }, [handleScheduleActivities]);

  function handleInsertActivityBelow(rowKey: string) {
    setActivities((currentActivities) => {
      const targetIndex = currentActivities.findIndex(
        (activity) => activity.rowKey === rowKey
      );

      if (targetIndex < 0) {
        return currentActivities;
      }

      const targetActivity = currentActivities[targetIndex];
      const nextActivity = buildBlankActivity(
        currentActivities,
        addDaysToInputDate(
          targetActivity.startDate,
          Math.max(getActivityDurationDays(targetActivity), 1)
        )
      );

      pendingActivityNameFocusRowKeyRef.current = nextActivity.rowKey;

      return [
        ...currentActivities.slice(0, targetIndex + 1),
        nextActivity,
        ...currentActivities.slice(targetIndex + 1),
      ];
    });
  }

  function handleActivityRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    rowKey: string
  ) {
    if (
      event.key !== "Insert" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    handleInsertActivityBelow(rowKey);
  }

  function handleDeleteActivity(rowKey: string) {
    setActivities((currentActivities) => {
      const activityToDelete = currentActivities.find(
        (activity) => activity.rowKey === rowKey
      );

      if (!activityToDelete) {
        return currentActivities;
      }

      const deletedId = normalizeRelationshipId(activityToDelete.activityId);

      return currentActivities
        .filter((activity) => activity.rowKey !== rowKey)
        .map((activity) => ({
          ...activity,
          predecessorIds: deletedId
            ? activity.predecessorIds.filter(
                (predecessorId) => predecessorId !== deletedId
              )
            : activity.predecessorIds,
        }));
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-[var(--foreground)]">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 shadow-[var(--shadow-lg)]">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 text-xs font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:border-[var(--border-strong)]"
        >
          Back
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-1">
            {(["days", "weeks"] as GanttScale[]).map((scaleOption) => {
              const isActive = ganttScale === scaleOption;

              return (
                <button
                  key={scaleOption}
                  type="button"
                  onClick={() => setGanttScale(scaleOption)}
                  className={[
                    "h-7 rounded-lg px-3 text-[10px] font-semibold uppercase tracking-[0.08em] transition duration-200",
                    isActive
                      ? "bg-[var(--inverse-bg)] text-[var(--inverse-fg)]"
                      : "text-[var(--muted)] hover:cursor-pointer hover:text-[var(--foreground)]",
                  ].join(" ")}
                >
                  {scaleOption}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleScheduleActivities}
            aria-keyshortcuts="F9"
            title="Schedule activities (F9)"
            className="h-9 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 text-xs font-semibold text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:border-[var(--border-strong)]"
          >
            Schedule
          </button>
          <span
            className={[
              "inline-flex h-9 items-center rounded-xl border px-3 text-[10px] font-semibold uppercase tracking-[0.08em]",
              getSaveStatusClassName(saveStatus),
            ].join(" ")}
            style={{ color: "var(--status-contrast-text)" }}
            title={saveStatusMessage}
          >
            {saveStatusMessage}
          </span>
          <button
            type="button"
            onClick={handleAddActivity}
            className="h-9 rounded-xl bg-green-600 px-4 text-xs font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
          >
            Add Activity
          </button>
        </div>
      </div>

      {isLoadingSchedule ? (
        <Card className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-6 py-4 text-sm font-semibold text-[var(--foreground)]">
            Loading schedule...
          </div>
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
          <Card className="flex min-h-0 flex-col p-3">
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
            <div
              ref={leftPaneRef}
              onScroll={() => syncPaneScroll("left")}
              className="relative isolate h-full overflow-auto overscroll-contain bg-[var(--panel)]"
            >
              <table className="w-full min-w-[1284px] table-fixed border-separate border-spacing-0 text-left text-[11px]">
                <colgroup>
                  <col style={{ width: activityIdColumnWidth }} />
                  <col style={{ width: activityNameColumnWidth }} />
                  <col style={{ width: "128px" }} />
                  <col style={{ width: "74px" }} />
                  <col style={{ width: "108px" }} />
                  <col style={{ width: "96px" }} />
                  <col style={{ width: "150px" }} />
                  <col style={{ width: "150px" }} />
                  <col style={{ width: "148px" }} />
                  <col style={{ width: "76px" }} />
                </colgroup>
                <thead className="bg-[var(--panel)]">
                  <tr>
                    <th
                      className="sticky left-0 top-0 z-50 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]"
                      style={{ left: 0 }}
                    >
                      Activity ID
                    </th>
                    <th
                      className="sticky top-0 z-50 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[1px_0_0_0_var(--border),0_1px_0_0_var(--border)]"
                      style={{ left: activityIdColumnWidth }}
                    >
                      Activity
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      Start Date
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      Duration
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      End Date
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      % Complete
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      Predecessor
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      Successor
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      Activity Type
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      Action
                    </th>
                  </tr>
                </thead>
              <tbody>
                {computedSchedule.activities.map((activity) => {
                  const warningText = buildActivityIssueText(activity);
                  const activityTitle = buildActivityTitle(activity);
                  const predecessorDraftKey = buildRelationshipDraftKey(
                    activity.rowKey,
                    "predecessor"
                  );
                  const successorDraftKey = buildRelationshipDraftKey(
                    activity.rowKey,
                    "successor"
                  );

                  return (
                    <tr
                      key={activity.rowKey}
                      className="h-10"
                      style={{ height: rowHeight }}
                      title={activityTitle || undefined}
                      onKeyDown={(event) =>
                        handleActivityRowKeyDown(event, activity.rowKey)
                      }
                    >
                      <td
                        className="sticky left-0 z-30 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 align-middle"
                        style={{ left: 0 }}
                      >
                        <Input
                          value={activity.activityId}
                          onChange={(event) =>
                            handleActivityIdChange(activity.rowKey, event.target.value)
                          }
                          placeholder="A100"
                          className={
                            activity.hasDuplicateId
                              ? `${compactInputClassName} border-amber-400/80`
                              : compactInputClassName
                          }
                          title={
                            activity.hasDuplicateId
                              ? "Duplicate ID. Relationships may be ambiguous."
                              : undefined
                          }
                        />
                      </td>
                      <td
                        className="sticky z-30 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 align-middle shadow-[1px_0_0_0_var(--border)]"
                        style={{ left: activityIdColumnWidth }}
                      >
                        <Input
                          ref={(input) => {
                            if (input) {
                              activityNameInputRefs.current.set(
                                activity.rowKey,
                                input
                              );
                              return;
                            }

                            activityNameInputRefs.current.delete(
                              activity.rowKey
                            );
                          }}
                          value={activity.activityName}
                          onChange={(event) =>
                            updateActivity(activity.rowKey, (currentActivity) => ({
                              ...currentActivity,
                              activityName: event.target.value,
                            }))
                          }
                          placeholder="Describe the activity"
                          className={compactInputClassName}
                        />
                      </td>
                      <td className="h-10 border-b border-[var(--border)] px-2 py-0.5 align-middle">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={
                            dateDraftValues[activity.rowKey] ??
                            formatDisplayDate(activity.startDate)
                          }
                          onChange={(event) =>
                            handleStartDateDraftChange(
                              activity.rowKey,
                              event.target.value
                            )
                          }
                          onBlur={() => clearStartDateDraft(activity.rowKey)}
                          placeholder="DD/MM/YYYY"
                          className={compactInputClassName}
                          title={
                            activity.isLogicDriven
                              ? `Logic start: ${formatDisplayDate(activity.computedStartDate)}`
                              : undefined
                          }
                        />
                      </td>
                      <td className="h-10 border-b border-[var(--border)] px-2 py-0.5 align-middle">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={String(
                            isMilestoneActivity(activity)
                              ? 0
                              : activity.durationDays
                          )}
                          disabled={isMilestoneActivity(activity)}
                          onChange={(event) =>
                            updateActivity(activity.rowKey, (currentActivity) => ({
                              ...currentActivity,
                              ...(isZeroDurationInput(event.target.value)
                                ? {
                                    activityType: "Start Milestone",
                                    durationDays: 0,
                                    percentComplete: 0,
                                  }
                                : {
                                    durationDays: clampDuration(
                                      event.target.value,
                                      currentActivity.activityType
                                    ),
                                  }),
                            }))
                          }
                          className={compactInputClassName}
                        />
                      </td>
                      <td className="h-10 border-b border-[var(--border)] px-2 py-0.5 align-middle">
                        <div
                          className={[
                            "flex h-8 items-center rounded-lg border px-2 text-[11px] font-medium",
                            warningText
                              ? "border-amber-400/70 bg-amber-500/10 text-[var(--foreground)]"
                              : "border-[var(--border)] bg-[var(--panel-soft)]",
                          ].join(" ")}
                          title={activityTitle || undefined}
                        >
                          {formatDisplayDate(activity.computedEndDate)}
                        </div>
                      </td>
                      <td className="h-10 border-b border-[var(--border)] px-2 py-0.5 align-middle">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={String(
                            isMilestoneActivity(activity)
                              ? 0
                              : activity.percentComplete
                          )}
                          disabled={isMilestoneActivity(activity)}
                          onChange={(event) =>
                            updateActivity(activity.rowKey, (currentActivity) => ({
                              ...currentActivity,
                              percentComplete: clampPercentComplete(
                                event.target.value
                              ),
                            }))
                          }
                          className={compactInputClassName}
                        />
                      </td>
                      <td className="h-10 border-b border-[var(--border)] px-2 py-0.5 align-middle">
                        <Input
                          value={
                            relationshipDraftValues[predecessorDraftKey] ??
                            formatRelationshipValue(activity.predecessorIds)
                          }
                          onChange={(event) => {
                            handleRelationshipDraftChange(
                              activity.rowKey,
                              "predecessor",
                              event.target.value
                            );
                            updateActivity(activity.rowKey, (currentActivity) => ({
                              ...currentActivity,
                              predecessorIds: parseRelationshipIds(event.target.value).filter(
                                (predecessorId) =>
                                  predecessorId !==
                                  normalizeRelationshipId(currentActivity.activityId)
                              ),
                            }));
                          }}
                          onBlur={() =>
                            clearRelationshipDraft(activity.rowKey, "predecessor")
                          }
                          placeholder="A100, A120"
                          className={
                            warningText
                              ? `${compactInputClassName} border-amber-400/80`
                              : compactInputClassName
                          }
                          title={activityTitle || undefined}
                        />
                      </td>
                      <td className="h-10 border-b border-[var(--border)] px-2 py-0.5 align-middle">
                        <Input
                          value={
                            relationshipDraftValues[successorDraftKey] ??
                            formatRelationshipValue(activity.successorIds)
                          }
                          onChange={(event) => {
                            handleRelationshipDraftChange(
                              activity.rowKey,
                              "successor",
                              event.target.value
                            );
                            handleSuccessorChange(
                              activity.rowKey,
                              event.target.value
                            );
                          }}
                          onBlur={() =>
                            clearRelationshipDraft(activity.rowKey, "successor")
                          }
                          placeholder="A300, A400"
                          className={compactInputClassName}
                        />
                      </td>
                      <td className="h-10 border-b border-[var(--border)] px-2 py-0.5 align-middle">
                        <select
                          value={activity.activityType}
                          onChange={(event) =>
                            handleActivityTypeChange(
                              activity.rowKey,
                              event.target.value as ActivityType
                            )
                          }
                          className={compactSelectClassName}
                        >
                          {activityTypes.map((activityType) => (
                            <option key={activityType} value={activityType}>
                              {activityType}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="h-10 border-b border-[var(--border)] px-2 py-0.5 align-middle">
                        <button
                          type="button"
                          onClick={() => handleDeleteActivity(activity.rowKey)}
                          className="h-8 rounded-lg border border-[var(--border)] px-2 text-[10px] font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col p-3">
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)]">
          <div
            ref={rightPaneRef}
            onScroll={() => syncPaneScroll("right")}
            className="h-full overflow-auto overscroll-contain"
          >
            <div
              className="relative"
              style={{
                width: ganttContentWidth,
              }}
            >
              <div className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--panel)]">
                <div className="flex">
                  {ganttColumns.map((column) => {
                    return (
                      <div
                        key={column.id}
                        className={[
                          "flex h-10 flex-col items-center justify-center border-r border-[var(--border)] px-1 text-center text-[10px] text-[var(--muted)]",
                          column.isWeekend ? "bg-[var(--panel-soft)]/80" : "",
                        ].join(" ")}
                        style={{ width: ganttCellWidth }}
                        title={`${formatDisplayDate(column.startDate)} to ${formatDisplayDate(column.endDate)}`}
                      >
                        <div className="font-semibold text-[var(--foreground)]">
                          {column.primaryLabel}
                        </div>
                        <div>{column.secondaryLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

                <div className="relative">
                  {todayMarkerLeft !== null ? (
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 z-30"
                      style={{ left: todayMarkerLeft }}
                      title={`Today - ${formatDisplayDate(todayDateValue)}`}
                    >
                      <div className="h-full w-px bg-black shadow-[0_0_0_1px_rgba(0,0,0,0.18)]" />
                      <div className="absolute left-1 top-1 rounded-full bg-black px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white shadow">
                        Today
                      </div>
                    </div>
                  ) : null}
                  <svg
                    className="pointer-events-none absolute inset-0 z-20"
                    width={ganttContentWidth}
                    height={computedSchedule.activities.length * rowHeight}
                    viewBox={`0 0 ${ganttContentWidth} ${
                      computedSchedule.activities.length * rowHeight
                    }`}
                    fill="none"
                    >
                      {ganttConnections.map((connection) => {
                      const sourceBounds = ganttVisualBoundsById.get(
                        connection.fromActivityId
                      );
                      const targetBounds = ganttVisualBoundsById.get(
                        connection.toActivityId
                      );
                      const startX =
                        sourceBounds?.endX ??
                        (connection.fromIsMilestone
                          ? connection.fromOffset * ganttCellWidth +
                            ganttBarInset +
                            ganttMilestoneSize
                          : connection.fromOffset * ganttCellWidth -
                            ganttBarInset);
                      const rawArrowTipX =
                        (targetBounds?.startX ??
                          connection.toOffset * ganttCellWidth +
                            ganttBarInset) - ganttArrowTargetGap;
                      const arrowTipX = rawArrowTipX;
                      const arrowBaseX = arrowTipX - ganttArrowWidth;
                      const startY =
                        connection.fromRowIndex * rowHeight + rowHeight / 2;
                      const endY = connection.toRowIndex * rowHeight + rowHeight / 2;
                      const path = buildGanttConnectionPath({
                        startX,
                        startY,
                        arrowBaseX,
                        endY,
                      });
                      const arrowHead = `M ${arrowBaseX} ${endY - 5} L ${arrowTipX} ${endY} L ${arrowBaseX} ${endY + 5} Z`;
                      const connectionColor = "#94a3b8";

                      return (
                        <g key={connection.id}>
                          <path
                            d={path}
                            stroke={connectionColor}
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d={arrowHead} fill={connectionColor} stroke="none" />
                        </g>
                      );
                    })}
                  </svg>

                  {computedSchedule.activities.map((activity) => {
                  const startOffset = findColumnBoundaryOffsetForDate(
                    ganttColumns,
                    activity.computedStartDate,
                    "start"
                  );
                    const endOffset = findColumnBoundaryOffsetForDate(
                      ganttColumns,
                      activity.computedEndDate,
                      "end"
                    );
                  const barWidth = Math.max(
                    (Math.max(endOffset - startOffset, 1 / 7) * ganttCellWidth) -
                      ganttBarInset * 2,
                    36
                  );
                  const isMilestone = isMilestoneActivity(activity);
                  const activityLabel = activity.activityName || "Untitled";
                  const activityId = normalizeRelationshipId(activity.activityId);
                  const visualBounds = activityId
                    ? ganttVisualBoundsById.get(activityId)
                    : null;
                  const visualStartX =
                    visualBounds?.startX ??
                    Math.max(
                      startOffset * ganttCellWidth + ganttBarInset,
                      ganttBarInset
                    );
                  const visualBarWidth =
                    visualBounds && !visualBounds.isMilestone
                      ? Math.max(visualBounds.endX - visualBounds.startX, 36)
                      : barWidth;
                  const completionPercent = isMilestone
                    ? 0
                    : clampPercentComplete(activity.percentComplete);

                  return (
                    <div
                      key={activity.rowKey}
                      className="relative border-b border-[var(--border)]"
                      style={{ height: rowHeight }}
                      title={buildActivityTitle(activity) || undefined}
                    >
                      <div className="absolute inset-0 flex">
                        {ganttColumns.map((column) => {
                          return (
                            <div
                              key={`${activity.rowKey}-${column.id}`}
                              className={[
                                "border-r border-[var(--border)]",
                                column.isWeekend
                                  ? "bg-[var(--panel)]/60"
                                  : "bg-[var(--panel-soft)]",
                              ].join(" ")}
                              style={{ width: ganttCellWidth }}
                            />
                          );
                        })}
                      </div>

                      <div className="absolute inset-y-0 left-0 right-0 z-10 flex items-center">
                        {isMilestone ? (
                          <div
                            className="flex h-8 items-center gap-2"
                            style={{
                              marginLeft: visualStartX,
                            }}
                            title={`${activity.activityType} - ${activityLabel} - ${formatDisplayDate(activity.computedStartDate)}`}
                          >
                            <span className="h-3.5 w-3.5 rotate-45 bg-black shadow ring-1 ring-white/70" />
                            <span className="whitespace-nowrap rounded-full bg-[var(--panel)] px-2 py-1 text-[10px] font-semibold text-[var(--foreground)] shadow-sm">
                              {activityLabel}
                            </span>
                          </div>
                        ) : (
                          <div
                            className="ml-1 flex h-7 items-center gap-2"
                            style={{
                              marginLeft: visualStartX,
                            }}
                            title={`${activityLabel} - ${formatDisplayDate(activity.computedStartDate)} to ${formatDisplayDate(activity.computedEndDate)}`}
                          >
                            <span
                              className={[
                                "relative h-5 overflow-hidden rounded-lg shadow",
                                activity.hasCircularDependency
                                  ? "bg-amber-500"
                                  : activity.unresolvedPredecessors.length > 0
                                    ? "bg-slate-500"
                                    : "bg-emerald-600",
                              ].join(" ")}
                              style={{ width: visualBarWidth }}
                            >
                              {completionPercent > 0 ? (
                                <span
                                  className="absolute inset-y-0 left-0 bg-blue-500"
                                  style={{ width: `${completionPercent}%` }}
                                />
                              ) : null}
                            </span>
                            <span className="whitespace-nowrap rounded-full bg-[var(--panel)] px-2 py-1 text-[10px] font-semibold text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]">
                              {activityLabel}
                            </span>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}

function computeSchedule(
  activities: SchedulerActivity[],
  expectedStartDate: string | null,
  options: ScheduleComputationOptions = {}
): ScheduleComputation {
  const respectManualStartDates = options.respectManualStartDates ?? true;
  const normalizedStartDate = expectedStartDate || getTodayInputDate();
  const activityIds = activities
    .map((activity) => normalizeRelationshipId(activity.activityId))
    .filter(Boolean);
  const duplicateIds = Array.from(
    activityIds.reduce<Map<string, number>>((counts, activityId) => {
      counts.set(activityId, (counts.get(activityId) ?? 0) + 1);
      return counts;
    }, new Map())
  )
    .filter(([, count]) => count > 1)
    .map(([activityId]) => activityId);
  const firstActivityById = new Map<string, SchedulerActivity>();

  activities.forEach((activity) => {
    const activityId = normalizeRelationshipId(activity.activityId);

    if (
      activityId &&
      !duplicateIds.includes(activityId) &&
      !firstActivityById.has(activityId)
    ) {
      firstActivityById.set(activityId, activity);
    }
  });

  const successorMap = buildSuccessorMap(activities);
  const computedRows = new Map<
    string,
    {
      startDate: string;
      endDate: string;
      unresolvedPredecessors: string[];
      hasCircularDependency: boolean;
      isLogicDriven: boolean;
    }
  >();
  const visiting = new Set<string>();

  function resolveActivity(activity: SchedulerActivity) {
    if (computedRows.has(activity.rowKey)) {
      return computedRows.get(activity.rowKey)!;
    }

    const activityId = normalizeRelationshipId(activity.activityId);
    const startDate =
      parseDateValue(activity.startDate) ?? parseDateValue(normalizedStartDate)!;
    const durationDays = getActivityDurationDays(activity);
    const baseEndDate = addDays(startDate, Math.max(durationDays - 1, 0));

    if (!activityId || duplicateIds.includes(activityId)) {
      const fallbackResult = {
        startDate: toInputDate(startDate),
        endDate: toInputDate(baseEndDate),
        unresolvedPredecessors: activity.predecessorIds.filter(Boolean),
        hasCircularDependency: false,
        isLogicDriven: false,
      };
      computedRows.set(activity.rowKey, fallbackResult);
      return fallbackResult;
    }

    if (visiting.has(activityId)) {
      const cycleResult = {
        startDate: toInputDate(startDate),
        endDate: toInputDate(baseEndDate),
        unresolvedPredecessors: [],
        hasCircularDependency: true,
        isLogicDriven: false,
      };
      computedRows.set(activity.rowKey, cycleResult);
      return cycleResult;
    }

    visiting.add(activityId);

    let computedStart = startDate;
    const relationshipStartCandidates: Date[] = [];
    const unresolvedPredecessors: string[] = [];
    let hasCircularDependency = false;
    let isLogicDriven = false;

    for (const predecessorId of activity.predecessorIds) {
      const predecessorActivity = firstActivityById.get(predecessorId);

      if (!predecessorActivity) {
        unresolvedPredecessors.push(predecessorId);
        continue;
      }

      const predecessorResult = resolveActivity(predecessorActivity);

      if (predecessorResult.hasCircularDependency) {
        hasCircularDependency = true;
      }

      const predecessorEndDate = parseDateValue(predecessorResult.endDate);

      if (!predecessorEndDate) {
        continue;
      }

      const relationshipStart = addDays(predecessorEndDate, 1);
      relationshipStartCandidates.push(relationshipStart);
    }

    if (relationshipStartCandidates.length > 0) {
      const relationshipDrivenStart = maxDate(relationshipStartCandidates);

      if (
        !respectManualStartDates ||
        relationshipDrivenStart.getTime() > computedStart.getTime()
      ) {
        computedStart = relationshipDrivenStart;
        isLogicDriven = true;
      }
    }

    visiting.delete(activityId);

    const result = {
      startDate: toInputDate(computedStart),
      endDate: toInputDate(
        addDays(computedStart, Math.max(durationDays - 1, 0))
      ),
      unresolvedPredecessors,
      hasCircularDependency,
      isLogicDriven,
    };
    computedRows.set(activity.rowKey, result);
    return result;
  }

  const scheduledActivities = activities.map((activity) => {
    const computed = resolveActivity(activity);
    const activityId = normalizeRelationshipId(activity.activityId);

    return {
      ...activity,
      successorIds: activityId ? successorMap.get(activityId) ?? [] : [],
      computedStartDate: computed.startDate,
      computedEndDate: computed.endDate,
      unresolvedPredecessors: computed.unresolvedPredecessors,
      hasCircularDependency: computed.hasCircularDependency,
      hasDuplicateId: activityId ? duplicateIds.includes(activityId) : false,
      isLogicDriven: computed.isLogicDriven,
      totalFloatDays: 0,
      isCritical: false,
    };
  });

  const allDates = scheduledActivities.flatMap((activity) => [
    activity.computedStartDate,
    activity.computedEndDate,
  ]);
  const sortedDates = [...allDates].sort();
  const earliestDate = sortedDates[0] || normalizedStartDate;
  const latestDate = sortedDates.at(-1) || normalizedStartDate;
  const dateRange = buildDateRange(earliestDate, latestDate);

  const activitiesWithCriticalPath = applyCriticalPathMetadata(
    scheduledActivities,
    latestDate
  );

  return {
    activities: activitiesWithCriticalPath,
    duplicateIds,
    dateRange,
    projectStart: earliestDate,
    projectFinish: latestDate,
    totalCalendarDays: Math.max(dateRange.length, 1),
  };
}

function buildSuccessorMap(activities: SchedulerActivity[]) {
  const successorMap = new Map<string, string[]>();

  activities.forEach((activity) => {
    const activityId = normalizeRelationshipId(activity.activityId);

    if (activityId && !successorMap.has(activityId)) {
      successorMap.set(activityId, []);
    }
  });

  activities.forEach((activity) => {
    const activityId = normalizeRelationshipId(activity.activityId);

    if (!activityId) {
      return;
    }

    activity.predecessorIds.forEach((predecessorId) => {
      const nextSuccessors = successorMap.get(predecessorId) ?? [];
      successorMap.set(
        predecessorId,
        mergeRelationshipIds([...nextSuccessors, activityId])
      );
    });
  });

  return successorMap;
}

function applyCriticalPathMetadata(
  activities: ScheduledActivity[],
  projectFinishValue: string
) {
  const projectFinish =
    parseDateValue(projectFinishValue) ?? parseDateValue(getTodayInputDate())!;
  const activityById = new Map<string, ScheduledActivity>();

  activities.forEach((activity) => {
    const activityId = normalizeRelationshipId(activity.activityId);

    if (activityId && !activity.hasDuplicateId) {
      activityById.set(activityId, activity);
    }
  });

  const lateDatesById = new Map<string, ActivityLateDates>();
  const resolvingIds = new Set<string>();

  function isCriticalPathEligible(activity: ScheduledActivity) {
    return (
      !activity.hasDuplicateId &&
      !activity.hasCircularDependency &&
      activity.unresolvedPredecessors.length === 0
    );
  }

  function resolveLateDates(activity: ScheduledActivity): ActivityLateDates {
    const activityId = normalizeRelationshipId(activity.activityId);
    const earlyStart =
      parseDateValue(activity.computedStartDate) ??
      parseDateValue(getTodayInputDate())!;
    const durationDays = getActivityDurationDays(activity);
    const earlyFinish =
      parseDateValue(activity.computedEndDate) ??
      addDays(earlyStart, Math.max(durationDays - 1, 0));

    if (!activityId || !isCriticalPathEligible(activity)) {
      return {
        lateStart: earlyStart,
        lateFinish: earlyFinish,
      };
    }

    const cachedLateDates = lateDatesById.get(activityId);

    if (cachedLateDates) {
      return cachedLateDates;
    }

    if (resolvingIds.has(activityId)) {
      return {
        lateStart: earlyStart,
        lateFinish: earlyFinish,
      };
    }

    resolvingIds.add(activityId);

    const successorLateFinishCandidates = activity.successorIds
      .map((successorId) => activityById.get(successorId))
      .filter(
        (successor): successor is ScheduledActivity => {
          if (!successor) {
            return false;
          }

          return isCriticalPathEligible(successor);
        }
      )
      .map((successor) => addDays(resolveLateDates(successor).lateStart, -1));

    const lateFinish =
      successorLateFinishCandidates.length > 0
        ? minDate(successorLateFinishCandidates)
        : projectFinish;
    const lateStart = addDays(lateFinish, -Math.max(durationDays - 1, 0));
    const lateDates = {
      lateStart,
      lateFinish,
    };

    resolvingIds.delete(activityId);
    lateDatesById.set(activityId, lateDates);
    return lateDates;
  }

  return activities.map((activity) => {
    const earlyStart = parseDateValue(activity.computedStartDate);

    if (!earlyStart || !isCriticalPathEligible(activity)) {
      return {
        ...activity,
        totalFloatDays: 0,
        isCritical: false,
      };
    }

    const { lateStart } = resolveLateDates(activity);
    const totalFloatDays = Math.max(daysBetween(earlyStart, lateStart), 0);

    return {
      ...activity,
      totalFloatDays,
      isCritical: totalFloatDays === 0,
    };
  });
}

function buildGanttConnections(
  activities: ScheduledActivity[],
  columns: GanttColumn[]
): GanttConnection[] {
  const rowIndexById = new Map<string, number>();
  const startOffsetById = new Map<string, number>();
  const endOffsetById = new Map<string, number>();
  const criticalById = new Map<string, boolean>();
  const milestoneById = new Map<string, boolean>();

  activities.forEach((activity, rowIndex) => {
    const activityId = normalizeRelationshipId(activity.activityId);

    if (!activityId) {
      return;
    }

    const startOffset = findColumnBoundaryOffsetForDate(
      columns,
      activity.computedStartDate,
      "start"
    );
    const endOffset = isMilestoneActivity(activity)
      ? startOffset
      : findColumnBoundaryOffsetForDate(
          columns,
          activity.computedEndDate,
          "end"
        );

    rowIndexById.set(activityId, rowIndex);
    criticalById.set(activityId, activity.isCritical);
    milestoneById.set(activityId, isMilestoneActivity(activity));
    startOffsetById.set(activityId, startOffset);
    endOffsetById.set(activityId, endOffset);
  });

  return activities.flatMap((activity) => {
    const targetActivityId = normalizeRelationshipId(activity.activityId);

    if (!targetActivityId) {
      return [];
    }

    const toRowIndex = rowIndexById.get(targetActivityId);
    const toOffset = startOffsetById.get(targetActivityId);

    if (toRowIndex === undefined || toOffset === undefined) {
      return [];
    }

    return activity.predecessorIds.flatMap((predecessorId) => {
      const fromRowIndex = rowIndexById.get(predecessorId);
      const fromOffset = endOffsetById.get(predecessorId);
      const isCritical =
        Boolean(criticalById.get(predecessorId)) &&
        Boolean(criticalById.get(targetActivityId));

      if (fromRowIndex === undefined || fromOffset === undefined) {
        return [];
      }

      return [
        {
          id: `${predecessorId}-${targetActivityId}`,
          fromActivityId: predecessorId,
          toActivityId: targetActivityId,
          fromRowIndex,
          toRowIndex,
          fromOffset,
          toOffset,
          fromIsMilestone: Boolean(milestoneById.get(predecessorId)),
          isCritical,
        },
      ];
    });
  });
}

function buildGanttVisualBounds(
  activities: ScheduledActivity[],
  columns: GanttColumn[],
  ganttCellWidth: number
) {
  const visualBoundsById = new Map<string, GanttVisualBounds>();

  activities.forEach((activity) => {
    const activityId = normalizeRelationshipId(activity.activityId);

    if (!activityId) {
      return;
    }

    const startOffset = findColumnBoundaryOffsetForDate(
      columns,
      activity.computedStartDate,
      "start"
    );
    const endOffset = findColumnBoundaryOffsetForDate(
      columns,
      activity.computedEndDate,
      "end"
    );
    const isMilestone = isMilestoneActivity(activity);
    const startX = Math.max(
      startOffset * ganttCellWidth + ganttBarInset,
      ganttBarInset
    );
    const width = isMilestone
      ? ganttMilestoneSize
      : Math.max(
          Math.max(endOffset - startOffset, 1 / 7) * ganttCellWidth -
            ganttBarInset * 2,
          36
        );

    visualBoundsById.set(activityId, {
      startX,
      endX: startX + width,
      isMilestone,
    });
  });

  return visualBoundsById;
}

function buildGanttConnectionPath({
  startX,
  startY,
  arrowBaseX,
  endY,
}: {
  startX: number;
  startY: number;
  arrowBaseX: number;
  endY: number;
}) {
  const availableRun = arrowBaseX - startX;

  if (availableRun >= ganttMinimumConnectorRun) {
    const elbowX = startX + 16;
    return `M ${startX} ${startY} H ${elbowX} V ${endY} H ${arrowBaseX}`;
  }

  const detourX = startX + 16;
  const approachX = Math.max(
    ganttBarInset,
    Math.min(
      arrowBaseX - ganttTightConnectorLoopWidth,
      startX - ganttTightConnectorLoopWidth
    )
  );
  const approachY =
    endY > startY
      ? endY - ganttTightConnectorLaneOffset
      : endY + ganttTightConnectorLaneOffset;

  return `M ${startX} ${startY} H ${detourX} V ${approachY} H ${approachX} V ${endY} H ${arrowBaseX}`;
}

function buildGanttColumns(
  schedule: ScheduleComputation,
  scale: GanttScale
): GanttColumn[] {
  if (scale === "weeks") {
    return buildWeekColumns(schedule.projectStart, schedule.projectFinish);
  }

  return schedule.dateRange.map((dateValue) => {
    const date = parseDateValue(dateValue) ?? parseDateValue(getTodayInputDate())!;
    const isWeekend = [0, 6].includes(date.getDay());

    return {
      id: dateValue,
      startDate: dateValue,
      endDate: dateValue,
      primaryLabel: formatDateForDisplay(dateValue, dateValue),
      secondaryLabel: "",
      isWeekend,
    };
  });
}

function buildWeekColumns(startDateValue: string, endDateValue: string) {
  const projectStart =
    parseDateValue(startDateValue) ?? parseDateValue(getTodayInputDate())!;
  const projectFinish = parseDateValue(endDateValue) ?? projectStart;
  const weekColumns: GanttColumn[] = [];
  let cursor = startOfWeek(projectStart);

  while (cursor.getTime() <= projectFinish.getTime()) {
    const weekStart = new Date(cursor);
    const weekEnd = endOfWeek(weekStart);

    weekColumns.push({
      id: `${toInputDate(weekStart)}-${toInputDate(weekEnd)}`,
      startDate: toInputDate(weekStart),
      endDate: toInputDate(weekEnd),
      primaryLabel: formatShortDate(weekStart),
      secondaryLabel: formatShortDate(weekEnd),
      isWeekend: false,
    });

    cursor = addDays(weekEnd, 1);
  }

  return weekColumns;
}

function findColumnBoundaryOffsetForDate(
  columns: GanttColumn[],
  dateValue: string,
  boundary: "start" | "end"
) {
  return findGanttDateOffsetForDate(columns, dateValue, boundary) ?? 0;
}

function findGanttDateOffsetForDate(
  columns: GanttColumn[],
  dateValue: string,
  boundary: "start" | "end"
) {
  const targetDate = parseDateValue(dateValue);

  if (!targetDate) {
    return null;
  }

  const columnIndex = columns.findIndex((column) => {
    const columnStart = parseDateValue(column.startDate);
    const columnEnd = parseDateValue(column.endDate);

    if (!columnStart || !columnEnd) {
      return false;
    }

    return (
      targetDate.getTime() >= columnStart.getTime() &&
      targetDate.getTime() <= columnEnd.getTime()
    );
  });

  if (columnIndex < 0) {
    return null;
  }

  const column = columns[columnIndex];
  const columnStart = parseDateValue(column.startDate);
  const columnEnd = parseDateValue(column.endDate);

  if (!columnStart || !columnEnd) {
    return null;
  }

  const totalDays =
    Math.max(
      Math.round(
        (columnEnd.getTime() - columnStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1,
      1
    );
  const dayIndex = Math.min(
    Math.max(
      Math.round(
        (targetDate.getTime() - columnStart.getTime()) / (1000 * 60 * 60 * 24)
      ),
      0
    ),
    totalDays - 1
  );

  return (
    columnIndex +
    (boundary === "start" ? dayIndex : dayIndex + 1) / totalDays
  );
}

function buildDateRange(startDateValue: string, endDateValue: string) {
  const startDate =
    parseDateValue(startDateValue) ?? parseDateValue(getTodayInputDate())!;
  const endDate = parseDateValue(endDateValue) ?? startDate;
  const dates: string[] = [];
  let cursor = new Date(startDate);

  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(toInputDate(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates.length > 0 ? dates : [toInputDate(startDate)];
}

function buildActivityIssueText(activity: ScheduledActivity) {
  const warnings: string[] = [];

  if (activity.hasDuplicateId) {
    warnings.push("Duplicate ID. Relationships may be ambiguous.");
  }

  if (activity.unresolvedPredecessors.length > 0) {
    warnings.push(
      `Unknown predecessors: ${activity.unresolvedPredecessors.join(", ")}`
    );
  }

  if (activity.hasCircularDependency) {
    warnings.push("Circular logic detected in this activity chain.");
  }

  return warnings.join(" ");
}

function buildActivityTitle(activity: ScheduledActivity) {
  const parts = [buildActivityIssueText(activity)];

  if (activity.isLogicDriven) {
    parts.push(`Logic start: ${formatDisplayDate(activity.computedStartDate)}`);
  }

  return parts.filter(Boolean).join(" ");
}

function getSchedulerBlockingSaveIssue(schedule: ScheduleComputation) {
  if (
    schedule.activities.some(
      (activity) => normalizeRelationshipId(activity.activityId) === ""
    )
  ) {
    return "Activity IDs required";
  }

  if (schedule.duplicateIds.length > 0) {
    return "Fix duplicate IDs";
  }

  return "";
}

function getSaveStatusClassName(status: SchedulerSaveStatus) {
  if (status === "saving" || status === "loading") {
    return "border-amber-500/60 bg-amber-100 dark:border-amber-400/50 dark:bg-amber-500/15";
  }

  if (status === "saved") {
    return "border-emerald-600/50 bg-emerald-100 dark:border-emerald-400/50 dark:bg-emerald-500/15";
  }

  if (status === "blocked" || status === "error") {
    return "border-red-600/50 bg-red-100 dark:border-red-400/50 dark:bg-red-500/15";
  }

  return "border-[var(--border)] bg-[var(--input-bg)]";
}

function buildNextActivityId(activities: SchedulerActivity[]) {
  const numericValues = activities
    .map((activity) => {
      const match = /\d+/.exec(activity.activityId);
      return match ? Number(match[0]) : 0;
    })
    .filter((value) => Number.isFinite(value));
  const nextValue = (Math.max(0, ...numericValues) || 0) + 10;

  return `A${String(nextValue).padStart(3, "0")}`;
}

function buildBlankActivity(
  activities: SchedulerActivity[],
  startDate: string
): SchedulerActivity {
  return {
    rowKey: createRowKey(),
    activityId: buildNextActivityId(activities),
    activityName: "",
    activityType: "Task Dependent",
    startDate,
    durationDays: 5,
    percentComplete: 0,
    predecessorIds: [],
  };
}

function isMilestoneActivityType(activityType: ActivityType) {
  return activityType === "Start Milestone" || activityType === "Finish Milestone";
}

function isMilestoneActivity(activity: SchedulerActivity) {
  return isMilestoneActivityType(activity.activityType);
}

function getActivityDurationDays(activity: SchedulerActivity) {
  return clampDuration(activity.durationDays, activity.activityType);
}

function clampDuration(
  value: string | number,
  activityType: ActivityType = "Task Dependent"
) {
  const numericValue = Number(value);
  const minimumDuration = isMilestoneActivityType(activityType) ? 0 : 1;

  if (!Number.isFinite(numericValue) || numericValue < minimumDuration) {
    return minimumDuration;
  }

  return Math.round(numericValue);
}

function clampPercentComplete(value: string | number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  if (numericValue > 100) {
    return 100;
  }

  return Math.round(numericValue);
}

function isZeroDurationInput(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue !== "" && Number(trimmedValue) === 0;
}

function normalizeRelationshipId(value: string) {
  return value.trim().toUpperCase();
}

function parseRelationshipIds(value: string) {
  return mergeRelationshipIds(
    value
      .split(/[,\n]+/g)
      .map((entry) => normalizeRelationshipId(entry))
      .filter(Boolean)
  );
}

function mergeRelationshipIds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatRelationshipValue(values: string[]) {
  return values.join(", ");
}

function buildRelationshipDraftKey(rowKey: string, field: RelationshipField) {
  return `${rowKey}:${field}`;
}

function parseDateValue(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDisplayDateInputToInputDate(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return buildInputDateFromParts(day, month, year);
  }

  const compactMatch = /^(\d{2})(\d{2})(\d{4})$/.exec(trimmedValue);

  if (compactMatch) {
    const [, day, month, year] = compactMatch;
    return buildInputDateFromParts(day, month, year);
  }

  const displayMatch = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(
    trimmedValue
  );

  if (!displayMatch) {
    return null;
  }

  const [, day, month, year] = displayMatch;
  return buildInputDateFromParts(day, month, year);
}

function buildInputDateFromParts(
  dayValue: string,
  monthValue: string,
  yearValue: string
) {
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year)
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return toInputDate(date);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function daysBetween(startDate: Date, endDate: Date) {
  return Math.round(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function minDate(dates: Date[]) {
  return dates.reduce((earliestDate, date) =>
    date.getTime() < earliestDate.getTime() ? date : earliestDate
  );
}

function maxDate(dates: Date[]) {
  return dates.reduce((latestDate, date) =>
    date.getTime() > latestDate.getTime() ? date : latestDate
  );
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDaysToInputDate(value: string, days: number) {
  const parsedDate =
    parseDateValue(value) ?? parseDateValue(getTodayInputDate())!;
  return toInputDate(addDays(parsedDate, days));
}

function getTodayInputDate() {
  return toInputDate(new Date());
}

function formatDisplayDate(value: string) {
  return formatDateForDisplay(value, "--");
}

function formatShortDate(value: Date) {
  return formatDateForDisplay(toInputDate(value), "--");
}

function startOfWeek(date: Date) {
  const normalizedDate = new Date(date);
  const day = normalizedDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalizedDate.setDate(normalizedDate.getDate() + diff);
  return normalizedDate;
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function createRowKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = char === "x" ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}
