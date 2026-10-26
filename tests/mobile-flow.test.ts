import { describe, it, expect } from 'vitest';
import { freshStore, selectedWorkout, newSession, sessionResume, restSeconds, validateStore } from '../src/model';
import { resolvePage } from '../src/routes';
function active(){const s=freshStore();s.active=newSession(selectedWorkout(s,1)!,s);return s;}
describe('mobile session recovery',()=>{
  it('restores existing v4 data without adding or changing records',()=>{
    const store=active();delete store.active!.resume;store.settings.name='Existing';store.active!.exercises[0].sets.forEach(set=>Object.assign(set,{weight:12,reps:8,done:true}));
    const raw=JSON.stringify(store),restored=validateStore(JSON.parse(raw));expect(JSON.stringify(restored)).toBe(raw);expect(sessionResume(restored.active!).exerciseIndex).toBe(1);
  });
  it('starts a new session at the first exercise with no timer',()=>{expect(sessionResume(active().active!)).toEqual({exerciseIndex:0,restEnd:null,restPaused:null});});
  it('round trips a selected exercise and a running or paused timer',()=>{
    for(const resume of [{exerciseIndex:4,restEnd:Date.now()+90000,restPaused:null,origin:'programme' as const},{exerciseIndex:6,restEnd:null,restPaused:85}]){const store=active();store.active!.resume=resume;expect(validateStore(JSON.parse(JSON.stringify(store)))).toEqual(store);}
  });
  it('expires rest without modifying any set or selected exercise',()=>{
    const store=active(),s=store.active!;s.resume={exerciseIndex:3,restEnd:100000,restPaused:null};const raw=JSON.stringify(s);expect(restSeconds(sessionResume(s),100001)).toBe(0);expect(JSON.stringify(s)).toBe(raw);
    expect(restSeconds({...s.resume,restEnd:102001},100000)).toBe(3);expect(restSeconds({...s.resume,restEnd:null,restPaused:70},100000)).toBe(70);
  });
  it.each([{exerciseIndex:0,restEnd:9e12,restPaused:null},{exerciseIndex:0,restEnd:null,restPaused:null,origin:'bad'},{exerciseIndex:-1,restEnd:null,restPaused:null},{exerciseIndex:7,restEnd:null,restPaused:null},{exerciseIndex:1.5,restEnd:null,restPaused:null},{exerciseIndex:0,restEnd:-1,restPaused:null},{exerciseIndex:0,restEnd:NaN,restPaused:null},{exerciseIndex:0,restEnd:null,restPaused:-1},{exerciseIndex:0,restEnd:1,restPaused:30},{exerciseIndex:0,restEnd:null,restPaused:1.2}])('rejects malformed resume metadata: %j',resume=>{const store=active();Object.assign(store.active!,{resume});expect(()=>validateStore(store)).toThrow('invalid');});
  it('falls back to the final exercise when an older session has every set logged',()=>{const s=active().active!;delete s.resume;s.exercises.forEach(ex=>ex.sets.forEach(set=>set.done=true));expect(sessionResume(s).exerciseIndex).toBe(s.exercises.length-1);});
});
describe('navigation compatibility',()=>{
  it.each([['#plan','programme'],['#insights','progress'],['#history','progress/history'],['#progress/bodyweight','progress/bodyweight'],['#workout/review','workout/review'],['#unknown','today']])('maps %s to %s', (hash,page)=>expect(resolvePage(hash)).toBe(page));
});
