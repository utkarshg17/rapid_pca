import { supabase } from "@/lib/supabase/client";
import type {
  SchedulerActivity,
  SchedulerActivityType,
  SchedulerPersistenceData,
} from "@/features/projects/types/scheduler";

type SchedulerScheduleRow = {
  id: string;
};

type SchedulerActivityRow = {
  id: string;
  row_order: number | null;
  activity_id: string | null;
  activity_name: string | null;
  activity_type: string | null;
  start_date: string | null;
  duration_days: number | null;
  percent_complete: number | null;
  material_cost: number | null;
  labour_cost: number | null;
  equipment_cost: number | null;
};

type SchedulerRelationshipRow = {
  predecessor_activity_row_id: string | null;
  successor_activity_row_id: string | null;
};

export async function getProjectScheduler(
  projectId: number
): Promise<SchedulerPersistenceData> {
  const { data: scheduleRows, error: scheduleError } = await supabase
    .from("scheduler_schedules")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  if (scheduleError) {
    throw new Error(scheduleError.message || "Failed to load scheduler.");
  }

  const schedule = (scheduleRows?.[0] ?? null) as SchedulerScheduleRow | null;

  if (!schedule) {
    return {
      scheduleId: null,
      activities: [],
    };
  }

  const { data: activityRows, error: activityError } = await supabase
    .from("scheduler_activities")
    .select(
      "id, row_order, activity_id, activity_name, activity_type, start_date, duration_days, percent_complete, material_cost, labour_cost, equipment_cost"
    )
    .eq("schedule_id", schedule.id)
    .eq("is_active", true)
    .order("row_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (activityError) {
    throw new Error(activityError.message || "Failed to load activities.");
  }

  const activitiesByRowId = new Map(
    ((activityRows ?? []) as SchedulerActivityRow[]).map((activity) => [
      activity.id,
      activity,
    ])
  );

  const { data: relationshipRows, error: relationshipError } = await supabase
    .from("scheduler_relationships")
    .select("predecessor_activity_row_id, successor_activity_row_id")
    .eq("schedule_id", schedule.id);

  if (relationshipError) {
    throw new Error(
      relationshipError.message || "Failed to load activity relationships."
    );
  }

  const predecessorIdsBySuccessorRowId = new Map<string, string[]>();

  ((relationshipRows ?? []) as SchedulerRelationshipRow[]).forEach(
    (relationship) => {
      if (
        !relationship.predecessor_activity_row_id ||
        !relationship.successor_activity_row_id
      ) {
        return;
      }

      const predecessorActivity = activitiesByRowId.get(
        relationship.predecessor_activity_row_id
      );

      if (!predecessorActivity?.activity_id) {
        return;
      }

      const existingPredecessors =
        predecessorIdsBySuccessorRowId.get(
          relationship.successor_activity_row_id
        ) ?? [];

      predecessorIdsBySuccessorRowId.set(
        relationship.successor_activity_row_id,
        [...existingPredecessors, predecessorActivity.activity_id]
      );
    }
  );

  return {
    scheduleId: schedule.id,
    activities: ((activityRows ?? []) as SchedulerActivityRow[]).map(
      (activity): SchedulerActivity => {
        const activityType = normalizeActivityType(activity.activity_type);

        return {
          rowKey: activity.id,
          activityId: activity.activity_id ?? "",
          activityName: activity.activity_name ?? "",
          activityType,
          startDate: activity.start_date ?? "",
          durationDays:
            activityType === "Task Dependent"
              ? Math.max(Number(activity.duration_days ?? 1), 1)
              : 0,
          percentComplete:
            activityType === "Task Dependent"
              ? clampPercentComplete(activity.percent_complete ?? 0)
              : 0,
          materialCost: normalizeCost(activity.material_cost),
          labourCost: normalizeCost(activity.labour_cost),
          equipmentCost: normalizeCost(activity.equipment_cost),
          predecessorIds:
            predecessorIdsBySuccessorRowId.get(activity.id)?.map((id) =>
              id.trim().toUpperCase()
            ) ?? [],
        };
      }
    ),
  };
}

function normalizeActivityType(value: string | null): SchedulerActivityType {
  if (
    value === "Task Dependent" ||
    value === "Start Milestone" ||
    value === "Finish Milestone"
  ) {
    return value;
  }

  return "Task Dependent";
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

function normalizeCost(value: string | number | null) {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}
