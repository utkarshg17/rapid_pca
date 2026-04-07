import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackPlumbingFixturesNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "MEP",
  subSubCategory: "Plumbing",
  item: "Plumbing Fixtures",
  costCode: "D2019",
};

export async function getPlumbingFixturesCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("cost_code", "D2019")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching plumbing fixtures cost code hierarchy:", error);
    return fallbackPlumbingFixturesNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackPlumbingFixturesNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackPlumbingFixturesNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackPlumbingFixturesNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackPlumbingFixturesNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackPlumbingFixturesNode.costCode,
  };
}
