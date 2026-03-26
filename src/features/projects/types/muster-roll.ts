export type PettyContractorRecord = {
  id: number;
  created_at: string;
  petty_contractor_name: string;
  labour_rate: number | null;
  mason_rate: number | null;
};

export type MusterRollRowRecord = {
  id: number;
  created_at: string;
  record_date: string;
  project_id: number;
  petty_contractor_id: number | null;
  petty_contractor_name: string;
  crew_name: string;
  crew_type: string;
  regular_hours: number;
  overtime_hours: number;
  rate: number;
  entry_group_id: number | string | null;
  created_by_user_name: string;
  created_by_user_id: number;
};

export type MusterRollEntryRow = {
  rowId: number;
  pettyContractorId: number | null;
  pettyContractorName: string;
  crewName: string;
  crewType: string;
  regularHours: number;
  overtimeHours: number;
  rate: number;
  lineTotal: number;
};

export type MusterRollEntry = {
  id: number;
  createdAt: string;
  recordDate: string;
  pettyContractorSummary: string;
  createdBy: string;
  entryGroupId: string;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalAmount: number;
  rows: MusterRollEntryRow[];
};
