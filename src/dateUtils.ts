/** all dates are handled as local-time YYYY-MM-DD strings to avoid timezone drift */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** the Sunday on/before the given date (Sunday = start of week here, matching DAY_NAMES[0]) */
export function mostRecentSundayISO(d: Date = new Date()): string {
  const date = new Date(d);
  date.setDate(date.getDate() - date.getDay());
  return toISODate(date);
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function dateForDayIndex(weekStartISO: string, dayIndex: number): Date {
  const date = parseISODate(weekStartISO);
  date.setDate(date.getDate() + dayIndex);
  return date;
}

/** e.g. "13.08" — no year, matches how the person asked for day headers to look */
export function formatDDMM(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

export function yearOfWeek(weekStartISO: string): number {
  // use the Thursday of the week so a week spanning New Year's shows the year most of it falls in
  return dateForDayIndex(weekStartISO, 4).getFullYear();
}

export function addMonthsISO(iso: string, months: number): string {
  const date = parseISODate(iso);
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** whole days between two ISO dates (b - a). Positive if b is after a. */
export function daysBetweenISO(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / msPerDay);
}
