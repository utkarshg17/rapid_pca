export function buildEstimateBadges({
  totalCost,
  totalQuantity,
  grossFloorArea,
  quantityUnitLabel,
}: {
  totalCost: number;
  totalQuantity: number;
  grossFloorArea: number;
  quantityUnitLabel: string;
}) {
  const safeGrossFloorArea = grossFloorArea > 0 ? grossFloorArea : 0;
  const unitQuantity =
    safeGrossFloorArea > 0 ? totalQuantity / safeGrossFloorArea : null;
  const unitCost = totalQuantity > 0 ? totalCost / totalQuantity : null;

  return [
    `Estimated Cost INR ${formatCurrencyNumber(totalCost)}`,
    unitQuantity === null
      ? "Unit Quantity (quantity/GFA): --"
      : `Unit Quantity (quantity/GFA): ${formatMetricNumber(unitQuantity)}`,
    unitCost === null
      ? "Unit Cost (cost/quantity) = --"
      : `Unit Cost (cost/quantity) = INR ${formatCurrencyNumber(unitCost)}/${quantityUnitLabel}`,
  ];
}

export function formatCurrencyNumber(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

export function formatAreaNumber(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function formatMetricNumber(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("en-IN", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })
    : "0.000";
}
