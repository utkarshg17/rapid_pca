export type SubContractorRecord = {
  id: number;
  created_at: string;
  sub_contractor_name: string;
  trade: string;
  rate: number | null;
  unit: string;
};

export type ProductionLogRecord = {
  id: number;
  created_at: string;
  project_id: number;
  record_date: string;
  sub_contractor: string;
  trade: string;
  man_hours: number | null;
  quantity: number | null;
  unit: string;
  rate: number | null;
  amount: number | null;
  item: string;
  cost_code: string;
  created_by_id: number | null;
  created_by_name: string;
};

export type ProductionLogEntry = {
  id: number;
  createdAt: string;
  projectId: number;
  recordDate: string;
  subContractorId: number | null;
  subContractorName: string;
  item: string;
  costCode: string;
  trade: string;
  manHours: number;
  quantity: number;
  unit: string;
  rate: number;
  rateUnit: string;
  amount: number;
  createdById: number | null;
  createdBy: string;
};
