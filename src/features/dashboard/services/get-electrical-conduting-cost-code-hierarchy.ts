import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackElectricalCondutingNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "MEP",
  subSubCategory: "Electrical",
  item: "Electrical Conduting",
  costCode: "D5013",
};

export async function getElectricalCondutingCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("cost_code", "D5013")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error fetching electrical conduting cost code hierarchy:",
      error
    );
    return fallbackElectricalCondutingNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackElectricalCondutingNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackElectricalCondutingNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackElectricalCondutingNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackElectricalCondutingNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackElectricalCondutingNode.costCode,
  };
}
