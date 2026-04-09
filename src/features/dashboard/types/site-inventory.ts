export type SiteInventorySourceType = "Site" | "Supplier" | "Other";

export type SiteInventoryUnit = "Bags" | "cu.m" | "sq.ft" | "count" | "litre" | "kg" | "ton";

export type SiteInventorySourceRecord = {
  id: number;
  created_at: string;
  source_name: string;
  source_type: string;
  created_by_id: string | null;
  created_by_name: string | null;
  is_active: boolean | null;
};

export type SiteInventorySource = {
  id: number;
  createdAt: string;
  sourceName: string;
  sourceType: SiteInventorySourceType;
  createdById: string | null;
  createdByName: string;
  isActive: boolean;
};

export type SiteInventoryItemRecord = {
  id: number;
  created_at: string;
  item_name: string;
  default_unit: string;
  category: string | null;
  description: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
  is_active: boolean | null;
};

export type SiteInventoryItem = {
  id: number;
  createdAt: string;
  itemName: string;
  defaultUnit: SiteInventoryUnit;
  category: string;
  description: string;
  createdById: string | null;
  createdByName: string;
  isActive: boolean;
};

export type SiteInventoryTransactionRecord = {
  id: number;
  created_at: string;
  transaction_date: string;
  from_source_id: number;
  to_source_id: number;
  challan_bill_no: string | null;
  vehicle_number: string | null;
  remarks: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
  status: string | null;
};

export type SiteInventoryTransactionLineRecord = {
  id: number;
  created_at: string;
  transaction_id: number;
  item_id: number;
  quantity: number;
  unit: string;
  remarks: string | null;
  sort_order: number | null;
};

export type SiteInventoryTransactionLine = {
  id: number;
  createdAt: string;
  transactionId: number;
  itemId: number;
  itemName: string;
  itemCategory: string;
  quantity: number;
  unit: SiteInventoryUnit;
  remarks: string;
  sortOrder: number;
};

export type SiteInventoryTransaction = {
  id: number;
  createdAt: string;
  transactionDate: string;
  fromSourceId: number;
  fromSourceName: string;
  fromSourceType: SiteInventorySourceType;
  toSourceId: number;
  toSourceName: string;
  toSourceType: SiteInventorySourceType;
  challanBillNo: string;
  vehicleNumber: string;
  remarks: string;
  createdById: string | null;
  createdByName: string;
  status: string;
  lines: SiteInventoryTransactionLine[];
};

export type SiteInventoryBalanceRecord = {
  id: number;
  created_at: string;
  updated_at: string;
  site_source_id: number;
  item_id: number;
  unit: string;
  quantity_on_hand: number;
};

export type SiteInventoryBalance = {
  id: number;
  createdAt: string;
  updatedAt: string;
  siteSourceId: number;
  siteName: string;
  itemId: number;
  itemName: string;
  itemCategory: string;
  unit: SiteInventoryUnit;
  quantityOnHand: number;
};

export type SaveSiteInventorySourceInput = {
  id?: number;
  sourceName: string;
  sourceType: SiteInventorySourceType;
  createdById: string | null;
  createdByName: string;
  isActive: boolean;
};

export type SaveSiteInventoryItemInput = {
  id?: number;
  itemName: string;
  defaultUnit: SiteInventoryUnit;
  category: string;
  description: string;
  createdById: string | null;
  createdByName: string;
  isActive: boolean;
};

export type CreateSiteInventoryTransactionInput = {
  transactionDate: string;
  fromSourceId: number;
  toSourceId: number;
  challanBillNo: string;
  vehicleNumber: string;
  remarks: string;
  createdById: string | null;
  createdByName: string;
  lines: Array<{
    itemId: number;
    quantity: number;
    unit: SiteInventoryUnit;
    remarks: string;
  }>;
};
export type UpdateSiteInventoryTransactionInput = {
  transactionId: number;
  transactionDate: string;
  fromSourceId: number;
  toSourceId: number;
  challanBillNo: string;
  vehicleNumber: string;
  remarks: string;
  lines: Array<{
    itemId: number;
    quantity: number;
    unit: SiteInventoryUnit;
    remarks: string;
  }>;
};
