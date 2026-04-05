import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackExteriorPaintNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Envelope",
  subSubCategory: "Exterior Finishes",
  item: "Exterior Paint",
  costCode: "B2018",
};

export async function getExteriorPaintCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Exterior Paint")
    .eq("cost_code", "B2018")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching exterior paint cost code hierarchy:", error);
    return fallbackExteriorPaintNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackExteriorPaintNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackExteriorPaintNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackExteriorPaintNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackExteriorPaintNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackExteriorPaintNode.costCode,
  };
}
