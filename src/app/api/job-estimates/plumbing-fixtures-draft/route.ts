import { createGfaFixtureDraftHandler } from "@/app/api/job-estimates/shared-gfa-fixture-draft";

export const POST = createGfaFixtureDraftHandler({
  itemName: "Plumbing Fixtures",
  costCode: "D2019",
  schemaName: "plumbing_fixtures_cost_draft",
  searchTerms: [
    "plumbing fixture",
    "sanitary fixture",
    "tap",
    "wc",
    "water closet",
    "sink",
    "wash basin",
    "urinal",
    "cp fitting",
  ],
  includedScope: [
    "taps",
    "WCs",
    "sinks",
    "wash basins",
    "urinals",
    "CP fittings",
    "sanitary fixtures",
    "small fixture accessories",
  ],
  excludedScope: [
    "plumbing pipe network",
    "water supply pipework",
    "drainage pipework",
    "pumps",
    "major plumbing equipment",
  ],
  materialScope:
    "Material cost per sq.ft of GFA should include taps, WCs, sinks, wash basins, urinals, CP fittings, sanitary fixtures, traps or small accessories where appropriate, and clearly necessary plumbing fixture accessories.",
  labourScope:
    "Labour cost per sq.ft of GFA should include fixture installation, fixing, alignment, connection support at fixture points, testing support, and related plumbing fixture labour.",
  equipmentScope:
    "Equipment cost per sq.ft of GFA may include small tools, testing equipment, access support, and other clearly applicable fixture installation equipment. Use 0 when equipment is not materially applicable.",
});
