import { createGfaFixtureDraftHandler } from "@/app/api/job-estimates/shared-gfa-fixture-draft";

export const POST = createGfaFixtureDraftHandler({
  itemName: "Electrical Fixtures",
  costCode: "D5046",
  schemaName: "electrical_fixtures_cost_draft",
  searchTerms: [
    "electrical fixture",
    "fan",
    "light",
    "switch",
    "socket",
    "plug point",
    "ac point",
    "electrical fittings",
  ],
  includedScope: [
    "fans",
    "AC fixture or AC point allowance where applicable",
    "switches",
    "plug-points",
    "sockets",
    "lights",
    "light fixtures",
    "small electrical accessories related to fixtures",
  ],
  excludedScope: [
    "conduiting pipe",
    "concealed conduit network",
    "wiring network already accounted for under Electrical Conduting",
    "distribution boxes already accounted for under Electrical Conduting",
  ],
  materialScope:
    "Material cost per sq.ft of GFA should include fans, AC fixture or point allowances where applicable, switches, plug-points, sockets, lights, fixture hardware, and clearly necessary electrical fixture accessories.",
  labourScope:
    "Labour cost per sq.ft of GFA should include fixture installation labour, switch and socket fixing, light and fan installation, testing support, and related electrical fixture labour.",
  equipmentScope:
    "Equipment cost per sq.ft of GFA may include small installation tools, ladders or access support, testing equipment, and other clearly applicable fixture installation equipment. Use 0 when equipment is not materially applicable.",
});
