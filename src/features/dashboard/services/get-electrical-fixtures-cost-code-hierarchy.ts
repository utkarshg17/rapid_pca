import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackElectricalFixturesNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "MEP",
  subSubCategory: "Electrical",
  item: "Electrical Fixtures",
  costCode: "D5046",
};

export async function getElectricalFixturesCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("cost_code", "D5046")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching electrical fixtures cost code hierarchy:", error);
    return fallbackElectricalFixturesNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackElectricalFixturesNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackElectricalFixturesNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackElectricalFixturesNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackElectricalFixturesNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackElectricalFixturesNode.costCode,
  };
}
