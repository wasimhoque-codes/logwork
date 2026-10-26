import { LEGACY_WORKOUTS } from '../src/legacy-data';
export function legacyStore(active = false) {
  const w = LEGACY_WORKOUTS[0];
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const session = { id: 'legacy-session', workoutId: w.id, date, startedAt: Date.now()-60000, phase: 'full', note: 'Original notes', exercises: w.exercises.map(e => ({ id:e.id, name:e.name, mode:e.mode ?? 'external', note:'Machine setting 3', sets:Array.from({length:e.sets},()=>({weight:e.id==='bench'?60:null,reps:e.max,rir:2,done:e.id==='bench'})) })) };
  return { version:1, settings:{name:'Alex',unit:'kg',phase:'full',autoRest:true},sessions:active?[]:[{...session,endedAt:Date.now()}],active:active?session:null,body:[{id:'weight',date,kg:70}] };
}
