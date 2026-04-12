"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ProjectRecord } from "@/features/projects/types/project";
import { formatDisplayDate as formatDateForDisplay } from "@/lib/date-format";

type ProjectSchedulerWorkspaceProps = {
  project: ProjectRecord;
  backHref: string;
};

type SchedulerActivity = {
  rowKey: string;
  activityId: string;
  activityName: string;
  activityType: ActivityType;
  startDate: string;
  durationDays: number;
  predecessorIds: string[];
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

type GanttConnection = {
  id: string;
  fromRowIndex: number;
  toRowIndex: number;
  fromOffset: number;
  toOffset: number;
};

type GanttScale = "days" | "weeks";

type ActivityType =
  | "Task Dependency"
  | "Start Milestone"
  | "Finish Milestone";

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

const dayWidth = 84;
const weekWidth = 92;
const rowHeight = 40;
const activityIdColumnWidth = 120;
const activityNameColumnWidth = 190;
const ganttBarInset = 10;
const ganttArrowWidth = 8;
const activityTypes: ActivityType[] = [
  "Task Dependency",
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
  const [ganttScale, setGanttScale] = useState<GanttScale>("days");
  const [activities, setActivities] = useState<SchedulerActivity[]>(() =>
    buildStarterActivities(project.expected_start_date)
  );

  const computedSchedule = useMemo(
    () => computeSchedule(activities, project.expected_start_date),
    [activities, project.expected_start_date]
  );
  const ganttColumns = useMemo(
    () => buildGanttColumns(computedSchedule, ganttScale),
    [computedSchedule, ganttScale]
  );
  const ganttCellWidth = ganttScale === "days" ? dayWidth : weekWidth;
  const ganttConnections = useMemo(
    () => buildGanttConnections(computedSchedule.activities, ganttColumns),
    [computedSchedule.activities, ganttColumns]
  );

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

  function handleActivityTypeChange(rowKey: string, nextValue: ActivityType) {
    updateActivity(rowKey, (activity) => ({
      ...activity,
      activityType: nextValue,
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
      {
        rowKey: createRowKey(),
        activityId: buildNextActivityId(currentActivities),
        activityName: "",
        activityType: "Task Dependency",
        startDate: addDaysToInputDate(latestFinish, 1),
        durationDays: 5,
        predecessorIds: [],
      },
    ]);
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
            onClick={handleAddActivity}
            className="h-9 rounded-xl bg-green-600 px-4 text-xs font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
          >
            Add Activity
          </button>
        </div>
      </div>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
          <Card className="flex min-h-0 flex-col p-3">
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
            <div
              ref={leftPaneRef}
              onScroll={() => syncPaneScroll("left")}
              className="relative isolate h-full overflow-auto overscroll-contain bg-[var(--panel)]"
            >
              <table className="w-full min-w-[1188px] table-fixed border-separate border-spacing-0 text-left text-[11px]">
                <colgroup>
                  <col style={{ width: activityIdColumnWidth }} />
                  <col style={{ width: activityNameColumnWidth }} />
                  <col style={{ width: "148px" }} />
                  <col style={{ width: "128px" }} />
                  <col style={{ width: "74px" }} />
                  <col style={{ width: "108px" }} />
                  <col style={{ width: "150px" }} />
                  <col style={{ width: "150px" }} />
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
                      Activity Type
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
                      Predecessor
                    </th>
                    <th className="sticky top-0 z-40 h-10 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)] shadow-[0_1px_0_0_var(--border)]">
                      Successor
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

                  return (
                    <tr
                      key={activity.rowKey}
                      className="h-10"
                      title={activityTitle || undefined}
                    >
                      <td
                        className="sticky left-0 z-30 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 align-middle"
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
                        className="sticky z-30 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1 align-middle shadow-[1px_0_0_0_var(--border)]"
                        style={{ left: activityIdColumnWidth }}
                      >
                        <Input
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
                      <td className="border-b border-[var(--border)] px-2 py-1 align-middle">
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
                      <td className="border-b border-[var(--border)] px-2 py-1 align-middle">
                        <Input
                          type="date"
                          value={activity.startDate}
                          onChange={(event) =>
                            updateActivity(activity.rowKey, (currentActivity) => ({
                              ...currentActivity,
                              startDate: event.target.value,
                            }))
                          }
                          className={compactInputClassName}
                          title={
                            activity.isLogicDriven
                              ? `Logic start: ${formatDisplayDate(activity.computedStartDate)}`
                              : undefined
                          }
                        />
                      </td>
                      <td className="border-b border-[var(--border)] px-2 py-1 align-middle">
                        <Input
                          type="number"
                          min={isMilestoneActivity(activity) ? 0 : 1}
                          value={String(
                            isMilestoneActivity(activity)
                              ? 0
                              : activity.durationDays
                          )}
                          disabled={isMilestoneActivity(activity)}
                          onChange={(event) =>
                            updateActivity(activity.rowKey, (currentActivity) => ({
                              ...currentActivity,
                              durationDays: clampDuration(
                                event.target.value,
                                currentActivity.activityType
                              ),
                            }))
                          }
                          className={compactInputClassName}
                        />
                      </td>
                      <td className="border-b border-[var(--border)] px-2 py-1 align-middle">
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
                      <td className="border-b border-[var(--border)] px-2 py-1 align-middle">
                        <Input
                          value={formatRelationshipValue(activity.predecessorIds)}
                          onChange={(event) =>
                            updateActivity(activity.rowKey, (currentActivity) => ({
                              ...currentActivity,
                              predecessorIds: parseRelationshipIds(event.target.value).filter(
                                (predecessorId) =>
                                  predecessorId !==
                                  normalizeRelationshipId(currentActivity.activityId)
                              ),
                            }))
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
                      <td className="border-b border-[var(--border)] px-2 py-1 align-middle">
                        <Input
                          value={formatRelationshipValue(activity.successorIds)}
                          onChange={(event) =>
                            handleSuccessorChange(activity.rowKey, event.target.value)
                          }
                          placeholder="A300, A400"
                          className={compactInputClassName}
                        />
                      </td>
                      <td className="border-b border-[var(--border)] px-2 py-1 align-middle">
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
                width: Math.max(ganttColumns.length * ganttCellWidth, 720),
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
                  <svg
                    className="pointer-events-none absolute inset-0 z-20"
                    width={Math.max(ganttColumns.length * ganttCellWidth, 720)}
                    height={computedSchedule.activities.length * rowHeight}
                    viewBox={`0 0 ${Math.max(
                      ganttColumns.length * ganttCellWidth,
                      720
                    )} ${computedSchedule.activities.length * rowHeight}`}
                    fill="none"
                    >
                      {ganttConnections.map((connection) => {
                      const startX =
                        connection.fromOffset * ganttCellWidth - ganttBarInset;
                      const arrowTipX =
                        connection.toOffset * ganttCellWidth + ganttBarInset;
                      const arrowBaseX = arrowTipX - ganttArrowWidth;
                      const startY =
                        connection.fromRowIndex * rowHeight + rowHeight / 2;
                      const endY = connection.toRowIndex * rowHeight + rowHeight / 2;
                      const availableRun = arrowBaseX - startX;
                      const elbowOffset =
                        availableRun > 18
                          ? 16
                          : Math.max(Math.min(availableRun - 8, 16), 6);
                      const elbowX = startX + elbowOffset;
                      const path = `M ${startX} ${startY} H ${elbowX} V ${endY} H ${arrowBaseX}`;
                      const arrowHead = `M ${arrowBaseX} ${endY - 5} L ${arrowTipX} ${endY} L ${arrowBaseX} ${endY + 5} Z`;

                      return (
                        <g key={connection.id}>
                          <path
                            d={path}
                            stroke="#94a3b8"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d={arrowHead} fill="#94a3b8" stroke="none" />
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
                              marginLeft: Math.max(
                                startOffset * ganttCellWidth + ganttBarInset,
                                ganttBarInset
                              ),
                            }}
                            title={`${activity.activityType} - ${activityLabel} - ${formatDisplayDate(activity.computedStartDate)}`}
                          >
                            <span className="h-3.5 w-3.5 rotate-45 bg-black shadow ring-1 ring-white/70" />
                            <span className="max-w-[220px] truncate rounded-full bg-[var(--panel)] px-2 py-1 text-[10px] font-semibold text-[var(--foreground)] shadow-sm">
                              {activityLabel}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={[
                              "ml-1 flex h-7 items-center rounded-lg px-2 text-[10px] font-semibold text-white shadow",
                              activity.hasCircularDependency
                                ? "bg-amber-500"
                                : activity.unresolvedPredecessors.length > 0
                                  ? "bg-slate-500"
                                  : activity.isCritical
                                    ? "bg-red-600"
                                    : "bg-emerald-600",
                              ].join(" ")}
                              style={{
                                marginLeft: Math.max(
                                  startOffset * ganttCellWidth + ganttBarInset,
                                  ganttBarInset
                                ),
                                width: barWidth,
                              }}
                            title={`${activityLabel} - ${formatDisplayDate(activity.computedStartDate)} to ${formatDisplayDate(activity.computedEndDate)}`}
                          >
                            <span className="truncate">{activityLabel}</span>
                          </div>
                        )}
                      </div>

                      {!isMilestone ? (
                        <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-[var(--panel)] px-2 py-1 text-[10px] text-[var(--muted)] shadow-sm">
                          {formatDisplayDate(activity.computedEndDate)}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function buildStarterActivities(expectedStartDate: string | null): SchedulerActivity[] {
  const baseDate = expectedStartDate || getTodayInputDate();

  return [
    {
      rowKey: createRowKey(),
      activityId: "A100",
      activityName: "Site Mobilization",
      startDate: baseDate,
      durationDays: 3,
      predecessorIds: [],
    },
    {
      rowKey: createRowKey(),
      activityId: "A110",
      activityName: "Site Preparation",
      startDate: baseDate,
      durationDays: 7,
      predecessorIds: ["A100"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A120",
      activityName: "Long-Lead Procurement",
      startDate: baseDate,
      durationDays: 12,
      predecessorIds: ["A100"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A130",
      activityName: "Temporary Utilities",
      startDate: addDaysToInputDate(baseDate, 1),
      durationDays: 5,
      predecessorIds: ["A100"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A200",
      activityName: "Survey + Layout",
      startDate: addDaysToInputDate(baseDate, 5),
      durationDays: 4,
      predecessorIds: ["A110"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A210",
      activityName: "Excavation",
      startDate: addDaysToInputDate(baseDate, 8),
      durationDays: 8,
      predecessorIds: ["A200"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A220",
      activityName: "PCC + Blinding",
      startDate: addDaysToInputDate(baseDate, 16),
      durationDays: 4,
      predecessorIds: ["A210"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A230",
      activityName: "Footings + Foundation Beams",
      startDate: addDaysToInputDate(baseDate, 18),
      durationDays: 14,
      predecessorIds: ["A220"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A240",
      activityName: "Backfilling + Compaction",
      startDate: addDaysToInputDate(baseDate, 31),
      durationDays: 5,
      predecessorIds: ["A230"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A300",
      activityName: "Ground Floor Slab",
      startDate: addDaysToInputDate(baseDate, 34),
      durationDays: 7,
      predecessorIds: ["A240"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A310",
      activityName: "Upper Floor Structure",
      startDate: addDaysToInputDate(baseDate, 40),
      durationDays: 42,
      predecessorIds: ["A300", "A120"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A320",
      activityName: "Masonry / Internal Partitions",
      startDate: addDaysToInputDate(baseDate, 54),
      durationDays: 24,
      predecessorIds: ["A310"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A330",
      activityName: "Roof Waterproofing",
      startDate: addDaysToInputDate(baseDate, 79),
      durationDays: 6,
      predecessorIds: ["A310"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A400",
      activityName: "MEP Sleeves + Shafts",
      startDate: addDaysToInputDate(baseDate, 48),
      durationDays: 10,
      predecessorIds: ["A310", "A130"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A410",
      activityName: "MEP Rough-In",
      startDate: addDaysToInputDate(baseDate, 60),
      durationDays: 20,
      predecessorIds: ["A320", "A400"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A420",
      activityName: "External Plaster + Paint Base",
      startDate: addDaysToInputDate(baseDate, 70),
      durationDays: 18,
      predecessorIds: ["A320"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A500",
      activityName: "Internal Plaster",
      startDate: addDaysToInputDate(baseDate, 78),
      durationDays: 16,
      predecessorIds: ["A320", "A410"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A510",
      activityName: "Flooring",
      startDate: addDaysToInputDate(baseDate, 92),
      durationDays: 12,
      predecessorIds: ["A500"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A520",
      activityName: "Doors + Windows Installation",
      startDate: addDaysToInputDate(baseDate, 92),
      durationDays: 10,
      predecessorIds: ["A500"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A530",
      activityName: "Internal Paint",
      startDate: addDaysToInputDate(baseDate, 103),
      durationDays: 10,
      predecessorIds: ["A510", "A520"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A540",
      activityName: "Fixtures + Testing",
      startDate: addDaysToInputDate(baseDate, 108),
      durationDays: 8,
      predecessorIds: ["A530", "A420"],
    },
    {
      rowKey: createRowKey(),
      activityId: "A600",
      activityName: "Snagging + Handover",
      startDate: addDaysToInputDate(baseDate, 116),
      durationDays: 7,
      predecessorIds: ["A540", "A330"],
    },
  ].map((activity) => ({
    ...activity,
    activityType: "Task Dependency",
  }));
}

function computeSchedule(
  activities: SchedulerActivity[],
  expectedStartDate: string | null
): ScheduleComputation {
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

      if (relationshipStart.getTime() > computedStart.getTime()) {
        computedStart = relationshipStart;
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

  activities.forEach((activity, rowIndex) => {
    const activityId = normalizeRelationshipId(activity.activityId);

    if (!activityId) {
      return;
    }

    rowIndexById.set(activityId, rowIndex);
    startOffsetById.set(
      activityId,
      findColumnBoundaryOffsetForDate(
        columns,
        activity.computedStartDate,
        "start"
      )
    );
    endOffsetById.set(
      activityId,
      findColumnBoundaryOffsetForDate(columns, activity.computedEndDate, "end")
    );
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

      if (fromRowIndex === undefined || fromOffset === undefined) {
        return [];
      }

      return [
        {
          id: `${predecessorId}-${targetActivityId}`,
          fromRowIndex,
          toRowIndex,
          fromOffset,
          toOffset,
        },
      ];
    });
  });
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
  const targetDate = parseDateValue(dateValue);

  if (!targetDate) {
    return 0;
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
    return 0;
  }

  const column = columns[columnIndex];
  const columnStart = parseDateValue(column.startDate);
  const columnEnd = parseDateValue(column.endDate);

  if (!columnStart || !columnEnd) {
    return columnIndex;
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

  if (activity.isCritical) {
    parts.push("Critical path: 0 days total float");
  } else if (activity.totalFloatDays > 0) {
    parts.push(`Total float: ${activity.totalFloatDays} days`);
  }

  return parts.filter(Boolean).join(" ");
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
  activityType: ActivityType = "Task Dependency"
) {
  const numericValue = Number(value);
  const minimumDuration = isMilestoneActivityType(activityType) ? 0 : 1;

  if (!Number.isFinite(numericValue) || numericValue < minimumDuration) {
    return minimumDuration;
  }

  return Math.round(numericValue);
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

function parseDateValue(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
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
  return Math.random().toString(36).slice(2, 10);
}
