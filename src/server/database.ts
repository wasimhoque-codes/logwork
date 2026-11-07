import { exerciseKey, freshStore, validateStore, type Store, type Session, type ExerciseLog } from '../model';
import { type Change, type Snapshot, type Mutation, records, fromRecords, overlay, validRecordKey, equal, canonical } from '../persistence/records';

export type Sql = { sql: string; params: (string | number | null)[] };
export interface Statement {
  bind(...params: unknown[]): Statement;
  all<T = Row>(): Promise<{ results: T[] }>;
  first<T = Row>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch<T = Row>(statements: Statement[]): Promise<{ results: T[] }[]>;
}
type Row = Record<string, string | number | null>;
const q = (sql: string, ...params: Sql['params']): Sql => ({ sql, params });
const json = (value: unknown) => value === undefined ? null : JSON.stringify(value);
const parsed = <T,>(value: string | number | null): T => JSON.parse(String(value));
export const prepared = (db: Database, statement: Sql) => db.prepare(statement.sql).bind(...statement.params);
export const runBatch = (db: Database, statements: Sql[]) => db.batch(statements.map(s=>prepared(db,s)));

export class Conflict extends Error {
  constructor(public keys: string[], public snapshot: Snapshot) { super('Records changed on another device.'); }
}

export async function readDataset(db: Database, datasetId: string): Promise<Snapshot> {
  const tables=['datasets','settings','programmes','week_attempts','exercise_choices','sessions','session_exercises','exercise_sets','body_entries','recovery_entries','record_versions'];
  const results=await db.batch(tables.map(table=>db.prepare(`SELECT * FROM ${table} WHERE ${table==='datasets'?'id':'dataset_id'} = ?${['week_attempts','sessions','body_entries','recovery_entries'].includes(table)?' ORDER BY position':''}${table==='session_exercises'?' ORDER BY session_id,position':''}${table==='exercise_sets'?' ORDER BY session_id,exercise_position,position':''}`).bind(datasetId)));
  const [dataset, settings, programme, attempts, choices, sessions, exercises, sets, body, recovery, versions]=results.map(r=>r.results);
  if(!dataset[0]||!settings[0]||!programme[0])throw new Error('Dataset is incomplete.');
  const p=programme[0], r: ReturnType<typeof records> = {
    settings:{name:String(settings[0].name),unit:settings[0].unit as 'kg'|'lb',autoRest:!!settings[0].auto_rest},
    programme:{week:Number(p.week),status:p.status as 'active'|'complete',attempts:attempts.map(a=>({id:String(a.id),week:Number(a.week),started:String(a.started),...(a.ended===null?{}:{ended:String(a.ended)}),...(a.decision===null?{}:{decision:a.decision as Store['programme']['attempts'][number]['decision']})})),options:{saturdayTwoSets:!!p.saturday_two_sets,saturdayCore:p.saturday_core as Store['programme']['options']['saturdayCore'],extraSlot:p.extra_slot as string|null,choices:Object.fromEntries(choices.map(c=>[c.slot,{variantId:c.variant_id,setup:c.setup,supportCm:c.support_cm,coreLevel:c.core_level}]))}},
    active:null,
  };
  for(const s of sessions) {
    const specs=exercises.filter(e=>e.session_id===s.id);
    const logs:ExerciseLog[]=specs.map(e=>({id:String(e.exercise_id),name:String(e.name),mode:e.mode as ExerciseLog['mode'],note:String(e.note),sets:sets.filter(t=>t.session_id===s.id&&t.exercise_position===e.position).map(t=>({weight:t.weight_kg as number|null,reps:Number(t.reps),rir:t.rir as number|null,done:!!t.done}))}));
    const session:Session={id:String(s.id),workoutId:String(s.workout_id),programId:'programme-16',workout:{...parsed<Omit<Session['workout'],'exercises'>>(s.workout_snapshot),exercises:specs.map(e=>parsed(e.prescription))},date:String(s.date),startedAt:Number(s.started_at),phase:'full',week:Number(s.week),attemptId:String(s.attempt_id),note:String(s.note),exercises:logs};
    if(s.ended_at!==null)session.endedAt=Number(s.ended_at);
    for(const key of ['feedback','warmup','cooldown','resume'] as const)if(s[key]!==null)Object.assign(session,{[key]:parsed(s[key])});
    r[s.ended_at===null?'active':'session:'+s.id]=session;
  }
  for(const b of body)r['body:'+b.date]={id:String(b.id),date:String(b.date),kg:Number(b.kg)};
  for(const e of recovery)r['recovery:'+e.id]={id:String(e.id),date:String(e.date),activity:e.activity as 'walking'|'cycling',cardio:Number(e.cardio),mobility:Number(e.mobility),note:String(e.note),week:Number(e.week),attemptId:String(e.attempt_id)};
  return {datasetId,revision:Number(dataset[0].revision),versions:Object.fromEntries(versions.map(v=>[v.record_key,Number(v.revision)])),store:fromRecords(r)};
}
export async function snapshot(db: Database): Promise<Snapshot> {
  // Retry if an import switched datasets while the old dataset was being read.
  for(let i=0;i<3;i++) {
    const owner=await db.prepare("SELECT active_dataset_id FROM owner_profile WHERE id='owner'").first();
    if(!owner?.active_dataset_id)return {datasetId:null,revision:0,versions:{},store:null};
    const value=await readDataset(db,String(owner.active_dataset_id));
    const current=await db.prepare("SELECT active_dataset_id FROM owner_profile WHERE id='owner'").first();
    if(current?.active_dataset_id===value.datasetId)return value;
  }
  throw new Error('Dataset changed repeatedly. Please retry.');
}

