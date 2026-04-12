import { supabase } from "@/lib/supabase/client";
import { formatDisplayMonthYear } from "@/lib/date-format";

export type LabourCostPoint = {
  monthKey: string;
  label: string;
  amount: number;
};

type LabourCostRow = {
  record_date: string;
  regular_hours: number | null;
  overtime_hours: number | null;
  rate: number | null;
  advance_payment: number | null;
};

function buildMonthKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildMonthLabel(date: Date) {
  return formatDisplayMonthYear(buildMonthKey(date), buildMonthKey(date));
}

function addMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function parseRecordDate(recordDate: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(recordDate);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  return new Date(recordDate);
}

export async function getLabourCostSeries(
  projectId: number
): Promise<LabourCostPoint[]> {
  const { data, error } = await supabase
    .from("muster_roll")
    .select("record_date, regular_hours, overtime_hours, rate, advance_payment")
    .eq("project_id", projectId)
    .order("record_date", { ascending: true });

  if (error) {
    console.error("Error fetching labour cost series:", error);
    return [];
  }

  const rows = (data ?? []) as LabourCostRow[];

  if (rows.length === 0) {
    return [];
  }

  const amountByMonth = new Map<string, number>();

  rows.forEach((row) => {
    if ((row.advance_payment ?? 0) > 0) {
      return;
    }

    const recordDate = parseRecordDate(row.record_date);

    if (Number.isNaN(recordDate.getTime())) {
      return;
    }

    const monthDate = new Date(
      Date.UTC(recordDate.getUTCFullYear(), recordDate.getUTCMonth(), 1)
    );
    const monthKey = buildMonthKey(monthDate);
    const regularHours = Number(row.regular_hours ?? 0);
    const overtimeHours = Number(row.overtime_hours ?? 0);
    const rate = Number(row.rate ?? 0);
    const lineAmount = ((regularHours + overtimeHours) * rate) / 12;

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

  const series: LabourCostPoint[] = [];
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
