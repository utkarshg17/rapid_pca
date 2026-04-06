export function parseEstimateNumber(value: string) {
  const normalizedValue = value.replace(/,/g, "").trim();
  const parsed = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatEstimateQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatQuantityPerGfa(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value
    .toFixed(6)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

export function calculateQuantityPerGfa(quantity: number, grossFloorArea: number) {
  if (grossFloorArea <= 0) {
    return 0;
  }

  return quantity / grossFloorArea;
}

export function calculateQuantityFromRatio(quantityPerGfa: number, grossFloorArea: number) {
  if (grossFloorArea <= 0) {
    return 0;
  }

  return quantityPerGfa * grossFloorArea;
}