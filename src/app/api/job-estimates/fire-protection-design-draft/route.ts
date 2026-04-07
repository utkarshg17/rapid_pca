import { createDesignServiceDraftHandler } from "@/app/api/job-estimates/shared-design-service-draft";

export const POST = createDesignServiceDraftHandler({
  itemName: "Fire Protection Design",
  costCode: "Z1050",
  schemaName: "fire_protection_design_cost_draft",
  serviceDescription:
    "fire protection design, fire-safety coordination, fire drawings, and related design services",
  pricingQuestion:
    "Based on the project type, floor count, region, building size, occupancy complexity, and fire-protection design needs, estimate the appropriate fire protection design fee rate in INR per sq.ft of GFA.",
});
