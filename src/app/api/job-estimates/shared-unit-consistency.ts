export const sharedUnitConsistencyNotes = [
  "All area inputs in the payload are in sq.ft unless explicitly stated otherwise.",
  "If you assume or use any thickness in mm, convert mm to meters before calculating volume.",
  "When deriving volume from area and thickness, first convert sq.ft to sq.m using 1 sq.ft = 0.092903 sq.m, then multiply by thickness in meters to get cu.m.",
  "Do not return cu.ft or mixed units when the schema expects cu.m.",
  "Return final values only in the exact units requested by the schema.",
];

export const sharedUnitConsistencyInstruction =
  "Unit consistency is critical. All area inputs are in sq.ft unless explicitly stated otherwise. If you use any assumed thickness in mm, convert mm to meters first. When deriving volume from area and thickness, convert sq.ft to sq.m using 1 sq.ft = 0.092903 sq.m, then multiply by thickness in meters to get cu.m. Never return cu.ft or mixed units when the schema expects cu.m. Return final values only in the exact units required by the schema.";
