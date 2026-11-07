import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { LocalDatabase } from '../src/persistence/local';
import { SyncEngine, RequestError, type Transport } from '../src/persistence/sync';
import { TestDatabase } from './sqlite';
import { freshStore, type Store, newSession, selectedWorkout } from '../src/model';
import { activateStage, createStage, stageChunk, stageStore, mutate, snapshot, Conflict } from '../src/server/database';
import { changesBetween, type Mutation, type Change, type Snapshot } from '../src/persistence/records';

let db:TestDatabase;const engines:SyncEngine[]=[];
beforeEach(()=>{vi.useFakeTimers({toFake:['setTimeout','clearTimeout','Date']});vi.stubGlobal('indexedDB',new IDBFactory());db=new TestDatabase();});
afterEach(()=>{engines.splice(0).forEach(e=>e.close());db.close();vi.useRealTimers();vi.unstubAllGlobals();});
const transport:Transport=async(path,body)=>{
  try {
    if(path==='bootstrap')return snapshot(db);
    if(path==='mutations')return await mutate(db,body as Mutation);
    const input=body as {action:string;id:string;expectedDatasetId:string|null;expectedRevision:number;header:Store;changes:Change[]};
    if(input.action==='create')return {id:await createStage(db,input.expectedDatasetId,input.expectedRevision)};
    if(input.action==='chunk'){await stageChunk(db,input.id,input.header,input.changes);return {saved:true};}
    return await activateStage(db,input.id,'owner');
  }catch(error){if(error instanceof Conflict)throw new RequestError(409,{conflicts:error.keys,snapshot:error.snapshot});throw error;}
};
async function device(store=freshStore(),send=transport){const e=new SyncEngine(new LocalDatabase(crypto.randomUUID()),send);engines.push(e);await e.open(store);return e;}
async function seed(store=freshStore()){const id=await createStage(db,null,0);await stageStore(db,id,store);await activateStage(db,id,'owner');}
async function edit(engine:SyncEngine,fn:(s:Store)=>void){const before=engine.current!.store,after=structuredClone(before);fn(after);await engine.edit(before,after);}

