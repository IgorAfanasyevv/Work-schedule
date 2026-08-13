import type {
  Employee,
  ShiftInstance,
  ShiftType,
  Eligibility,
  ReplacementOption,
} from './types';

/* ---------------------------------------------------------------------- */
/*  time helpers                                                          */
/* ---------------------------------------------------------------------- */

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function durationHours(start: string, end: string): number {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 1440;
  return +((e - s) / 60).toFixed(2);
}

/** absolute [start,end] range in minutes-since-week-start, handling overnight wrap */
export function shiftAbsRange(dayIdx: number, start: string, end: string): [number, number] {
  const sMin = toMinutes(start);
  const eMin = toMinutes(end);
  const s = dayIdx * 1440 + sMin;
  const e = eMin <= sMin ? dayIdx * 1440 + eMin + 1440 : dayIdx * 1440 + eMin;
  return [s, e];
}

export function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/* ---------------------------------------------------------------------- */
/*  ids / instance factory                                                */
/* ---------------------------------------------------------------------- */

export function uid(): string {
  return 'x' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function makeInstance(
  day: number,
  st: Pick<ShiftType, 'id' | 'name' | 'start' | 'end' | 'category'>,
  extra?: Partial<ShiftInstance>
): ShiftInstance {
  return {
    id: uid(),
    day,
    shiftTypeId: st.id,
    name: st.name,
    start: st.start,
    end: st.end,
    category: st.category,
    durationHours: durationHours(st.start, st.end),
    employeeId: null,
    tempWorkerName: null,
    manual: false,
    exception: false,
    ...extra,
  };
}

export function buildTemplateInstances(shiftTypes: ShiftType[]): ShiftInstance[] {
  const list: ShiftInstance[] = [];
  for (let d = 0; d < 7; d++) {
    shiftTypes.forEach((st) => list.push(makeInstance(d, st)));
  }
  return list;
}

/* ---------------------------------------------------------------------- */
/*  assignee helpers (regular employee OR one-off "מתגבר" reinforcement)  */
/* ---------------------------------------------------------------------- */

export function isAssigned(inst: ShiftInstance): boolean {
  return !!(inst.employeeId || inst.tempWorkerName);
}

export function assigneeLabel(inst: ShiftInstance, employees: Employee[]): string | null {
  if (inst.employeeId) {
    const e = employees.find((x) => x.id === inst.employeeId);
    return e ? e.name : '—';
  }
  if (inst.tempWorkerName) return inst.tempWorkerName;
  return null;
}

export type InstanceStatus = 'empty' | 'temp' | 'warn' | 'manual' | 'filled';

export function instanceStatus(inst: ShiftInstance): InstanceStatus {
  if (!isAssigned(inst)) return 'empty';
  if (inst.tempWorkerName) return 'temp';
  if (inst.exception) return 'warn';
  if (inst.manual) return 'manual';
  return 'filled';
}

/* ---------------------------------------------------------------------- */
/*  eligibility / hard constraints                                        */
/* ---------------------------------------------------------------------- */

function isBlocked(employee: Employee, instance: ShiftInstance): boolean {
  return (employee.blocks || []).some((b) => {
    if (b.scope === 'day') return b.day === instance.day;
    if (b.scope === 'category')
      return (b.day === 'all' || b.day === instance.day) && b.category === instance.category;
    if (b.scope === 'shift') return b.day === instance.day && b.shiftTypeId === instance.shiftTypeId;
    return false;
  });
}

/**
 * @param capField which field on the employee acts as the hard ceiling for shift count.
 *   'maxShifts'    -> used for manual assignment / replacement search (the true hard cap)
 *   'desiredShifts'-> used by the automatic engine, which must never push someone past what they asked for
 */
export function getEligibility(
  employee: Employee,
  instance: ShiftInstance,
  instances: ShiftInstance[],
  ignoreInstanceId?: string | null,
  capField: 'maxShifts' | 'desiredShifts' = 'maxShifts'
): Eligibility {
  const reasons: Eligibility['reasons'] = [];

  if (isBlocked(employee, instance)) reasons.push({ type: 'blocked' });

  const mine = instances.filter(
    (i) => i.employeeId === employee.id && i.id !== instance.id && i.id !== ignoreInstanceId
  );
  const rangeA = shiftAbsRange(instance.day, instance.start, instance.end);
  const conflicts = mine.filter((i) => overlaps(rangeA, shiftAbsRange(i.day, i.start, i.end)));
  if (conflicts.length) reasons.push({ type: 'overlap', conflicts });

  const currentCount = instances.filter((i) => i.employeeId === employee.id && i.id !== instance.id).length;
  const cap = employee[capField];
  if (currentCount >= cap) {
    reasons.push({ type: capField === 'desiredShifts' ? 'maxDesired' : 'maxShifts', currentCount, cap });
  }

  if (instance.category === 'night') {
    const nightList = instances.filter(
      (i) => i.employeeId === employee.id && i.category === 'night' && i.id !== instance.id
    );
    if (nightList.length >= 3) reasons.push({ type: 'maxNights', count: nightList.length });

    const nightDays = new Set(nightList.map((i) => i.day));
    nightDays.add(instance.day);
    let consecutive = false;
    for (let d = 0; d <= 4; d++) {
      if (nightDays.has(d) && nightDays.has(d + 1) && nightDays.has(d + 2)) consecutive = true;
    }
    if (consecutive) reasons.push({ type: 'consecutiveNights' });
  }

  return { eligible: reasons.length === 0, reasons, conflicts };
}

/* ---------------------------------------------------------------------- */
/*  fairness scoring (lower = better candidate)                           */
/* ---------------------------------------------------------------------- */

export function fairnessScore(employee: Employee, _instance: ShiftInstance, instances: ShiftInstance[]): number {
  const mine = instances.filter((i) => i.employeeId === employee.id);
  const count = mine.length;
  const deficit = employee.desiredShifts - count;
  const nights = mine.filter((i) => i.category === 'night').length;
  const weekends = mine.filter((i) => i.day === 5 || i.day === 6).length;
  const twelveHr = mine.filter((i) => i.durationHours >= 11.5).length;
  return -deficit * 10 + nights * 3 + weekends * 2 + twelveHr * 1;
}

/* ---------------------------------------------------------------------- */
/*  full generation (Constraint Satisfaction, MRV heuristic + fairness)   */
/* ---------------------------------------------------------------------- */

export function generateFullSchedule(employees: Employee[], template: ShiftInstance[]): ShiftInstance[] {
  const instances: ShiftInstance[] = template.map((i) => ({
    ...i,
    employeeId: null,
    tempWorkerName: null,
    manual: false,
    exception: false,
  }));
  let remaining = instances.map((i) => i.id);

  while (remaining.length) {
    let bestId: string | null = null;
    let bestList: Employee[] | null = null;

    for (const id of remaining) {
      const inst = instances.find((i) => i.id === id)!;
      const elig = employees.filter((e) => getEligibility(e, inst, instances, null, 'desiredShifts').eligible);
      if (bestList === null || elig.length < bestList.length) {
        bestId = id;
        bestList = elig;
        if (elig.length === 0) break;
      }
    }

    const inst = instances.find((i) => i.id === bestId)!;
    if (!bestList || bestList.length === 0) {
      remaining = remaining.filter((id) => id !== bestId);
      continue;
    }

    const scored = bestList.map((e) => ({ e, score: fairnessScore(e, inst, instances) }));
    scored.sort((a, b) => a.score - b.score);
    inst.employeeId = scored[0].e.id;
    remaining = remaining.filter((id) => id !== bestId);
  }

  return instances;
}

/* ---------------------------------------------------------------------- */
/*  replacement search (direct candidates + depth-2 overlap chains)       */
/* ---------------------------------------------------------------------- */

export function findReplacements(
  instanceId: string,
  instances: ShiftInstance[],
  employees: Employee[],
  maxOptions = 3
): ReplacementOption[] {
  const vacant = instances.find((i) => i.id === instanceId);
  if (!vacant) return [];
  const options: ReplacementOption[] = [];

  const direct = employees
    .map((e) => ({ e, elig: getEligibility(e, vacant, instances) }))
    .filter((x) => x.elig.eligible)
    .map((x) => ({ e: x.e, score: fairnessScore(x.e, vacant, instances) }))
    .sort((a, b) => a.score - b.score);

  direct.forEach((d) => {
    options.push({ changeCount: 1, changes: [{ instanceId: vacant.id, toEmployeeId: d.e.id }], score: d.score });
  });

  if (options.length < maxOptions) {
    const blockedByOverlapOnly = employees
      .map((e) => ({ e, elig: getEligibility(e, vacant, instances) }))
      .filter((x) => !x.elig.eligible && x.elig.reasons.length === 1 && x.elig.reasons[0].type === 'overlap');

    blockedByOverlapOnly.forEach(({ e, elig }) => {
      const conflictInstances = elig.reasons[0].conflicts || [];
      const subChanges: { instanceId: string; toEmployeeId: string }[] = [];
      let allResolved = true;

      for (const c of conflictInstances) {
        const cands = employees
          .filter((a) => a.id !== e.id)
          .map((a) => ({ a, elig2: getEligibility(a, c, instances, c.id) }))
          .filter((x) => x.elig2.eligible)
          .map((x) => ({ a: x.a, score: fairnessScore(x.a, c, instances) }))
          .sort((x, y) => x.score - y.score);

        if (!cands.length) {
          allResolved = false;
          break;
        }
        subChanges.push({ instanceId: c.id, toEmployeeId: cands[0].a.id });
      }

      if (allResolved) {
        options.push({
          changeCount: 1 + subChanges.length,
          changes: [{ instanceId: vacant.id, toEmployeeId: e.id }, ...subChanges],
          score: fairnessScore(e, vacant, instances),
        });
      }
    });
  }

  options.sort((a, b) => a.changeCount - b.changeCount || a.score - b.score);
  return options.slice(0, maxOptions);
}

/* ---------------------------------------------------------------------- */
/*  decision explanation (section 32 of the spec)                         */
/* ---------------------------------------------------------------------- */

export function explain(employee: Employee, instance: ShiftInstance, instances: ShiftInstance[]): string {
  const elig = getEligibility(employee, instance, instances, instance.id);
  if (elig.eligible) return `${employee.name} זמין וכשיר לשיבוץ במשמרת זו ללא הפרת אילוצים.`;

  const parts = elig.reasons.map((r) => {
    if (r.type === 'overlap') {
      const names = (r.conflicts || [])
        .map((c) => `${DAY_NAMES_HE[c.day]} ${c.name} (${c.start}–${c.end})`)
        .join(', ');
      return `${employee.name} כבר משובץ במשמרת חופפת בשעות: ${names}.`;
    }
    if (r.type === 'maxShifts') return `${employee.name} כבר עבד ${r.currentCount} משמרות מתוך מקסימום ${employee.maxShifts}.`;
    if (r.type === 'maxDesired')
      return `${employee.name} כבר הגיע למספר המשמרות הרצוי שלו (${employee.desiredShifts}). ניתן לשבץ מעבר לכך רק ידנית.`;
    if (r.type === 'maxNights') return `${employee.name} כבר עבד ${r.count} משמרות לילה השבוע. המקסימום הוא 3.`;
    if (r.type === 'consecutiveNights') return `השיבוץ ייצור עבור ${employee.name} יותר משתי משמרות לילה רצופות.`;
    if (r.type === 'blocked') return `${employee.name} חסם את המשמרת הזו מראש.`;
    return '';
  });

  return parts.join(' ');
}

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
