import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackRegularStairNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Superstructure",
  subSubCategory: "Staircases",
  item: "Regular Stair",
  costCode: "C2011",
};

export async function getRegularStairCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("cost_code", "C2011")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching regular stair cost code hierarchy:", error);
    return fallbackRegularStairNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackRegularStairNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackRegularStairNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackRegularStairNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackRegularStairNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackRegularStairNode.costCode,
  };
}
