import { createClient } from "@supabase/supabase-js";

import { env, validateEnv } from "@/lib/utils/env";

export type DsrRateReference = {
  code: string;
  description: string;
  unit: string;
  basicRate: number;
};

type FetchRelevantDsrRatesInput = {
  searchTerms: string[];
  targetUnits?: string[];
  maxRows?: number;
};

type DsrRateRecord = {
  code: string | null;
  description: string | null;
  unit: string | null;
  basic_rate: number | null;
};

export function buildDsrPromptNotes(targetUnitLabel: string) {
  return [
    "Use the provided dsrReferenceRates as your primary pricing anchor instead of inventing rates from scratch.",
    `Prefer the closest DSR descriptions whose unit already matches ${targetUnitLabel}, or can be sensibly compared to it.`,
    `If the closest relevant DSR row is in a different but convertible unit than ${targetUnitLabel}, convert it carefully before using it in the estimate.`,
    "Only apply physically valid conversions such as sq.m to sq.ft, cu.m to cu.ft, meter to foot, or kg to ton where they are actually compatible.",
    "Do not force invalid conversions across unlike unit families such as area to volume or ton to cu.m unless a clear engineering basis is explicitly justified.",
    "If more than one DSR row is relevant, combine them carefully and conservatively rather than ignoring them.",
    "If you convert a DSR rate, state the original unit, the converted unit, and the conversion basis briefly in assumptions.",
    "If you adjust away from the closest DSR reference due to scope differences, state that briefly in assumptions.",
  ];
}

export async function fetchRelevantDsrRates({
  searchTerms,
  targetUnits = [],
  maxRows = 20,
}: FetchRelevantDsrRatesInput): Promise<DsrRateReference[]> {
  try {
    validateEnv();

    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
    const normalizedTerms = Array.from(
      new Set(
        searchTerms
          .flatMap((term) => normalizeSearchTerm(term).split(" "))
          .filter((term) => term.length >= 3)
      )
    ).slice(0, 10);

    let query = supabase
      .from("dsr_rates")
      .select("code, description, unit, basic_rate")
      .limit(250);

    if (normalizedTerms.length > 0) {
      const orFilters = normalizedTerms
        .map((term) => `description.ilike.%${escapeForIlike(term)}%`)
        .join(",");

      query = query.or(orFilters);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching DSR rates:", error);
      return [];
    }

    return ((data ?? []) as DsrRateRecord[])
      .map((row) => {
        const description = row.description?.trim() ?? "";
        const unit = row.unit?.trim() ?? "";
        const basicRate = row.basic_rate ?? 0;

        return {
          code: row.code?.trim() ?? "",
          description,
          unit,
          basicRate,
          score: scoreDsrRow(
            {
              code: row.code?.trim() ?? "",
              description,
              unit,
              basicRate,
            },
            normalizedTerms,
            targetUnits
          ),
        };
      })
      .filter((row) => row.description && row.unit && Number.isFinite(row.basicRate))
      .sort(
        (left, right) =>
          right.score - left.score || left.description.localeCompare(right.description)
      )
      .slice(0, maxRows)
      .map(({ code, description, unit, basicRate }) => ({
        code,
        description,
        unit,
        basicRate,
      }));
  } catch (error) {
    console.error("Failed to resolve DSR rates for a job estimate prompt:", error);
    return [];
  }
}

function scoreDsrRow(
  row: { code: string; description: string; unit: string; basicRate: number },
  terms: string[],
  targetUnits: string[]
) {
  const normalizedDescription = row.description.toLowerCase();
  const normalizedCode = row.code.toLowerCase();
  const normalizedUnit = row.unit.toLowerCase();

  let score = 0;

  for (const term of terms) {
    if (normalizedDescription.includes(term)) {
      score += normalizedDescription.startsWith(term) ? 10 : 6;
    }

    if (normalizedCode.includes(term)) {
      score += 3;
    }
  }

  if (targetUnits.some((unit) => unit.toLowerCase() === normalizedUnit)) {
    score += 8;
  }

  return score;
}

function normalizeSearchTerm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+./ ]+/g, " ").replace(/\s+/g, " ").trim();
}

function escapeForIlike(value: string) {
  return value.replace(/[%_,]/g, "");
}
