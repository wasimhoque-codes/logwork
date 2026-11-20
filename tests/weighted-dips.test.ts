import { describe, expect, it } from 'vitest';
import { fixedWorkoutForDay, VARIANTS } from '../src/data';
import { applyWeightedDipsDefault, exerciseHistory, freshStore, newSession, prefillExercise, recentExerciseSets, validateStore } from '../src/model';
import { exerciseVolume, movementSeries } from '../src/progress-data';

const choice=(variantId:string)=>({variantId,supportCm:null,coreLevel:'Basic'});
const upperB=(store:ReturnType<typeof freshStore>)=>fixedWorkoutForDay(4,store.programme.options)!;

describe('weighted dips',()=>{
  it('defaults to added load with the existing prescription and no assumed starting weight',()=>{
    const store=freshStore(),workout=upperB(store),dip=workout.exercises[3];
    expect(dip).toMatchObject({id:'p16-weighted-dip',name:'Weighted Dips',mode:'external',method:'load',sets:2,min:6,max:10,rest:90,tempo:'2-0-1'});
    expect(dip.note).toContain('Log added weight only, excluding bodyweight.');
    expect(newSession(workout,store).exercises[3].sets[0].weight).toBeNull();
    expect(VARIANTS['upper-b:dip'].map(ex=>ex.id)).toEqual(['p16-weighted-dip','p16-assisted-dip','p16-dip','p16-supported-chest-10']);
  });

  it.each([undefined,'p16-assisted-dip','p16-dip'])('updates the old choice %s once and preserves snapshots',variantId=>{
    const store=freshStore();delete store.programme.options.weightedDipsDefaultApplied;
    if(variantId)store.programme.options.choices['upper-b:dip']=choice(variantId);
    store.active=newSession(upperB(store),store);
    const before=structuredClone(store),updated=applyWeightedDipsDefault(store);
    expect(upperB(updated).exercises[3].id).toBe('p16-weighted-dip');
    expect(updated.active).toBe(store.active);expect(updated.sessions).toBe(store.sessions);
    expect(store).toEqual(before);
    updated.programme.options.choices['upper-b:dip']=choice('p16-dip');
    expect(applyWeightedDipsDefault(validateStore(updated)).programme.options.choices['upper-b:dip'].variantId).toBe('p16-dip');
  });

  it('retains an explicitly selected chest press and rejects invalid migration markers',()=>{
    const store=freshStore();delete store.programme.options.weightedDipsDefaultApplied;
    store.programme.options.choices['upper-b:dip']=choice('p16-supported-chest-10');
    expect(upperB(applyWeightedDipsDefault(store)).exercises[3].id).toBe('p16-supported-chest-10');
    expect(()=>validateStore({...store,programme:{...store.programme,options:{...store.programme.options,weightedDipsDefaultApplied:'yes'}}})).toThrow();
  });

  it('separates historical assistance and bodyweight from added-load prefills and progress',()=>{
    const store=freshStore();
    for(const [variantId,weight] of [['p16-assisted-dip',30],['p16-dip',0]] as const){
      store.programme.options.choices['upper-b:dip']=choice(variantId);
      const session=newSession(upperB(store),store);session.endedAt=session.startedAt+1000;
      session.exercises[3].sets.forEach(set=>Object.assign(set,{weight,reps:8,done:true}));
      store.sessions.push(session);
    }
    const before=structuredClone(store.sessions);
    delete store.programme.options.weightedDipsDefaultApplied;
    const updated=applyWeightedDipsDefault(store),dip=upperB(updated).exercises[3];
    expect(prefillExercise(dip,updated.sessions).sets[0].weight).toBeNull();
    const weighted=newSession(upperB(updated),updated);weighted.startedAt+=10000;
    expect(exerciseHistory(updated.sessions,weighted,3)).toEqual([]);
    expect(recentExerciseSets(updated.sessions,dip)).toEqual([]);
    weighted.exercises[3].sets.forEach(set=>Object.assign(set,{weight:10,reps:8,done:true}));
    weighted.endedAt=weighted.startedAt+1000;updated.sessions.push(weighted);
    expect(prefillExercise(dip,updated.sessions).sets[0]).toMatchObject({weight:10,reps:8,done:false});
    expect(exerciseVolume(dip,weighted.exercises[3])).toBe(160);
    expect(movementSeries(updated.sessions).map(series=>series.mode).sort()).toEqual(['assistance','bodyweight','external']);
    expect(updated.sessions.slice(0,2)).toEqual(before);
    expect(validateStore(updated).version).toBe(4);
  });
});
