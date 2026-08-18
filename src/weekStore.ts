import type { AppState, ShiftInstance } from './types';
import { buildTemplateInstances } from './engine';

/** the actual schedule for the currently-viewed week (never a mix of weeks) */
export function currentInstances(s: AppState): ShiftInstance[] {
  return s.weeks[s.weekStartDate] ?? [];
}

/** writes back a new instances array for the currently-viewed week only, leaving every other week untouched */
export function withCurrentInstances(s: AppState, instances: ShiftInstance[]): AppState {
  return { ...s, weeks: { ...s.weeks, [s.weekStartDate]: instances } };
}

/** makes sure a given week has its own (initially blank) instances before we navigate to it or read from it */
export function ensureWeekSeeded(s: AppState, weekStartDate: string): AppState {
  if (s.weeks[weekStartDate]) return s;
  return { ...s, weeks: { ...s.weeks, [weekStartDate]: buildTemplateInstances(s.shiftTypes) } };
}
