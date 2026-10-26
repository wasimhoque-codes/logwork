import { describe, expect, it, vi, afterEach } from 'vitest';
import { WORKOUTS, plannedSets, configuredWorkout, DEFAULT_ROUTINE_OPTIONS, prescription } from '../src/back-support-data';
import { freshStore, newSession, toKg, fromKg, volume, progression, validateStore, weekSessions, readStore, STORAGE_KEY, LEGACY_STORAGE_KEY, coreWorkoutCount } from '../src/v2-model';
import { legacyStore } from './fixtures';
const workout = (id: string) => WORKOUTS.find(w=>w.id===id)!;
afterEach(()=>vi.unstubAllGlobals());

describe('revised routine', () => {
  it('matches every full-volume prescription, including core and hip work', () => {
    expect(WORKOUTS.map(w=>[w.id,w.exercises.reduce((n,e)=>n+e.sets,0)])).toEqual([['upper-a',33],['lower-a',23],['recovery',12],['upper-b',32],['lower-b',22],['optional',17]]);
    expect(workout('upper-a').exercises.map(e=>[e.id,e.sets,e.min,e.max])).toEqual([
      ['db-bench',4,6,10],['chest-row',4,8,12],['incline-press',3,8,12],['pulldown',3,8,12],['lateral',3,12,20],['face-pull',3,12,15],['rope-triceps',2,10,15],['db-curl',2,10,15],['bird-dog',3,6,8],['side-plank',3,20,40],['pallof',3,10,12],
    ]);
    expect(workout('lower-a').exercises.map(e=>[e.id,e.sets,e.min,e.max])).toEqual([
      ['goblet-squat',4,8,12],['hip-thrust',4,8,12],['split-squat',3,8,10],['seated-curl',3,10,15],['extension',3,10,15],['standing-calf',3,10,15],['hip-abduction',3,12,15],
    ]);
    expect(workout('upper-b').exercises.map(e=>[e.id,e.sets,e.min,e.max])).toEqual([
      ['seated-db-press',3,6,10],['pullups',3,6,10],['machine-press',3,8,12],['cable-row',3,8,12],['pec-deck',2,10,15],['reverse-pec',3,12,20],['lateral',3,12,20],['ez-curl',3,8,12],['overhead-cable',3,10,15],['dead-bug',3,6,10],['suitcase-carry',3,30,45],
    ]);
    expect(workout('lower-b').exercises.map(e=>[e.id,e.sets,e.min,e.max])).toEqual([
      ['hack',3,8,12],['step-up',3,8,12],['hinge-curl',3,10,15],['hip-thrust',3,10,15],['lying-curl',3,10,15],['seated-calf',3,12,15],['hip-abduction',2,15,15],['hip-extension',2,12,12],
    ]);
    expect(workout('recovery').exercises.map(e=>[e.id,e.min,e.max])).toEqual([['modified-curl-up',6,8],['bird-dog',6,6],['side-plank',20,30],['glute-bridge',12,15],['bw-split-squat',8,8],['pallof',10,10]]);
    expect(workout('optional').exercises.map(e=>[e.id,e.sets,e.min,e.max])).toEqual([['lateral',4,12,20],['reverse-fly',3,15,20],['preacher',3,10,15],['hammer',2,10,15],['cable-triceps',3,10,15],['overhead-triceps',2,10,15]]);
  });
  it('caps ramp-up sets but leaves recovery rounds independent', () => {
    const store=freshStore();store.settings.phase='ramp';
    const session=newSession(workout('upper-a'),store);
    expect(session.exercises.every(e=>e.sets.length===2)).toBe(true);
    expect(session.exercises[0].sets.every(s=>s.rir===3&&!s.done)).toBe(true);
    expect(session.exercises.find(e=>e.id==='bird-dog')!.sets.every(s=>s.rir===null&&s.weight===0)).toBe(true);
    store.settings.routine.recoveryRounds=3;
    const recovery=newSession(workout('recovery'),store);
    expect(recovery.phase).toBe('full');expect(recovery.exercises.every(e=>e.sets.length===3)).toBe(true);
    expect(plannedSets(workout('upper-a').exercises[0],'full')).toBe(4);
  });
  it('uses separate curl and RDL identities without altering the later curl', () => {
    const store=freshStore();
    const curl=newSession(workout('lower-b'),store);
    expect(curl.exercises.map(e=>e.id)).toContain('hinge-curl');
    store.settings.routine.fridayHinge='rdl';
    const rdl=newSession(workout('lower-b'),store);
    expect(rdl.exercises[2].id).toBe('db-rdl');expect(rdl.exercises[4].id).toBe('lying-curl');
    expect(rdl.workout.exercises[2].max).toBe(10);
    expect(validateStore({...store,active:rdl}).active).toEqual(rdl);
    expect(configuredWorkout(workout('lower-b'),DEFAULT_ROUTINE_OPTIONS).exercises[2].id).toBe('hinge-curl');
  });
  it('stores independent session snapshots including day-specific targets', () => {
    const store=freshStore(), a=newSession(workout('lower-a'),store), b=newSession(workout('lower-b'),store);
    expect(a.workout.exercises.find(e=>e.id==='hip-thrust')!.sets).toBe(4);
    expect(a.workout.exercises.find(e=>e.id==='hip-thrust')!.max).toBe(12);
    expect(b.workout.exercises.find(e=>e.id==='hip-thrust')!.sets).toBe(3);
    expect(b.workout.exercises.find(e=>e.id==='hip-thrust')!.max).toBe(15);
    a.workout.exercises[0].sets=1;expect(workout('lower-a').exercises[0].sets).toBe(4);
  });
  it('represents duration and per-side amounts without doubling volume', () => {
    const session=newSession(workout('upper-b'),freshStore());
    const carry=session.exercises.at(-1)!;carry.sets.forEach(s=>Object.assign(s,{weight:20,reps:45,done:true}));
    expect(prescription(session.workout.exercises.at(-1)!)).toBe('30–45 sec / side');expect(volume(session)).toBe(0);
    const lower=newSession(workout('lower-a'),freshStore());
    lower.exercises[2].sets[0]={weight:10,reps:8,done:true,rir:2};expect(volume(lower)).toBe(80);
    lower.exercises[2].mode='assistance';expect(volume(lower)).toBe(0);
  });
  it('keeps recovery and Saturday outside the four-workout target', () => {
    const store=freshStore();expect(coreWorkoutCount(WORKOUTS.map(w=>newSession(w,store)))).toBe(4);
    expect(coreWorkoutCount([newSession(workout('recovery'),store),newSession(workout('optional'),store)])).toBe(0);
  });
});

