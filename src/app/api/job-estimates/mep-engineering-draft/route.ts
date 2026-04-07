import { createDesignServiceDraftHandler } from "@/app/api/job-estimates/shared-design-service-draft";

export const POST = createDesignServiceDraftHandler({
  itemName: "MEP Engineering",
  costCode: "Z1040",
  schemaName: "mep_engineering_cost_draft",
  serviceDescription:
    "mechanical, electrical, and plumbing engineering design, coordination, drawings, and related design services",
  pricingQuestion:
    "Based on the project type, MEP intensity implied by the room program, openings, finishes, region, and building size, estimate the appropriate MEP engineering fee rate in INR per sq.ft of GFA.",
});
