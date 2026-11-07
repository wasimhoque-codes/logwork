import { freshStore, validateStore, type Store, type Session, type Settings, type Programme, type BodyEntry, type RecoveryEntry } from '../model';

export type RecordValue = Settings | Programme | Session | BodyEntry | RecoveryEntry | null;
export type Records = Record<string, RecordValue>;
export type Versions = Record<string, number>;
export type Change = { key: string; value?: RecordValue; expected: number; position?: number };
export type Snapshot = { datasetId: string | null; revision: number; versions: Versions; store: Store | null };
export type Mutation = { id: string; datasetId: string; programmeVersion: number; changes: Change[] };

export function records(store: Store): Records {
  return {
    settings: store.settings, programme: store.programme, active: store.active,
    ...Object.fromEntries(store.sessions.map(s => ['session:'+s.id, s])),
    ...Object.fromEntries(store.body.map(b => ['body:'+b.date, b])),
    ...Object.fromEntries(store.recovery.map(r => ['recovery:'+r.id, r])),
  };
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
