import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackInteriorPlasterNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Interior Construction",
  subSubCategory: "Interior Finishes",
  item: "Interior Plaster",
  costCode: "C3014",
};

export async function getInteriorPlasterCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Interior Plaster")
    .eq("cost_code", "C3014")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching interior plaster cost code hierarchy:", error);
    return fallbackInteriorPlasterNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackInteriorPlasterNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackInteriorPlasterNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackInteriorPlasterNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackInteriorPlasterNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackInteriorPlasterNode.costCode,
  };
}
