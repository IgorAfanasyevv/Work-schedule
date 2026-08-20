import type { AppState, Employee, ShiftType } from './types';
import { buildTemplateInstances, uid } from './engine';
import { mostRecentSundayISO } from './dateUtils';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured, STATE_COLLECTION } from './firebaseClient';

const STORAGE_KEY_PREFIX = 'shift-scheduler-state-';

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
/*  whenever Firebase env vars are not configured (e.g. local dev)      */
/* ------------------------------------------------------------------ */

export function loadLocalState(siteId: string): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + siteId);
    if (raw) return withMigrations(JSON.parse(raw) as AppState);
  } catch {
    /* fall through to default */
  }
  return defaultState();
}

const pendingLocal: Record<string, AppState> = {};
const localSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function flushLocalSite(siteId: string) {
  const pending = pendingLocal[siteId];
  if (pending === undefined) return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + siteId, JSON.stringify(pending));
  } catch (e) {
    console.error('local save failed', e);
  }
  delete pendingLocal[siteId];
  if (localSaveTimers[siteId]) {
    clearTimeout(localSaveTimers[siteId]);
    delete localSaveTimers[siteId];
  }
}

export function saveLocalState(state: AppState, siteId: string) {
  pendingLocal[siteId] = state;
  // deferred to the next tick (not a real debounce delay) rather than called synchronously,
  // since this can be triggered from inside a React state updater and firing storage/network
  // side effects synchronously mid-update is risky; still effectively immediate for the purpose
  // of not losing data on a quick refresh
  setTimeout(() => flushLocalSite(siteId), 0);
}

/* ------------------------------------------------------------------ */
/*  shared (Firebase Firestore) persistence — every visitor reads/      */
/*  writes the same document for a given site, so everyone who opens    */
/*  the link and picks that site sees the same schedule, updated live   */
/* ------------------------------------------------------------------ */

const stateDocRef = (siteId: string) => doc(db!, STATE_COLLECTION, siteId);

export async function loadRemoteState(siteId: string): Promise<AppState> {
  if (!db) return defaultState();
  try {
    const snap = await getDoc(stateDocRef(siteId));
    if (snap.exists()) {
      const payload = snap.data() as { data?: AppState };
      if (payload.data) return withMigrations(payload.data);
    }
    // first run for this site: seed the document with the default state
    const seed = defaultState();
    await setDoc(stateDocRef(siteId), { data: seed, updatedAt: serverTimestamp() });
    return seed;
  } catch (e) {
    console.error('remote load failed', e);
    return defaultState();
  }
}

const pendingRemote: Record<string, AppState> = {};
const remoteSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function flushRemoteSite(siteId: string) {
  const pending = pendingRemote[siteId];
  if (pending === undefined || !db) return;
  setDoc(stateDocRef(siteId), { data: pending, updatedAt: serverTimestamp() }, { merge: true }).catch((e) =>
    console.error('remote save failed', e)
  );
  delete pendingRemote[siteId];
  if (remoteSaveTimers[siteId]) {
    clearTimeout(remoteSaveTimers[siteId]);
    delete remoteSaveTimers[siteId];
  }
}

export function saveRemoteState(state: AppState, siteId: string) {
  if (!db) return;
  pendingRemote[siteId] = state;
  // same reasoning as saveLocalState: deferred to the next tick instead of called synchronously
  // from inside a React state updater, and with no artificial delay beyond that
  setTimeout(() => flushRemoteSite(siteId), 0);
}

/** subscribe to live changes for one site (from any tab/user); returns an unsubscribe function */
export function subscribeRemoteState(siteId: string, onChange: (state: AppState) => void): () => void {
  if (!db) return () => {};
  const unsubscribe = onSnapshot(stateDocRef(siteId), (snap) => {
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

export async function loadState(siteId: string): Promise<AppState> {
  return isFirebaseConfigured ? loadRemoteState(siteId) : loadLocalState(siteId);
}

export function saveState(state: AppState, siteId: string) {
  if (isFirebaseConfigured) saveRemoteState(state, siteId);
  else saveLocalState(state, siteId);
}

/**
 * Immediately writes out any save that's still waiting on its debounce timer, for every site.
 * Called right before the page unloads/hides so a refresh or tab close can't silently drop the
 * last few seconds of edits that hadn't been persisted yet.
 */
export function flushPendingSaves() {
  Object.keys(pendingLocal).forEach(flushLocalSite);
  Object.keys(pendingRemote).forEach(flushRemoteSite);
}
