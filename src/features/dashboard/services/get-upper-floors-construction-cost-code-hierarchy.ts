import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackUpperFloorsConstructionNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Superstructure",
  subSubCategory: "Structural Elements",
  item: "Upper Floors Construction (Slab + Beam)",
  costCode: "B1012",
};

export async function getUpperFloorsConstructionCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Upper Floors Construction (Slab + Beam)")
    .eq("cost_code", "B1012")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error fetching upper floors construction cost code hierarchy:",
      error
    );
    return fallbackUpperFloorsConstructionNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackUpperFloorsConstructionNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackUpperFloorsConstructionNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackUpperFloorsConstructionNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackUpperFloorsConstructionNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackUpperFloorsConstructionNode.costCode,
  };
}
