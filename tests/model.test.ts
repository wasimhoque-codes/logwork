import { describe, expect, it, vi, afterEach } from 'vitest';
import { WORKOUTS, VARIANTS, resolveWorkout, DEFAULT_OPTIONS, SATURDAY_CORE } from '../src/data';
import { freshStore, selectedWorkout, newSession, reviewWeek, currentAttempt, attemptSessions, coreWorkoutCount, completeSession, validateStore, readStore, STORAGE_KEY, RETIRED_STORAGE_KEYS, saveStore, previousExercise, progression, volume, toKg, fromKg, bodyGuidance, localDate, pendingFollowups, emptyFeedback, type Session } from '../src/model';
const workout=(id:string)=>WORKOUTS.find(w=>w.id===id)!;
const options=()=>structuredClone(DEFAULT_OPTIONS);
function atWeek(week:number){const s=freshStore();s.programme.week=week;s.programme.attempts[0].week=week;return s;}
function completed(week=5,id='upper-a'):Session {const s=atWeek(week),w=selectedWorkout(s,workout(id).days[0])!,log=newSession(w,s);log.date='2026-01-01';log.endedAt=log.startedAt+60000;log.feedback={before:null,after:'none',nextDay:'none',nextDayDate:'2026-01-02',technique:true};log.exercises.forEach((e,i)=>e.sets.forEach(set=>Object.assign(set,{weight:e.mode==='bodyweight'?0:20,reps:w.exercises[i].max,done:true,rir:3})));return log;}
afterEach(()=>vi.unstubAllGlobals());
describe('source programme',()=>{
  it('starts with the source equipment defaults and selectable floor-bridge alternative',()=>{
    const s=freshStore();expect(selectedWorkout(s,2)!.exercises.map(e=>e.id)).toContain('p16-leg-press');expect(selectedWorkout(s,2)!.exercises[3].id).toBe('p16-machine-thrust');expect(VARIANTS['lower-a:thrust'].map(e=>e.id)).toContain('p16-bridge-12');expect(selectedWorkout(s,4)!.exercises[3].id).toBe('p16-assisted-dip');expect(selectedWorkout(s,5)!.exercises[2].id).toBe('p16-seated-curl');expect(selectedWorkout(s,5)!.exercises[3].id).toBe('p16-floor-bridge');
  });
  it('preserves all full-volume prescriptions, rest, tempo and per-side/timed fields',()=>{
    const shape=(id:string)=>workout(id).exercises.map(e=>[e.sets,e.min,e.max,e.rest,e.tempo,!!e.perSide,!!e.timed]);
    expect(shape('upper-a')).toEqual([[3,8,12,120,'3-0-1',false,false],[3,8,12,120,'2-1-1',false,false],[2,8,12,90,'2-1-1',false,false],[2,8,15,75,'2-0-1',false,false],[2,12,20,60,'2-1-1',false,false],[2,10,15,60,'2-0-1',false,false],[2,10,10,45,'2s hold',true,false]]);
    expect(shape('lower-a')).toEqual([[3,8,12,120,'3-0-1',false,false],[2,8,10,90,'2-0-1',true,false],[3,10,15,90,'2-1-1',false,false],[3,8,12,90,'2-1-1',false,false],[3,10,15,60,'2-1-1',false,false],[2,8,8,45,'Slow',true,false],[2,6,6,45,'5s hold',true,false]]);
    expect(shape('upper-b')).toEqual([[3,5,8,120,'2-1-1',false,false],[3,8,12,120,'2-0-1',false,false],[2,10,12,90,'2-1-1',false,false],[2,6,10,90,'2-0-1',false,false],[2,12,20,60,'2-1-1',false,false],[2,10,15,60,'2-0-1',false,false],[2,20,40,45,'Hold',true,true]]);
    expect(shape('lower-b')).toEqual([[2,8,12,90,'2-0-1',true,false],[3,10,15,90,'2-1-1',false,false],[3,10,15,90,'2-1-1',false,false],[3,10,15,75,'2-2-1',false,false],[2,12,20,60,'2-1-1',false,false],[2,12,20,60,'2-1-1',false,false],[2,20,40,45,'Hold',false,true]]);
    expect(shape('optional')).toEqual([[2,8,15,75,'2-0-1',false,false],[2,8,12,75,'2-1-1',false,false],[2,12,15,60,'2-0-1',false,false],[2,12,20,60,'2-1-1',false,false],[2,10,15,60,'2-0-1',false,false],[2,10,15,60,'2-0-1',false,false]]);
    expect(workout('recovery').exercises).toEqual([]);
    expect(WORKOUTS.filter(w=>w.category==='strength').map(w=>w.exercises.reduce((n,e)=>n+e.sets,0))).toEqual([16,18,16,17]);
  });
  it.each([1,2,3,4,5,6,8,9,12,13,15,16])('resolves Week %i without mutating catalog or filling actual RIR',week=>{
    const s=atWeek(week),w=selectedWorkout(s,1)!;const session=newSession(w,s);
    expect(session.workout).not.toBe(w);expect(session.exercises[0].sets.every(set=>set.rir===null)).toBe(true);
    expect(w.exercises.map(e=>e.sets)).toEqual(week===1?[2,2,2,2,1,1,2]:week===2?[2,2,2,2,2,2,2]:week===16?[2,1,1,1,1,1,1]:[3,3,2,2,2,2,2]);
    expect(w.exercises[0].rir).toBe(week===1?'4':week===2?'3–4':week===16?'4+':'2–3');
    expect(workout('upper-a').exercises[0].sets).toBe(3);
    expect(validateStore({...s,active:session}).active).toEqual(session);
  });
  it('keeps core at two and never raises foundation sets beyond the table',()=>{
    for(const week of [1,2,3,4]) for(const w of WORKOUTS.filter(w=>w.category==='strength')){const resolved=resolveWorkout(w,week,options());resolved.exercises.forEach((e,i)=>{expect(e.sets).toBeLessThanOrEqual(w.exercises[i].sets);if(e.role==='core')expect(e.sets).toBe(2);});}
    expect(resolveWorkout(workout('lower-a'),3,options()).exercises.map(e=>e.sets)).toEqual([3,2,2,3,2,2,2]);
  });
  it('halves total deload sets, retains each movement and skips Saturday',()=>{
    for(const w of WORKOUTS.filter(w=>w.category==='strength')){const full=w.exercises.reduce((n,e)=>n+e.sets,0),deload=resolveWorkout(w,16,options());expect(deload.exercises.reduce((n,e)=>n+e.sets,0)).toBe(Math.ceil(full/2));expect(deload.exercises.every(e=>e.sets>=1)).toBe(true);}
    expect(resolveWorkout(workout('optional'),16,options()).exercises).toEqual([]);
  });
  it('gates Saturday and the optional core skill at the correct weeks',()=>{
    const o=options();o.saturdayTwoSets=true;o.saturdayCore='knee-raise';
    expect(resolveWorkout(workout('optional'),4,o).exercises).toHaveLength(0);
    expect(resolveWorkout(workout('optional'),5,o).exercises.every(e=>e.sets===1)).toBe(true);
    expect(resolveWorkout(workout('optional'),6,o).exercises).toHaveLength(6);
    expect(resolveWorkout(workout('optional'),8,o).exercises).toHaveLength(6);
    expect(resolveWorkout(workout('optional'),9,o).exercises.at(-1)).toMatchObject(SATURDAY_CORE['knee-raise']);
  });
  it('adds only one chosen set during consolidation and drops it in deload',()=>{
    const o=options();o.extraSlot='upper-a:press';
    for(const week of [12,13,15,16]){const r=resolveWorkout(workout('upper-a'),week,o);expect(r.exercises[0].sets).toBe(week===12?3:week===16?2:4);expect(r.exercises[1].sets).toBe(week===16?1:3);}
  });
});
describe('attempts and prescriptions',()=>{
  it('advances only explicitly, repeats with a fresh attempt and blocks review of active sessions',()=>{
    const s=freshStore(),first=currentAttempt(s).id;expect(selectedWorkout(s,1)!.exercises[0].sets).toBe(2);
    const repeat=reviewWeek(s,'repeat');expect(repeat.programme.week).toBe(1);expect(currentAttempt(repeat).id).not.toBe(first);expect(s.programme.attempts).toHaveLength(1);
    const next=reviewWeek(repeat,'advance');expect(next.programme.week).toBe(2);
    next.active=newSession(selectedWorkout(next,1)!,next);expect(()=>reviewWeek(next,'advance')).toThrow('active workout');
  });
  it('counts only complete unique main workouts within an attempt',()=>{
    const s=atWeek(5),session=completed();session.attemptId=currentAttempt(s).id;s.sessions=[session];
    expect(coreWorkoutCount(attemptSessions(s))).toBe(1);s.sessions.push({...session,id:'duplicate'});expect(coreWorkoutCount(attemptSessions(s))).toBe(1);
    session.exercises[0].sets[0].done=false;expect(completeSession(session)).toBe(false);expect(coreWorkoutCount(attemptSessions(s))).toBe(0);
    session.exercises[0].sets[0].done=true;const repeated=reviewWeek(s,'repeat');expect(coreWorkoutCount(attemptSessions(repeated))).toBe(0);expect(repeated.sessions).toHaveLength(2);
  });
  it('finishes Week 16 without switching automatically and explicitly restarts',()=>{
    const s=atWeek(16),done=reviewWeek(s,'advance');expect(done.programme.status).toBe('complete');expect(done.programme.week).toBe(16);
    expect(()=>newSession(selectedWorkout(done,1)!,done)).toThrow();const restart=reviewWeek(done,'restart');expect(restart.programme.week).toBe(1);expect(restart.programme.status).toBe('active');expect(restart.programme.attempts[0]).toEqual(done.programme.attempts[0]);expect(validateStore(restart)).toEqual(restart);
  });
  it('uses the extra weekly set only once even if the workout is repeated',()=>{
    const store=atWeek(13);store.programme.options.extraSlot='upper-a:press';const w=selectedWorkout(store,1)!,session=newSession(w,store);session.exercises[0].sets.forEach(set=>Object.assign(set,{weight:10,reps:12,done:true}));session.endedAt=session.startedAt+1000;store.sessions=[session];expect(w.exercises[0].sets).toBe(4);expect(selectedWorkout(store,1)!.exercises[0].sets).toBe(3);store.programme.options.extraSlot='lower-a:squat';expect(selectedWorkout(store,2)!.exercises[0].sets).toBe(3);
  });
  it('snapshots saved variation and setup; units never alter stored loads',()=>{
    const s=atWeek(5);s.programme.options.choices['lower-a:squat']={variantId:VARIANTS['lower-a:squat'][1].id,setup:'Belt station',supportCm:null,coreLevel:'Basic'};
    const session=newSession(selectedWorkout(s,2)!,s);s.programme.options.choices['lower-a:squat'].setup='Different station';expect(session.workout.exercises[0].setup).toBe('Belt station');expect(session.workout.exercises[0].name).toBe('Belt Squat');expect(toKg(fromKg(20,'lb'),'lb')).toBeCloseTo(20,9);expect(validateStore({...s,active:session}).active).toEqual(session);
  });
  it('prefills only the same variation, setup, height, core level and load mode',()=>{
    const s=atWeek(5),old=completed();s.sessions=[old];expect(newSession(selectedWorkout(s,1)!,s).exercises[0].sets[0].weight).toBe(20);
    const ex=old.workout.exercises[0];expect(previousExercise(s.sessions,{...ex,setup:'other'})).toBeUndefined();expect(previousExercise(s.sessions,{...ex,supportCm:50})).toBeUndefined();expect(previousExercise(s.sessions,{...ex,coreLevel:'Longer lever'})).toBeUndefined();expect(previousExercise(s.sessions,ex,'assistance')).toBeUndefined();
    s.programme.options.choices['upper-a:press']={variantId:VARIANTS['upper-a:press'][1].id,setup:'',supportCm:null,coreLevel:'Basic'};expect(newSession(selectedWorkout(s,1)!,s).exercises[0].sets[0].weight).toBeNull();
  });
});
describe('progression and recovery',()=>{
  it('requires every target, equal loads, technique, session and dated next-day feedback',()=>{
    const s=completed(),ex=s.workout.exercises[0],log=s.exercises[0];expect(progression(ex,log,s)?.title).toContain('load increase');
    for(const feedback of [{...s.feedback!,technique:null},{...s.feedback!,after:null},{...s.feedback!,nextDay:null,nextDayDate:null},{...s.feedback!,after:'worse' as const},{...s.feedback!,nextDay:'radiating' as const},{...s.feedback!,nextDayDate:s.date},{...s.feedback!,before:'worse' as const}])expect(progression(ex,log,{...s,feedback})).toBeNull();
    log.sets[0].reps=11;expect(progression(ex,log,s)).toBeNull();log.sets[0].reps=12;log.sets[0].rir=0;expect(progression(ex,log,s)).toBeNull();log.sets[0].rir=null;log.sets[0].weight=22;expect(progression(ex,log,s)).toBeNull();
  });
  it('offers correct assistance, push-up, core, range and bridge methods',()=>{
    const b=completed(9,'upper-b');expect(progression(b.workout.exercises[0],b.exercises[0],b)?.title).toContain('less assistance');expect(progression(b.workout.exercises[6],b.exercises[6],b)?.title).toContain('Control');b.exercises[0].sets.forEach(set=>set.weight=0);expect(progression(b.workout.exercises[0],b.exercises[0],b)?.title).toContain('unassisted');
    const a=completed();expect(progression(a.workout.exercises[3],a.exercises[3],a)?.title).toContain('push-up');
    const lower=completed(9,'lower-b');expect(progression(lower.workout.exercises[0],lower.exercises[0],lower)?.title).toContain('range');expect(progression(lower.workout.exercises[3],lower.exercises[3],lower)?.title).toContain('Pelvic');
    for(const week of [1,4,16]){const s=completed(week);expect(progression(s.workout.exercises[0],s.exercises[0],s)).toBeNull();}
  });
  it('excludes assistance, bodyweight and timed work from volume; does not double sides',()=>{
    const s=completed(9,'upper-b');s.exercises.forEach(e=>e.sets.forEach(set=>set.done=false));s.exercises[0].sets[0].done=true;expect(volume(s)).toBe(0);s.exercises[6].sets[0].done=true;expect(volume(s)).toBe(0);
    s.exercises[1].sets[0].done=true;expect(volume(s)).toBe(240);
  });
  it('keeps followups pending until the following local date and feedback is recorded',()=>{
    const store=atWeek(5),session=completed();session.feedback=emptyFeedback();store.sessions=[session];expect(pendingFollowups(store,'2026-01-01')).toEqual([]);expect(pendingFollowups(store,'2026-01-02')).toEqual([session]);session.feedback.nextDay='none';expect(pendingFollowups(store,'2026-01-02')).toEqual([]);
  });
  it('uses consecutive completed weekly averages for plateau guidance',()=>{
    const body=[['2026-09-14',60],['2026-09-15',60],['2026-09-21',60],['2026-09-22',60],['2026-09-28',60],['2026-09-29',60]].map(([date,kg],i)=>({id:String(i),date:String(date),kg:Number(kg)}));
    expect(bodyGuidance(body,'2026-10-09')).toContain('100–150');expect(bodyGuidance(body.filter(b=>b.date!=='2026-09-15'),'2026-10-09')).not.toContain('100–150');expect(bodyGuidance(body,'2026-11-09')).not.toContain('100–150');
  });
});
describe('v4 fresh-start storage and backups',()=>{
  it.each([1,2,3])('rejects version %i backups without modifying them',version=>{
    const old={...freshStore(),version},raw=JSON.stringify(old);
    expect(()=>validateStore(old)).toThrow('only version-4 backups');expect(JSON.stringify(old)).toBe(raw);
  });
  it('round trips every new record type and snapshots without losing unknowns',()=>{
    const s=atWeek(9);s.active=newSession(selectedWorkout(s,4)!,s);s.daily=[{date:localDate(),symptoms:null,protein:true,surplus:null,sleep:false,movement:null}];s.recovery=[{id:'recovery',date:localDate(),activity:'cycling',cardio:25,mobility:15,note:'Easy',week:9,attemptId:currentAttempt(s).id}];expect(validateStore(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it('rejects malformed fields, identity mismatches, duplicates and future followups',()=>{
    const s=atWeek(9);s.active=newSession(selectedWorkout(s,4)!,s);
    for(const mutate of [(v:typeof s)=>v.active!.workout.exercises[0].tempo='bad',(v:typeof s)=>v.active!.exercises[0].mode='external',(v:typeof s)=>v.active!.exercises[0].sets.push({...v.active!.exercises[0].sets[0]}),(v:typeof s)=>v.active!.feedback!.nextDay='none',(v:typeof s)=>v.programme.attempts.push({...v.programme.attempts[0]}),(v:typeof s)=>v.programme.options.choices['bad']={variantId:'bad',setup:'',supportCm:null,coreLevel:'Basic'}]){const copy=structuredClone(s);mutate(copy);expect(()=>validateStore(copy)).toThrow();}
    const bad=structuredClone(s);bad.daily=[{date:localDate(),symptoms:null,protein:null,surplus:null,sleep:null,movement:null},{date:localDate(),symptoms:null,protein:null,surplus:null,sleep:null,movement:null}];expect(()=>validateStore(bad)).toThrow();
  });
  it('rejects internally consistent sets that violate foundation, consolidation or deload rules',()=>{
    for(const week of [1,5,13,16]){
      const s=atWeek(week);s.active=newSession(selectedWorkout(s,1)!,s);
      const ex=s.active.workout.exercises[0],log=s.active.exercises[0];ex.sets=1;log.sets=log.sets.slice(0,1);expect(()=>validateStore(s)).toThrow();
    }
    const s=atWeek(13);s.active=newSession(selectedWorkout(s,1)!,s);for(const i of [0,1]){s.active.workout.exercises[i].sets++;s.active.exercises[i].sets.push({...s.active.exercises[i].sets[0]});}expect(()=>validateStore(s)).toThrow();
    const saturday=atWeek(6);saturday.active=newSession(selectedWorkout(saturday,6)!,saturday);saturday.active.workout.exercises[0].sets=2;saturday.active.exercises[0].sets.push({...saturday.active.exercises[0].sets[0]});expect(()=>validateStore(saturday)).toThrow();
  });
  it('ignores all retired data and starts with empty records and default preferences',()=>{
    const records=new Map(RETIRED_STORAGE_KEYS.map((key,i)=>[key,i===1?'broken':JSON.stringify({...freshStore(),settings:{name:'Old',unit:'lb',autoRest:false},active:{old:true}})]));
    const getItem=vi.fn((key:string)=>records.get(key as typeof RETIRED_STORAGE_KEYS[number])??null);
    vi.stubGlobal('localStorage',{getItem});const result=readStore();
    expect(getItem.mock.calls).toEqual([[STORAGE_KEY]]);expect(result.error).toBeUndefined();
    expect(result.store).toMatchObject({version:4,settings:{name:'',unit:'kg',autoRest:true},programme:{week:1,status:'active',options:DEFAULT_OPTIONS},sessions:[],active:null,body:[],daily:[],recovery:[]});
    expect(result.store.programme.attempts).toHaveLength(1);
    expect(newSession(selectedWorkout(result.store,2)!,result.store).exercises[3].sets[0].weight).toBeNull();
  });
  it('commits before removing only known old keys, and preserves new data on reload',()=>{
    const records=new Map<string,string>(RETIRED_STORAGE_KEYS.map(key=>[key,'old']));records.set('other-app','keep');
    const calls:string[]=[];vi.stubGlobal('localStorage',{getItem:(key:string)=>records.get(key)??null,setItem:(key:string,raw:string)=>{calls.push(key);records.set(key,raw);},removeItem:(key:string)=>{calls.push(key);records.delete(key);}});
    const store=atWeek(5);store.active=newSession(selectedWorkout(store,1)!,store);store.active.exercises[0].sets[0]={weight:12,reps:8,rir:null,done:true};saveStore(store);
    expect(calls).toEqual([STORAGE_KEY,...RETIRED_STORAGE_KEYS]);expect(records.get('other-app')).toBe('keep');expect(readStore().store).toEqual(store);
  });
  it('retains old records when saving fails and retries cleanup independently',()=>{
    const records=new Map<string,string>(RETIRED_STORAGE_KEYS.map(key=>[key,'old'])),removeItem=vi.fn();
    vi.stubGlobal('localStorage',{setItem:()=>{throw new Error('Quota');},removeItem});expect(()=>saveStore(freshStore())).toThrow('Quota');expect(removeItem).not.toHaveBeenCalled();
    let blocked=true;vi.stubGlobal('localStorage',{setItem:(key:string,raw:string)=>records.set(key,raw),getItem:(key:string)=>records.get(key)??null,removeItem:(key:string)=>{if(blocked)throw new Error('Blocked');records.delete(key);}});
    const store=freshStore();saveStore(store);expect(readStore().store).toEqual(store);expect(records.has('gym-hawk-v3')).toBe(true);blocked=false;saveStore(store);expect(records.has('gym-hawk-v3')).toBe(false);
  });
  it('preserves corrupt v4 data without falling back, and reports unavailable storage',()=>{
    const getItem=vi.fn(()=>'{broken');vi.stubGlobal('localStorage',{getItem});expect(readStore().corrupt).toBe(true);expect(getItem.mock.calls).toEqual([[STORAGE_KEY]]);
    vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('Blocked');}});expect(readStore().error).toContain('storage is unavailable');
  });
});
