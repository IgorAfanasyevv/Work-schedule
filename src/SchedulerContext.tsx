import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  AppState,
  Employee,
  EmployeeBlock,
  ShiftInstance,
  ShiftType,
  Category,
} from './types';
import { REASON_LABELS, DAY_NAMES } from './types';
import {
  assigneeLabel,
  fairnessScore,
  findReplacements,
  generateFullSchedule,
  getEligibility,
  makeInstance,
  pickAmongBest,
  uid,
} from './engine';
import { defaultState, loadState, saveState, subscribeRemoteState } from './state';
import { isFirebaseConfigured } from './firebaseClient';
import { addDaysISO, mostRecentSundayISO } from './dateUtils';
import { currentInstances, withCurrentInstances, ensureWeekSeeded } from './weekStore';

export type Tab = 'dashboard' | 'schedule' | 'myshifts' | 'employees' | 'shifttypes';

export type ModalState =
  | { type: 'shiftDetail'; instanceId: string }
  | { type: 'markUnavailable'; instanceId: string }
  | { type: 'replacements'; instanceId: string }
  | { type: 'addEditEmployee'; employeeId: string | null }
  | { type: 'addBlock'; employeeId: string }
  | { type: 'shiftType'; shiftTypeId: string | null }
  | { type: 'adhocShift' }
  | { type: 'dayConstraints'; employeeId: string; day: number }
  | null;

interface ToastItem {
  id: number;
  msg: string;
}

interface Ctx {
  state: AppState;
  /** the current week's shift schedule only — derived from state.weeks[state.weekStartDate] */
  instances: ShiftInstance[];
  tab: Tab;
  setTab: (t: Tab) => void;
  modal: ModalState;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  calendarView: boolean;
  setCalendarView: (v: boolean) => void;
  selectedEmployeeId: string | null;
  setSelectedEmployeeId: (id: string) => void;
  assignMode: 'regular' | 'temp';
  setAssignMode: (m: 'regular' | 'temp') => void;
  toasts: ToastItem[];
  toast: (msg: string) => void;
  isGenerating: boolean;
  isLoaded: boolean;
  isShared: boolean;

  setWeekLabel: (label: string) => void;
  navigateWeek: (direction: -1 | 1) => void;
  goToCurrentWeek: () => void;
  goToDate: (dateISO: string) => void;
  fullGenerate: () => void;
  localRecalc: () => void;
  clearSchedule: () => void;
  clearWeekPreferences: () => void;

  assignEmployee: (instanceId: string, employeeId: string | null, opts?: { force?: boolean }) => { ok: boolean; reasons?: string[] };
  assignTemp: (instanceId: string, name: string) => void;
  removeTemp: (instanceId: string) => void;
  markUnavailable: (instanceId: string, reason: string) => void;
  applyReplacementOption: (instanceId: string, optionIndex: number) => void;
  setInstanceTime: (instanceId: string, start: string, end: string) => void;
  duplicateInstance: (instanceId: string) => void;
  deleteInstance: (instanceId: string) => void;

  addEmployee: (name: string, desired: number, max: number) => void;
  updateEmployee: (id: string, name: string, desired: number, max: number) => void;
  deleteEmployee: (id: string) => void;
  addBlock: (employeeId: string, block: EmployeeBlock) => void;
  removeBlock: (employeeId: string, idx: number) => void;
  setDayConstraints: (employeeId: string, day: number, dayOff: boolean, blockedShiftTypeIds: string[], reason?: string) => void;

  addShiftType: (name: string, start: string, end: string, category: Category) => void;
  updateShiftType: (id: string, name: string, start: string, end: string, category: Category) => void;
  deleteShiftType: (id: string) => void;
  addAdhocShift: (day: number, name: string, start: string, end: string, category: Category) => void;
  clearAuditLog: () => void;
}

const SchedulerCtx = createContext<Ctx | null>(null);

export function useScheduler(): Ctx {
  const ctx = useContext(SchedulerCtx);
  if (!ctx) throw new Error('useScheduler must be used within SchedulerProvider');
  return ctx;
}

