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
import { getSchedulerCostCodeItemOptions } from "@/features/projects/services/get-scheduler-cost-code-item-options";
import { getProjectScheduler } from "@/features/projects/services/get-project-scheduler";
import { saveProjectScheduler } from "@/features/projects/services/save-project-scheduler";
import type {
  SchedulerActivity,
  SchedulerCostCodeItemOption,
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

type StartDateSortMode = "normal" | "ascending" | "descending";

type RelationshipField = "predecessor" | "successor";

type SchedulerSaveStatus = "loading" | "idle" | "saving" | "saved" | "blocked" | "error";

type SchedulerWorkspaceMode = "schedule" | "report";

type ActivityResourceCostDraft = {
  costCodeItem: string;
  activityBucket: string;
  estimatedQuantity: string;
  unit: string;
  materialCost: string;
  labourCost: string;
  equipmentCost: string;
};

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

type SchedulerReportUnitRow = {
  activityBucket: string;
  unit: string;
  estimatedQuantity: number;
  activityCount: number;
  materialCost: number;
  labourCost: number;
  equipmentCost: number;
};

type SchedulerReportFloorGroup = {
  floor: string;
  unitRows: SchedulerReportUnitRow[];
  activityCount: number;
  materialCost: number;
  labourCost: number;
  equipmentCost: number;
};

type SchedulerReportCostCodeGroup = {
  key: string;
  costCode: string;
  item: string;
  floorGroups: SchedulerReportFloorGroup[];
  activityCount: number;
  materialCost: number;
  labourCost: number;
  equipmentCost: number;
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
const schedulerFloorOptions = [
  "Foundation",
  "Basement 1",
  "Basement 2",
  "Basement 3",
  "Basement 4",
  "Basement 5",
  "Ground Floor",
  "Stilt",
  "Podium",
  ...Array.from({ length: 40 }, (_, index) => String(index + 1)),
  "Terrace",
];
const schedulerUnitOptions = ["sq.ft", "cu.m", "kg", "LF"];
const schedulerActivityBucketOptions = [
  "Shuttering",
  "Casting",
  "Rebar",
  "Flooring",
  "Brickwork",
  "Interior Paint",
  "Exterior Paint",
  "Electrical Conduiting",
  "Plumbing Pipe",
];
const emptyResourceCostDraft: ActivityResourceCostDraft = {
  costCodeItem: "",
  activityBucket: "",
  estimatedQuantity: "",
  unit: "",
  materialCost: "",
  labourCost: "",
  equipmentCost: "",
};
const inrCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inrUnitCostFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const quantityFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 3,
});
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
  const [startDateSortMode, setStartDateSortMode] =
    useState<StartDateSortMode>("normal");
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [isLoadingCostCodeItems, setIsLoadingCostCodeItems] = useState(true);
  const [saveStatus, setSaveStatus] =
    useState<SchedulerSaveStatus>("loading");
  const [saveStatusMessage, setSaveStatusMessage] =
    useState("Loading schedule...");
  const [activities, setActivities] = useState<SchedulerActivity[]>([]);
  const [workspaceMode, setWorkspaceMode] =
    useState<SchedulerWorkspaceMode>("schedule");
  const [costCodeItemOptions, setCostCodeItemOptions] = useState<
    SchedulerCostCodeItemOption[]
  >([]);
  const [todayDateValue] = useState(() => getTodayInputDate());
  const [relationshipDraftValues, setRelationshipDraftValues] = useState<
    Record<string, string>
  >({});
  const [dateDraftValues, setDateDraftValues] = useState<
    Record<string, string>
  >({});
  const [resourceDialogRowKey, setResourceDialogRowKey] = useState<
    string | null
  >(null);
  const [resourceCostDraft, setResourceCostDraft] =
    useState<ActivityResourceCostDraft>(emptyResourceCostDraft);

  const computedSchedule = useMemo(
    () => computeSchedule(activities, project.expected_start_date),
    [activities, project.expected_start_date]
  );
  const displayedActivities = useMemo(
    () =>
      getSortedScheduledActivities(
        computedSchedule.activities,
        startDateSortMode
      ),
    [computedSchedule.activities, startDateSortMode]
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
    () => buildGanttConnections(displayedActivities, ganttColumns),
    [displayedActivities, ganttColumns]
  );
  const ganttVisualBoundsById = useMemo(
    () =>
      buildGanttVisualBounds(
        displayedActivities,
        ganttColumns,
        ganttCellWidth
      ),
    [displayedActivities, ganttColumns, ganttCellWidth]
  );
  const todayMarkerOffset = useMemo(
    () => findGanttDateOffsetForDate(ganttColumns, todayDateValue, "start"),
    [ganttColumns, todayDateValue]
  );
  const todayMarkerLeft =
    todayMarkerOffset === null ? null : todayMarkerOffset * ganttCellWidth;
  const selectedResourceActivity = useMemo(
    () =>
      resourceDialogRowKey
        ? computedSchedule.activities.find(
            (activity) => activity.rowKey === resourceDialogRowKey
          ) ?? null
        : null,
    [computedSchedule.activities, resourceDialogRowKey]
  );
  const resourceDraftTotal =
    parseMoneyInput(resourceCostDraft.materialCost) +
    parseMoneyInput(resourceCostDraft.labourCost) +
    parseMoneyInput(resourceCostDraft.equipmentCost);
  const selectedResourceCostCodeOption = useMemo(
    () =>
      findCostCodeItemOption(
        resourceCostDraft.costCodeItem,
        costCodeItemOptions
      ),
    [costCodeItemOptions, resourceCostDraft.costCodeItem]
  );
  const schedulerReportGroups = useMemo(
    () =>
      buildSchedulerReportGroups(
        computedSchedule.activities,
        costCodeItemOptions
      ),
    [computedSchedule.activities, costCodeItemOptions]
  );

  useEffect(() => {
    scheduleIdRef.current = scheduleId;
  }, [scheduleId]);

  useEffect(() => {
    let isCancelled = false;

    getSchedulerCostCodeItemOptions()
      .then((options) => {
        if (isCancelled) {
          return;
        }

        setCostCodeItemOptions(options);
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        console.error("Error loading scheduler cost code item options:", error);
        setCostCodeItemOptions([]);
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }

        setIsLoadingCostCodeItems(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

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
        setWorkspaceMode("schedule");
        setRelationshipDraftValues({});
        setDateDraftValues({});
        setResourceDialogRowKey(null);
        setResourceCostDraft(emptyResourceCostDraft);
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

  function handleStartDateSortToggle() {
    setStartDateSortMode((currentSortMode) => {
      if (currentSortMode === "normal") {
        return "ascending";
      }

      if (currentSortMode === "ascending") {
        return "descending";
      }

      return "normal";
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
    if (handleVerticalCellNavigation(event)) {
      return;
    }

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

  function handleVerticalCellNavigation(
    event: KeyboardEvent<HTMLTableRowElement>
  ) {
    if (
      (event.key !== "ArrowDown" && event.key !== "ArrowUp") ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return false;
    }

    const activeElement = event.target;

    if (!(activeElement instanceof HTMLInputElement)) {
      return false;
    }

    const currentCell = activeElement.closest("td");
    const currentRow = event.currentTarget;
    const tableBody = currentRow.parentElement;

    if (!currentCell || !tableBody) {
      return false;
    }

    const rowOffset = event.key === "ArrowDown" ? 1 : -1;
    const targetRow = tableBody.children.item(
      currentRow.sectionRowIndex + rowOffset
    );

    if (!(targetRow instanceof HTMLTableRowElement)) {
      return false;
    }

    const targetCell = targetRow.cells.item(currentCell.cellIndex);
    const targetControl = targetCell?.querySelector<
      HTMLInputElement | HTMLSelectElement
    >("input:not(:disabled), select:not(:disabled)");

    if (!targetControl) {
      return false;
    }

    event.preventDefault();
    targetControl.focus();

    if (targetControl instanceof HTMLInputElement) {
      targetControl.select();
    }

    return true;
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

  function getActivityEstimatedCost(activity: SchedulerActivity) {
    return (
      activity.materialCost + activity.labourCost + activity.equipmentCost
    );
  }

  function handleOpenResourceDialog(activity: ScheduledActivity) {
    setResourceDialogRowKey(activity.rowKey);
    setResourceCostDraft({
      costCodeItem: activity.costCodeItem,
      activityBucket: activity.activityBucket,
      estimatedQuantity: formatQuantityDraftValue(activity.estimatedQuantity),
      unit: activity.unit,
      materialCost: formatMoneyDraftValue(activity.materialCost),
      labourCost: formatMoneyDraftValue(activity.labourCost),
      equipmentCost: formatMoneyDraftValue(activity.equipmentCost),
    });
  }

  function handleCloseResourceDialog() {
    setResourceDialogRowKey(null);
    setResourceCostDraft(emptyResourceCostDraft);
  }

  function handleResourceCostDraftChange(
    field: keyof ActivityResourceCostDraft,
    nextValue: string
  ) {
    setResourceCostDraft((currentDraft) => ({
      ...currentDraft,
      [field]: nextValue,
    }));
  }

  function handleSaveResourceCosts() {
    if (!resourceDialogRowKey) {
      return;
    }

    updateActivity(resourceDialogRowKey, (activity) => ({
      ...activity,
      costCodeItem: normalizeCostCodeItem(resourceCostDraft.costCodeItem),
      activityBucket: normalizeActivityBucket(resourceCostDraft.activityBucket),
      estimatedQuantity: parseQuantityInput(
        resourceCostDraft.estimatedQuantity
      ),
      unit: resourceCostDraft.unit,
      materialCost: parseMoneyInput(resourceCostDraft.materialCost),
      labourCost: parseMoneyInput(resourceCostDraft.labourCost),
      equipmentCost: parseMoneyInput(resourceCostDraft.equipmentCost),
    }));
    handleCloseResourceDialog();
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-[var(--foreground)]">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 shadow-[var(--shadow-lg)]">
        {workspaceMode === "report" ? (
          <button
            type="button"
            onClick={() => setWorkspaceMode("schedule")}
            className="inline-flex h-9 items-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 text-xs font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:border-[var(--border-strong)]"
          >
            Back
          </button>
        ) : (
          <>
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
              <button
                type="button"
                onClick={() => setWorkspaceMode("report")}
                className="h-9 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 text-xs font-semibold text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:border-[var(--border-strong)]"
              >
                Report
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
          </>
        )}
      </div>

      {isLoadingSchedule ? (
        <Card className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-6 py-4 text-sm font-semibold text-[var(--foreground)]">
            Loading schedule...
          </div>
        </Card>
      ) : workspaceMode === "report" ? (
        <SchedulerReportView reportGroups={schedulerReportGroups} />
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
          <Card className="flex min-h-0 flex-col p-3">
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
            <div
              ref={leftPaneRef}
              onScroll={() => syncPaneScroll("left")}
              className="relative isolate h-full overflow-auto overscroll-contain bg-[var(--panel)]"
            >
              <table className="w-full min-w-[1712px] table-fixed border-separate border-spacing-0 text-left text-[11px]">
                <colgroup>
                  <col style={{ width: activityIdColumnWidth }} />
                  <col style={{ width: activityNameColumnWidth }} />
                  <col style={{ width: "128px" }} />
                  <col style={{ width: "74px" }} />
                  <col style={{ width: "108px" }} />
                  <col style={{ width: "96px" }} />
                  <col style={{ width: "150px" }} />
                  <col style={{ width: "150px" }} />
                  <col style={{ width: "112px" }} />
                  <col style={{ width: "112px" }} />
                  <col style={{ width: "132px" }} />
                  <col style={{ width: "148px" }} />
                  <col style={{ width: "104px" }} />
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
                      <button
                        type="button"
                        onClick={handleStartDateSortToggle}
                        className="flex w-full items-center justify-between gap-1 text-left uppercase tracking-[0.14em] transition duration-200 hover:cursor-pointer hover:text-[var(--foreground)]"
                        title="Toggle start date sort: normal, ascending, descending"
                        aria-label={`Start date sort is ${startDateSortMode}. Click to change.`}
                      >
                        <span>Start Date</span>
                        <span className="text-[11px] font-bold tracking-normal text-[var(--foreground)]">
                          {getStartDateSortIndicator(startDateSortMode)}
                        </span>
                      </button>
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
                      Floor
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      Cost Code
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      Estimated Cost
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
                {displayedActivities.map((activity) => {
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
                  const costCodeOption = findCostCodeItemOption(
                    activity.costCodeItem,
                    costCodeItemOptions
                  );
                  const costCodeDisplay =
                    costCodeOption?.costCode ??
                    (activity.costCodeItem && isLoadingCostCodeItems
                      ? "Loading..."
                      : "-");

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
                          value={activity.floor}
                          onChange={(event) =>
                            updateActivity(activity.rowKey, (currentActivity) => ({
                              ...currentActivity,
                              floor: event.target.value,
                            }))
                          }
                          className={compactSelectClassName}
                        >
                          <option value="">Select</option>
                          {schedulerFloorOptions.map((floorOption) => (
                            <option key={floorOption} value={floorOption}>
                              {floorOption}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="h-10 border-b border-[var(--border)] px-2 py-0.5 align-middle">
                        <div
                          className="flex h-8 items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-2 text-[11px] font-semibold text-[var(--foreground)]"
                          title={
                            activity.costCodeItem
                              ? `${activity.costCodeItem}${
                                  costCodeOption
                                    ? ` (${costCodeOption.costCode})`
                                    : ""
                                }`
                              : "No cost code item selected"
                          }
                        >
                          {costCodeDisplay}
                        </div>
                      </td>
                      <td className="h-10 border-b border-[var(--border)] px-2 py-0.5 align-middle">
                        <div
                          className="flex h-8 items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-2 text-[11px] font-semibold text-[var(--foreground)]"
                          title="Material + Labour + Equipment"
                        >
                          {formatCurrencyInr(
                            getActivityEstimatedCost(activity)
                          )}
                        </div>
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
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenResourceDialog(activity)}
                            aria-label={`Add resources for ${
                              activity.activityName || activity.activityId
                            }`}
                            title="Add resources"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:border-green-500 hover:text-green-600 dark:hover:text-green-300"
                          >
                            <UserPlusIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(activity.rowKey)}
                            className="h-8 rounded-lg border border-[var(--border)] px-2 text-[10px] font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-red-400 hover:text-red-600 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
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
                    height={displayedActivities.length * rowHeight}
                    viewBox={`0 0 ${ganttContentWidth} ${
                      displayedActivities.length * rowHeight
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

                  {displayedActivities.map((activity) => {
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

      {selectedResourceActivity ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scheduler-resource-dialog-title"
          onClick={handleCloseResourceDialog}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--subtle)]">
                  Resource Loading
                </p>
                <h2
                  id="scheduler-resource-dialog-title"
                  className="mt-1 text-2xl font-semibold tracking-tight"
                >
                  {selectedResourceActivity.activityName || "Untitled Activity"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {selectedResourceActivity.activityId || "No activity ID"} -
                  add the PM&apos;s estimated resource cost split.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseResourceDialog}
                className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2 text-xs font-medium text-[var(--foreground)] transition duration-200 hover:cursor-pointer hover:border-[var(--border-strong)]"
              >
                Close
              </button>
            </div>

            <div className="mt-6">
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
                  Cost Code Item
                </span>
                <SearchableSchedulerCostCodeItemInput
                  value={resourceCostDraft.costCodeItem}
                  itemOptions={costCodeItemOptions}
                  isLoadingItems={isLoadingCostCodeItems}
                  onChange={(nextValue) =>
                    handleResourceCostDraftChange("costCodeItem", nextValue)
                  }
                />
              </label>
              {selectedResourceCostCodeOption ? (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Tagged to {selectedResourceCostCodeOption.item} (
                  {selectedResourceCostCodeOption.costCode})
                </p>
              ) : null}
            </div>

            <div className="mt-5">
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
                  Activity Bucket
                </span>
                <SearchableSchedulerActivityBucketInput
                  value={resourceCostDraft.activityBucket}
                  bucketOptions={schedulerActivityBucketOptions}
                  onChange={(nextValue) =>
                    handleResourceCostDraftChange("activityBucket", nextValue)
                  }
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
                  Estimated Quantity
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={resourceCostDraft.estimatedQuantity}
                  onChange={(event) =>
                    handleResourceCostDraftChange(
                      "estimatedQuantity",
                      event.target.value
                    )
                  }
                  placeholder="0"
                  className="h-11 rounded-xl text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
                  Unit
                </span>
                <select
                  value={resourceCostDraft.unit}
                  onChange={(event) =>
                    handleResourceCostDraftChange("unit", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition duration-200 focus:border-[var(--border-strong)]"
                >
                  <option value="">Select unit</option>
                  {schedulerUnitOptions.map((unitOption) => (
                    <option key={unitOption} value={unitOption}>
                      {unitOption}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
                  Material Cost
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={resourceCostDraft.materialCost}
                  onChange={(event) =>
                    handleResourceCostDraftChange(
                      "materialCost",
                      event.target.value
                    )
                  }
                  placeholder="0"
                  className="h-11 rounded-xl text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
                  Labour Cost
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={resourceCostDraft.labourCost}
                  onChange={(event) =>
                    handleResourceCostDraftChange(
                      "labourCost",
                      event.target.value
                    )
                  }
                  placeholder="0"
                  className="h-11 rounded-xl text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
                  Equipment Cost
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={resourceCostDraft.equipmentCost}
                  onChange={(event) =>
                    handleResourceCostDraftChange(
                      "equipmentCost",
                      event.target.value
                    )
                  }
                  placeholder="0"
                  className="h-11 rounded-xl text-sm"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--subtle)]">
                Estimated Cost
              </span>
              <span className="text-xl font-semibold text-[var(--foreground)]">
                {formatCurrencyInr(resourceDraftTotal)}
              </span>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseResourceDialog}
                className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2 text-xs font-medium text-[var(--foreground)] transition duration-200 hover:cursor-pointer hover:border-[var(--border-strong)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveResourceCosts}
                className="rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
              >
                Save Resources
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SchedulerReportViewProps = {
  reportGroups: SchedulerReportCostCodeGroup[];
};

function SchedulerReportView({ reportGroups }: SchedulerReportViewProps) {
  const totalActivities = reportGroups.reduce(
    (sum, group) => sum + group.activityCount,
    0
  );
  const totalEstimatedCost = reportGroups.reduce(
    (sum, group) => sum + getReportGroupEstimatedCost(group),
    0
  );

  return (
    <Card className="min-h-0 flex-1 overflow-hidden p-3">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
        <div className="border-b border-[var(--border)] bg-[var(--panel-soft)] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--subtle)]">
            Schedule Report
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Cost Code and Floor Summary
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Estimated quantities are grouped by cost code, floor, and unit.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                  Activities
                </p>
                <p className="mt-1 text-lg font-semibold">{totalActivities}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                  Estimated Cost
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrencyInr(totalEstimatedCost)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {reportGroups.length === 0 ? (
            <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-6 text-center">
              <div>
                <p className="text-lg font-semibold">No report data yet</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                  Add cost code items, floors, activity buckets, estimated
                  quantities, and units in resource loading to generate this
                  summary.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {reportGroups.map((group) => (
                <section
                  key={group.key}
                  className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--subtle)]">
                        Cost Code
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">
                        {group.costCode}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {group.item}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                        {group.activityCount} activities
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1 font-semibold text-[var(--foreground)]">
                        {formatCurrencyInr(getReportGroupEstimatedCost(group))}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--border)]">
                    {group.floorGroups.map((floorGroup) => (
                      <div key={floorGroup.floor} className="p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
                              Floor
                            </p>
                            <h4 className="mt-1 font-semibold">
                              {floorGroup.floor}
                            </h4>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-[var(--panel-soft)] px-3 py-1 text-[var(--muted)]">
                              {floorGroup.activityCount} activities
                            </span>
                            <span className="rounded-full bg-[var(--panel-soft)] px-3 py-1 font-semibold">
                              {formatCurrencyInr(
                                getReportFloorEstimatedCost(floorGroup)
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
                            <thead className="bg-[var(--panel)]">
                              <tr>
                                <th className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                  Activity Bucket
                                </th>
                                <th className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                  Unit
                                </th>
                                <th className="border-b border-[var(--border)] px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                  Estimated Quantity
                                </th>
                                <th className="border-b border-[var(--border)] px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                  Activities
                                </th>
                                <th className="border-b border-[var(--border)] px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                  Material
                                </th>
                                <th className="border-b border-[var(--border)] px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                  Labour
                                </th>
                                <th className="border-b border-[var(--border)] px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                  Equipment
                                </th>
                                <th className="border-b border-[var(--border)] px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                  Estimated Cost
                                </th>
                                <th className="border-b border-[var(--border)] px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                  Unit Cost
                                </th>
                                <th className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                  Unit Cost Unit
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {floorGroup.unitRows.map((row) => (
                                <tr key={row.activityBucket}>
                                  <td className="border-b border-[var(--border)] px-3 py-2 font-semibold">
                                    {row.activityBucket}
                                  </td>
                                  <td className="border-b border-[var(--border)] px-3 py-2 text-[var(--muted)]">
                                    {row.unit}
                                  </td>
                                  <td className="border-b border-[var(--border)] px-3 py-2 text-right font-semibold">
                                    {formatQuantity(row.estimatedQuantity)}
                                  </td>
                                  <td className="border-b border-[var(--border)] px-3 py-2 text-right text-[var(--muted)]">
                                    {row.activityCount}
                                  </td>
                                  <td className="border-b border-[var(--border)] px-3 py-2 text-right">
                                    {formatCurrencyInr(row.materialCost)}
                                  </td>
                                  <td className="border-b border-[var(--border)] px-3 py-2 text-right">
                                    {formatCurrencyInr(row.labourCost)}
                                  </td>
                                  <td className="border-b border-[var(--border)] px-3 py-2 text-right">
                                    {formatCurrencyInr(row.equipmentCost)}
                                  </td>
                                  <td className="border-b border-[var(--border)] px-3 py-2 text-right font-semibold">
                                    {formatCurrencyInr(
                                      getReportUnitEstimatedCost(row)
                                    )}
                                  </td>
                                  <td className="border-b border-[var(--border)] px-3 py-2 text-right font-semibold">
                                    {formatReportUnitCost(row)}
                                  </td>
                                  <td className="border-b border-[var(--border)] px-3 py-2 text-[var(--muted)]">
                                    {formatReportUnitCostUnit(row.unit)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

type SearchableSchedulerCostCodeItemInputProps = {
  value: string;
  itemOptions: SchedulerCostCodeItemOption[];
  isLoadingItems: boolean;
  onChange: (value: string) => void;
};

type SearchableSchedulerActivityBucketInputProps = {
  value: string;
  bucketOptions: string[];
  onChange: (value: string) => void;
};

function SearchableSchedulerActivityBucketInput({
  value,
  bucketOptions,
  onChange,
}: SearchableSchedulerActivityBucketInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const visibleOptions = useMemo(() => {
    const normalizedValue = normalizeActivityBucket(value).toLowerCase();
    const matches = bucketOptions.filter((option) => {
      if (!normalizedValue) {
        return true;
      }

      return option.toLowerCase().includes(normalizedValue);
    });

    return matches
      .sort((left, right) => {
        const leftStartsWith = normalizedValue
          ? left.toLowerCase().startsWith(normalizedValue)
          : false;
        const rightStartsWith = normalizedValue
          ? right.toLowerCase().startsWith(normalizedValue)
          : false;

        return (
          Number(rightStartsWith) - Number(leftStartsWith) ||
          left.localeCompare(right)
        );
      })
      .slice(0, 8);
  }, [bucketOptions, value]);
  const activeHighlightedIndex =
    visibleOptions.length === 0
      ? 0
      : Math.min(highlightedIndex, visibleOptions.length - 1);

  function handleSelectBucket(option: string) {
    onChange(option);
    setIsOpen(false);
    setHighlightedIndex(0);
  }

  return (
    <div className="relative">
      <Input
        className="h-11 rounded-xl text-sm"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => {
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (visibleOptions.length === 0) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((previousIndex) =>
              Math.min(previousIndex + 1, visibleOptions.length - 1)
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((previousIndex) =>
              Math.max(previousIndex - 1, 0)
            );
            return;
          }

          if (event.key === "Tab" || event.key === "Enter") {
            if (isOpen) {
              event.preventDefault();
              handleSelectBucket(
                visibleOptions[activeHighlightedIndex] ?? visibleOptions[0]
              );
            }
          }
        }}
        placeholder="Type to search activity buckets"
      />

      {isOpen && visibleOptions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
          <ul className="max-h-64 divide-y divide-[var(--border)] overflow-y-auto">
            {visibleOptions.map((option, index) => (
              <li key={option}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelectBucket(option)}
                  className={[
                    "flex w-full px-3 py-2 text-left text-xs font-medium transition duration-150",
                    activeHighlightedIndex === index
                      ? "bg-[var(--surface)] text-[var(--foreground)]"
                      : "bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--surface)]",
                  ].join(" ")}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SearchableSchedulerCostCodeItemInput({
  value,
  itemOptions,
  isLoadingItems,
  onChange,
}: SearchableSchedulerCostCodeItemInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const visibleOptions = useMemo(() => {
    const normalizedValue = normalizeCostCodeItem(value).toLowerCase();
    const matches = itemOptions.filter((option) => {
      if (!normalizedValue) {
        return true;
      }

      return (
        normalizeCostCodeItem(option.item)
          .toLowerCase()
          .includes(normalizedValue) ||
        option.costCode.toLowerCase().includes(normalizedValue)
      );
    });

    return matches
      .sort((left, right) => {
        const leftItem = normalizeCostCodeItem(left.item).toLowerCase();
        const rightItem = normalizeCostCodeItem(right.item).toLowerCase();
        const leftStartsWith = normalizedValue
          ? leftItem.startsWith(normalizedValue)
          : false;
        const rightStartsWith = normalizedValue
          ? rightItem.startsWith(normalizedValue)
          : false;

        return (
          Number(rightStartsWith) - Number(leftStartsWith) ||
          left.item.localeCompare(right.item) ||
          left.costCode.localeCompare(right.costCode)
        );
      })
      .slice(0, 8);
  }, [itemOptions, value]);
  const activeHighlightedIndex =
    visibleOptions.length === 0
      ? 0
      : Math.min(highlightedIndex, visibleOptions.length - 1);

  function handleSelectItem(option: SchedulerCostCodeItemOption) {
    onChange(option.item);
    setIsOpen(false);
    setHighlightedIndex(0);
  }

  return (
    <div className="relative">
      <Input
        className="h-11 rounded-xl text-sm"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => {
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (visibleOptions.length === 0) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((previousIndex) =>
              Math.min(previousIndex + 1, visibleOptions.length - 1)
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((previousIndex) =>
              Math.max(previousIndex - 1, 0)
            );
            return;
          }

          if (event.key === "Tab" || event.key === "Enter") {
            if (isOpen) {
              event.preventDefault();
              handleSelectItem(
                visibleOptions[activeHighlightedIndex] ?? visibleOptions[0]
              );
            }
          }
        }}
        placeholder={
          isLoadingItems
            ? "Loading cost code items..."
            : itemOptions.length === 0
              ? "No cost code items available"
              : "Type to search cost code items"
        }
      />

      {isOpen && !isLoadingItems && visibleOptions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
          <ul className="max-h-64 divide-y divide-[var(--border)] overflow-y-auto">
            {visibleOptions.map((option, index) => (
              <li key={`${option.item}-${option.costCode}`}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelectItem(option)}
                  className={[
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition duration-150",
                    activeHighlightedIndex === index
                      ? "bg-[var(--surface)] text-[var(--foreground)]"
                      : "bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--surface)]",
                  ].join(" ")}
                >
                  <span className="font-medium">{option.item}</span>
                  <span className="shrink-0 text-[10px] text-[var(--subtle)]">
                    {option.costCode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function UserPlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M3.5 21a6.5 6.5 0 0 1 13 0" />
      <path d="M18 8v6" />
      <path d="M15 11h6" />
    </svg>
  );
}

function getSortedScheduledActivities(
  activities: ScheduledActivity[],
  sortMode: StartDateSortMode
) {
  if (sortMode === "normal") {
    return activities;
  }

  return activities
    .map((activity, originalIndex) => ({
      activity,
      originalIndex,
      startTime: getActivitySortStartTime(activity),
    }))
    .sort((firstActivity, secondActivity) => {
      const dateComparison =
        firstActivity.startTime - secondActivity.startTime;

      if (dateComparison !== 0) {
        return sortMode === "ascending" ? dateComparison : -dateComparison;
      }

      return firstActivity.originalIndex - secondActivity.originalIndex;
    })
    .map(({ activity }) => activity);
}

function getActivitySortStartTime(activity: ScheduledActivity) {
  const startDate =
    parseDateValue(activity.computedStartDate) ??
    parseDateValue(activity.startDate);

  return startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function getStartDateSortIndicator(sortMode: StartDateSortMode) {
  if (sortMode === "ascending") {
    return "↑";
  }

  if (sortMode === "descending") {
    return "↓";
  }

  return "--";
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

function buildSchedulerReportGroups(
  activities: ScheduledActivity[],
  itemOptions: SchedulerCostCodeItemOption[]
): SchedulerReportCostCodeGroup[] {
  const groupMap = new Map<
    string,
    SchedulerReportCostCodeGroup & {
      floorGroupMap: Map<
        string,
        SchedulerReportFloorGroup & {
          activityBucketRowMap: Map<string, SchedulerReportUnitRow>;
        }
      >;
    }
  >();

  activities.forEach((activity) => {
    if (!shouldIncludeActivityInReport(activity)) {
      return;
    }

    const costCodeOption = findCostCodeItemOption(
      activity.costCodeItem,
      itemOptions
    );
    const normalizedItem = normalizeCostCodeItem(activity.costCodeItem);
    const costCode = costCodeOption?.costCode ?? "No cost code";
    const item = costCodeOption?.item ?? (normalizedItem || "Unassigned item");
    const costGroupKey = costCodeOption
      ? `cost-code:${costCodeOption.costCode}`
      : normalizedItem
        ? `item:${normalizedItem.toLowerCase()}`
        : "unassigned-cost-code";
    const floor = activity.floor.trim() || "No floor";
    const activityBucket =
      normalizeActivityBucket(activity.activityBucket) || "No activity bucket";
    const unit = activity.unit.trim() || "No unit";

    let costGroup = groupMap.get(costGroupKey);

    if (!costGroup) {
      costGroup = {
        key: costGroupKey,
        costCode,
        item,
        floorGroups: [],
        floorGroupMap: new Map(),
        activityCount: 0,
        materialCost: 0,
        labourCost: 0,
        equipmentCost: 0,
      };
      groupMap.set(costGroupKey, costGroup);
    }

    let floorGroup = costGroup.floorGroupMap.get(floor);

    if (!floorGroup) {
      floorGroup = {
        floor,
        unitRows: [],
        activityBucketRowMap: new Map(),
        activityCount: 0,
        materialCost: 0,
        labourCost: 0,
        equipmentCost: 0,
      };
      costGroup.floorGroupMap.set(floor, floorGroup);
      costGroup.floorGroups.push(floorGroup);
    }

    let unitRow = floorGroup.activityBucketRowMap.get(activityBucket);

    if (!unitRow) {
      unitRow = {
        activityBucket,
        unit,
        estimatedQuantity: 0,
        activityCount: 0,
        materialCost: 0,
        labourCost: 0,
        equipmentCost: 0,
      };
      floorGroup.activityBucketRowMap.set(activityBucket, unitRow);
      floorGroup.unitRows.push(unitRow);
    } else {
      unitRow.unit = mergeReportUnitLabels(unitRow.unit, unit);
    }

    const estimatedQuantity = activity.estimatedQuantity ?? 0;

    unitRow.estimatedQuantity += estimatedQuantity;
    unitRow.activityCount += 1;
    unitRow.materialCost += activity.materialCost;
    unitRow.labourCost += activity.labourCost;
    unitRow.equipmentCost += activity.equipmentCost;

    floorGroup.activityCount += 1;
    floorGroup.materialCost += activity.materialCost;
    floorGroup.labourCost += activity.labourCost;
    floorGroup.equipmentCost += activity.equipmentCost;

    costGroup.activityCount += 1;
    costGroup.materialCost += activity.materialCost;
    costGroup.labourCost += activity.labourCost;
    costGroup.equipmentCost += activity.equipmentCost;
  });

  return Array.from(groupMap.values())
    .map((group) => ({
      key: group.key,
      costCode: group.costCode,
      item: group.item,
      activityCount: group.activityCount,
      materialCost: group.materialCost,
      labourCost: group.labourCost,
      equipmentCost: group.equipmentCost,
      floorGroups: group.floorGroups
        .map((floorGroup) => ({
          floor: floorGroup.floor,
          activityCount: floorGroup.activityCount,
          materialCost: floorGroup.materialCost,
          labourCost: floorGroup.labourCost,
          equipmentCost: floorGroup.equipmentCost,
          unitRows: floorGroup.unitRows.sort(compareReportUnitRows),
        }))
        .sort(compareReportFloorGroups),
    }))
    .sort(compareReportCostCodeGroups);
}

function shouldIncludeActivityInReport(activity: SchedulerActivity) {
  return Boolean(
      activity.costCodeItem.trim() ||
      activity.activityBucket.trim() ||
      activity.floor.trim() ||
      activity.unit.trim() ||
      (activity.estimatedQuantity ?? 0) > 0 ||
      activity.materialCost > 0 ||
      activity.labourCost > 0 ||
      activity.equipmentCost > 0
  );
}

function compareReportCostCodeGroups(
  left: SchedulerReportCostCodeGroup,
  right: SchedulerReportCostCodeGroup
) {
  if (left.costCode === "No cost code" && right.costCode !== "No cost code") {
    return 1;
  }

  if (right.costCode === "No cost code" && left.costCode !== "No cost code") {
    return -1;
  }

  return (
    left.costCode.localeCompare(right.costCode) ||
    left.item.localeCompare(right.item)
  );
}

function compareReportFloorGroups(
  left: SchedulerReportFloorGroup,
  right: SchedulerReportFloorGroup
) {
  return (
    getReportFloorSortIndex(left.floor) - getReportFloorSortIndex(right.floor) ||
    left.floor.localeCompare(right.floor)
  );
}

function compareReportUnitRows(
  left: SchedulerReportUnitRow,
  right: SchedulerReportUnitRow
) {
  return (
    getReportActivityBucketSortIndex(left.activityBucket) -
      getReportActivityBucketSortIndex(right.activityBucket) ||
    left.activityBucket.localeCompare(right.activityBucket) ||
    getReportUnitSortIndex(left.unit) - getReportUnitSortIndex(right.unit) ||
    left.unit.localeCompare(right.unit)
  );
}

function getReportFloorSortIndex(floor: string) {
  const index = schedulerFloorOptions.indexOf(floor);
  return index === -1 ? schedulerFloorOptions.length + 1 : index;
}

function getReportUnitSortIndex(unit: string) {
  const index = schedulerUnitOptions.indexOf(unit);
  return index === -1 ? schedulerUnitOptions.length + 1 : index;
}

function getReportActivityBucketSortIndex(activityBucket: string) {
  const index = schedulerActivityBucketOptions.indexOf(activityBucket);
  return index === -1 ? schedulerActivityBucketOptions.length + 1 : index;
}

function getReportUnitEstimatedCost(row: SchedulerReportUnitRow) {
  return row.materialCost + row.labourCost + row.equipmentCost;
}

function getReportUnitCost(row: SchedulerReportUnitRow) {
  if (row.estimatedQuantity <= 0) {
    return null;
  }

  return getReportUnitEstimatedCost(row) / row.estimatedQuantity;
}

function getReportFloorEstimatedCost(group: SchedulerReportFloorGroup) {
  return group.materialCost + group.labourCost + group.equipmentCost;
}

function getReportGroupEstimatedCost(group: SchedulerReportCostCodeGroup) {
  return group.materialCost + group.labourCost + group.equipmentCost;
}

function formatQuantity(value: number) {
  return quantityFormatter.format(value);
}

function formatReportUnitCost(row: SchedulerReportUnitRow) {
  const unitCost = getReportUnitCost(row);

  if (unitCost === null) {
    return "-";
  }

  return inrUnitCostFormatter.format(unitCost);
}

function formatReportUnitCostUnit(unit: string) {
  if (!unit || unit === "No unit") {
    return "-";
  }

  return `INR/${unit}`;
}

function mergeReportUnitLabels(existingUnit: string, nextUnit: string) {
  if (existingUnit === nextUnit) {
    return existingUnit;
  }

  const units = new Set(
    [...existingUnit.split(", "), ...nextUnit.split(", ")]
      .map((unit) => unit.trim())
      .filter(Boolean)
  );

  return Array.from(units)
    .sort((left, right) => {
      return (
        getReportUnitSortIndex(left) - getReportUnitSortIndex(right) ||
        left.localeCompare(right)
      );
    })
    .join(", ");
}

function findCostCodeItemOption(
  value: string,
  itemOptions: SchedulerCostCodeItemOption[]
) {
  const normalizedValue = normalizeCostCodeItem(value).toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  return (
    itemOptions.find(
      (option) =>
        normalizeCostCodeItem(option.item).toLowerCase() === normalizedValue
    ) ?? null
  );
}

function normalizeCostCodeItem(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeActivityBucket(value: string) {
  return value.replace(/\s+/g, " ").trim();
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
    floor: "",
    costCodeItem: "",
    activityBucket: "",
    estimatedQuantity: null,
    unit: "",
    materialCost: 0,
    labourCost: 0,
    equipmentCost: 0,
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

function formatCurrencyInr(value: number) {
  return inrCurrencyFormatter.format(value);
}

function formatMoneyDraftValue(value: number) {
  return value > 0 ? String(value) : "";
}

function formatQuantityDraftValue(value: number | null) {
  return value !== null && value > 0 ? String(value) : "";
}

function parseMoneyInput(value: string) {
  const numericValue = Number(value.replace(/,/g, "").trim());

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}

function parseQuantityInput(value: string) {
  const trimmedValue = value.replace(/,/g, "").trim();

  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
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
