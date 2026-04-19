export type SchedulerActivityType =
  | "Task Dependent"
  | "Start Milestone"
  | "Finish Milestone";

export type SchedulerActivity = {
  rowKey: string;
  activityId: string;
  activityName: string;
  activityType: SchedulerActivityType;
  startDate: string;
  durationDays: number;
  percentComplete: number;
  floor: string;
  costCodeItem: string;
  activityBucket: string;
  estimatedQuantity: number | null;
  unit: string;
  materialCost: number;
  labourCost: number;
  equipmentCost: number;
  predecessorIds: string[];
};

export type SchedulerPersistenceData = {
  scheduleId: string | null;
  activities: SchedulerActivity[];
};

export type SchedulerCostCodeItemOption = {
  item: string;
  costCode: string;
};

export type SaveSchedulerActivityInput = SchedulerActivity & {
  computedEndDate: string;
};

export type SaveProjectSchedulerInput = {
  scheduleId: string | null;
  projectId: number;
  projectName: string;
  expectedStartDate: string | null;
  statusDate: string;
  activities: SaveSchedulerActivityInput[];
};

export type SaveProjectSchedulerResult = {
  scheduleId: string;
};
