import { createDesignServiceDraftHandler } from "@/app/api/job-estimates/shared-design-service-draft";

export const POST = createDesignServiceDraftHandler({
  itemName: "Architectural Design",
  costCode: "Z1010",
  schemaName: "architectural_design_cost_draft",
  serviceDescription:
    "architectural planning, concept design, design development, coordination support, and architectural drawing services",
  pricingQuestion:
    "Based on the project type, region, building size, floor count, and complexity, estimate the appropriate architectural design fee rate in INR per sq.ft of GFA.",
});