describe('workout model and migration', () => {
  it('converts units without mutating canonical loads', () => {
    expect(toKg(fromKg(62.5,'lb'),'lb')).toBeCloseTo(62.5,10);expect(toKg(100,'lb')).toBeCloseTo(45.359237,6);
  });
  it('copies completed loads for unchanged movements but not changed variants', () => {
    const store=validateStore(legacyStore());
    const next=newSession(workout('upper-a'),store);
    expect(next.exercises[0].sets[0].weight).toBeNull(); // barbell bench never becomes dumbbell load
    store.sessions[0].exercises[1].sets.forEach(s=>Object.assign(s,{weight:40,reps:10,done:true}));
    expect(newSession(workout('upper-a'),store).exercises[1].sets[0]).toMatchObject({weight:40,reps:10,done:false});
    const lower=newSession(workout('lower-a'),store);expect(lower.exercises[0].sets[0].weight).toBeNull();
  });
  it('earns a conditional milestone only on full prescribed sets', () => {
    const s=newSession(workout('upper-a'),freshStore()),e=s.workout.exercises[0],log=s.exercises[0];
    log.sets.forEach(s=>Object.assign(s,{weight:20,reps:10,done:true}));expect(progression(e,log,'full')).toEqual({kg:20,increment:1.25});
    expect(progression(e,log,'ramp')).toBeNull();log.sets[3].reps=9;expect(progression(e,log,'full')).toBeNull();
    log.sets[3].reps=10;log.sets[3].weight=22;expect(progression(e,log,'full')).toBeNull();log.sets[3].weight=20;log.sets[3].done=false;expect(progression(e,log,'full')).toBeNull();
  });
  it('evaluates Friday hip thrust against its own prescription', () => {
    const s=newSession(workout('lower-b'),freshStore()),i=s.exercises.findIndex(e=>e.id==='hip-thrust'),log=s.exercises[i];
    log.sets.forEach(set=>Object.assign(set,{weight:40,reps:12,done:true}));expect(progression(s.workout.exercises[i],log,s.phase)).toBeNull();
    log.sets.forEach(set=>set.reps=15);expect(progression(s.workout.exercises[i],log,s.phase)).not.toBeNull();
  });
  it('never suggests load progression for recovery, core or timed work', () => {
    for(const id of ['recovery','upper-a','upper-b']){
      const s=newSession(workout(id),freshStore());
      s.workout.exercises.forEach((e,i)=>{if(e.recovery||e.kind==='core'||e.timed){const log=s.exercises[i];log.mode='external';log.sets.forEach(set=>Object.assign(set,{weight:20,reps:e.max,done:true}));expect(progression(e,log,'full')).toBeNull();}});
    }
  });
  it('migrates completed and unfinished original sessions without mutating input', () => {
    for(const active of [false,true]){
      const old=legacyStore(active),raw=JSON.stringify(old),store=validateStore(old),s=active?store.active!:store.sessions[0];
      expect(store.version).toBe(2);expect(s.programId).toBe('original');expect(s.exercises).toEqual(active?old.active!.exercises:old.sessions[0].exercises);
      expect(s.workout.exercises[0]).toMatchObject({id:'bench',sets:4,min:5,max:8});expect(JSON.stringify(old)).toBe(raw);
      expect(validateStore(JSON.parse(JSON.stringify(store)))).toEqual(store);
    }
  });
  it('reads old storage and preserves the original record', () => {
    const raw=JSON.stringify(legacyStore(true)),records=new Map([[LEGACY_STORAGE_KEY,raw]]),setItem=vi.fn();
    vi.stubGlobal('localStorage',{getItem:(key:string)=>records.get(key)??null,setItem});
    expect(readStore().store.active?.programId).toBe('original');expect(setItem).not.toHaveBeenCalled();expect(records.get(LEGACY_STORAGE_KEY)).toBe(raw);
    records.set(STORAGE_KEY,JSON.stringify(freshStore()));expect(readStore().store.active).toBeNull();
  });
  it('blocks corrupt data rather than silently falling back over it', () => {
    vi.stubGlobal('localStorage',{getItem:(key:string)=>key===STORAGE_KEY?'{}':JSON.stringify(legacyStore())});
    expect(readStore().corrupt).toBe(true);
  });
  it('excludes the original timed farmer carry from historical volume', () => {
    const old=legacyStore(),w=workout('optional');expect(w.exercises.some(e=>e.id==='carry')).toBe(false);
    // Construct an original optional session with the legacy catalog.
    return import('../src/legacy-data').then(({LEGACY_WORKOUTS})=>{
      const legacy=LEGACY_WORKOUTS.find(w=>w.id==='optional')!;
      const session={...old.sessions[0],workoutId:'optional',exercises:legacy.exercises.map(e=>({id:e.id,name:e.name,mode:'external',note:'',sets:Array.from({length:e.sets},()=>({weight:10,reps:20,rir:2,done:true}))}))};
      expect(volume(validateStore({...old,sessions:[session]}).sessions[0])).toBe(17*10*20);
    });
  });
  it('validates unfinished fields, snapshots, dates, duplicates and unknown IDs', () => {
    const store=freshStore();store.active=newSession(workout('upper-a'),store);store.active.exercises[0].sets[0].reps=0;expect(validateStore(structuredClone(store))).toEqual(store);
    expect(()=>validateStore({...store,version:3})).toThrow();expect(()=>validateStore({...store,body:[{id:'b',date:'2026-02-31',kg:70}]})).toThrow();
    store.active.exercises[0].sets[0].done=true;expect(()=>validateStore(store)).toThrow();store.active.exercises[0].sets[0].done=false;
    store.active.workout.exercises[0].id='bad';expect(()=>validateStore(store)).toThrow();
    const original=legacyStore();original.sessions[0].exercises[0].id='bad';expect(()=>validateStore(original)).toThrow();
    store.active=null;store.body=[{id:'1',date:'2026-10-01',kg:70},{id:'2',date:'2026-10-01',kg:71}];expect(()=>validateStore(store)).toThrow();
  });
  it('counts only the selected local calendar week', () => {
    const store=freshStore(),sessions=['2026-10-04','2026-10-05','2026-10-11','2026-10-12'].map(date=>({...newSession(workout('upper-a'),store),date}));
    expect(weekSessions(sessions,new Date('2026-10-05T00:00:00')).map(s=>s.date)).toEqual(['2026-10-05','2026-10-11']);
  });
});
