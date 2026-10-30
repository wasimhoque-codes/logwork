import { describe, expect, it } from 'vitest';
import { freshStore, selectedWorkout, newSession, exerciseHistory, addSessionSet, localDate, type Session } from '../src/model';

function fixture(day=1,week=9) {
  const store=freshStore();store.programme.week=week;store.programme.attempts[0].week=week;
  return newSession(selectedWorkout(store,day)!,store);
}
function saved(current:Session,daysAgo=1) {
  const session=structuredClone(current);session.id=crypto.randomUUID();session.startedAt-=daysAgo*86400000;session.endedAt=session.startedAt+60000;session.date=localDate(new Date(session.startedAt));
  session.exercises.forEach(e=>e.sets.forEach(set=>Object.assign(set,{weight:e.mode==='bodyweight'?0:20,rir:3,done:true})));
  return session;
}

describe('exercise history',()=>{
  it('returns the latest five matching saved sessions newest first, without mutating records',()=>{
    const current=fixture(),sessions=[6,2,4,7,3,1,5].map(day=>saved(current,day));
    const before=structuredClone(sessions),history=exerciseHistory(sessions,current,0);
    expect(history.map(e=>e.startedAt)).toEqual([1,2,3,4,5].map(day=>current.startedAt-day*86400000));
    expect(history[0]).toMatchObject({sessionId:sessions[5].id,date:sessions[5].date,week:9,exercise:current.workout.exercises[0],mode:'external'});
    expect(sessions).toEqual(before);
  });
  it('excludes the active session, equal or later starts, unfinished sessions, and exercises without logged sets',()=>{
    const current=fixture(),sameId=saved(current),equal=saved(current,0),future=saved(current,-1),unfinished=saved(current),empty=saved(current);
    sameId.id=current.id;delete unfinished.endedAt;empty.exercises[0].sets.forEach(set=>set.done=false);
    expect(exerciseHistory([current,sameId,equal,future,unfinished,empty],current,0)).toEqual([]);
    expect(exerciseHistory([saved(current)],current,-1)).toEqual([]);expect(exerciseHistory([],current,99)).toEqual([]);
  });
  it.each(['variation','mode','setup','height','core level'])('requires matching %s',difference=>{
    const current=fixture(),old=saved(current),spec=old.workout.exercises[0];
    if(difference==='variation')spec.id='other';
    if(difference==='mode')old.exercises[0].mode='assistance';
    if(difference==='setup')spec.setup='Other station';
    if(difference==='height')spec.supportCm=99;
    if(difference==='core level')spec.coreLevel='Longer lever';
    expect(exerciseHistory([old],current,0)).toEqual([]);
  });
  it('normalizes setup whitespace/case and finds matching exercises across workout days, positions and weeks',()=>{
    const current=fixture(),old=saved(current);current.workout.exercises[0].setup='  Bench A  ';old.workout.exercises[0].setup='bench a';old.week=5;old.workoutId='other-day';
    old.exercises.reverse();old.workout.exercises.reverse();
    expect(exerciseHistory([old],current,0)[0].week).toBe(5);
  });
  it('includes partial workouts, skips unlogged rows, and preserves original numbers and extra-set prescriptions',()=>{
    const current=fixture(),old=addSessionSet(saved(current),0),last=old.exercises[0].sets.length;
    old.exercises[0].sets[1].done=false;old.exercises[1].sets[0].done=false;
    Object.assign(old.exercises[0].sets.at(-1)!,{weight:27,reps:7,rir:0,done:true});
    const entry=exerciseHistory([old],current,0)[0];
    expect(entry.sets.map(s=>s.setNumber)).toEqual(Array.from({length:last},(_,i)=>i+1).filter(i=>i!==2));
    expect(entry.sets.at(-1)).toMatchObject({setNumber:last,weight:27,reps:7,rir:0});expect(entry.exercise.sets).toBe(last-1);
    entry.sets[0].weight=999;expect(old.exercises[0].sets[0].weight).toBe(20);
  });
  it('reads saved edits and deletions rather than caching old values',()=>{
    const current=fixture(),old=saved(current);
    expect(exerciseHistory([old],current,0)[0].sets[0].weight).toBe(20);
    old.exercises[0].sets[0].weight=23;expect(exerciseHistory([old],current,0)[0].sets[0].weight).toBe(23);
    expect(exerciseHistory([],current,0)).toEqual([]);
  });
  it('retains bodyweight, assistance and timed/per-side historical snapshots',()=>{
    const current=fixture(4),old=saved(current);
    for(const index of [0,3,6]) {
      const entry=exerciseHistory([old],current,index)[0];
      expect(entry.mode).toBe(old.exercises[index].mode);expect(entry.exercise).toEqual(old.workout.exercises[index]);
      expect(entry.sets[0].weight).toBe(entry.mode==='bodyweight'?0:20);
    }
  });
});