export function SchedulerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => defaultState());
  const [isLoaded, setIsLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [modal, setModal] = useState<ModalState>(null);
  const [calendarView, setCalendarView] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [assignMode, setAssignMode] = useState<'regular' | 'temp'>('regular');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // initial load (from Supabase if configured, otherwise from this browser's localStorage)
  useEffect(() => {
    let cancelled = false;
    loadState().then((s) => {
      if (!cancelled) {
        setState(ensureWeekSeeded(s, s.weekStartDate));
        setIsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // live updates from other tabs/users when Supabase is configured
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribe = subscribeRemoteState((incoming) => setState((prev) => ensureWeekSeeded(incoming, prev.weekStartDate)));
    return unsubscribe;
  }, []);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const withAudit = useCallback((next: AppState, text: string): AppState => {
    const entry = { id: uid(), ts: new Date().toLocaleString('he-IL'), text };
    const auditLog = [entry, ...next.auditLog].slice(0, 300);
    return { ...next, auditLog };
  }, []);

  const empName = useCallback(
    (id: string | null) => {
      if (!id) return '—';
      const e = state.employees.find((x) => x.id === id);
      return e ? e.name : '—';
    },
    [state.employees]
  );

  const openModal = useCallback((m: ModalState) => {
    if (m?.type === 'shiftDetail') {
      // reset the toggle to match the current assignment kind
      // (looked up lazily inside the component, but default sensibly here)
    }
    setModal(m);
  }, []);
  const closeModal = useCallback(() => setModal(null), []);

  /* ------------------------------------------------------------------ */
  const setWeekLabel = useCallback(
    (label: string) => {
      setState((s) => {
        const next = { ...s, weekLabel: label };
        saveState(next);
        return next;
      });
    },
    []
  );

  const fullGenerate = useCallback(() => {
    setIsGenerating(true);
    // deferred so React can paint the "generating..." state before the (synchronous) computation runs
    setTimeout(() => {
      setState((s) => {
        const generated = generateFullSchedule(s.employees, currentInstances(s), s.weekStartDate);
        const unfilled = generated.filter((i) => !i.employeeId && !i.tempWorkerName).length;
        const text =
          unfilled > 0
            ? `נוצר סידור מלא עבור ${s.weekLabel} — אך ${unfilled} משמרות נשארו לא מאוישות (אין עובד זמין/מתאים).`
            : `נוצר סידור מלא אוטומטית עבור ${s.weekLabel}. כל המשמרות מאוישות.`;
        const next = withAudit(withCurrentInstances(s, generated), text);
        saveState(next);
        toast(unfilled > 0 ? `הסידור נוצר — ${unfilled} משמרות נשארו ללא איוש ⚠️` : 'הסידור המלא נוצר בהצלחה — כל המשמרות מאוישות ✓');
        return next;
      });
      setIsGenerating(false);
    }, 20);
  }, [withAudit, toast]);

  const localRecalc = useCallback(() => {
    setIsGenerating(true);
    setTimeout(() => {
      setState((s) => {
        let changed = 0;
        let instances = currentInstances(s).map((inst) => ({ ...inst }));

        // 1) unassign anyone who is now in hard-constraint violation (unless explicitly flagged as an approved exception)
        instances = instances.map((inst) => {
          if (inst.employeeId && !inst.exception) {
            const e = s.employees.find((x) => x.id === inst.employeeId);
            if (!e) {
              changed++;
              return { ...inst, employeeId: null };
            }
            const elig = getEligibility(e, inst, instances, s.weekStartDate, inst.id);
            if (!elig.eligible) {
              changed++;
              return { ...inst, employeeId: null };
            }
          }
          return inst;
        });

        // 2) try to auto-fill empties (never touches מתגבר slots), respecting each employee's requested count
        instances = instances.map((inst) => {
          if (inst.employeeId || inst.tempWorkerName) return inst;
          const cands = s.employees.filter((e) => getEligibility(e, inst, instances, s.weekStartDate, null, 'desiredShifts').eligible);
          if (cands.length) {
            const scored = cands.map((e) => ({ item: e, score: fairnessScore(e, inst, instances, s.employees) }));
            changed++;
            return { ...inst, employeeId: pickAmongBest(scored).id };
          }
          return inst;
        });

        const unfilled = instances.filter((i) => !i.employeeId && !i.tempWorkerName).length;
        const next = withAudit(
          withCurrentInstances(s, instances),
          `בוצע חישוב מקומי: ${changed} שיבוצים עודכנו. ${unfilled > 0 ? `${unfilled} משמרות נשארו לא מאוישות.` : 'כל המשמרות מאוישות.'}`
        );
        saveState(next);
        toast(
          unfilled > 0
            ? `חישוב מקומי בוצע — ${changed} שינויים, אך ${unfilled} משמרות עדיין לא מאוישות ⚠️`
            : `חישוב מקומי בוצע — ${changed > 0 ? changed + ' שינויים' : 'אין שינויים נדרשים'}, כל המשמרות מאוישות ✓`
        );
        return next;
      });
      setIsGenerating(false);
    }, 20);
  }, [withAudit, toast]);

  const navigateWeek = useCallback((direction: -1 | 1) => {
    setState((s) => {
      const newWeek = addDaysISO(s.weekStartDate, direction * 7);
      const next = ensureWeekSeeded({ ...s, weekStartDate: newWeek }, newWeek);
      saveState(next);
      return next;
    });
  }, []);

  const goToCurrentWeek = useCallback(() => {
    setState((s) => {
      const newWeek = mostRecentSundayISO();
      const next = ensureWeekSeeded({ ...s, weekStartDate: newWeek }, newWeek);
      saveState(next);
      return next;
    });
  }, []);

  /** jump straight to the week containing an arbitrary chosen date */
  const goToDate = useCallback((dateISO: string) => {
    if (!dateISO) return;
    setState((s) => {
      const [y, m, d] = dateISO.split('-').map(Number);
      const newWeek = mostRecentSundayISO(new Date(y, m - 1, d));
      const next = ensureWeekSeeded({ ...s, weekStartDate: newWeek }, newWeek);
      saveState(next);
      return next;
    });
  }, []);

  const clearSchedule = useCallback(() => {
    setState((s) => {
      const instances = currentInstances(s).map((i) => ({
        ...i,
        employeeId: null,
        tempWorkerName: null,
        manual: false,
        exception: false,
      }));
      const next = withAudit(
        withCurrentInstances(s, instances),
        `כל השיבוצים בסידור של השבוע ${s.weekStartDate} נוקו. העדפות העובדים ושבועות אחרים נשארו ללא שינוי.`
      );
      saveState(next);
      return next;
    });
    toast('הסידור של השבוע הנוכחי נוקה — כל המשמרות ריקות כעת (העדפות ושבועות אחרים לא נגעו)');
  }, [withAudit, toast]);

  /** clears only THIS week's day/shift preferences (set from the availability grid) for every
   *  employee — separate from clearSchedule on purpose, since wiping the schedule and wiping
   *  people's stated availability are two different actions. Standing blocks from the "עובדים"
   *  tab and other weeks' preferences are untouched. */
  const clearWeekPreferences = useCallback(() => {
    setState((s) => {
      const week = s.weekStartDate;
      const employees = s.employees.map((e) => ({
        ...e,
        blocks: e.blocks.filter((b) => b.weekStartDate !== week),
      }));
      const next = withAudit({ ...s, employees }, `כל ההעדפות של השבוע (${week}) נוקו עבור כל העובדים.`);
      saveState(next);
      return next;
    });
    toast('ההעדפות של השבוע הנוכחי נוקו');
  }, [withAudit, toast]);

  /* ------------------------------------------------------------------ */
  const assignEmployee = useCallback(
    (instanceId: string, employeeId: string | null, opts?: { force?: boolean }): { ok: boolean; reasons?: string[] } => {
      const weekInstances = currentInstances(state);
      const inst = weekInstances.find((i) => i.id === instanceId);
      if (!inst) return { ok: false };

      if (employeeId) {
        const e = state.employees.find((x) => x.id === employeeId)!;
        const elig = getEligibility(e, inst, weekInstances, state.weekStartDate, inst.id);
        if (!elig.eligible && !opts?.force) {
          return { ok: false, reasons: elig.reasons.map((r) => REASON_LABELS[r.type]) };
        }
        const from = assigneeLabel(inst, state.employees) || 'ריק';
        const isException = !elig.eligible && !!opts?.force;
        setState((s) => {
          const instances = currentInstances(s).map((i) =>
            i.id === instanceId ? { ...i, employeeId, tempWorkerName: null, manual: true, exception: isException } : i
          );
          const text = isException
            ? `${DAY_NAMES[inst.day]} ${inst.name}: ${from} ← ${empName(employeeId)} (חריגה ידנית מאושרת: ${elig.reasons
                .map((r) => REASON_LABELS[r.type])
                .join('; ')})`
            : `${DAY_NAMES[inst.day]} ${inst.name}: ${from} ← ${empName(employeeId)} (שינוי ידני)`;
          const next = withAudit(withCurrentInstances(s, instances), text);
          saveState(next);
          return next;
        });
        toast(isException ? 'השיבוץ נשמר כחריגה ידנית' : 'השיבוץ נשמר');
        return { ok: true };
      }

      // unassign
      const from = assigneeLabel(inst, state.employees) || 'ריק';
      setState((s) => {
        const instances = currentInstances(s).map((i) =>
          i.id === instanceId ? { ...i, employeeId: null, tempWorkerName: null, manual: true, exception: false } : i
        );
        const next = withAudit(
          withCurrentInstances(s, instances),
          `${DAY_NAMES[inst.day]} ${inst.name}: ${from} ← ריק (שינוי ידני)`
        );
        saveState(next);
        return next;
      });
      toast('השיבוץ נשמר');
      return { ok: true };
    },
    [state, withAudit, toast, empName]
  );

  const assignTemp = useCallback(
    (instanceId: string, name: string) => {
      const inst = currentInstances(state).find((i) => i.id === instanceId);
      if (!inst) return;
      const from = assigneeLabel(inst, state.employees) || 'ריק';
      setState((s) => {
        const instances = currentInstances(s).map((i) =>
          i.id === instanceId ? { ...i, employeeId: null, tempWorkerName: name, manual: true, exception: false } : i
        );
        const next = withAudit(
          withCurrentInstances(s, instances),
          `${DAY_NAMES[inst.day]} ${inst.name}: ${from} ← ${name} (מתגבר, לא ברשימת העובדים הקבועים)`
        );
        saveState(next);
        return next;
      });
      toast('המתגבר שובץ למשמרת');
    },
    [state, withAudit, toast]
  );

  const removeTemp = useCallback(
    (instanceId: string) => {
      const inst = currentInstances(state).find((i) => i.id === instanceId);
      if (!inst) return;
      const name = inst.tempWorkerName;
      setState((s) => {
        const instances = currentInstances(s).map((i) =>
          i.id === instanceId ? { ...i, tempWorkerName: null, manual: false } : i
        );
        const next = withAudit(withCurrentInstances(s, instances), `${DAY_NAMES[inst.day]} ${inst.name}: המתגבר ${name} הוסר מהמשמרת.`);
        saveState(next);
        return next;
      });
      toast('המתגבר הוסר');
    },
    [state, withAudit, toast]
  );

  const markUnavailable = useCallback(
    (instanceId: string, reason: string) => {
      const inst = currentInstances(state).find((i) => i.id === instanceId);
      if (!inst) return;
      const who = empName(inst.employeeId);
      setState((s) => {
        const instances = currentInstances(s).map((i) =>
          i.id === instanceId ? { ...i, employeeId: null, manual: false, exception: false } : i
        );
        const next = withAudit(
          withCurrentInstances(s, instances),
          `${who} הוסר מהמשמרת ${DAY_NAMES[inst.day]} ${inst.name} (${inst.start}–${inst.end}). סיבה: ${reason}.`
        );
        saveState(next);
        return next;
      });
    },
    [state, empName, withAudit]
  );

  const applyReplacementOption = useCallback(
    (instanceId: string, optionIndex: number) => {
      const options = findReplacements(instanceId, currentInstances(state), state.employees, state.weekStartDate, 3);
      const opt = options[optionIndex];
      if (!opt) return;
      setState((s) => {
        let instances = currentInstances(s);
        let text = '';
        opt.changes.forEach((ch) => {
          const inst = instances.find((i) => i.id === ch.instanceId)!;
          const fromName = assigneeLabel(inst, s.employees) || 'ריק';
          instances = instances.map((i) =>
            i.id === ch.instanceId ? { ...i, employeeId: ch.toEmployeeId, tempWorkerName: null, manual: true } : i
          );
          text += `${DAY_NAMES[inst.day]} · ${inst.name} (${inst.start}–${inst.end}): ${fromName} ← ${empName(
            ch.toEmployeeId
          )} · הוחלף באמצעות מנוע חיפוש מחליפים\n`;
        });
        const next = withAudit(withCurrentInstances(s, instances), text.trim());
        saveState(next);
        return next;
      });
      toast(`ההחלפה בוצעה (${opt.changeCount} שינוי${opt.changeCount > 1 ? 'ים' : ''})`);
    },
    [state, empName, withAudit, toast]
  );

  /* ------------------------------------------------------------------ */
  const addEmployee = useCallback(
    (name: string, desired: number, max: number) => {
      setState((s) => {
        const employee: Employee = { id: uid(), name, desiredShifts: desired, maxShifts: max, blocks: [] };
        const next = withAudit({ ...s, employees: [...s.employees, employee] }, `נוסף עובד חדש: ${name}.`);
        saveState(next);
        return next;
      });
      toast('נשמר');
    },
    [withAudit, toast]
  );

  const updateEmployee = useCallback(
    (id: string, name: string, desired: number, max: number) => {
      setState((s) => {
        const employees = s.employees.map((e) => (e.id === id ? { ...e, name, desiredShifts: desired, maxShifts: max } : e));
        const next = withAudit({ ...s, employees }, `עודכנו פרטי העובד ${name}.`);
        saveState(next);
        return next;
      });
      toast('נשמר');
    },
    [withAudit, toast]
  );

  const deleteEmployee = useCallback(
    (id: string) => {
      setState((s) => {
        const e = s.employees.find((x) => x.id === id);
        if (!e) return s;
        // an employee is global, so free up their assignments in EVERY week, not just the one being viewed
        const weeks: AppState['weeks'] = {};
        for (const [wk, insts] of Object.entries(s.weeks)) {
          weeks[wk] = insts.map((i) => (i.employeeId === id ? { ...i, employeeId: null } : i));
        }
        const employees = s.employees.filter((x) => x.id !== id);
        const next = withAudit({ ...s, employees, weeks }, `העובד ${e.name} נמחק מהמערכת (מכל השבועות).`);
        saveState(next);
        return next;
      });
      toast('העובד נמחק');
    },
    [withAudit, toast]
  );

  const addBlock = useCallback(
    (employeeId: string, block: EmployeeBlock) => {
      setState((s) => {
        const e = s.employees.find((x) => x.id === employeeId);
        if (!e) return s;
        const employees = s.employees.map((x) => (x.id === employeeId ? { ...x, blocks: [...x.blocks, block] } : x));
        const next = withAudit({ ...s, employees }, `נוספה חסימה עבור ${e.name}.`);
        saveState(next);
        return next;
      });
      toast('החסימה נוספה');
    },
    [withAudit, toast]
  );

  const removeBlock = useCallback(
    (employeeId: string, idx: number) => {
      setState((s) => {
        const e = s.employees.find((x) => x.id === employeeId);
        if (!e) return s;
        const employees = s.employees.map((x) =>
          x.id === employeeId ? { ...x, blocks: x.blocks.filter((_, i) => i !== idx) } : x
        );
        const next = withAudit({ ...s, employees }, `הוסרה חסימה עבור ${e.name}.`);
        saveState(next);
        return next;
      });
    },
    [withAudit]
  );

  /**
   * used by the weekly availability modal: sets, in one atomic update, whether an employee is off
   * for the whole day, or which specific shifts they can't work that day (can be several).
   * Replaces only this day's own day/shift-scoped blocks — leaves any whole-week category
   * blocks (managed from the "עובדים" tab) untouched.
   */
  const setDayConstraints = useCallback(
    (employeeId: string, day: number, dayOff: boolean, blockedShiftTypeIds: string[], reason?: string) => {
      setState((s) => {
        const e = s.employees.find((x) => x.id === employeeId);
        if (!e) return s;
        const week = s.weekStartDate;
        // only drop THIS week's own day/shift blocks for that day — blocks tagged with any other
        // week (or untagged legacy ones from before this feature existed) are left untouched, so
        // nothing is ever erased and older weeks stay exactly as they were when you view them again
        const kept = e.blocks.filter((b) => {
          if (b.weekStartDate !== week) return true;
          if (b.scope === 'day' && b.day === day) return false;
          if (b.scope === 'shift' && b.day === day) return false;
          return true;
        });
        const additions: EmployeeBlock[] = dayOff
          ? [{ scope: 'day', day, reason: reason || undefined, weekStartDate: week }]
          : blockedShiftTypeIds.map((shiftTypeId) => ({ scope: 'shift', day, shiftTypeId, weekStartDate: week }));
        const employees = s.employees.map((x) =>
          x.id === employeeId ? { ...x, blocks: [...kept, ...additions] } : x
        );
        const text = dayOff
          ? `${e.name}: סומן כ${reason || 'יום חופש'} ב${DAY_NAMES[day]} (שבוע ${week}).`
          : blockedShiftTypeIds.length
          ? `${e.name}: עודכנו משמרות חסומות ב${DAY_NAMES[day]} (${blockedShiftTypeIds.length}, שבוע ${week}).`
          : `${e.name}: הוסרו כל החסימות ל${DAY_NAMES[day]} לשבוע ${week} (זמין לכל המשמרות באותו שבוע).`;
        const next = withAudit({ ...s, employees }, text);
        saveState(next);
        return next;
      });
    },
    [withAudit]
  );

  /** lets a manager override the hours of a single scheduled cell (e.g. "Igor works 7:00-15:00 that day only") without touching the shift-type template used by every other day */
  const setInstanceTime = useCallback(
    (instanceId: string, start: string, end: string) => {
      setState((s) => {
        const inst = currentInstances(s).find((i) => i.id === instanceId);
        if (!inst) return s;
        const instances = currentInstances(s).map((i) =>
          i.id === instanceId ? { ...i, start, end, durationHours: durationHoursSafe(start, end) } : i
        );
        const next = withAudit(
          withCurrentInstances(s, instances),
          `${DAY_NAMES[inst.day]} ${inst.name}: שעות המשמרת שונו ל-${start}-${end} (עבור תא זה בלבד).`
        );
        saveState(next);
        return next;
      });
      toast('השעות עודכנו');
    },
    [withAudit, toast]
  );

  /** adds another empty slot identical to an existing one (same day/shift/time) - for holidays/weekends that need two people on the same shift */
  const duplicateInstance = useCallback(
    (instanceId: string) => {
      setState((s) => {
        const source = currentInstances(s).find((i) => i.id === instanceId);
        if (!source) return s;
        const clone: ShiftInstance = {
          ...source,
          id: uid(),
          employeeId: null,
          tempWorkerName: null,
          manual: false,
          exception: false,
        };
        const next = withAudit(
          withCurrentInstances(s, [...currentInstances(s), clone]),
          `נוסף תא נוסף ל-${DAY_NAMES[source.day]} ${source.name} (${source.start}-${source.end}) - לשיבוץ עובד שני.`
        );
        saveState(next);
        return next;
      });
      toast('נוסף מקום שני לאותה משמרת');
    },
    [withAudit, toast]
  );

  const deleteInstance = useCallback(
    (instanceId: string) => {
      setState((s) => {
        const inst = currentInstances(s).find((i) => i.id === instanceId);
        if (!inst) return s;
        const instances = currentInstances(s).filter((i) => i.id !== instanceId);
        const next = withAudit(
          withCurrentInstances(s, instances),
          `הוסר תא: ${DAY_NAMES[inst.day]} ${inst.name} (${inst.start}-${inst.end}).`
        );
        saveState(next);
        return next;
      });
    },
    [withAudit]
  );

  /* ------------------------------------------------------------------ */
  const addShiftType = useCallback(
    (name: string, start: string, end: string, category: Category) => {
      setState((s) => {
        const id = uid();
        const shiftTypes: ShiftType[] = [...s.shiftTypes, { id, name, start, end, category }];
        // apply to every week that already has its own data, so it stays consistent everywhere -
        // weeks not visited yet will get it automatically since they're built fresh from shiftTypes
        const weeks: AppState['weeks'] = {};
        for (const [wk, insts] of Object.entries(s.weeks)) {
          const newInstances: ShiftInstance[] = [];
          for (let d = 0; d < 7; d++) newInstances.push(makeInstance(d, { id, name, start, end, category }));
          weeks[wk] = [...insts, ...newInstances];
        }
        const next = withAudit(
          { ...s, shiftTypes, weeks },
          `נוסף סוג משמרת חדש "${name}" (${start}-${end}) לכל ימי השבוע, בכל השבועות הקיימים.`
        );
        saveState(next);
        return next;
      });
      toast('נשמר');
    },
    [withAudit, toast]
  );

  const updateShiftType = useCallback(
    (id: string, name: string, start: string, end: string, category: Category) => {
      setState((s) => {
        const shiftTypes = s.shiftTypes.map((st) => (st.id === id ? { ...st, name, start, end, category } : st));
        const weeks: AppState['weeks'] = {};
        for (const [wk, insts] of Object.entries(s.weeks)) {
          weeks[wk] = insts.map((i) =>
            i.shiftTypeId === id
              ? { ...i, name, start, end, category, durationHours: durationHoursSafe(start, end) }
              : i
          );
        }
        const next = withAudit({ ...s, shiftTypes, weeks }, `עודכן סוג המשמרת "${name}" (${start}-${end}) בכל השבועות.`);
        saveState(next);
        return next;
      });
      toast('נשמר');
    },
    [withAudit, toast]
  );

  const deleteShiftType = useCallback(
    (id: string) => {
      setState((s) => {
        const st = s.shiftTypes.find((x) => x.id === id);
        if (!st) return s;
        const shiftTypes = s.shiftTypes.filter((x) => x.id !== id);
        const weeks: AppState['weeks'] = {};
        for (const [wk, insts] of Object.entries(s.weeks)) {
          weeks[wk] = insts.filter((i) => i.shiftTypeId !== id);
        }
        const next = withAudit({ ...s, shiftTypes, weeks }, `סוג המשמרת "${st.name}" נמחק (מכל השבועות).`);
        saveState(next);
        return next;
      });
      toast('נמחק');
    },
    [withAudit, toast]
  );

  const addAdhocShift = useCallback(
    (day: number, name: string, start: string, end: string, category: Category) => {
      setState((s) => {
        const inst = makeInstance(day, { id: 'adhoc-' + uid(), name, start, end, category });
        const next = withAudit(
          withCurrentInstances(s, [...currentInstances(s), inst]),
          `נוספה משמרת ייעודית: ${DAY_NAMES[day]} ${name} (${start}-${end}) לשבוע ${s.weekStartDate}.`
        );
        saveState(next);
        return next;
      });
      toast('המשמרת נוספה');
    },
    [withAudit, toast]
  );

  const clearAuditLog = useCallback(() => {
    setState((s) => {
      const next = { ...s, auditLog: [] };
      saveState(next);
      return next;
    });
    toast('יומן השינויים נוקה');
  }, [toast]);

  /* ------------------------------------------------------------------ */
  const value = useMemo<Ctx>(
    () => ({
      state,
      instances: currentInstances(state),
      tab,
      setTab,
      modal,
      openModal,
      closeModal,
      calendarView,
      setCalendarView,
      selectedEmployeeId,
      setSelectedEmployeeId,
      assignMode,
      setAssignMode,
      toasts,
      toast,
      isGenerating,
      isLoaded,
      isShared: isFirebaseConfigured,
      setWeekLabel,
      navigateWeek,
      goToCurrentWeek,
      goToDate,
      fullGenerate,
      localRecalc,
      clearSchedule,
      clearWeekPreferences,
      assignEmployee,
      assignTemp,
      removeTemp,
      markUnavailable,
      applyReplacementOption,
      setInstanceTime,
      duplicateInstance,
      deleteInstance,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      addBlock,
      removeBlock,
      setDayConstraints,
      addShiftType,
      updateShiftType,
      deleteShiftType,
      addAdhocShift,
      clearAuditLog,
    }),
    [
      state,
      tab,
      modal,
      openModal,
      closeModal,
      calendarView,
      selectedEmployeeId,
      assignMode,
      toasts,
      toast,
      isGenerating,
      isLoaded,
      setWeekLabel,
      navigateWeek,
      goToCurrentWeek,
      goToDate,
      fullGenerate,
      localRecalc,
      clearSchedule,
      clearWeekPreferences,
      assignEmployee,
      assignTemp,
      removeTemp,
      markUnavailable,
      applyReplacementOption,
      setInstanceTime,
      duplicateInstance,
      deleteInstance,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      addBlock,
      removeBlock,
      setDayConstraints,
      addShiftType,
      updateShiftType,
      deleteShiftType,
      addAdhocShift,
      clearAuditLog,
    ]
  );

  return <SchedulerCtx.Provider value={value}>{children}</SchedulerCtx.Provider>;
}

function durationHoursSafe(start: string, end: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440;
  return +((e - s) / 60).toFixed(2);
}
