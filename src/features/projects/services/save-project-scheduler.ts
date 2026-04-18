import { supabase } from "@/lib/supabase/client";
import type {
  SaveProjectSchedulerInput,
  SaveProjectSchedulerResult,
  SaveSchedulerActivityInput,
  SchedulerActivityType,
} from "@/features/projects/types/scheduler";

type SchedulerScheduleRow = {
  id: string;
};

type ExistingSchedulerActivityRow = {
  id: string;
  percent_complete: number | null;
};

export async function saveProjectScheduler(
  input: SaveProjectSchedulerInput
): Promise<SaveProjectSchedulerResult> {
  validateActivitiesForSave(input.activities);

  const scheduleId = await ensureActiveSchedule(input);
  const existingActivities = await getExistingActivities(scheduleId);

  await clearRelationships(scheduleId);
  await deleteRemovedActivities(scheduleId, existingActivities, input.activities);
  await upsertActivities(scheduleId, input);
  await insertRelationships(scheduleId, input.activities);
  await insertProgressUpdates(
    scheduleId,
    input.statusDate,
    existingActivities,
    input.activities
  );

  return { scheduleId };
}

async function ensureActiveSchedule(input: SaveProjectSchedulerInput) {
  if (input.scheduleId) {
    const { data, error } = await supabase
      .from("scheduler_schedules")
      .update({
        default_start_date: input.expectedStartDate,
        status_date: input.statusDate,
      })
      .eq("id", input.scheduleId)
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to update scheduler.");
    }

    return (data as SchedulerScheduleRow).id;
  }

  const { data: existingScheduleRows, error: existingScheduleError } =
    await supabase
      .from("scheduler_schedules")
      .select("id")
      .eq("project_id", input.projectId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);

  if (existingScheduleError) {
    throw new Error(
      existingScheduleError.message || "Failed to check existing scheduler."
    );
  }

  const existingSchedule = (existingScheduleRows?.[0] ??
    null) as SchedulerScheduleRow | null;

  if (existingSchedule) {
    return existingSchedule.id;
  }

  const { data, error } = await supabase
    .from("scheduler_schedules")
    .insert({
      project_id: input.projectId,
      schedule_name: `${input.projectName || "Project"} Schedule`,
      status_date: input.statusDate,
      default_start_date: input.expectedStartDate,
      calendar_type: "calendar_days",
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create scheduler.");
  }

  return (data as SchedulerScheduleRow).id;
}

async function getExistingActivities(scheduleId: string) {
  const { data, error } = await supabase
    .from("scheduler_activities")
    .select("id, percent_complete")
    .eq("schedule_id", scheduleId);

  if (error) {
    throw new Error(error.message || "Failed to read existing activities.");
  }

  return (data ?? []) as ExistingSchedulerActivityRow[];
}

async function clearRelationships(scheduleId: string) {
  const { error } = await supabase
    .from("scheduler_relationships")
    .delete()
    .eq("schedule_id", scheduleId);

  if (error) {
    throw new Error(error.message || "Failed to clear relationships.");
  }
}

