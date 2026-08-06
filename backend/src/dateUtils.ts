const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(str: string): boolean {
  if (!DATE_RE.test(str)) return false;
  const d = new Date(str + "T00:00:00.000Z");
  return !Number.isNaN(d.getTime()) && formatDate(d) === str;
}

export function parseDateStr(str: string): Date {
  return new Date(str + "T00:00:00.000Z");
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayStr(): string {
  return formatDate(new Date());
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDateStr(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d);
}

export function compareDateStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Monday-aligned week start for the given date (ISO week convention, Mon-Sun)
export function startOfWeek(dateStr: string): string {
  const d = parseDateStr(dateStr);
  const dow = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return formatDate(d);
}
