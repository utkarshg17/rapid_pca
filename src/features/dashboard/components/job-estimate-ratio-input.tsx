"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  calculateQuantityFromRatio,
  calculateQuantityPerGfa,
  formatEstimateQuantity,
  formatQuantityPerGfa,
  parseEstimateNumber,
} from "@/features/dashboard/components/job-estimate-quantity-metrics";

type JobEstimateRatioInputProps = {
  quantityValue: string;
  grossFloorArea: number;
  onQuantityChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function JobEstimateRatioInput({
  quantityValue,
  grossFloorArea,
  onQuantityChange,
  placeholder = "0",
  className,
}: JobEstimateRatioInputProps) {
  const formattedRatio = useMemo(() => {
    if (!quantityValue.trim()) {
      return "";
    }

    return formatQuantityPerGfa(
      calculateQuantityPerGfa(parseEstimateNumber(quantityValue), grossFloorArea)
    );
  }, [grossFloorArea, quantityValue]);

  const [draftValue, setDraftValue] = useState(formattedRatio);
  const [isFocused, setIsFocused] = useState(false);

  function handleChange(nextValue: string) {
    const normalizedValue = nextValue.replace(/,/g, "");

    setDraftValue(normalizedValue);

    if (!normalizedValue.trim()) {
      onQuantityChange("");
      return;
    }

    if (!/^\d*\.?\d*$/.test(normalizedValue.trim())) {
      return;
    }

    const parsedRatio = Number.parseFloat(normalizedValue);

    if (!Number.isFinite(parsedRatio)) {
      return;
    }

    onQuantityChange(
      formatEstimateQuantity(
        calculateQuantityFromRatio(parsedRatio, grossFloorArea)
      )
    );
  }

  return (
    <Input
      value={isFocused ? draftValue : formattedRatio}
      onChange={(event) => handleChange(event.target.value)}
      onFocus={() => {
        setIsFocused(true);
        setDraftValue(formattedRatio);
      }}
      onBlur={() => setIsFocused(false)}
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
    />
  );
}
