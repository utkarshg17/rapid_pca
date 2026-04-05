import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackInteriorPaintNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Interior Finishes",
  subSubCategory: "Paints",
  item: "Interior Paint",
  costCode: "C3015",
};

export async function getInteriorPaintCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Interior Paint")
    .eq("cost_code", "C3015")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching interior paint cost code hierarchy:", error);
    return fallbackInteriorPaintNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackInteriorPaintNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackInteriorPaintNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackInteriorPaintNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackInteriorPaintNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackInteriorPaintNode.costCode,
  };
}
