import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { LocalDatabase } from '../src/persistence/local';
import { SyncEngine, RequestError, type Transport } from '../src/persistence/sync';
import { TestDatabase } from './sqlite';
import { freshStore, type Store, newSession, selectedWorkout } from '../src/model';
import { activateStage, createStage, stageChunk, stageStore, mutate, snapshot, Conflict } from '../src/server/database';
import { changesBetween, type Mutation, type Change, type Snapshot } from '../src/persistence/records';

let db:TestDatabase;const engines:SyncEngine[]=[];
beforeEach(()=>{vi.useFakeTimers({toFake:['setTimeout','clearTimeout','Date']});vi.stubGlobal('indexedDB',new IDBFactory());vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));db=new TestDatabase();});
afterEach(()=>{engines.splice(0).forEach(e=>e.close());db.close();vi.useRealTimers();vi.unstubAllGlobals();});
const transport:Transport=async(path,body)=>{
  try {
    if(path==='bootstrap')return snapshot(db);
    if(path==='mutations')return await mutate(db,body as Mutation);
    const input=body as {action:string;id:string;expectedDatasetId:string|null;expectedRevision:number;header:Store;changes:Change[]};
    if(input.action==='create')return {id:await createStage(db,input.expectedDatasetId,input.expectedRevision)};
    if(input.action==='chunk'){await stageChunk(db,input.id,input.header,input.changes);return {saved:true};}
    return await activateStage(db,input.id);
  }catch(error){if(error instanceof Conflict)throw new RequestError(409,{conflicts:error.keys,snapshot:error.snapshot});throw error;}
};
async function device(store=freshStore(),send=transport){const e=new SyncEngine(new LocalDatabase(crypto.randomUUID()),send);engines.push(e);await e.open(store);return e;}
async function seed(store=freshStore()){const id=await createStage(db,null,0);await stageStore(db,id,store);await activateStage(db,id);}
async function edit(engine:SyncEngine,fn:(s:Store)=>void){vi.setSystemTime(Date.now()+10);const before=engine.current!.store,after=structuredClone(before);fn(after);await engine.edit(before,after);}

