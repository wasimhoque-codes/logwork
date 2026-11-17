import { freshStore, validateStore, type Store, type Session, type Settings, type Programme, type BodyEntry, type RecoveryEntry } from '../model';

export type RecordValue = Settings | Programme | Session | BodyEntry | RecoveryEntry | null;
export type Records = Record<string, RecordValue>;
export type Versions = Record<string, number>;
export type Change = { key: string; value?: RecordValue; expected: number; position?: number };
export type EditClock = { editedAt: number; id: string };
export type Edit = EditClock & {
  changes: Change[];
  removedSetup?: true;
  activeId?: string;
  attempts?: Programme['attempts'];
};
export type Snapshot = { datasetId: string | null; revision: number; versions: Versions; clocks?: Record<string, EditClock>; store: Store | null };
export type Mutation = Edit & { datasetId: string };
export const SYNC_PROTOCOL = '4';

export function compareEdits(a: EditClock, b?: EditClock) {
  return !b ? 1 : a.editedAt - b.editedAt || (a.id > b.id ? 1 : a.id < b.id ? -1 : 0);
}

export function mergeEdit(base: Store, clocks: NonNullable<Snapshot['clocks']>, edit: Edit) {
  const changes = edit.changes.filter(change => compareEdits(edit, clocks[change.key]) > 0);
  const savedKey = edit.activeId && 'session:' + edit.activeId;
  const finishing = !!savedKey && edit.changes.some(change => change.key === savedKey && change.value);
  const activeIndex = changes.findIndex(change => change.key === 'active');
  const active = changes[activeIndex];
  if (active) {
    const draft = active.value as Session | null;
    if (draft ? clocks['session:' + draft.id] || base.sessions.some(session => session.id === draft.id)
      : base.active && base.active.id !== edit.activeId) changes.splice(activeIndex, 1);
  }
  // Completion is terminal for this workout ID, even when a newer draft reached D1 first.
  if (finishing && base.active?.id === edit.activeId && !changes.some(change => change.key === 'active')) {
    changes.push({key:'active', value:null, expected:0});
  }

  const programmeChange = changes.find(change => change.key === 'programme');
  const programme = (programmeChange?.value ?? base.programme) as Programme;
  const incoming = new Map(programme.attempts.map(attempt => [attempt.id, attempt]));
  const needed = new Set<string>();
  for (const change of changes) {
    if (change.value && (change.key === 'active' || change.key.startsWith('session:') || change.key.startsWith('recovery:'))) {
      const id = (change.value as Session | RecoveryEntry).attemptId;
      if (id) needed.add(id);
    }
  }
  const missing = new Map<string, Programme['attempts'][number]>();
  for (const attempt of base.programme.attempts) {
    if (!incoming.has(attempt.id)) missing.set(attempt.id, attempt);
  }
  for (const attempt of edit.attempts ?? []) {
    if (needed.has(attempt.id) && !incoming.has(attempt.id) && !missing.has(attempt.id)) missing.set(attempt.id, attempt);
  }
  if (missing.size) {
    const attempts = [...programme.attempts];
    const last = attempts.pop()!;
    const historical = [...missing.values()].map(attempt => attempt.ended ? attempt : {
      ...attempt, ended: attempt.started, decision: 'restart' as const,
    });
    const value = {...programme, attempts:[...attempts, ...historical, last]};
    if (programmeChange) changes[changes.indexOf(programmeChange)] = {...programmeChange, value};
    else changes.push({key:'programme', value, expected:0});
  }
  const store = overlay(base, changes);
  const nextClocks = {...clocks};
  for (const {key} of changes) {
    if (key === 'programme' && !programmeChange) continue;
    nextClocks[key] = {editedAt:edit.editedAt,id:edit.id};
  }
  return {store, changes, clocks:nextClocks};
}

export function records(store: Store): Records {
  return {
    settings: store.settings, programme: store.programme, active: store.active,
    ...Object.fromEntries(store.sessions.map(s => ['session:'+s.id, s])),
    ...Object.fromEntries(store.body.map(b => ['body:'+b.date, b])),
    ...Object.fromEntries(store.recovery.map(r => ['recovery:'+r.id, r])),
  };
}
export function importRecords(store: Store): Change[] {
  const positions = new Map([
    ...store.sessions.map((value, index) => ['session:' + value.id, index] as const),
    ...store.body.map((value, index) => ['body:' + value.date, index] as const),
    ...store.recovery.map((value, index) => ['recovery:' + value.id, index] as const),
  ]);
  return Object.entries(records(store)).map(([key,value]) => ({
    key, value, expected:0, position:positions.get(key),
  }));
}
export function fromRecords(input: Records): Store {
  const s = freshStore();
  s.settings = input.settings as Settings;
  s.programme = input.programme as Programme;
  s.active = input.active as Session | null;
  s.sessions = Object.entries(input).filter(([k])=>k.startsWith('session:')).map(([,v])=>v as Session);
  s.body = Object.entries(input).filter(([k])=>k.startsWith('body:')).map(([,v])=>v as BodyEntry);
  s.recovery = Object.entries(input).filter(([k])=>k.startsWith('recovery:')).map(([,v])=>v as RecoveryEntry);
  return validateStore(s);
}
export const canonical = (value:unknown):string => JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export const equal = (a: unknown, b: unknown) => canonical(a) === canonical(b);
export function changesBetween(before: Store, after: Store, versions: Versions = {}): Change[] {
  const a=records(before), b=records(after);
  return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(key=>!equal(a[key],b[key])).map(key=>({key,...(key in b?{value:b[key]}:{}),expected:versions[key]??0}));
}
export function overlay(store: Store, changes: Change[]): Store {
  const result=records(store);
  for(const change of changes) { if(change.value===undefined)delete result[change.key];else result[change.key]=change.value; }
  return fromRecords(result);
}
export function validRecordKey(key: string) {
  return ['settings','programme','active'].includes(key)||/^(session|recovery):[^\s]{1,100}$/.test(key)||/^body:\d{4}-\d{2}-\d{2}$/.test(key);
}
