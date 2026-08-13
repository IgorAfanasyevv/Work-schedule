import type { AppState, Employee, ShiftType } from './types';
import { buildTemplateInstances, uid } from './engine';
import { isSupabaseConfigured, supabase, STATE_ROW_ID, STATE_TABLE } from './supabaseClient';

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
  const instances = buildTemplateInstances(shiftTypes);
  return {
    weekLabel: 'שבוע נוכחי',
    shiftTypes,
    employees,
    instances,
    auditLog: [],
  };
}

/* ------------------------------------------------------------------ */
/*  local (per-browser) persistence — used automatically as a fallback  */
/*  whenever Supabase env vars are not configured (e.g. local dev)      */
/* ------------------------------------------------------------------ */

export function loadLocalState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
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
/*  shared (Supabase) persistence — every visitor reads/writes the      */
/*  same row, so everyone who opens the link sees the same schedule     */
/* ------------------------------------------------------------------ */

export async function loadRemoteState(): Promise<AppState> {
  if (!supabase) return defaultState();
  const { data, error } = await supabase.from(STATE_TABLE).select('data').eq('id', STATE_ROW_ID).maybeSingle();
  if (error) {
    console.error('remote load failed', error);
    return defaultState();
  }
  if (data?.data) return data.data as AppState;

  // first run: seed the row with the default state
  const seed = defaultState();
  await supabase.from(STATE_TABLE).upsert({ id: STATE_ROW_ID, data: seed, updated_at: new Date().toISOString() });
  return seed;
}

let remoteSaveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveRemoteState(state: AppState) {
  if (!supabase) return;
  if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(async () => {
    const { error } = await supabase!
      .from(STATE_TABLE)
      .upsert({ id: STATE_ROW_ID, data: state, updated_at: new Date().toISOString() });
    if (error) console.error('remote save failed', error);
  }, 400);
}

/** subscribe to changes made by *other* tabs/users; returns an unsubscribe function */
export function subscribeRemoteState(onChange: (state: AppState) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('app_state_changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: STATE_TABLE, filter: `id=eq.${STATE_ROW_ID}` },
      (payload) => {
        if (payload.new && (payload.new as { data?: AppState }).data) {
          onChange((payload.new as { data: AppState }).data);
        }
      }
    )
    .subscribe();
  return () => {
    supabase!.removeChannel(channel);
  };
}

/* ------------------------------------------------------------------ */
/*  unified entry points used by the app — pick remote vs local         */
/* ------------------------------------------------------------------ */

export async function loadState(): Promise<AppState> {
  return isSupabaseConfigured ? loadRemoteState() : loadLocalState();
}

export function saveState(state: AppState) {
  if (isSupabaseConfigured) saveRemoteState(state);
  else saveLocalState(state);
}