export function writeRecords(dataset: string, changes: Change[], store: Store): Sql[] {
  const result:Sql[]=[];
  const append=(sql:string,...params:Sql['params'])=>result.push(q(sql,...params));
  // Programme first, active removal before saved insertion: finishing is one transaction.
  const order=(key:string)=>key==='programme'?0:key==='active'?1:2;
  for(const {key,value,position} of [...changes].sort((a,b)=>order(a.key)-order(b.key))) {
    if(key==='settings') {
      const s=store.settings;
      append('INSERT INTO settings VALUES(?,?,?,?) ON CONFLICT(dataset_id) DO UPDATE SET name=excluded.name,unit=excluded.unit,auto_rest=excluded.auto_rest',dataset,s.name,s.unit,+s.autoRest);
    } else if(key==='programme') {
      const p=store.programme,o=p.options;
      append('INSERT INTO programmes VALUES(?,?,?,?,?,?) ON CONFLICT(dataset_id) DO UPDATE SET week=excluded.week,status=excluded.status,saturday_two_sets=excluded.saturday_two_sets,saturday_core=excluded.saturday_core,extra_slot=excluded.extra_slot',dataset,p.week,p.status,+o.saturdayTwoSets,o.saturdayCore,o.extraSlot);
      p.attempts.forEach((a,i)=>append('INSERT INTO week_attempts VALUES(?,?,?,?,?,?,?) ON CONFLICT(dataset_id,id) DO UPDATE SET week=excluded.week,started=excluded.started,ended=excluded.ended,decision=excluded.decision',dataset,a.id,i,a.week,a.started,a.ended??null,a.decision??null));
      append('DELETE FROM exercise_choices WHERE dataset_id=?',dataset);
      for(const [slot,c] of Object.entries(o.choices))append('INSERT INTO exercise_choices VALUES(?,?,?,?,?,?)',dataset,slot,c.variantId,c.setup,c.supportCm,c.coreLevel);
    } else if(key==='active'||key.startsWith('session:')) {
      if(key==='active')append('DELETE FROM sessions WHERE dataset_id=? AND ended_at IS NULL',dataset);
      else append('DELETE FROM sessions WHERE dataset_id=? AND id=?',dataset,key.slice(8));
      if(value) {
        const s=value as Session, {exercises,...workout}=s.workout;
        append('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',dataset,s.id,key==='active'?-1:position??store.sessions.findIndex(x=>x.id===s.id),s.workoutId,s.programId,JSON.stringify(workout),s.date,s.startedAt,s.endedAt??null,s.phase,s.week!,s.attemptId!,s.note,json(s.feedback),json(s.warmup),json(s.cooldown),json(s.resume));
        s.exercises.forEach((e,i)=>{
          append('INSERT INTO session_exercises VALUES(?,?,?,?,?,?,?,?,?)',dataset,s.id,i,e.id,e.name,e.mode,e.note,exerciseKey(exercises[i],e.mode),JSON.stringify(exercises[i]));
          e.sets.forEach((t,j)=>append('INSERT INTO exercise_sets VALUES(?,?,?,?,?,?,?,?)',dataset,s.id,i,j,t.weight,t.reps,t.rir,+t.done));
        });
      }
    } else if(key.startsWith('body:')) {
      append('DELETE FROM body_entries WHERE dataset_id=? AND date=?',dataset,key.slice(5));
      const b=value as Store['body'][number]|undefined;
      if(b)append('INSERT INTO body_entries VALUES(?,?,?,?,?)',dataset,b.id,position??store.body.findIndex(x=>x.id===b.id),b.date,b.kg);
    } else if(key.startsWith('recovery:')) {
      append('DELETE FROM recovery_entries WHERE dataset_id=? AND id=?',dataset,key.slice(9));
      const r=value as Store['recovery'][number]|undefined;
      if(r)append('INSERT INTO recovery_entries VALUES(?,?,?,?,?,?,?,?,?,?)',dataset,r.id,position??store.recovery.findIndex(x=>x.id===r.id),r.date,r.activity,r.cardio,r.mobility,r.note,r.week,r.attemptId);
    }
    append('INSERT INTO record_versions VALUES(?,?,1,?) ON CONFLICT(dataset_id,record_key) DO UPDATE SET revision=revision+1,deleted=excluded.deleted',dataset,key,+(value===undefined));
  }
  return result;
}
export async function hash(value: unknown) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function mutate(db: Database, input: Mutation): Promise<Snapshot> {
  if(!input||typeof input.id!=='string'||input.id.length>100||typeof input.datasetId!=='string'||!Array.isArray(input.changes)||input.changes.length<1||input.changes.length>250||!Number.isInteger(input.programmeVersion)||new Set(input.changes.map(c=>c.key)).size!==input.changes.length||input.changes.some(c=>!validRecordKey(c.key)||!Number.isInteger(c.expected)||c.expected<0||(['programme','settings','active'].includes(c.key)&&c.value===undefined)))throw new Error('Invalid mutation.');
  const digest=await hash(input);
  const receipt=()=>db.prepare('SELECT payload_hash FROM mutation_receipts WHERE dataset_id=? AND mutation_id=?').bind(input.datasetId,input.id).first();
  const previous=await receipt();
  if(previous) {if(previous.payload_hash!==digest)throw new Error('Mutation ID was reused.');const current=await snapshot(db);if(current.datasetId!==input.datasetId)throw new Conflict(['dataset'],current);return current;}
  const before=await snapshot(db);
  const conflicts=input.changes.filter(c=>(before.versions[c.key]??0)!==c.expected).map(c=>c.key);
  if(before.datasetId!==input.datasetId||!before.store)throw new Conflict(['dataset'],before);
  if(input.changes.some(c=>c.key==='active'||c.key.startsWith('session:'))&&input.programmeVersion!==(before.versions.programme??0))conflicts.push('programme');
  if(conflicts.length)throw new Conflict([...new Set(conflicts)],before);
  const after=overlay(before.store,input.changes);
  // Keys must identify the same records as their values, and always validate the full result.
  const afterRecords=records(after);
  for(const c of input.changes)if(c.value!==undefined&&!equal(afterRecords[c.key],c.value))throw new Error('Record key does not match its value.');
  // Separate guards stay below D1's bound-parameter limit even for a large mutation.
  const guards=[q("INSERT INTO write_guards VALUES(?,CASE WHEN (SELECT active_dataset_id FROM owner_profile WHERE id='owner')=? AND (SELECT revision FROM datasets WHERE id=?)=? THEN 1 ELSE 0 END)",input.id,input.datasetId,input.datasetId,before.revision),...input.changes.map((c,i)=>q('INSERT INTO write_guards VALUES(?,CASE WHEN COALESCE((SELECT revision FROM record_versions WHERE dataset_id=? AND record_key=?),0)=? THEN 1 ELSE 0 END)',input.id+':'+i,input.datasetId,c.key,c.expected))];
  const cleanup=[input.id,...input.changes.map((_,i)=>input.id+':'+i)].map(id=>q('DELETE FROM write_guards WHERE id=?',id));
  const statements=[...guards,...writeRecords(input.datasetId,input.changes,after),q('UPDATE datasets SET revision=revision+1 WHERE id=?',input.datasetId),q('INSERT INTO mutation_receipts SELECT ?,?,?,revision FROM datasets WHERE id=?',input.datasetId,input.id,digest,input.datasetId),...cleanup];
  try {await runBatch(db,statements);}catch(error) {
    const duplicate=await receipt();
    if(duplicate?.payload_hash===digest){const current=await snapshot(db);if(current.datasetId!==input.datasetId)throw new Conflict(['dataset'],current);return current;}
    const current=await snapshot(db);
    if(current.revision!==before.revision||current.datasetId!==before.datasetId)throw new Conflict(input.changes.filter(c=>(current.versions[c.key]??0)!==c.expected).map(c=>c.key),current);
    throw error;
  }
  return snapshot(db);
}

