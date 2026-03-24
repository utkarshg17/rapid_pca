import { supabase } from "@/lib/supabase/client";

export type MaterialCostPoint = {
  monthKey: string;
  label: string;
  amount: number;
};

type MaterialCostRow = {
  created_at: string;
  quantity: number;
  unit_cost: number | null;
};

function buildMonthKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function addMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export async function getMaterialCostSeries(
  projectId: number
): Promise<MaterialCostPoint[]> {
  const { data, error } = await supabase
    .from("unit_quantities")
    .select("created_at, quantity, unit_cost")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching material cost series:", error);
    return [];
  }

  const rows = (data ?? []) as MaterialCostRow[];

  if (rows.length === 0) {
    return [];
  }

  const amountByMonth = new Map<string, number>();

  rows.forEach((row) => {
    const createdAt = new Date(row.created_at);

    if (Number.isNaN(createdAt.getTime())) {
      return;
    }

    const monthDate = new Date(
      Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), 1)
    );
    const monthKey = buildMonthKey(monthDate);
    const lineAmount = row.quantity * (row.unit_cost ?? 0);

    amountByMonth.set(monthKey, (amountByMonth.get(monthKey) ?? 0) + lineAmount);
  });

  const sortedMonthKeys = Array.from(amountByMonth.keys()).sort();

  if (sortedMonthKeys.length === 0) {
    return [];
  }

  const start = new Date(`${sortedMonthKeys[0]}-01T00:00:00.000Z`);
  const end = new Date(
    `${sortedMonthKeys[sortedMonthKeys.length - 1]}-01T00:00:00.000Z`
  );

  const series: MaterialCostPoint[] = [];
  let cursor = start;

  while (cursor <= end) {
    const monthKey = buildMonthKey(cursor);

    series.push({
      monthKey,
      label: buildMonthLabel(cursor),
      amount: amountByMonth.get(monthKey) ?? 0,
    });

    cursor = addMonth(cursor);
  }

  return series;
}
