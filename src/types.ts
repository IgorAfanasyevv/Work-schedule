export type Category = 'morning' | 'afternoon' | 'night' | 'other';

export interface ShiftType {
  id: string;
  name: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  category: Category;
}

export type BlockScope = 'day' | 'category' | 'shift';

export interface EmployeeBlock {
  scope: BlockScope;
  /** day index 0-6, or 'all' when scope === 'category' and it applies to the whole week */
  day: number | 'all';
  category?: Category; // used when scope === 'category'
  shiftTypeId?: string; // used when scope === 'shift'
  /** free-text reason shown in the weekly summary, e.g. "מילואים" / "חופש" (used when scope === 'day') */
  reason?: string;
  /**
   * ISO date (YYYY-MM-DD, the Sunday of that week) this block was set for. Only used for blocks
   * created from the weekly availability grid (scope 'day'/'shift'): those apply ONLY to the week
   * they were entered for, so a new week always starts blank and old weeks' choices stay in
   * history instead of leaking forward or getting overwritten. Blocks with no weekStartDate (e.g.
   * the standing constraints added from the "עובדים" tab) are treated as always-on, every week.
   */
  weekStartDate?: string;
}

export interface Employee {
  id: string;
  name: string;
  desiredShifts: number;
  maxShifts: number;
  blocks: EmployeeBlock[];
}

export interface ShiftInstance {
  id: string;
  day: number; // 0-6 (Sunday-Saturday)
  shiftTypeId: string;
  name: string;
  start: string;
  end: string;
  category: Category;
  durationHours: number;
  employeeId: string | null;
  /** a one-off reinforcement worker who is NOT part of the permanent employee roster */
  tempWorkerName: string | null;
  manual: boolean;
  exception: boolean;
}

export interface AuditEntry {
  id: string;
  ts: string;
  text: string;
}

export interface AppState {
  weekLabel: string;
  /** ISO date (YYYY-MM-DD) of the Sunday this week's table starts on, used for the date labels + week navigation arrows */
  weekStartDate: string;
  shiftTypes: ShiftType[];
  employees: Employee[];
  /**
   * Each week's actual shift schedule, keyed by that week's Sunday (ISO date) - completely
   * separate data per week, so generating/editing/clearing one week never touches another.
   * A week that hasn't been visited yet simply has no entry here; the app creates a fresh blank
   * one (from the current shiftTypes) the first time you navigate to it.
   */
  weeks: Record<string, ShiftInstance[]>;
  auditLog: AuditEntry[];
}

export type EligibilityReasonType =
  | 'blocked'
  | 'overlap'
  | 'sameDayShift'
  | 'maxShifts'
  | 'maxDesired'
  | 'maxNights'
  | 'consecutiveNights';

export interface EligibilityReason {
  type: EligibilityReasonType;
  conflicts?: ShiftInstance[];
  currentCount?: number;
  cap?: number;
  count?: number;
}

export interface Eligibility {
  eligible: boolean;
  reasons: EligibilityReason[];
  conflicts: ShiftInstance[];
}

export interface ReplacementChange {
  instanceId: string;
  toEmployeeId: string;
}

export interface ReplacementOption {
  changeCount: number;
  changes: ReplacementChange[];
  score: number;
}

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

export const CATEGORY_LABEL: Record<Category, string> = {
  morning: 'בוקר',
  afternoon: 'צהריים',
  night: 'לילה',
  other: 'אחר',
};

export const REASON_LABELS: Record<EligibilityReasonType, string> = {
  blocked: 'העובד חסם משמרת זו',
  overlap: 'קיימת חפיפת שעות עם משמרת אחרת שלו',
  sameDayShift: 'העובד כבר משובץ למשמרת נוספת שמתחילה באותו יום (לא ניתן לעבוד פעמיים באותו יום)',
  maxShifts: 'העובד הגיע למספר המשמרות המקסימלי שלו',
  maxDesired: 'העובד כבר הגיע למספר המשמרות הרצוי שלו (ניתן לשבץ מעבר לכך רק ידנית)',
  maxNights: 'העובד הגיע למכסת 3 משמרות הלילה השבועית',
  consecutiveNights: 'השיבוץ ייצור יותר מ-2 לילות רצופים',
};

export const ABSENCE_REASONS = ['מילואים', 'מחלה', 'נסיבות אישיות', 'מצב חירום', 'אחר'] as const;