export function initialRecords(store:Store):Change[] {return Object.entries(records(store)).map(([key,value])=>({key,value,expected:0}));}
export async function createStage(db:Database, expectedDatasetId:string|null, expectedRevision:number) {
  const id=crypto.randomUUID();
  await runBatch(db,[q("INSERT INTO datasets(id,state,created_at) VALUES(?,'staging',?)",id,Date.now()),q('INSERT INTO import_stages(id,expected_dataset_id,expected_revision,created_at) VALUES(?,?,?,?)',id,expectedDatasetId,expectedRevision,Date.now())]);
  return id;
}
export async function stageStore(db:Database,id:string,store:Store) {
  const s=validateStore(store);
  const stage=await db.prepare('SELECT activated FROM import_stages WHERE id=?').bind(id).first();
  if(!stage||stage.activated)throw new Error('Import stage is unavailable.');
  await runBatch(db,writeRecords(id,initialRecords(s),s));
}
export async function stageChunk(db:Database,id:string,header:Pick<Store,'settings'|'programme'>,changes:Change[]) {
  if(changes.some(c=>!c||!validRecordKey(c.key)||c.value===undefined||c.position!==undefined&&(!Number.isInteger(c.position)||c.position<0)))throw new Error('Invalid import chunk.');
  const partial=overlay({...freshStore(),...header},changes);
  const normalized=records(partial);
  if(changes.some(c=>!equal(normalized[c.key],c.value)))throw new Error('Invalid import chunk record key.');
  const guardId=crypto.randomUUID();
  await runBatch(db,[q('INSERT INTO write_guards VALUES(?,CASE WHEN (SELECT activated FROM import_stages WHERE id=?)=0 THEN 1 ELSE 0 END)',guardId,id),...writeRecords(id,[{key:'settings',value:partial.settings,expected:0},{key:'programme',value:partial.programme,expected:0},...changes.filter(c=>!['settings','programme'].includes(c.key))],partial),q('DELETE FROM write_guards WHERE id=?',guardId)]);
}
export async function activateStage(db:Database,id:string,email:string) {
  const stage=await db.prepare('SELECT * FROM import_stages WHERE id=?').bind(id).first();
  if(!stage)throw new Error('Import stage was not found.');
  if(stage.activated){const current=await snapshot(db);if(current.datasetId!==id)throw new Conflict(['dataset'],current);return current;}
  await readDataset(db,id); // Full domain validation before the pointer can switch.
  const statements=activationSql(id,stage.expected_dataset_id as string|null,Number(stage.expected_revision),email);
  try {await runBatch(db,statements);}catch {throw new Conflict(['dataset'],await snapshot(db));}
  return snapshot(db);
}
export function activationSql(id:string,expectedId:string|null,expectedRevision:number,email:string):Sql[] {
  return [q("INSERT INTO write_guards VALUES(?,CASE WHEN (SELECT active_dataset_id FROM owner_profile WHERE id='owner') IS ? AND COALESCE((SELECT revision FROM datasets WHERE id=?),0)=? AND (SELECT activated FROM import_stages WHERE id=?)=0 THEN 1 ELSE 0 END)",id,expectedId,expectedId,expectedRevision,id),q("UPDATE datasets SET state='archived' WHERE id=?",expectedId),q("UPDATE datasets SET state='active',revision=1 WHERE id=?",id),q("INSERT INTO owner_profile VALUES('owner',?,?) ON CONFLICT(id) DO UPDATE SET active_dataset_id=excluded.active_dataset_id,email=excluded.email",id,email),q('UPDATE import_stages SET activated=1 WHERE id=?',id),q('DELETE FROM write_guards WHERE id=?',id)];
}
