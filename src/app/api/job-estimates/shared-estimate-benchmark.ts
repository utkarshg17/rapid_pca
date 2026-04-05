type GrossFloorAreaInput = {
  superstructureFootprint?: string;
  stiltFloorCount?: string;
  floorCount?: string;
};

export function calculateGrossFloorAreaSqft({
  superstructureFootprint,
  stiltFloorCount,
  floorCount,
}: GrossFloorAreaInput) {
  const footprint = parseOptionalNumber(superstructureFootprint);
  const stiltCount = parseOptionalNumber(stiltFloorCount);
  const floors = parseOptionalNumber(floorCount);

  return footprint * (stiltCount + floors);
}

function parseOptionalNumber(value?: string) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
