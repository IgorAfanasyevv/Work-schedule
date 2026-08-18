import type { AppState, Employee, ShiftType } from './types';
import { buildTemplateInstances, uid } from './engine';
import { mostRecentSundayISO } from './dateUtils';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured, STATE_COLLECTION, STATE_DOC_ID } from './firebaseClient';

const STORAGE_KEY = 'shift-scheduler-state';

export function defaultShiftTypes(): ShiftType[] {
  return [
    { id: 'morning', name: 'בוקר', start: '05:45', end: '14:00', category: 'morning' },
    { id: 'afternoon', name: 'צהריים', start: '13:45', end: '22:00', category: 'afternoon' },
    { id: 'night', name: 'לילה', start: '21:45', end: '06:00', category: 'night' },
    { id: 'night2', name: 'לילה קנה 2', start: '23:00', end: '07:00', category: 'night' },
  ];
}

export function defaultEmployees(): Employee[] {
  return [
    { id: uid(), name: 'איגור', desiredShifts: 6, maxShifts: 6, blocks: [] },
    { id: uid(), name: 'אריאל', desiredShifts: 6, maxShifts: 6, blocks: [] },
    { id: uid(), name: 'איתן', desiredShifts: 5, maxShifts: 6, blocks: [] },
    { id: uid(), name: 'עומר', desiredShifts: 5, maxShifts: 5, blocks: [] },
    { id: uid(), name: 'חי', desiredShifts: 4, maxShifts: 5, blocks: [] },
  ];
}

export function defaultState(): AppState {
  const shiftTypes = defaultShiftTypes();
  const employees = defaultEmployees();
  const weekStartDate = mostRecentSundayISO();
  return {
    weekLabel: 'שבוע נוכחי',
    weekStartDate,
    shiftTypes,
    employees,
    weeks: { [weekStartDate]: buildTemplateInstances(shiftTypes) },
    auditLog: [],
  };
}

/** fills in fields that older saved states (from before a feature existed) might be missing,
 *  including the old-style single flat `instances` array from before per-week storage existed */
function withMigrations(raw: AppState & { instances?: unknown }): AppState {
  const weekStartDate = raw.weekStartDate || mostRecentSundayISO();
  let weeks = raw.weeks;
  if (!weeks) {
    // pre-migration shape: a single shared `instances` array used for every week. Preserve it as
    // this week's data (better than silently discarding real assignments) - every other week will
    // simply start fresh from now on, which is exactly the per-week behavior going forward.
    const legacyInstances = Array.isArray(raw.instances) ? (raw.instances as AppState['weeks'][string]) : [];
    weeks = { [weekStartDate]: legacyInstances };
  }
  const { instances: _drop, ...rest } = raw;
  return { ...rest, weekStartDate, weeks };
}

/* ------------------------------------------------------------------ */
/*  local (per-browser) persistence — used automatically as a fallback  */
/*  whenever Supabase env vars are not configured (e.g. local dev)      */
/* ------------------------------------------------------------------ */

export function loadLocalState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return withMigrations(JSON.parse(raw) as AppState);
  } catch {
    /* fall through to default */
  }
  return defaultState();
}

let localSaveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveLocalState(state: AppState) {
  if (localSaveTimer) clearTimeout(localSaveTimer);
  localSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('local save failed', e);
    }
  }, 250);
}

/* ------------------------------------------------------------------ */
/*  shared (Firebase Firestore) persistence — every visitor reads/      */
/*  writes the same document, so everyone who opens the link sees the   */
/*  same schedule, updated live                                         */
/* ------------------------------------------------------------------ */

const stateDocRef = () => doc(db!, STATE_COLLECTION, STATE_DOC_ID);

export async function loadRemoteState(): Promise<AppState> {
  if (!db) return defaultState();
  try {
    const snap = await getDoc(stateDocRef());
    if (snap.exists()) {
      const payload = snap.data() as { data?: AppState };
      if (payload.data) return withMigrations(payload.data);
    }
    // first run: seed the document with the default state
    const seed = defaultState();
    await setDoc(stateDocRef(), { data: seed, updatedAt: serverTimestamp() });
    return seed;
  } catch (e) {
    console.error('remote load failed', e);
    return defaultState();
  }
}

let remoteSaveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveRemoteState(state: AppState) {
  if (!db) return;
  if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(() => {
    setDoc(stateDocRef(), { data: state, updatedAt: serverTimestamp() }, { merge: true }).catch((e) =>
      console.error('remote save failed', e)
    );
  }, 400);
}

/** subscribe to live changes (from any tab/user); returns an unsubscribe function */
export function subscribeRemoteState(onChange: (state: AppState) => void): () => void {
  if (!db) return () => {};
  const unsubscribe = onSnapshot(stateDocRef(), (snap) => {
    if (snap.exists()) {
      const payload = snap.data() as { data?: AppState };
      if (payload.data) onChange(withMigrations(payload.data));
    }
  });
  return unsubscribe;
}

/* ------------------------------------------------------------------ */
/*  unified entry points used by the app — pick remote vs local         */
/* ------------------------------------------------------------------ */

export async function loadState(): Promise<AppState> {
  return isFirebaseConfigured ? loadRemoteState() : loadLocalState();
}

export function saveState(state: AppState) {
  if (isFirebaseConfigured) saveRemoteState(state);
  else saveLocalState(state);
}