async function deleteRemovedActivities(
  scheduleId: string,
  existingActivities: ExistingSchedulerActivityRow[],
  nextActivities: SaveSchedulerActivityInput[]
) {
  const nextActivityIds = new Set(nextActivities.map((activity) => activity.rowKey));
  const activityIdsToDelete = existingActivities
    .map((activity) => activity.id)
    .filter((id) => !nextActivityIds.has(id));

  if (activityIdsToDelete.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("scheduler_activities")
    .delete()
    .eq("schedule_id", scheduleId)
    .in("id", activityIdsToDelete);

  if (error) {
    throw new Error(error.message || "Failed to delete removed activities.");
  }
}

async function upsertActivities(
  scheduleId: string,
  input: SaveProjectSchedulerInput
) {
  if (input.activities.length === 0) {
    return;
  }

  const activityPayload = input.activities.map((activity, rowIndex) => {
    const activityType = normalizeActivityType(activity.activityType);

    return {
      id: activity.rowKey,
      schedule_id: scheduleId,
      project_id: input.projectId,
      row_order: rowIndex,
      activity_id: normalizeActivityId(activity.activityId),
      activity_name: activity.activityName.trim(),
      activity_type: activityType,
      start_date: activity.startDate,
      duration_days:
        activityType === "Task Dependent"
          ? Math.max(Number(activity.durationDays), 1)
          : 0,
      end_date: activity.computedEndDate,
      percent_complete:
        activityType === "Task Dependent"
          ? clampPercentComplete(activity.percentComplete)
          : 0,
      cost_code_item: activity.costCodeItem.trim() || null,
      material_cost: normalizeCost(activity.materialCost),
      labour_cost: normalizeCost(activity.labourCost),
      equipment_cost: normalizeCost(activity.equipmentCost),
      is_active: true,
    };
  });

  const { error } = await supabase
    .from("scheduler_activities")
    .upsert(activityPayload, { onConflict: "id" });

  if (error) {
    throw new Error(error.message || "Failed to save activities.");
  }
}

async function insertRelationships(
  scheduleId: string,
  activities: SaveSchedulerActivityInput[]
) {
  const activityRowIdByActivityId = new Map(
    activities.map((activity) => [
      normalizeActivityId(activity.activityId),
      activity.rowKey,
    ])
  );

  const relationshipPayload = activities.flatMap((activity) => {
    const successorRowId = activity.rowKey;

    return activity.predecessorIds
      .map((predecessorId) => {
        const predecessorRowId = activityRowIdByActivityId.get(
          normalizeActivityId(predecessorId)
        );

        if (!predecessorRowId || predecessorRowId === successorRowId) {
          return null;
        }

        return {
          schedule_id: scheduleId,
          predecessor_activity_row_id: predecessorRowId,
          successor_activity_row_id: successorRowId,
          relationship_type: "FS",
          lag_days: 0,
        };
      })
      .filter(Boolean);
  });

  if (relationshipPayload.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("scheduler_relationships")
    .insert(relationshipPayload);

  if (error) {
    throw new Error(error.message || "Failed to save relationships.");
  }
}

async function insertProgressUpdates(
  scheduleId: string,
  statusDate: string,
  existingActivities: ExistingSchedulerActivityRow[],
  activities: SaveSchedulerActivityInput[]
) {
  const existingPercentByActivityId = new Map(
    existingActivities.map((activity) => [
      activity.id,
      Number(activity.percent_complete ?? 0),
    ])
  );

  const progressPayload = activities
    .map((activity) => {
      const activityType = normalizeActivityType(activity.activityType);
      const percentComplete =
        activityType === "Task Dependent"
          ? clampPercentComplete(activity.percentComplete)
          : 0;
      const previousPercent = existingPercentByActivityId.get(activity.rowKey);

      if (
        previousPercent === undefined
          ? percentComplete === 0
          : previousPercent === percentComplete
      ) {
        return null;
      }

      return {
        schedule_id: scheduleId,
        activity_row_id: activity.rowKey,
        progress_date: statusDate,
        percent_complete: percentComplete,
        remarks: null,
      };
    })
    .filter(Boolean);

  if (progressPayload.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("scheduler_progress_updates")
    .insert(progressPayload);

  if (error) {
    throw new Error(error.message || "Failed to save progress updates.");
  }
}

function validateActivitiesForSave(activities: SaveSchedulerActivityInput[]) {
  const normalizedIds = activities.map((activity) =>
    normalizeActivityId(activity.activityId)
  );

  if (normalizedIds.some((activityId) => !activityId)) {
    throw new Error("Every activity needs an Activity ID before saving.");
  }

  const uniqueIds = new Set(normalizedIds);

  if (uniqueIds.size !== normalizedIds.length) {
    throw new Error("Duplicate Activity IDs must be fixed before saving.");
  }
}

function normalizeActivityId(value: string) {
  return value.trim().toUpperCase();
}

function normalizeActivityType(value: SchedulerActivityType) {
  return value;
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

function normalizeCost(value: string | number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}
