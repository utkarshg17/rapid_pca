export type UnitQuantityRow = {
  id: number;
  created_at: string;
  project_id: number;
  project_name: string;
  cost_code: string;
  item: string;
  quantity_parameter: string;
  quantity: number;
  unit_cost: number;
  unit: string;
  floor: number;
  zone: string;
  created_by_user_id: number;
  created_by_user_name: string;
  entry_group_id: number;
};

export type UnitQuantityEntry = {
  entryGroupId: string;
  element: string;
  costCode: string;
  floor: string;
  zone: string;
  createdAt: string;
  createdBy: string;
  totalCost: number;
  quantities: Array<{
    rowId: number;
    parameter: string;
    quantity: number;
    unitCost: number;
    unit: string;
  }>;
};
