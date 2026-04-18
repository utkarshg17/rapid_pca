import { supabase } from "@/lib/supabase/client";
import type { SchedulerCostCodeItemOption } from "@/features/projects/types/scheduler";

export async function getSchedulerCostCodeItemOptions(): Promise<
  SchedulerCostCodeItemOption[]
> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("item, cost_code")
    .order("item", { ascending: true });

  if (error) {
    console.error("Error fetching scheduler cost code item options:", error);
    return [];
  }

  const uniqueOptions = new Map<string, SchedulerCostCodeItemOption>();

  (data ?? []).forEach((row) => {
    if (typeof row.item !== "string" || typeof row.cost_code !== "string") {
      return;
    }

    const item = row.item.trim();
    const costCode = row.cost_code.trim();

    if (!item || !costCode) {
      return;
    }

    const key = `${item}::${costCode}`;

    if (!uniqueOptions.has(key)) {
      uniqueOptions.set(key, {
        item,
        costCode,
      });
    }
  });

  return Array.from(uniqueOptions.values());
}
