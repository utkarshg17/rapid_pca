import type { ProjectRecord } from "@/features/projects/types/project";

type ProjectTypeRelation =
  | {
      id: number;
      type_name: string;
    }
  | {
      id: number;
      type_name: string;
    }[]
  | null
  | undefined;

export type RawProjectRecord = Omit<ProjectRecord, "project_type_options"> & {
  project_type_options: ProjectTypeRelation;
};

function normalizeProjectTypeRelation(relation: ProjectTypeRelation) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

export function normalizeProjectRecord(raw: RawProjectRecord): ProjectRecord {
  return {
    ...raw,
    project_type_options: normalizeProjectTypeRelation(raw.project_type_options),
  };
}

export function normalizeProjectRecords(rawRecords: RawProjectRecord[]) {
  return rawRecords.map(normalizeProjectRecord);
}
