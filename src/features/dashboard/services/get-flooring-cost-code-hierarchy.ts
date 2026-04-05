import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackFlooringNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Finishes",
  subSubCategory: "Floor Finishes",
  item: "Flooring",
  costCode: "C3024",
};

export async function getFlooringCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Flooring")
    .eq("cost_code", "C3024")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching flooring cost code hierarchy:", error);
    return fallbackFlooringNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackFlooringNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackFlooringNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackFlooringNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackFlooringNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackFlooringNode.costCode,
  };
}

