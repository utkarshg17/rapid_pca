import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackRoofWaterproofingNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Envelope",
  subSubCategory: "Roofing & Waterproofing",
  item: "Roof Waterproofing",
  costCode: "B3017",
};

export async function getRoofWaterproofingCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Roof Waterproofing")
    .eq("cost_code", "B3017")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching roof waterproofing cost code hierarchy:", error);
    return fallbackRoofWaterproofingNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackRoofWaterproofingNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackRoofWaterproofingNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackRoofWaterproofingNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackRoofWaterproofingNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackRoofWaterproofingNode.costCode,
  };
}
