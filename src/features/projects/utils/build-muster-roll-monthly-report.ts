import type { MusterRollEntry } from "@/features/projects/types/muster-roll";

export type MonthlyMusterRollReportRow = {
  pettyContractorId: number | null;
  pettyContractorName: string;
  crewName: string;
  crewType: string;
  rate: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  totalAmount: number;
  dailyHours: Record<
    string,
    {
      regularHours: number;
      overtimeHours: number;
    }
  >;
};

export type MonthlyMusterRollReport = {
  monthValue: string;
  dayKeys: string[];
  rows: MonthlyMusterRollReportRow[];
};

export function buildMonthlyMusterRollReport(
  entries: MusterRollEntry[],
  monthValue: string
): MonthlyMusterRollReport {
  const dayKeys = buildMonthDayKeys(monthValue);
  const rowMap = new Map<
    string,
    {
      pettyContractorId: number | null;
      pettyContractorName: string;
      crewName: string;
      crewType: string;
      rate: number;
      lastUsedAt: string;
      dailyHours: MonthlyMusterRollReportRow["dailyHours"];
    }
  >();

  entries.forEach((entry) => {
    const recordDate = toInputDate(entry.recordDate);

    if (!recordDate.startsWith(`${monthValue}-`)) {
      return;
    }

    entry.rows.forEach((row) => {
      const pettyContractorName = row.pettyContractorName.trim();
      const pettyContractorKey = row.pettyContractorId ?? `name:${pettyContractorName}`;
      const normalizedCrewName = normalizeCrewName(row.crewName);

      if (!normalizedCrewName || !pettyContractorName) {
        return;
      }

      const rowKey = `${pettyContractorKey}::${normalizedCrewName}`;
      const existingRow = rowMap.get(rowKey);
      const nextDailyHours = {
        ...(existingRow?.dailyHours ?? {}),
      };
      const existingDayHours = nextDailyHours[recordDate] ?? {
        regularHours: 0,
        overtimeHours: 0,
      };

      nextDailyHours[recordDate] = {
        regularHours: existingDayHours.regularHours + row.regularHours,
        overtimeHours: existingDayHours.overtimeHours + row.overtimeHours,
      };

      const shouldReplaceMetadata =
        !existingRow ||
        compareDateValues(recordDate, existingRow.lastUsedAt) >= 0;

      rowMap.set(rowKey, {
        pettyContractorId: shouldReplaceMetadata
          ? row.pettyContractorId
          : existingRow.pettyContractorId,
        pettyContractorName: shouldReplaceMetadata
          ? pettyContractorName
          : existingRow.pettyContractorName,
        crewName: shouldReplaceMetadata ? row.crewName : existingRow.crewName,
        crewType: shouldReplaceMetadata ? row.crewType : existingRow.crewType,
        rate: shouldReplaceMetadata ? row.rate : existingRow.rate,
        lastUsedAt: shouldReplaceMetadata ? recordDate : existingRow.lastUsedAt,
        dailyHours: nextDailyHours,
      });
    });
  });

  const rows: MonthlyMusterRollReportRow[] = Array.from(rowMap.values())
    .map((row) => {
      const totalRegularHours = dayKeys.reduce(
        (sum, dayKey) => sum + (row.dailyHours[dayKey]?.regularHours ?? 0),
        0
      );
      const totalOvertimeHours = dayKeys.reduce(
        (sum, dayKey) => sum + (row.dailyHours[dayKey]?.overtimeHours ?? 0),
        0
      );
      const totalHours = totalRegularHours + totalOvertimeHours;

      return {
        pettyContractorId: row.pettyContractorId,
        pettyContractorName: row.pettyContractorName,
        crewName: row.crewName,
        crewType: row.crewType,
        rate: row.rate,
        totalRegularHours,
        totalOvertimeHours,
        totalHours,
        totalAmount: (totalHours * row.rate) / 12,
        dailyHours: row.dailyHours,
      };
    })
    .sort((left, right) => {
      const pettyContractorCompare = left.pettyContractorName.localeCompare(
        right.pettyContractorName
      );

      if (pettyContractorCompare !== 0) {
        return pettyContractorCompare;
      }

      return left.crewName.localeCompare(right.crewName);
    });

  return {
    monthValue,
    dayKeys,
    rows,
  };
}

export function buildMonthDayKeys(monthValue: string) {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthValue);

  if (!monthMatch) {
    return [];
  }

  const [, year, month] = monthMatch;
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
}

export function formatDayHeader(dateValue: string) {
  const date = parseDateValue(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
  });
}

export function toInputDate(dateValue: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const date = parseDateValue(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toISOString().slice(0, 10);
}

export function parseDateValue(dateValue: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(dateValue);
}

function normalizeCrewName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function compareDateValues(leftDateValue: string, rightDateValue: string) {
  const leftDate = parseDateValue(leftDateValue);
  const rightDate = parseDateValue(rightDateValue);

  const leftTime = Number.isNaN(leftDate.getTime()) ? 0 : leftDate.getTime();
  const rightTime = Number.isNaN(rightDate.getTime()) ? 0 : rightDate.getTime();

  return leftTime - rightTime;
}