it('persists offline changes through reload and syncs them on reconnection',async()=>{
  await seed();let online=false;
  const sender:Transport=(p,b)=>online?transport(p,b):Promise.reject(new Error('Offline'));
  const e=await device(freshStore(),sender);online=true;await e.sync();online=false;
  await edit(e,s=>{s.body=[{id:'b',date:'2026-11-01',kg:75}];});await e.sync();
  const saved=await e.local.read();expect(saved!.store.body).toHaveLength(1);online=true;await e.sync();
  expect((await snapshot(db)).store!.body).toEqual(saved!.store.body);expect(e.status).toBe('synced');
});
it('automatically merges different records but retains both versions of the same record',async()=>{
  await seed();const a=await device(),b=await device();await a.sync();await b.sync();
  await edit(a,s=>{s.settings.name='A';});await edit(b,s=>{s.body=[{id:'b',date:'2026-11-01',kg:75}];});await a.sync();await b.sync();
  expect(b.current!.store.settings.name).toBe('A');expect(b.current!.conflicts).toEqual([]);
  await a.sync();await edit(a,s=>{s.settings.name='A2';});await edit(b,s=>{s.settings.name='B';});await a.sync();await b.sync();
  expect(b.current!.conflicts).toContain('settings');expect(b.current!.store.settings.name).toBe('B');expect(b.current!.base!.store!.settings.name).toBe('A2');
  await b.resolve('settings','local');await b.sync();expect((await snapshot(db)).store!.settings.name).toBe('B');
});
it('allows choosing the cloud version without deleting unrelated local work',async()=>{
  await seed();const a=await device(),b=await device();await a.sync();await b.sync();
  await edit(a,s=>{s.settings.name='Cloud';});await a.sync();await edit(b,s=>{s.settings.name='Local';s.body=[{id:'b',date:'2026-11-01',kg:75}];});await b.sync();
  await b.resolve('settings','server');await b.sync();const saved=(await snapshot(db)).store!;expect(saved.settings.name).toBe('Cloud');expect(saved.body).toHaveLength(1);
});
it('replays an acknowledged write after a lost response without duplicating sets or revisions',async()=>{
  await seed();let lose=true;
  const sender:Transport=async(path,body)=>{const response=await transport(path,body);if(path==='mutations'&&lose){lose=false;throw new Error('Lost response');}return response;};
  const e=await device(freshStore(),sender);await e.sync();await edit(e,s=>{s.settings.name='Once';});await e.sync();expect(e.current!.flight).toBeDefined();
  const revision=(await snapshot(db)).revision;await e.sync();expect((await snapshot(db)).revision).toBe(revision);expect(e.current!.flight).toBeUndefined();
});
it('keeps unsent conflicting records when a different record is acknowledged',async()=>{
  await seed();const a=await device(),b=await device();await a.sync();await b.sync();await edit(a,s=>{s.settings.name='Cloud';});await a.sync();
  await edit(b,s=>{s.settings.name='Local';s.body=[{id:'b',date:'2026-11-01',kg:75}];});await b.sync();
  expect(b.current!.store.settings.name).toBe('Local');expect(b.current!.conflicts).toEqual(['settings']);expect((await snapshot(db)).store!.body).toHaveLength(1);
});
it('handles competing active workouts as a conflict',async()=>{
  await seed();const a=await device(),b=await device();await a.sync();await b.sync();
  await edit(a,s=>{s.active=newSession(selectedWorkout(s,1)!,s);});await edit(b,s=>{s.active=newSession(selectedWorkout(s,2)!,s);});await a.sync();await b.sync();
  expect(b.current!.conflicts).toContain('active');await b.resolve('active','server');expect(b.current!.store.active!.id).toBe(a.current!.store.active!.id);
});
it('retains edits when sign-in expires and resumes after authentication',async()=>{
  await seed();let signedIn=true;const sender:Transport=(p,b)=>signedIn?transport(p,b):Promise.reject(new RequestError(401,{error:'Sign in'}));
  const e=await device(freshStore(),sender);await e.sync();signedIn=false;await edit(e,s=>{s.settings.unit='lb';});await e.sync();expect(e.status).toBe('signin');expect(e.current!.store.settings.unit).toBe('lb');
  signedIn=true;await e.sync();expect((await snapshot(db)).store!.settings.unit).toBe('lb');
});
it('keeps restored datasets and stale device edits for explicit review',async()=>{
  await seed();const a=await device(),b=await device();await a.sync();await b.sync();
  const replacement=freshStore();replacement.settings.name='Restored';await a.restore(replacement);await a.sync();
  await edit(b,s=>{s.body=[{id:'b',date:'2026-11-01',kg:75}];});await b.sync();expect(b.current!.conflicts).toEqual(['dataset']);
  expect(b.current!.store.body).toHaveLength(1);expect(b.current!.remote!.store!.settings.name).toBe('Restored');
});
it('detects a remote edit after an acknowledged write whose response was lost',async()=>{
  await seed();let lose=true;
  const sender:Transport=async(path,body)=>{
    const response=await transport(path,body);
    if(path==='mutations'&&lose){
      lose=false;const base=response as Snapshot,next=structuredClone(base.store!);next.settings.name='Another device';
      await mutate(db,{id:crypto.randomUUID(),datasetId:base.datasetId!,programmeVersion:base.versions.programme,changes:changesBetween(base.store!,next,base.versions)});
      throw new Error('Lost response');
    }
    return response;
  };
  const e=await device(freshStore(),sender);await e.sync();await edit(e,s=>{s.settings.name='First edit';});await e.sync();
  await edit(e,s=>{s.settings.name='Later local edit';});await e.sync();
  expect(e.current!.conflicts).toContain('settings');expect(e.current!.store.settings.name).toBe('Later local edit');expect((await snapshot(db)).store!.settings.name).toBe('Another device');
});
