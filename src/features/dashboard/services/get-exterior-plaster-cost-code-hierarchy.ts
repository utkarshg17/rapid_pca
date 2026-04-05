import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackExteriorPlasterNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Envelope",
  subSubCategory: "Exterior Finishes",
  item: "Exterior Plaster",
  costCode: "B2016",
};

export async function getExteriorPlasterCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Exterior Plaster")
    .eq("cost_code", "B2016")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching exterior plaster cost code hierarchy:", error);
    return fallbackExteriorPlasterNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackExteriorPlasterNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackExteriorPlasterNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackExteriorPlasterNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackExteriorPlasterNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackExteriorPlasterNode.costCode,
  };
}
