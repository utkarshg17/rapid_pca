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
