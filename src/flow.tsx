import { ExerciseIcon } from './exercise-icon';
import { Check, ChevronRight, NotebookPen } from './icons';
import { COOLDOWN } from './data';
import { completeSession, doneSets, localDate, prescribedSetsComplete, removeUnusedExtras, sessionLabel, skippedSets, workoutDateError, type Session } from './model';

export function ReviewWorkout({session,saving,date,onDate,onUpdate,onSave,onContinue,onJump}:{session:Session;saving:boolean;date:string;onDate:(date:string)=>void;onUpdate:(fn:(s:Session)=>Session)=>void;onSave:(date:string)=>void;onContinue:()=>void;onJump:(exercise:number,set:number)=>void}) {
  const label=sessionLabel(session),logged=doneSets(session),complete=prescribedSetsComplete(session);
  const planned=session.workout.exercises.reduce((count,exercise)=>count+exercise.sets,0);
  const plannedDone=session.exercises.reduce((count,log,index)=>count+log.sets.slice(0,session.workout.exercises[index].sets).filter(set=>set.done).length,0);
  const unusedExtras=session.exercises.reduce((count,log,index)=>count+log.sets.slice(session.workout.exercises[index].sets).filter(set=>!set.done).length,0);
  const error=workoutDateError(session,date);
  return <>
    <p className="eyebrow">{session.workout.name}{label && ' · '+label}</p>
    <section className="review-summary">
      <h2>{complete?'Ready to save':plannedDone+' of '+planned+' prescribed sets logged'}</h2>
      <p>{complete?'Your prescribed sets are complete.':logged===0?'Log at least one set to save this workout.':'This will be saved as a partial workout.'}</p>
      {!complete&&<details className="guide-section"><summary>Unfinished sets</summary>
        <ul className="guide-list">{session.exercises.map((log,index)=>{
          const missing=log.sets.slice(0,session.workout.exercises[index].sets).flatMap((set,i)=>set.done?[]:[i]);
          const skipped=skippedSets(session,index);
          return missing.length?<li key={log.id}><button className="text-button" disabled={saving} onClick={()=>onJump(index,missing[0])}>
            <ExerciseIcon exercise={session.workout.exercises[index]} size={24}/>{log.name} · {missing.length-skipped.length} remaining{skipped.length>0&&' · '+skipped.length+' skipped'}<ChevronRight size={16}/>
          </button></li>:null;
        })}</ul>
      </details>}
      {unusedExtras>0&&<button className="text-button" disabled={saving} onClick={()=>onUpdate(removeUnusedExtras)}>Remove {unusedExtras} unused extra {unusedExtras===1?'set':'sets'}</button>}
    </section>
    <label className="field-label" htmlFor="review-date">Workout date</label>
    <input className="text-input" id="review-date" type="date" min="1900-01-01" max={localDate()} value={date} disabled={saving} onChange={event=>onDate(event.target.value)}/>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <details className="guide-section cooldown-inline"><summary>Cool-down checklist <span className="muted">5–8 min</span></summary>
      <p>Gentle movement, easy stretches and relaxed breathing. These do not count as working sets.</p>
      {COOLDOWN.map((text,i)=><label className="check-line" key={text}><input type="checkbox" disabled={saving} checked={session.cooldown?.[i]??false} onChange={event=>onUpdate(s=>({...s,cooldown:COOLDOWN.map((_,j)=>i===j?event.target.checked:s.cooldown?.[j]??false)}))}/><span>{text}</span></label>)}
    </details>
    <div className="flow-actions"><button className="primary full-width" disabled={!logged||saving||!!error} onClick={()=>onSave(date)}>{saving?'Saving workout…':'Save workout'}<Check size={20}/></button><button className="text-button full-width" onClick={onContinue} disabled={saving}>Continue workout</button></div>
  </>;
}

export function WorkoutSaved({session,animate,onToday,onView}:{session:Session;animate:boolean;onToday:()=>void;onView:()=>void}) {
  const label=sessionLabel(session),complete=completeSession(session);
  return <section className="saved-summary" data-award={complete?'complete':'partial'} data-animate={animate||undefined}>
    <span className="saved-mark" aria-hidden="true">{complete?<Check size={32}/>:<NotebookPen size={28}/>}</span>
    <h2>{session.workout.name}</h2>
    <p>{label && label+' · '}{complete?'Complete':'Partial workout'}</p>
    <div className="saved-stats"><strong>{doneSets(session)}<span>sets logged</span></strong>
      <strong>{Math.max(0,Math.floor(((session.endedAt??Date.now())-session.startedAt)/60000))}<span>minutes elapsed</span></strong>
    </div>
    <p className="muted">{complete?'Your session is saved. Take a moment to recover.':'Your logged sets are saved. Partial workouts remain in your history.'}</p>
    <button className="primary full-width" onClick={onToday}>Back to Today</button>
    <button className="text-button full-width" onClick={onView}>View workout<ChevronRight size={18}/></button>
  </section>;
}
