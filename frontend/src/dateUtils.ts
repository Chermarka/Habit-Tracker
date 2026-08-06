export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayStr(): string {
  return formatDate(new Date());
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d);
}

export function startOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return formatDate(d);
}

export const DOW_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export function formatHuman(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
