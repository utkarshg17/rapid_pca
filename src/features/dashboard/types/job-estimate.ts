export type JobEstimateRecord = {
  id: number;
  created_at: string;
  project_name: string;
  project_type: string;
};

export type JobEstimate = {
  id: number;
  createdAt: string;
  projectName: string;
  projectType: string;
};

export type RoomTypeOption = {
  id: number;
  room_name: string;
};

export type CostCodeHierarchyNode = {
  category: string;
  subCategory: string;
  subSubCategory: string;
  item: string;
  costCode: string;
};

export type JobEstimateAreaTakeoffRecord = {
  id: number;
  created_at: string;
  job_estimate_id: number;
  room_type: string | null;
  area: number | null;
  unit: string | null;
  floor_finish: string | null;
};

export type JobEstimateAreaTakeoff = {
  id: number;
  createdAt: string;
  jobEstimateId: number;
  roomType: string;
  area: string;
  unit: string;
  floorFinish: string;
};

export type JobEstimateFinishRecord = {
  id: number;
  created_at: string;
  job_estimate_id: number;
  finish_type: string | null;
  description: string | null;
};

export type JobEstimateFinish = {
  id: number;
  createdAt: string;
  jobEstimateId: number;
  finishType: string;
  description: string;
};

export type JobEstimateProjectDetailsRecord = {
  id: number;
  created_at: string;
  job_estimate_project_id: number;
  project_name: string;
  project_type: string;
  client: string | null;
  architect: string | null;
  contract_type: string | null;
  submission_deadline: string | null;
  tender_estimated_amount: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  total_plot_area: number | null;
  boundary_wall: boolean | null;
  basement_count: number | null;
  basement_area: number | null;
  superstructure_footprint: number | null;
  stilt_floor_count: number | null;
  floor_count: number | null;
  foundation_type: string | null;
  superstructure_type: string | null;
  created_by_id: number | null;
  created_by_name: string | null;
};

export type JobEstimateProjectDetails = {
  id: number | null;
  jobEstimateProjectId: number;
  projectName: string;
  projectType: string;
  client: string;
  architect: string;
  contractType: string;
  submissionDeadline: string;
  tenderEstimatedAmount: string;
  city: string;
  state: string;
  country: string;
  totalPlotArea: string;
  boundaryWall: string;
  basementCount: string;
  basementArea: string;
  superstructureFootprint: string;
  stiltFloorCount: string;
  floorCount: string;
  foundationType: string;
  superstructureType: string;
  createdById: number | null;
  createdByName: string;
  createdAt: string | null;
};

export type JobEstimateDetailedItemRecord = {
  id: number;
  created_at: string;
  updated_at: string;
  job_estimate_id: number;
  cost_code: string;
  item_name: string;
  unit: string;
  save_status: string | null;
  source_type: string | null;
  ai_generated_at: string | null;
  saved_by_id: string | null;
  saved_by_name: string | null;
  gfa_snapshot: number | null;
};

export type JobEstimateDetailedItemRowRecord = {
  id: number;
  created_at: string;
  updated_at: string;
  detailed_item_id: number;
  row_key: string;
  row_label: string;
  quantity: number | null;
  quantity_per_gfa: number | null;
  unit: string | null;
  material_cost_per_unit: number | null;
  labour_cost_per_unit: number | null;
  equipment_cost_per_unit: number | null;
  total_cost_per_unit: number | null;
  row_total: number | null;
  assumed_system: string | null;
  assumptions: string | null;
  confidence: string | null;
  status: string | null;
  sort_order: number | null;
};

export type JobEstimateDetailedItem = {
  id: number;
  createdAt: string;
  updatedAt: string;
  jobEstimateId: number;
  costCode: string;
  itemName: string;
  unit: string;
  saveStatus: string;
  sourceType: string;
  aiGeneratedAt: string | null;
  savedById: string | null;
  savedByName: string;
  gfaSnapshot: number;
};

export type JobEstimateDetailedItemRow = {
  id: number;
  createdAt: string;
  updatedAt: string;
  detailedItemId: number;
  rowKey: string;
  rowLabel: string;
  quantity: number;
  quantityPerGfa: number;
  unit: string;
  materialCostPerUnit: number;
  labourCostPerUnit: number;
  equipmentCostPerUnit: number;
  totalCostPerUnit: number;
  rowTotal: number;
  assumedSystem: string;
  assumptions: string;
  confidence: string;
  status: string;
  sortOrder: number;
};

export type JobEstimateDetailedItemWithRows = {
  item: JobEstimateDetailedItem;
  rows: JobEstimateDetailedItemRow[];
};

export type SaveJobEstimateDetailedItemRowInput = {
  rowKey: string;
  rowLabel: string;
  quantity: number;
  quantityPerGfa: number;
  unit: string;
  materialCostPerUnit: number;
  labourCostPerUnit: number;
  equipmentCostPerUnit: number;
  totalCostPerUnit: number;
  rowTotal: number;
  assumedSystem: string;
  assumptions: string;
  confidence: string;
  status: string;
  sortOrder: number;
};

export type SaveJobEstimateDetailedItemInput = {
  jobEstimateId: number;
  costCode: string;
  itemName: string;
  unit: string;
  gfaSnapshot: number;
  saveStatus?: string;
  sourceType?: string;
  aiGeneratedAt?: string | null;
  savedById?: string | null;
  savedByName?: string;
  rows: SaveJobEstimateDetailedItemRowInput[];
};

export type JobEstimateOverviewSummaryItem = {
  costCode: string;
  category: string;
  item: string;
  quantity: number;
  quantityPerGfa: number;
  unit: string;
  materialCostPerUnit: number;
  labourCostPerUnit: number;
  equipmentCostPerUnit: number;
  cost: number;
};

export type JobEstimateOpeningType = "Door" | "Window" | "Ventilator" | "Facade";

export type JobEstimateOpeningRecord = {
  id: number;
  created_at: string;
  job_estimate_id: number;
  opening_type: string;
  opening_name: string | null;
  height: number | null;
  width: number | null;
  unit: string | null;
  quantity: number | null;
  description: string | null;
  sort_order: number | null;
};

export type JobEstimateOpening = {
  id: number;
  createdAt: string;
  jobEstimateId: number;
  openingType: JobEstimateOpeningType;
  openingName: string;
  height: string;
  width: string;
  unit: string;
  quantity: string;
  description: string;
  sortOrder: number;
};


