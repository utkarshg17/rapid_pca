import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackInteriorDoorsNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Openings",
  subSubCategory: "Doors",
  item: "Interior Doors",
  costCode: "C1021",
};

export async function getInteriorDoorsCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("cost_code", "C1021")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching interior doors cost code hierarchy:", error);
    return fallbackInteriorDoorsNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackInteriorDoorsNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackInteriorDoorsNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackInteriorDoorsNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackInteriorDoorsNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackInteriorDoorsNode.costCode,
  };
}
