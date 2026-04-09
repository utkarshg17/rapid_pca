import { createGfaFixtureDraftHandler } from "@/app/api/job-estimates/shared-gfa-fixture-draft";

export const POST = createGfaFixtureDraftHandler({
  itemName: "Fire Protection Distribution and Storage",
  costCode: "G3014",
  schemaName: "fire_protection_distribution_and_storage_cost_draft",
  searchTerms: [
    "fire protection distribution",
    "fire sprinkler system",
    "fire fighting pipe",
    "sprinkler piping",
    "sprinkler head",
    "hydrant pipe building",
    "fire alarm and sprinkler fittings",
    "fire protection storage tank internal building allowance",
  ],
  includedScope: [
    "internal fire protection distribution pipes",
    "sprinklers",
    "sprinkler heads",
    "internal fire-fighting fittings",
    "valves",
    "landing valves where relevant inside the building",
    "internal fire protection equipment and accessories",
    "storage allowance tied to the building fire protection system where relevant",
  ],
  excludedScope: [
    "external site-wide fire network outside the building",
    "external fire hydrant yard piping",
    "external underground fire lines beyond the building scope",
    "site-level external tanks and infrastructure clearly outside the building",
  ],
  materialScope:
    "Material cost per sq.ft of GFA should include internal fire protection distribution pipes, sprinklers, sprinkler heads, pipe fittings, supports, valves, internal fire-fighting accessories, and clearly applicable building-level fire protection materials. Do not include external site-wide fire infrastructure outside the building.",
  labourScope:
    "Labour cost per sq.ft of GFA should include internal fire protection pipe installation, sprinkler installation, fittings fixing, supports, testing support, and related fire protection installation labour within the building.",
  equipmentScope:
    "Equipment cost per sq.ft of GFA may include threading or cutting tools, lifting or access support, testing equipment, and other clearly applicable building-level fire protection installation equipment. Use 0 when equipment is not materially applicable.",
});
