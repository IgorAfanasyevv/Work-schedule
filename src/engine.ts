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

/** shifts a "HH:MM" time by N hours (can be negative), wrapping correctly around midnight */
export function addHoursToTime(time: string, hours: number): string {
  let total = toMinutes(time) + hours * 60;
  total = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
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

/**
 * Friday & Saturday get reinforced (2-person) coverage automatically, since that's the weekend
 * shift for a security team: every Saturday slot, and every Friday slot except the morning one
 * (which ends before the weekend reinforcement window starts), gets a second slot from the start
 * so the manager never has to remember to click "+ הוסף עובד שני" for the weekend.
 */
export function buildTemplateInstances(shiftTypes: ShiftType[]): ShiftInstance[] {
  const FRIDAY = 5;
  const SATURDAY = 6;
  const list: ShiftInstance[] = [];
  for (let d = 0; d < 7; d++) {
    shiftTypes.forEach((st) => {
      list.push(makeInstance(d, st));
      // NOTE: 'night' is deliberately excluded here. Every day already has TWO separate night-type
      // shift definitions (e.g. 21:45–06:00 and 23:00–07:00), each needing its own person - that's
      // already "2 people covering the night" without any doubling. Doubling night on top of that
      // demanded 4 different people for Friday/Saturday nights alone, which - combined with the
      // max-3-nights/max-2-consecutive rule - left far more of the week structurally unfillable
      // than intended. Morning/afternoon/other categories still get reinforced on the weekend.
      const needsWeekendReinforcement =
        st.category !== 'night' && (d === SATURDAY || (d === FRIDAY && st.category !== 'morning'));
      if (needsWeekendReinforcement) {
        // the second person on a shared shift comes an hour later (and leaves an hour later) than
        // the first, rather than clocking in at the exact same time - e.g. 13:45–22:00 + 15:00–23:00
        list.push(
          makeInstance(d, { ...st, start: addHoursToTime(st.start, 1), end: addHoursToTime(st.end, 1) })
        );
      }
    });
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

function isBlocked(employee: Employee, instance: ShiftInstance, weekStartDate: string): boolean {
  return (employee.blocks || []).some((b) => {
    // week-scoped blocks (from the weekly availability grid) only apply to the week they were set for
    if (b.weekStartDate && b.weekStartDate !== weekStartDate) return false;
    if (b.scope === 'day') return b.day === instance.day;
    if (b.scope === 'category')
      return (b.day === 'all' || b.day === instance.day) && b.category === instance.category;
    if (b.scope === 'shift') return b.day === instance.day && b.shiftTypeId === instance.shiftTypeId;
    return false;
  });
}

/**
 * @param weekStartDate ISO date (Sunday) of the week currently being scheduled/edited — required so
 *   week-scoped availability blocks (see EmployeeBlock.weekStartDate) only apply to their own week.
 * @param capField which field on the employee acts as the hard ceiling for shift count.
 *   'maxShifts'    -> used for manual assignment / replacement search (the true hard cap)
 *   'desiredShifts'-> used by the automatic engine, which must never push someone past what they asked for
 */
export function getEligibility(
  employee: Employee,
  instance: ShiftInstance,
  instances: ShiftInstance[],
  weekStartDate: string,
  ignoreInstanceId?: string | null,
  capField: 'maxShifts' | 'desiredShifts' = 'maxShifts'
): Eligibility {
  const reasons: Eligibility['reasons'] = [];

  if (isBlocked(employee, instance, weekStartDate)) reasons.push({ type: 'blocked' });

  const mine = instances.filter(
    (i) => i.employeeId === employee.id && i.id !== instance.id && i.id !== ignoreInstanceId
  );
  const rangeA = shiftAbsRange(instance.day, instance.start, instance.end);
  const conflicts = mine.filter((i) => overlaps(rangeA, shiftAbsRange(i.day, i.start, i.end)));
  if (conflicts.length) reasons.push({ type: 'overlap', conflicts });

  // A person can't work two shifts that both START on the same calendar day — e.g. a morning
  // shift followed by a night shift starting later that same day. This is stricter than pure
  // time-overlap: those two might not literally overlap in minutes, but the person still can't
  // physically do both. The one explicit exception this must NOT block: a night shift that
  // started the PREVIOUS day and only *ends* this morning — that one has day === yesterday, so
  // it doesn't count here, and the person can still pick up e.g. an afternoon shift today.
  const sameStartDay = mine.filter((i) => i.day === instance.day);
  if (sameStartDay.length) reasons.push({ type: 'sameDayShift', conflicts: sameStartDay });

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

/**
 * Lower score = better candidate for this slot.
 *
 * This is a PROPORTIONAL fairness model, not just "who's furthest from their own target":
 * for every shift category (morning/afternoon/night/other), each employee has a "fair share" of
 * that category's total slots this week, proportional to how much they want to work overall
 * (desiredShifts) relative to the whole team. Someone who opened up more availability (a higher
 * desiredShifts) is expected to - and will - absorb proportionally more of every category,
 * nights included, which is exactly what lets a flexible person relieve less-available
 * coworkers instead of the algorithm just splitting things evenly head-count-wise.
 *
 * Without this, two equally-available people could end up with very different night counts
 * purely because of processing order: once someone hits their own overall target they stop being
 * prioritized for anything else, even if their personal night count is still low compared to
 * peers who are equally free to work nights.
 */
export function fairnessScore(
  employee: Employee,
  instance: ShiftInstance,
  instances: ShiftInstance[],
  employees: Employee[]
): number {
  const mine = instances.filter((i) => i.employeeId === employee.id);
  const count = mine.length;

  // RATIOS, not raw counts - this is the key fix. With raw counts, someone who simply asked for a
  // much bigger number of shifts than everyone else would have a numerically huge "deficit" that
  // swamped every other consideration (category variety, streak prevention), causing them to
  // dominate one single shift type across the whole week instead of getting a fair mix. Using
  // "how full is my own target" as a 0..1-ish ratio keeps everyone on the same scale regardless of
  // how big their personal desiredShifts is, while still correctly letting someone with a bigger
  // target keep absorbing more shifts for longer after less-available coworkers fill up.
  const overallRatio = employee.desiredShifts > 0 ? count / employee.desiredShifts : 1;

  const totalDesired = employees.reduce((sum, e) => sum + e.desiredShifts, 0) || 1;
  const teamShare = employee.desiredShifts / totalDesired;

  // same idea per shift category (morning/afternoon/night/other): each employee's fair share of a
  // category is proportional to their share of the whole team's desired workload, and we compare
  // their current count against that share as a ratio - the main lever for balancing e.g. night
  // counts fairly regardless of how big anyone's overall target is
  const totalOfThisCategory = instances.filter((i) => i.category === instance.category).length;
  const categoryCount = mine.filter((i) => i.category === instance.category).length;
  const fairShareOfCategory = teamShare * totalOfThisCategory;
  const categoryRatio = fairShareOfCategory > 0 ? categoryCount / fairShareOfCategory : categoryCount > 0 ? 2 : 0;

  // same for weekend shifts specifically
  const totalWeekendSlots = instances.filter((i) => i.day === 5 || i.day === 6).length;
  const weekendCount = mine.filter((i) => i.day === 5 || i.day === 6).length;
  const fairShareOfWeekend = teamShare * totalWeekendSlots;
  const weekendRatio = fairShareOfWeekend > 0 ? weekendCount / fairShareOfWeekend : weekendCount > 0 ? 2 : 0;

  const twelveHr = mine.filter((i) => i.durationHours >= 11.5).length;

  // Strongly discourage doing the SAME shift category (morning/afternoon/night) on the day right
  // before or right after this one - this is what stops someone from ending up on "morning" five
  // days in a row. It's a soft penalty, not a hard rule: still allowed if nobody else can fill the
  // slot, just deprioritized against anyone who'd bring more variety.
  const sameCategoryAdjacentDay = mine.filter(
    (i) => i.category === instance.category && Math.abs(i.day - instance.day) === 1
  ).length;

  return overallRatio * 100 + categoryRatio * 40 + weekendRatio * 15 + twelveHr * 1 + sameCategoryAdjacentDay * 14;
}

/** among several candidates tied for the best (lowest) fairness score, pick one at random instead
 *  of always the same one - a fully deterministic tie-break is what made one person systematically
 *  "win" every tied slot and dominate a shift type across the week. */
export function pickAmongBest<T>(scored: { item: T; score: number }[]): T {
  const sorted = [...scored].sort((a, b) => a.score - b.score);
  const bestScore = sorted[0].score;
  const tied = sorted.filter((x) => x.score === bestScore);
  return tied[Math.floor(Math.random() * tied.length)].item;
}

/* ---------------------------------------------------------------------- */
/*  full generation (Constraint Satisfaction, MRV heuristic + fairness)   */
/* ---------------------------------------------------------------------- */

export function generateFullSchedule(employees: Employee[], template: ShiftInstance[], weekStartDate: string): ShiftInstance[] {
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
      const elig = employees.filter((e) => getEligibility(e, inst, instances, weekStartDate, null, 'desiredShifts').eligible);
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

    const scored = bestList.map((e) => ({ item: e, score: fairnessScore(e, inst, instances, employees) }));
    inst.employeeId = pickAmongBest(scored).id;
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
  weekStartDate: string,
  maxOptions = 3
): ReplacementOption[] {
  const vacant = instances.find((i) => i.id === instanceId);
  if (!vacant) return [];
  const options: ReplacementOption[] = [];

  const direct = employees
    .map((e) => ({ e, elig: getEligibility(e, vacant, instances, weekStartDate) }))
    .filter((x) => x.elig.eligible)
    .map((x) => ({ e: x.e, score: fairnessScore(x.e, vacant, instances, employees) }))
    .sort((a, b) => a.score - b.score);

  direct.forEach((d) => {
    options.push({ changeCount: 1, changes: [{ instanceId: vacant.id, toEmployeeId: d.e.id }], score: d.score });
  });

  if (options.length < maxOptions) {
    const blockedBySingleConflict = employees
      .map((e) => ({ e, elig: getEligibility(e, vacant, instances, weekStartDate) }))
      .filter(
        (x) =>
          !x.elig.eligible &&
          x.elig.reasons.length === 1 &&
          (x.elig.reasons[0].type === 'overlap' || x.elig.reasons[0].type === 'sameDayShift')
      );

    blockedBySingleConflict.forEach(({ e, elig }) => {
      const conflictInstances = elig.reasons[0].conflicts || [];
      const subChanges: { instanceId: string; toEmployeeId: string }[] = [];
      let allResolved = true;

      for (const c of conflictInstances) {
        const cands = employees
          .filter((a) => a.id !== e.id)
          .map((a) => ({ a, elig2: getEligibility(a, c, instances, weekStartDate, c.id) }))
          .filter((x) => x.elig2.eligible)
          .map((x) => ({ a: x.a, score: fairnessScore(x.a, c, instances, employees) }))
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
          score: fairnessScore(e, vacant, instances, employees),
        });
      }
    });
  }

  options.sort((a, b) => a.changeCount - b.changeCount || a.score - b.score);
  return options.slice(0, maxOptions);
}

/* ---------------------------------------------------------------------- */
/*  "creative" gap-filling: free someone up from a normal shift elsewhere  */
/*  by having a DIFFERENT person cover that slot as an extended 12-hour    */
/*  shift, then move the now-free person onto the vacant/gap slot          */
/* ---------------------------------------------------------------------- */

export interface TwelveHourChainOption {
  vacantInstanceId: string;
  freedEmployeeId: string;
  freedEmployeeName: string;
  /** the shift the freed employee gets pulled off of */
  sourceInstanceId: string;
  sourceDay: number;
  sourceName: string;
  originalStart: string;
  originalEnd: string;
  /** who absorbs that slot into a 12-hour shift instead */
  coveringEmployeeId: string;
  coveringEmployeeName: string;
  newStart: string;
  newEnd: string;
}

export function findTwelveHourChains(
  vacantInstanceId: string,
  instances: ShiftInstance[],
  employees: Employee[],
  weekStartDate: string,
  maxOptions = 3
): TwelveHourChainOption[] {
  const vacant = instances.find((i) => i.id === vacantInstanceId);
  if (!vacant) return [];
  const options: TwelveHourChainOption[] = [];

  for (const E of employees) {
    const eAssignments = instances.filter((i) => i.employeeId === E.id && i.id !== vacantInstanceId);
    for (const S of eAssignments) {
      // would E be eligible for the vacant slot if S weren't tying them up?
      const elig = getEligibility(E, vacant, instances, weekStartDate, S.id);
      if (!elig.eligible) continue;

      const newEnd = addHoursToTime(S.start, 12);
      const candidateInstance: ShiftInstance = { ...S, start: S.start, end: newEnd, durationHours: 12 };

      for (const F of employees) {
        if (F.id === E.id) continue;
        // F must not already be working that day somewhere else
        const fBusyThatDay = instances.some((i) => i.employeeId === F.id && i.day === S.day && i.id !== S.id);
        if (fBusyThatDay) continue;
        const fElig = getEligibility(F, candidateInstance, instances, weekStartDate, S.id);
        if (fElig.eligible) {
          options.push({
            vacantInstanceId,
            freedEmployeeId: E.id,
            freedEmployeeName: E.name,
            sourceInstanceId: S.id,
            sourceDay: S.day,
            sourceName: S.name,
            originalStart: S.start,
            originalEnd: S.end,
            coveringEmployeeId: F.id,
            coveringEmployeeName: F.name,
            newStart: S.start,
            newEnd,
          });
          if (options.length >= maxOptions) return options;
        }
      }
    }
  }
  return options;
}

/* ---------------------------------------------------------------------- */
/*  decision explanation (section 32 of the spec)                         */
/* ---------------------------------------------------------------------- */

export function explain(employee: Employee, instance: ShiftInstance, instances: ShiftInstance[], weekStartDate: string): string {
  const elig = getEligibility(employee, instance, instances, weekStartDate, instance.id);
  if (elig.eligible) return `${employee.name} זמין וכשיר לשיבוץ במשמרת זו ללא הפרת אילוצים.`;

  const parts = elig.reasons.map((r) => {
    if (r.type === 'overlap') {
      const names = (r.conflicts || [])
        .map((c) => `${DAY_NAMES_HE[c.day]} ${c.name} (${c.start}–${c.end})`)
        .join(', ');
      return `${employee.name} כבר משובץ במשמרת חופפת בשעות: ${names}.`;
    }
    if (r.type === 'sameDayShift') {
      const names = (r.conflicts || []).map((c) => `${c.name} (${c.start}–${c.end})`).join(', ');
      return `${employee.name} כבר משובץ למשמרת אחרת שמתחילה באותו יום: ${names}. לא ניתן לעבוד פעמיים באותו יום.`;
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
