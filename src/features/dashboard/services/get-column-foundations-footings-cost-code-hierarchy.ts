import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackColumnFoundationsFootingsNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Substructure",
  subSubCategory: "Foundations",
  item: "Column Foundations + Footings",
  costCode: "A1012",
};

export async function getColumnFoundationsFootingsCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("item", "Column Foundations + Footings")
    .eq("cost_code", "A1012")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error fetching column foundations + footings cost code hierarchy:",
      error
    );
    return fallbackColumnFoundationsFootingsNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackColumnFoundationsFootingsNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackColumnFoundationsFootingsNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackColumnFoundationsFootingsNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackColumnFoundationsFootingsNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackColumnFoundationsFootingsNode.costCode,
  };
}
