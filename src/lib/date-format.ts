const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateParts(date: Date) {
  return [
    padDatePart(date.getDate()),
    padDatePart(date.getMonth() + 1),
    String(date.getFullYear()),
  ].join("/");
}

export function parseDateForDisplay(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const dateOnlyMatch = dateOnlyPattern.exec(value);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDisplayDate(
  value: string | null | undefined,
  fallback = "--"
) {
  const date = parseDateForDisplay(value);
  return date ? formatDateParts(date) : fallback;
}

export function formatDisplayDateTime(
  value: string | null | undefined,
  fallback = "--"
) {
  const date = parseDateForDisplay(value);

  if (!date) {
    return fallback;
  }

  return `${formatDateParts(date)}, ${padDatePart(date.getHours())}:${padDatePart(
    date.getMinutes()
  )}`;
}

export function formatDisplayMonthYear(
  value: string | null | undefined,
  fallback = "--"
) {
  if (!value) {
    return fallback;
  }

  const monthOnlyMatch = /^(\d{4})-(\d{2})$/.exec(value);

  if (monthOnlyMatch) {
    const [, year, month] = monthOnlyMatch;
    return `${month}/${year}`;
  }

  const date = parseDateForDisplay(value);

  if (!date) {
    return fallback;
  }

  return `${padDatePart(date.getMonth() + 1)}/${date.getFullYear()}`;
}
