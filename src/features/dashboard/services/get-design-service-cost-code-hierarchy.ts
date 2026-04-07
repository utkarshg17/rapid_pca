import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackNodes: Record<string, CostCodeHierarchyNode> = {
  Z1010: {
    category: "Professional Services",
    subCategory: "Design",
    subSubCategory: "Architecture",
    item: "Architectural Design",
    costCode: "Z1010",
  },
  Z1020: {
    category: "Professional Services",
    subCategory: "Design",
    subSubCategory: "Interiors",
    item: "Interior Design Services",
    costCode: "Z1020",
  },
  Z1030: {
    category: "Professional Services",
    subCategory: "Design",
    subSubCategory: "Structural",
    item: "Structural Engineering",
    costCode: "Z1030",
  },
  Z1040: {
    category: "Professional Services",
    subCategory: "Design",
    subSubCategory: "MEP",
    item: "MEP Engineering",
    costCode: "Z1040",
  },
  Z1050: {
    category: "Professional Services",
    subCategory: "Design",
    subSubCategory: "Fire Protection",
    item: "Fire Protection Design",
    costCode: "Z1050",
  },
};

export async function getDesignServiceCostCodeHierarchy(
  costCode: keyof typeof fallbackNodes
): Promise<CostCodeHierarchyNode> {
  const fallbackNode = fallbackNodes[costCode];
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("cost_code", costCode)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching ${costCode} design service hierarchy:`, error);
    return fallbackNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackNode.costCode,
  };
}
