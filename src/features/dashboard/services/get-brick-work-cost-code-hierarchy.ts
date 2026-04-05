import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackBrickWorkNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Masonry",
  subSubCategory: "Brickwork",
  item: "Brick Work",
  costCode: "C1018",
};

export async function getBrickWorkCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Brick Work")
    .eq("cost_code", "C1018")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching brick work cost code hierarchy:", error);
    return fallbackBrickWorkNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackBrickWorkNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackBrickWorkNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackBrickWorkNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackBrickWorkNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackBrickWorkNode.costCode,
  };
}

