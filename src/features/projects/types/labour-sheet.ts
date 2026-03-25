export type CrewOption = {
  crew_role_name: string;
  crew_code: string;
};

export type LabourItemOption = {
  item: string;
  cost_code: string;
};

export type LabourSheetRow = {
  id: number;
  created_at: string;
  project_id: number;
  labour_date: string;
  crew_role: string;
  crew_code: string;
  crew_name: string;
  item: string;
  cost_code: string;
  floor: number;
  zone: string;
  description: string;
  created_by_user_id: number;
  created_by_user_name: string;
  entry_group_id: number;
};

export type LabourSheetEntry = {
  id: number;
  createdAt: string;
  labourDate: string;
  createdBy: string;
  entryGroupId: string;
  rows: Array<{
    rowId: number;
    crewRole: string;
    crewCode: string;
    crewName: string;
    item: string;
    costCode: string;
    floor: string;
    zone: string;
    description: string;
  }>;
};
