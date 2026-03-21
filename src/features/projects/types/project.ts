export type ProjectTypeOption = {
  id: number;
  type_name: string;
  display_order: number;
  is_active: boolean;
};

export type ProjectRecord = {
  id: number;
  created_at: string;
  project_name: string;
  project_code: string;
  expected_start_date: string | null;
  plot_area: number | null;
  project_footprint: number | null;
  basement_count: number | null;
  stilt_count: number | null;
  podium_count: number | null;
  floor_count: number | null;
  foundation_type: string | null;
  super_structure_type: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  site_address: string | null;
  client_name: string | null;
  architect: string | null;
  project_manager: string | null;
  site_incharge: string | null;
  is_active: boolean;
  project_type_options: {
    id: number;
    type_name: string;
  } | null;
};

export type ProjectAccessUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_id: string | null;
  role: string | null;
};

export type CreateProjectInput = {
  project_name: string;
  project_type_id: number;
  expected_start_date: string | null;
  plot_area: number | null;
  project_footprint: number | null;
  basement_count: number | null;
  stilt_count: number | null;
  podium_count: number | null;
  floor_count: number | null;
  foundation_type: string | null;
  super_structure_type: string | null;
  city: string;
  state: string;
  country: string;
  site_address: string;
  client_name: string;
  architect: string;
  project_manager: string;
  site_incharge: string;
};
