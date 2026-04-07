import { createDesignServiceDraftHandler } from "@/app/api/job-estimates/shared-design-service-draft";

export const POST = createDesignServiceDraftHandler({
  itemName: "Interior Design Services",
  costCode: "Z1020",
  schemaName: "interior_design_services_cost_draft",
  serviceDescription:
    "interior design, interior space planning, interior finishes coordination, and interior drawing services",
  pricingQuestion:
    "Based on the project type, region, area takeoffs, finishes, and fit-out complexity, estimate the appropriate interior design service fee rate in INR per sq.ft of GFA.",
});
