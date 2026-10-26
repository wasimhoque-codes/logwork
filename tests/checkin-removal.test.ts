import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshStore, newSession, selectedWorkout, currentAttempt, localDate, validateStore, readStore, saveStore, STORAGE_KEY } from '../src/model';

function populatedStore() {
  const store=freshStore();store.settings={name:'Keep me',unit:'lb',autoRest:false};
  store.programme.options.choices['lower-a:thrust']={variantId:'p16-bridge-12',setup:'Mat',supportCm:null,coreLevel:'Basic'};
  const session=newSession(selectedWorkout(store,1)!,store);session.exercises[0].sets[0]={weight:12,reps:10,rir:3,done:true};session.feedback!.before='stable';session.feedback!.after='none';session.feedback!.technique=true;session.endedAt=session.startedAt+60000;store.sessions=[session];
  store.active=newSession(selectedWorkout(store,2)!,store);store.active.feedback!.before='none';
  store.body=[{id:'weight',date:localDate(),kg:61}];
  store.recovery=[{id:'recovery',date:localDate(),activity:'cycling',cardio:20,mobility:10,note:'Keep',week:1,attemptId:currentAttempt(store).id}];
  return store;
}
const checkins=()=>[{date:localDate(),symptoms:'worse',protein:true,surplus:null,sleep:false,movement:true}];
afterEach(()=>vi.unstubAllGlobals());
describe('retired daily check-ins',()=>{
  it('discards only daily records on backup validation without mutating the source',()=>{
    const store=populatedStore(),legacy={...structuredClone(store),daily:checkins()};
    expect(validateStore(legacy)).toEqual(store);expect(legacy.daily).toEqual(checkins());
    const restored=validateStore(JSON.parse(JSON.stringify(validateStore(legacy))));expect(restored).toEqual(store);
  });
  it('normalises missing and malformed retired fields without weakening other validation',()=>{
    for(const daily of [undefined,null,'retired',{},[{},{}]])expect(validateStore({...freshStore(),daily}).daily).toEqual([]);
    expect(()=>validateStore({...freshStore(),body:[{id:'bad',date:localDate(),kg:0}],daily:checkins()})).toThrow();
  });
  it('removes daily records from loaded storage and persists preserved records on save',()=>{
    const store=populatedStore(),storage=new Map([[STORAGE_KEY,JSON.stringify({...store,daily:checkins()})],['unrelated','keep']]);
    vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)});
    const loaded=readStore();expect(loaded.error).toBeUndefined();expect(loaded.store).toEqual(store);saveStore(loaded.store);
    expect(JSON.parse(storage.get(STORAGE_KEY)!)).toEqual(store);expect(storage.get('unrelated')).toBe('keep');
  });
  it('starts workout feedback unrecorded regardless of legacy symptoms',()=>{
    const store=freshStore();Object.assign(store,{daily:checkins()});
    expect(newSession(selectedWorkout(store,1)!,store).feedback).toEqual({before:null,after:null,nextDay:null,nextDayDate:null,technique:null});
  });
});
