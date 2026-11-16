import { Check, ChevronRight } from './icons';
import { COOLDOWN } from './data';
import { completeSession, doneSets, sessionLabel, type Session } from './model';
export function ReviewWorkout({session,onUpdate,onSave,onContinue}:{session:Session;onUpdate:(fn:(s:Session)=>Session)=>void;onSave:()=>void;onContinue:()=>void}) {
  const label=sessionLabel(session),done=doneSets(session),total=session.exercises.reduce((n,ex)=>n+ex.sets.length,0);
  return <><p className="eyebrow">{session.workout.name}{label && ' · '+label}</p><section className="review-summary"><h2>{done===total?'Ready to save':done+' of '+total+' sets logged'}</h2><p>{done===total?'Your prescribed sets are complete.':done===0?'Log at least one set to save this workout.':'This will be saved as a partial workout.'}</p>{done<total&&<details className="guide-section"><summary>Unfinished sets</summary><ul className="guide-list">{session.exercises.map(ex=>{const missing=ex.sets.filter(set=>!set.done).length;return missing?<li key={ex.id}>{ex.name}: {missing} remaining</li>:null;})}</ul></details>}</section>
    <details className="guide-section cooldown-inline"><summary>Cool-down checklist <span className="muted">5–8 min</span></summary><p>Gentle movement, easy stretches and relaxed breathing. These do not count as working sets.</p>{COOLDOWN.map((text,i)=><label className="check-line" key={text}><input type="checkbox" checked={session.cooldown?.[i]??false} onChange={e=>onUpdate(s=>({...s,cooldown:COOLDOWN.map((_,j)=>i===j?e.target.checked:s.cooldown?.[j]??false)}))}/><span>{text}</span></label>)}</details>
    <div className="flow-actions"><button className="primary full-width" disabled={!done} onClick={onSave}>Save workout<Check size={20}/></button><button className="text-button full-width" onClick={onContinue}>Continue workout</button></div>
  </>;
}
export function WorkoutSaved({session,onToday,onView}:{session:Session;onToday:()=>void;onView:()=>void}) {
  const label=sessionLabel(session);
  return <section className="saved-summary"><span className="saved-mark"><Check size={32}/></span><h2>{session.workout.name}</h2><p>{label && label+' · '}{completeSession(session)?'Complete':'Partial workout'}</p><div className="saved-stats"><strong>{doneSets(session)}<span>sets logged</span></strong><strong>{Math.max(1,Math.floor(((session.endedAt??Date.now())-session.startedAt)/60000))}<span>minutes</span></strong></div><p className="muted">{completeSession(session)?'Your session is saved. Take a moment to recover.':'Your logged sets are saved. Partial workouts remain in your history.'}</p><button className="primary full-width" onClick={onToday}>Back to Today</button><button className="text-button full-width" onClick={onView}>View workout<ChevronRight size={18}/></button></section>;
}
