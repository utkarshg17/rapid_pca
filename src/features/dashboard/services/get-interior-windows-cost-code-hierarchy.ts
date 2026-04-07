import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackInteriorWindowsNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Openings",
  subSubCategory: "Windows",
  item: "Interior Windows",
  costCode: "C1017",
};

export async function getInteriorWindowsCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("cost_code", "C1017")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching interior windows cost code hierarchy:", error);
    return fallbackInteriorWindowsNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackInteriorWindowsNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackInteriorWindowsNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackInteriorWindowsNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackInteriorWindowsNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackInteriorWindowsNode.costCode,
  };
}