it('persists offline changes through reload and syncs them on reconnection',async()=>{
  await seed();let online=false;
  const sender:Transport=(p,b)=>online?transport(p,b):Promise.reject(new Error('Offline'));
  const e=await device(freshStore(),sender);online=true;await e.sync();online=false;
  await edit(e,s=>{s.body=[{id:'b',date:'2026-11-01',kg:75}];});await e.sync();
  const saved=await e.local.read();expect(saved!.store.body).toHaveLength(1);e.close();
  const reopened=new SyncEngine(e.local,sender);engines.push(reopened);await reopened.open(freshStore());
  online=true;await reopened.sync();expect((await snapshot(db)).store!.body).toEqual(saved!.store.body);expect(reopened.status).toBe('synced');
});
it('keeps a later offline edit even after an earlier edit has synced',async()=>{
  await seed();const a=await device(),b=await device();await a.sync();await b.sync();
  await edit(a,s=>{s.settings.name='Earlier';s.body=[{id:'b',date:'2026-11-01',kg:75}];});
  await edit(b,s=>{s.settings.name='Later offline';});await a.sync();await b.sync();await a.sync();
  expect(a.current!.store.settings.name).toBe('Later offline');
  expect(a.current!.store.body).toHaveLength(1);expect(b.status).toBe('synced');
});
it('replays an acknowledged write after a lost response without duplicating sets or revisions',async()=>{
  await seed();let lose=true;
  const sender:Transport=async(path,body)=>{const response=await transport(path,body);if(path==='mutations'&&lose){lose=false;throw new Error('Lost response');}return response;};
  const e=await device(freshStore(),sender);await e.sync();await edit(e,s=>{s.settings.name='Once';});await e.sync();expect(e.current!.queue).toHaveLength(1);
  const revision=(await snapshot(db)).revision;await e.sync();expect((await snapshot(db)).revision).toBe(revision);expect(e.current!.queue).toHaveLength(0);
});
it('resolves competing active workouts by edit time',async()=>{
  await seed();const a=await device(),b=await device();await a.sync();await b.sync();
  await edit(a,s=>{s.active=newSession(selectedWorkout(s,1)!,s);});
  await edit(b,s=>{s.active=newSession(selectedWorkout(s,2)!,s);});
  const latest=b.current!.store.active!.id;
  await b.sync();await a.sync();expect(a.current!.store.active!.id).toBe(latest);
});
it('retains edits when sign-in expires and resumes after authentication',async()=>{
  await seed();let signedIn=true;const sender:Transport=(p,b)=>signedIn?transport(p,b):Promise.reject(new RequestError(401,{error:'Sign in'}));
  const e=await device(freshStore(),sender);await e.sync();signedIn=false;await edit(e,s=>{s.settings.unit='lb';});await e.sync();expect(e.status).toBe('signin');expect(e.current!.store.settings.unit).toBe('lb');
  signedIn=true;await e.sync();expect((await snapshot(db)).store!.settings.unit).toBe('lb');
});
it('adopts the restored dataset and keeps old offline edits in a local backup',async()=>{
  await seed();const a=await device(),b=await device();await a.sync();await b.sync();
  const replacement=freshStore();replacement.settings.name='Restored';await a.restore(replacement);await a.sync();
  await edit(b,s=>{s.body=[{id:'b',date:'2026-11-01',kg:75}];});await b.sync();
  expect(b.current!.recovered?.[0].body).toHaveLength(1);expect(b.current!.store.settings.name).toBe('Restored');
  expect((await snapshot(db)).store!.body).toHaveLength(0);
});
it('detects a remote edit after an acknowledged write whose response was lost',async()=>{
  await seed();let lose=true;
  const sender:Transport=async(path,body)=>{
    const response=await transport(path,body);
    if(path==='mutations'&&lose){
      lose=false;const base=response as Snapshot,next=structuredClone(base.store!);next.settings.name='Another device';
      await mutate(db,{id:crypto.randomUUID(),datasetId:base.datasetId!,editedAt:Date.now()+1,changes:changesBetween(base.store!,next,base.versions)});
      throw new Error('Lost response');
    }
    return response;
  };
  const e=await device(freshStore(),sender);await e.sync();await edit(e,s=>{s.settings.name='First edit';});await e.sync();
  await edit(e,s=>{s.settings.name='Later local edit';});await e.sync();
  expect(e.status).toBe('synced');expect(e.current!.store.settings.name).toBe('Later local edit');expect((await snapshot(db)).store!.settings.name).toBe('Later local edit');
});

it('cleans an offline edit and recovery copy before syncing a legacy setup record', async () => {
  await seed();
  const base = await snapshot(db);
  const store = structuredClone(base.store!);
  const choice = { variantId: 'p16-leg-press', setup: 'Old machine', supportCm: null, coreLevel: 'Basic' };
  store.programme.options.choices['lower-a:squat'] = choice;
  const local = new LocalDatabase(crypto.randomUUID());
  await local.update(() => ({
    store, base, blocked: false, recovered: [store],
    queue: [{ id: 'offline-setup', editedAt: Date.now(), changes: changesBetween(base.store!, store) }],
  }));
  const engine = new SyncEngine(local, transport);
  engines.push(engine);
  await engine.open(freshStore());
  expect(engine.current?.queue?.[0]).toMatchObject({ id: 'offline-setup', removedSetup: true });
  await engine.sync();
  const current = await snapshot(db);
  expect(current.store?.programme.options.choices['lower-a:squat']).toEqual({
    variantId: choice.variantId, supportCm: null, coreLevel: 'Basic',
  });
  expect(JSON.stringify(engine.current)).not.toContain('Old machine');
  expect(engine.current?.queue).toEqual([]);
});
