import { describe, it, expect, afterEach } from 'vitest';
import { TestDatabase } from './sqlite';
import { freshStore, newSession, selectedWorkout, addSessionSet, validateStore } from '../src/model';
import { createStage, stageStore, activateStage, mutate, snapshot, readDataset, stageChunk, initialRecords } from '../src/server/database';
import { changesBetween, type Snapshot, type Mutation } from '../src/persistence/records';

const databases:TestDatabase[]=[];
function database(){const db=new TestDatabase();databases.push(db);return db;}
afterEach(()=>databases.splice(0).forEach(db=>db.close()));
async function seed(db:TestDatabase,store=freshStore()) {const id=await createStage(db,null,0);await stageStore(db,id,store);return activateStage(db,id);}
function mutation(base: Snapshot, store: NonNullable<Snapshot['store']>, editedAt = base.revision + 1): Mutation {
  return {id:crypto.randomUUID(), datasetId:base.datasetId!, editedAt,
    activeId:store.active === null ? base.store?.active?.id : undefined,
    changes:changesBetween(base.store!,store,base.versions)};
}

describe('D1 relational persistence',()=>{
  it('round-trips setup snapshots, extras, incomplete sets, feedback and resume state',async()=>{
    const db=database(),store=freshStore();
    store.programme.options.choices['upper-a:press']={variantId:'p16-incline-db',setup:'Bench 2',supportCm:42,coreLevel:'Basic'};
    store.active=addSessionSet(newSession(selectedWorkout(store,1)!,store),0);
    store.active.exercises[0].sets[0]={weight:14.235,reps:10,rir:null,done:true};
    store.active.resume={exerciseIndex:2,restEnd:null,restPaused:87,origin:'programme'};
    store.body=[{id:'weight',date:'2026-11-01',kg:72.345}];
    expect((await seed(db,store)).store).toEqual(validateStore(store));
    const counts=db.raw.prepare('SELECT COUNT(*) AS count FROM exercise_sets').get();expect(counts!.count).toBe(store.active.exercises.reduce((n,e)=>n+e.sets.length,0));
  });
  it('finishes a workout atomically and replays a lost response only once',async()=>{
    const db=database(),store=freshStore();store.active=newSession(selectedWorkout(store,1)!,store);store.active.exercises[0].sets[0]={weight:10,reps:8,rir:3,done:true};
    const base=await seed(db,store),saved={...store.active,endedAt:Date.now()},next={...store,active:null,sessions:[saved]},input=mutation(base,next);
    const first=await mutate(db,input);expect(first.store).toEqual(next);expect((await mutate(db,input)).revision).toBe(first.revision);
    expect(db.raw.prepare('SELECT COUNT(*) AS count FROM sessions').get()!.count).toBe(1);
    await expect(mutate(db,{...input,changes:[{...input.changes[0],value:store.active}]})).rejects.toThrow('Mutation ID was reused');
  });
  it.each([true,false])('keeps the latest edit regardless of upload order (%s)',async newerFirst=>{
    const db=database(),base=await seed(db),older=structuredClone(base.store!),newer=structuredClone(base.store!);
    older.settings.name='Older';older.body=[{id:'b',date:'2026-11-01',kg:70}];newer.settings.name='Newer';
    const edits=[mutation(base,older,100),mutation(base,newer,200)];
    if(newerFirst)edits.reverse();
    await Promise.all(edits.map(edit=>mutate(db,edit)));
    const merged=await snapshot(db);
    expect(merged.store!.settings.name).toBe('Newer');expect(merged.store!.body).toEqual(older.body);
  });
  it('breaks timestamp ties consistently and retains deletion clocks',async()=>{
    const db=database(),store=freshStore();store.body=[{id:'b',date:'2026-11-01',kg:70}];const base=await seed(db,store);
    const deleted=await mutate(db,{...mutation(base,{...store,body:[]},100),id:'z'});
    expect(deleted.clocks!['body:2026-11-01']).toEqual({editedAt:100,id:'z'});
    const stale=structuredClone(store);stale.body[0].kg=71;
    expect((await mutate(db,{...mutation(base,stale,100),id:'a'})).store!.body).toEqual([]);
    expect((await mutate(db,mutation(base,stale,101))).store!.body).toEqual(stale.body);
  });
  it.each([true,false])('finishes a workout without clearing an unrelated draft (%s)',async newerFirst=>{
    const db=database(),store=freshStore();store.active=newSession(selectedWorkout(store,1)!,store);
    store.active.exercises[0].sets[0]={weight:10,reps:8,rir:3,done:true};
    const base=await seed(db,store),saved={...store.active,endedAt:Date.now()},other=newSession(selectedWorkout(store,2)!,store);
    const edits=[mutation(base,{...store,active:null,sessions:[saved]},100),mutation(base,{...store,active:other},200)];
    if(newerFirst)edits.reverse();
    for(const edit of edits)await mutate(db,edit);
    const replay={...store.active,note:'Delayed draft'};
    const final=await mutate(db,mutation(base,{...store,active:replay},300));
    expect(final.store!.active?.id).toBe(other.id);expect(final.store!.sessions).toEqual([saved]);
  });
  it('keeps interrupted stages invisible and refuses an import over intervening edits',async()=>{
    const db=database(),base=await seed(db),replacement=freshStore();replacement.settings.name='Restored';
    const id=await createStage(db,base.datasetId,base.revision);await stageStore(db,id,replacement);
    expect((await snapshot(db)).store!.settings.name).toBe('');
    const edit=structuredClone(base.store!);edit.settings.name='Newer';await mutate(db,mutation(base,edit));
    await expect(activateStage(db,id)).rejects.toMatchObject({keys:['dataset']});
    expect((await snapshot(db)).store!.settings.name).toBe('Newer');expect((await readDataset(db,id)).store!.settings.name).toBe('Restored');
  });
  it('validates staged chunks and activates a complete dataset only once',async()=>{
    const db=database(),store=freshStore(),id=await createStage(db,null,0);
    store.body=[{id:'a',date:'2026-11-01',kg:72},{id:'b',date:'2026-11-02',kg:73}];
    await stageChunk(db,id,store,initialRecords(store).map((c,i)=>({...c,position:i})));
    expect((await activateStage(db,id)).store).toEqual(store);expect((await activateStage(db,id)).store).toEqual(store);
    await expect(stageChunk(db,id,store,initialRecords(store))).rejects.toThrow();
  });
  it('uses database constraints to reject multiple active sessions and rolls batches back',async()=>{
    const db=database(),store=freshStore();store.active=newSession(selectedWorkout(store,1)!,store);const base=await seed(db,store);
    const before=await snapshot(db);
    await expect(db.batch([db.prepare('UPDATE settings SET name=? WHERE dataset_id=?').bind('wrong',base.datasetId),db.prepare('INSERT INTO sessions SELECT dataset_id,?,position,workout_id,program_id,workout_snapshot,date,started_at,ended_at,phase,week,attempt_id,note,feedback,warmup,cooldown,resume FROM sessions WHERE dataset_id=?').bind('another',base.datasetId)])).rejects.toThrow();
    expect(await snapshot(db)).toEqual(before);
  });
  it('does not acknowledge an old mutation or activation over a newer restore',async()=>{
    const db=database(),base=await seed(db),next=structuredClone(base.store!);next.settings.name='Before restore';
    const input=mutation(base,next);const saved=await mutate(db,input);
    db.raw.prepare("UPDATE owner_profile SET email='legacy@example.invalid' WHERE id='owner'").run();
    const id=await createStage(db,saved.datasetId,saved.revision);await stageStore(db,id,freshStore());await activateStage(db,id);
    expect(db.raw.prepare("SELECT email FROM owner_profile WHERE id='owner'").get()?.email).toBe('legacy@example.invalid');
    await expect(mutate(db,input)).rejects.toMatchObject({keys:['dataset']});
    await expect(activateStage(db,base.datasetId!)).rejects.toMatchObject({keys:['dataset']});
  });
});
