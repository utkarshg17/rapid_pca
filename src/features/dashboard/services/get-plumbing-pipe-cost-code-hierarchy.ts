import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackPlumbingPipeNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "MEP",
  subSubCategory: "Plumbing",
  item: "Plumbing Pipe",
  costCode: "D2024",
};

export async function getPlumbingPipeCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("cost_code", "D2024")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error fetching plumbing pipe cost code hierarchy:",
      error
    );
    return fallbackPlumbingPipeNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackPlumbingPipeNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackPlumbingPipeNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackPlumbingPipeNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackPlumbingPipeNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackPlumbingPipeNode.costCode,
  };
}


