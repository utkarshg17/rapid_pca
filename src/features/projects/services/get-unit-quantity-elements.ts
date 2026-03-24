import { supabase } from "@/lib/supabase/client";

export type UnitQuantityElementOption = {
  cost_code: string;
  item: string;
};

const supportedCostCodes = new Set([
  "B1017",
  "B1012",
  "A1032",
  "A1012",
  "C2011",
  "B2068",
  "C3015",
]);

const fallbackElements: UnitQuantityElementOption[] = [
  {
    cost_code: "B1017",
    item: "Vertical Structural Elements (Concrete)",
  },
  {
    cost_code: "B1012",
    item: "Upper Floors Construction (Slab + Beam)",
  },
  {
    cost_code: "A1032",
    item: "Structural Slab on Grade",
  },
  {
    cost_code: "A1012",
    item: "Column Foundations + Footings",
  },
  {
    cost_code: "C2011",
    item: "Regular Stair",
  },
  {
    cost_code: "B2068",
    item: "Exterior Paint",
  },
  {
    cost_code: "C3015",
    item: "Interior Paint",
  },
];

export async function getUnitQuantityElements(): Promise<
  UnitQuantityElementOption[]
> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("cost_code, item")
    .order("item", { ascending: true });

  if (error) {
    console.warn("Error fetching unit quantity elements:", error.message);
    return fallbackElements;
  }

  const filteredElements = (data ?? []).filter(
    (element) =>
      typeof element.cost_code === "string" &&
      typeof element.item === "string" &&
      supportedCostCodes.has(element.cost_code)
  ) as UnitQuantityElementOption[];

  return filteredElements.length > 0 ? filteredElements : fallbackElements;
}
