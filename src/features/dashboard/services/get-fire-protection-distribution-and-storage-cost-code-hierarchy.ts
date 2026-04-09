import { supabase } from "@/lib/supabase/client";
import type { CostCodeHierarchyNode } from "@/features/dashboard/types/job-estimate";

const fallbackFireProtectionDistributionAndStorageNode: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "MEP",
  subSubCategory: "Fire Protection",
  item: "Fire Protection Distribution and Storage",
  costCode: "G3014",
};

export async function getFireProtectionDistributionAndStorageCostCodeHierarchy(): Promise<CostCodeHierarchyNode> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("category, sub_category, sub_sub_category, item, cost_code")
    .eq("cost_code", "G3014")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error fetching fire protection distribution and storage cost code hierarchy:",
      error
    );
    return fallbackFireProtectionDistributionAndStorageNode;
  }

  return {
    category:
      typeof data?.category === "string" && data.category.trim()
        ? data.category
        : fallbackFireProtectionDistributionAndStorageNode.category,
    subCategory:
      typeof data?.sub_category === "string" && data.sub_category.trim()
        ? data.sub_category
        : fallbackFireProtectionDistributionAndStorageNode.subCategory,
    subSubCategory:
      typeof data?.sub_sub_category === "string" && data.sub_sub_category.trim()
        ? data.sub_sub_category
        : fallbackFireProtectionDistributionAndStorageNode.subSubCategory,
    item:
      typeof data?.item === "string" && data.item.trim()
        ? data.item
        : fallbackFireProtectionDistributionAndStorageNode.item,
    costCode:
      typeof data?.cost_code === "string" && data.cost_code.trim()
        ? data.cost_code
        : fallbackFireProtectionDistributionAndStorageNode.costCode,
  };
}
