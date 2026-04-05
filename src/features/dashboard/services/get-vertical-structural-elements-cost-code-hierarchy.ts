import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackVerticalStructuralElementsNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Superstructure",
  subSubCategory: "Structural Elements",
  item: "Vertical Structural Elements",
  costCode: "B1017",
};

export async function getVerticalStructuralElementsCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Vertical Structural Elements")
    .eq("cost_code", "B1017")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching vertical structural elements cost code hierarchy:", error);
    return fallbackVerticalStructuralElementsNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackVerticalStructuralElementsNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackVerticalStructuralElementsNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackVerticalStructuralElementsNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackVerticalStructuralElementsNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackVerticalStructuralElementsNode.costCode,
  };
}
