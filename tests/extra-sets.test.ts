import { describe, expect, it } from 'vitest';
import { WORKOUTS } from '../src/data';
import { addSessionSet, removeLastSessionSet, freshStore, selectedWorkout, newSession, validateStore, completeSession, doneSets, volume, progression, currentAttempt, type Session } from '../src/model';

function active(week=5,day=1){
  const store=freshStore();store.programme.week=week;store.programme.attempts[0].week=week;
  store.active=newSession(selectedWorkout(store,day)!,store);
  return store;
}
function complete(session:Session){
  const copy=structuredClone(session);
  copy.endedAt=copy.startedAt+60000;
  copy.exercises.forEach((log,i)=>log.sets.forEach(set=>Object.assign(set,{weight:log.mode==='bodyweight'?0:20,reps:copy.workout.exercises[i].max,rir:3,done:true})));
  copy.feedback={before:null,after:'none',nextDay:'none',nextDayDate:'2026-01-02',technique:true};copy.date='2026-01-01';
  return copy;
}

describe('session-only extra sets',()=>{
  it('copies the last set values, clears RIR and completion, and preserves other records',()=>{
    const s=active().active!;s.exercises[0].sets.at(-1)!.weight=18;s.exercises[0].sets.at(-1)!.reps=11;s.exercises[0].sets.at(-1)!.rir=3;s.exercises[0].sets.at(-1)!.done=true;
    const raw=JSON.stringify(s),added=addSessionSet(s,0),newSet=added.exercises[0].sets.at(-1)!;
    expect(newSet).toEqual({weight:18,reps:11,rir:null,done:false});expect(newSet).not.toBe(s.exercises[0].sets.at(-1));
    expect(JSON.stringify(s)).toBe(raw);expect(added.workout).toBe(s.workout);expect(added.exercises[1]).toBe(s.exercises[1]);expect(added.resume).toEqual(s.resume);
  });
  it('preserves empty loads, bodyweight, assistance and timed/per-side values',()=>{
    const s=active(9,4).active!;
    expect(addSessionSet(s,1).exercises[1].sets.at(-1)!.weight).toBeNull();
    for(const i of [0,3,6]){
      s.exercises[i].sets.at(-1)!.weight=s.exercises[i].mode==='bodyweight'?0:25;
      const added=addSessionSet(s,i);
      expect(added.exercises[i].mode).toBe(s.exercises[i].mode);
      expect(added.exercises[i].sets.at(-1)).toMatchObject({weight:s.exercises[i].sets.at(-1)!.weight,reps:s.exercises[i].sets.at(-1)!.reps,done:false,rir:null});
      expect(added.workout.exercises[i]).toEqual(s.workout.exercises[i]);
    }
  });
  it('caps additions at ten and ignores invalid exercise indices',()=>{
    let s=active().active!;for(let i=0;i<20;i++)s=addSessionSet(s,0);
    expect(s.exercises[0].sets).toHaveLength(10);expect(addSessionSet(s,0)).toBe(s);
    expect(addSessionSet(s,-1)).toBe(s);expect(addSessionSet(s,99)).toBe(s);
    const finished=complete(s);expect(addSessionSet(finished,0)).toBe(finished);expect(removeLastSessionSet(finished,0)).toBe(finished);
  });
  it.each([false,true])('edits finished sessions (partial=%s) without mutating metadata or the original',partial=>{
    const store=active(),original=complete(store.active!);store.active=null;
    if(partial)original.exercises[1].sets[0].done=false;
    const before=structuredClone(original),added=addSessionSet(original,0),index=original.exercises[0].sets.length;
    expect(original).toEqual(before);
    expect(added.exercises[0].sets[index]).toEqual({weight:20,reps:original.exercises[0].sets.at(-1)!.reps,rir:null,done:false});
    expect({...added,exercises:original.exercises}).toEqual(original);
    expect(completeSession(added)).toBe(false);
    store.sessions=[added];expect(validateStore(JSON.parse(JSON.stringify(store)))).toEqual(store);
    expect(removeLastSessionSet(added,0)).toEqual(original);
    expect(added.exercises[0].sets).toHaveLength(index+1);
    added.exercises[0].sets[index].done=true;
    expect(removeLastSessionSet(added,0)).toBe(added);
    expect(newSession(selectedWorkout(store,1)!,store).exercises[0].sets).toHaveLength(original.workout.exercises[0].sets);
  });
  it('removes only the last unlogged extra, preserving prescribed and logged sets',()=>{
    const s=active().active!,one=addSessionSet(s,0),two=addSessionSet(one,0);
    two.exercises[0].sets.at(-2)!.done=true;
    const removed=removeLastSessionSet(two,0);
    expect(removed.exercises[0].sets).toHaveLength(s.exercises[0].sets.length+1);
    expect(two.exercises[0].sets).toHaveLength(s.exercises[0].sets.length+2);
    expect(removeLastSessionSet(removed,0)).toBe(removed);
    removed.exercises[0].sets.at(-1)!.done=false;
    expect(removeLastSessionSet(removeLastSessionSet(removed,0),0).exercises[0].sets).toHaveLength(s.exercises[0].sets.length);
    expect(removeLastSessionSet(s,0)).toBe(s);expect(removeLastSessionSet(s,-1)).toBe(s);
  });
  it.each([1,5,13,16])('round trips active and finished extras in week %i without changing prescriptions or future counts',week=>{
    const store=active(week),prescription=structuredClone(store.active!.workout);
    store.active=addSessionSet(store.active!,0);
    expect(validateStore(JSON.parse(JSON.stringify(store)))).toEqual(store);
    store.sessions=[complete(store.active)];store.active=null;
    expect(validateStore(JSON.parse(JSON.stringify(store)))).toEqual(store);
    expect(store.sessions[0].workout).toEqual(prescription);
    expect(newSession(selectedWorkout(store,1)!,store).exercises[0].sets).toHaveLength(prescription.exercises[0].sets);
  });
  it('accepts ten sets and rejects undersized arrays, eleven sets and malformed extras',()=>{
    const store=active();while(store.active!.exercises[0].sets.length<10)store.active=addSessionSet(store.active!,0);
    expect(validateStore(store)).toEqual(store);
    for(const mutate of [
      (s:Session)=>s.exercises[0].sets.push({...s.exercises[0].sets[0]}),
      (s:Session)=>s.exercises[0].sets.splice(s.workout.exercises[0].sets-1),
      (s:Session)=>s.exercises[0].sets.at(-1)!.rir=11,
      (s:Session)=>s.exercises[0].sets.at(-1)!.reps=-1,
      (s:Session)=>s.exercises[0].sets.at(-1)!.done=true,
    ]){const copy=structuredClone(store);mutate(copy.active!);expect(()=>validateStore(copy)).toThrow();}
  });
  it('counts extras in completion and volume and applies all progression checks to them',()=>{
    const original=complete(active().active!),s=addSessionSet(original,0),ex=s.workout.exercises[0],log=s.exercises[0];
    s.endedAt=original.endedAt;
    expect(completeSession(s)).toBe(false);expect(progression(ex,log,s)).toBeNull();
    Object.assign(log.sets.at(-1)!,{weight:20,reps:ex.max,rir:3,done:true});
    expect(completeSession(s)).toBe(true);expect(doneSets(s)).toBe(doneSets(original)+1);expect(volume(s)).toBe(volume(original)+20*ex.max);
    expect(progression(ex,log,s)?.title).toContain('load increase');
    for(const patch of [{weight:21},{reps:ex.max-1},{rir:1},{done:false}]){
      const copy=structuredClone(log);Object.assign(copy.sets.at(-1)!,patch);expect(progression(ex,copy,s)).toBeNull();
    }
    expect(progression(ex,log,{...s,feedback:{...s.feedback!,after:'worse'}})).toBeNull();
  });
  it('checks the prescribed weekly bonus position even when manual extras follow it',()=>{
    const store=active(13);store.programme.options.extraSlot='upper-a:press';
    const w=selectedWorkout(store,1)!,s=complete(newSession(w,store));
    expect(w.exercises[0].sets).toBe(4);
    const added=addSessionSet({...s,endedAt:undefined},0);added.endedAt=s.endedAt;store.sessions=[added];
    expect(selectedWorkout(store,1)!.exercises[0].sets).toBe(3);
    added.exercises[0].sets[3].done=false;Object.assign(added.exercises[0].sets[4],{weight:20,done:true});
    expect(selectedWorkout(store,1)!.exercises[0].sets).toBe(4);
    const base=WORKOUTS.find(w=>w.id==='upper-a')!;
    const manual=complete(addSessionSet(newSession(base,store),0));manual.attemptId=currentAttempt(store).id;store.sessions=[manual];
    expect(selectedWorkout(store,1)!.exercises[0].sets).toBe(4);
  });
});
