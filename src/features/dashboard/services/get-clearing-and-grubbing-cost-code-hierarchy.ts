import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackClearingAndGrubbingNode: CostCodeHierarchyNode = {
  category: "Site Preparation",
  subCategory: "Pre-Construction",
  subSubCategory: "Clearing & Grubbing",
  item: "Clearing and Grubbing",
  costCode: "G1011",
};

export async function getClearingAndGrubbingCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Clearing and Grubbing")
    .eq("cost_code", "G1011")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching clearing and grubbing cost code hierarchy:", error);
    return fallbackClearingAndGrubbingNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackClearingAndGrubbingNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackClearingAndGrubbingNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackClearingAndGrubbingNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackClearingAndGrubbingNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackClearingAndGrubbingNode.costCode,
  };
}
