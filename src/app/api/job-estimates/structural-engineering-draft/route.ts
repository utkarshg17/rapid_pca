import { createDesignServiceDraftHandler } from "@/app/api/job-estimates/shared-design-service-draft";

export const POST = createDesignServiceDraftHandler({
  itemName: "Structural Engineering",
  costCode: "Z1030",
  schemaName: "structural_engineering_cost_draft",
  serviceDescription:
    "structural analysis, design, coordination, structural drawings, and engineering design services",
  pricingQuestion:
    "Based on the structural system, foundation type, floor count, basement complexity, region, and project type, estimate the appropriate structural engineering fee rate in INR per sq.ft of GFA.",
});
