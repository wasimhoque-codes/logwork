import { ExerciseIcon } from './exercise-icon';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, RotateCcw, Trash2, NotebookPen, Plus } from './icons';
import { prescription, rirTarget, type Unit } from './data';
import { fromKg, toKg, number, dateLabel, addSessionSet, removeLastSessionSet, MAX_SETS_PER_EXERCISE, previousSetAt, skippedSets, type Session, type SetLog, type ExerciseLog, type ExerciseHistoryEntry } from './model';
import { useContentFade, useSetFeedback } from './motion';
import { Modal } from './components';
import { ExerciseDemo } from './technique-demo';

type Props={session:Session;exerciseIndex:number;unit:Unit;saving:boolean;initialSet?:number;previous?:ExerciseLog;history:ExerciseHistoryEntry[];onIndex:(index:number)=>void;onSet:(setIndex:number,patch:Partial<SetLog>)=>void;onCommit:(index:number,values:SetLog,action:'log'|'edit'|'undo')=>Promise<void>;onSkip:(index:number,skip:boolean)=>void;onSwap?:()=>void;onStartRest?:()=>void;onUpdate:(fn:(s:Session)=>Session)=>void;onDiscard:()=>void;onGuide:()=>void;onUrgent:()=>void;onWarmup:()=>void;onReview:()=>void;rest?:React.ReactNode};
export function WorkoutScreen({session,exerciseIndex,unit,saving,initialSet,previous,history,onIndex,onSet,onCommit,onSkip,onSwap,onStartRest,onUpdate,onDiscard,onGuide,onUrgent,onWarmup,onReview,rest}:Props){
  const [showHistory,setShowHistory]=useState(false),[picker,setPicker]=useState(false),[more,setMore]=useState(false),[showSets,setShowSets]=useState(false),[editing,setEditing]=useState<number|null>(initialSet??null),[editDraft,setEditDraft]=useState<SetLog|null>(null),[error,setError]=useState<{field:'weight'|'reps';text:string}|null>(null);
  const [lastLogged,setLastLogged]=useState<{index:number;value:SetLog}|null>(null);
  const [saveError,setSaveError]=useState('');
  const [retryAction,setRetryAction]=useState<'submit'|number>('submit');
  const writing=useRef(false);
  const weightRef=useRef<HTMLInputElement>(null),repsRef=useRef<HTMLInputElement>(null),setRef=useRef<HTMLElement>(null),exerciseRef=useRef<HTMLElement>(null),justLogged=useRef(false),focusAfterSetChange=useRef(false);
  const dockRef=useRef<HTMLDivElement>(null);
  const exercise=session.workout.exercises[exerciseIndex],log=session.exercises[exerciseIndex],done=log.sets.filter(s=>s.done).length;
  const skipped=skippedSets(session,exerciseIndex);
  const first=log.sets.findIndex((set,index)=>!set.done&&!skipped.includes(index)),setIndex=editing??first,set=setIndex>=0?(editing!==null?editDraft??log.sets[setIndex]:log.sets[setIndex]):undefined,lastExercise=exerciseIndex===session.exercises.length-1;
  useContentFade(exerciseRef,exerciseIndex,'exercise');useContentFade(setRef,exerciseIndex);useSetFeedback(setRef,dockRef,done,exerciseIndex);
  useEffect(()=>{
    setEditing(initialSet??null);setEditDraft(null);setError(null);setSaveError('');setLastLogged(null);setShowSets(false);setShowHistory(false);
  },[exerciseIndex,exercise.id,initialSet]);
  useEffect(()=>{if(justLogged.current){justLogged.current=false;setRef.current?.focus({preventScroll:true});}},[first,done]);
  useEffect(()=>{if(focusAfterSetChange.current){focusAfterSetChange.current=false;setRef.current?.focus({preventScroll:true});setRef.current?.scrollIntoView({block:'nearest'});}},[log.sets.length]);
  const amount=(value:SetLog)=>`${log.mode==='bodyweight'?'Bodyweight':`${number(fromKg(value.weight??0,unit))} ${unit}${log.mode==='assistance'?' assistance':''}`} × ${value.reps}${exercise.timed?' sec':' reps'}${exercise.perSide?' / side':''}`;
  const patchLog=(patch:Partial<ExerciseLog>)=>onUpdate(s=>({...s,exercises:s.exercises.map((e,i)=>i===exerciseIndex?{...e,...patch}:e)}));
  function addSet(){
    if(saving||log.sets.length>=MAX_SETS_PER_EXERCISE)return;
    focusAfterSetChange.current=first<0&&editing===null;
    onUpdate(s=>addSessionSet(s,exerciseIndex));
  }
  function removeSet(){
    const lastIndex=log.sets.length-1;
    if(lastIndex<exercise.sets||log.sets[lastIndex].done)return;
    if(editing===lastIndex){setEditing(null);setEditDraft(null);}
    if(setIndex===lastIndex)setError(null);
    focusAfterSetChange.current=true;
    onUpdate(s=>removeLastSessionSet(s,exerciseIndex));
  }
  function changeSet(patch:Partial<SetLog>){
    if(writing.current)return;
    setError(null);setSaveError('');
    if(editing!==null)setEditDraft(value=>({...value??log.sets[editing],...patch}));
    else onSet(setIndex,{...patch,done:false});
  }
  async function saveSet(index:number,value:SetLog,action:'log'|'edit'|'undo') {
    if(writing.current) return;
    writing.current=true;
    setSaveError('');
    setRetryAction(action==='undo'?index:'submit');
    justLogged.current=action==='log';
    try {
      await onCommit(index,value,action);
      if(action==='log') setLastLogged({index,value});
      else if(lastLogged?.index===index) setLastLogged(null);
      setEditing(null);setEditDraft(null);
    } catch(error) {
      justLogged.current=false;
      setSaveError(error instanceof Error&&error.message.startsWith('This set')?error.message:'Could not save this set on this device.');
    } finally {
      writing.current=false;
    }
  }
  function submit(){
    if(!set||saving||writing.current)return;
    if(set.weight===null||!Number.isFinite(set.weight)||set.weight<0||set.weight>2000){setError({field:'weight',text:'Enter a valid '+(log.mode==='assistance'?'assistance':'weight')+' to log this set.'});weightRef.current?.focus();return;}
    if(!Number.isInteger(set.reps)||set.reps<1||set.reps>1000){setError({field:'reps',text:'Enter '+(exercise.timed?'seconds':'repetitions')+' from 1 to 1,000.'});repsRef.current?.focus();return;}
    setError(null);
    void saveSet(setIndex,set,log.sets[setIndex].done?'edit':'log');
  }
  const last=previousSetAt(previous,setIndex);
  const focusInput=(event:React.FocusEvent<HTMLInputElement>)=>event.currentTarget.select();
  return <>
    <div className="training-topline"><button className="exercise-picker" disabled={saving} onClick={()=>setPicker(true)}>Exercise {exerciseIndex+1} of {session.exercises.length}<ChevronRight size={18}/></button><button className="text-button" disabled={saving} onClick={onWarmup}>Warm-up</button></div>
    <section ref={exerciseRef} className="exercise-heading"><h2 className="exercise-icon-heading"><ExerciseIcon exercise={exercise} size={64}/><span>{log.name}</span></h2><p className="exercise-target">Target {prescription(exercise)}</p><p className="tempo-cue">Tempo {exercise.tempo??'Controlled'} · {rirTarget(exercise)}</p>{exercise.perSide&&<p className="per-side-cue">Complete both sides, then log one set.</p>}{/one dumbbell|one hand/i.test(exercise.note??'')&&<p className="per-side-cue">Weight is per hand.</p>}<div className="exercise-tools"><button className="text-button technique-link" aria-label="More exercise options" disabled={saving} onClick={()=>setMore(true)}>Technique & options<ChevronRight size={17}/></button><button className="text-button exercise-history-link" aria-label={`History for ${log.name}`} onClick={()=>setShowHistory(true)}>History<ChevronRight size={17}/></button></div></section>
    {set?<section className="focused-set" ref={setRef} tabIndex={-1} role="group" aria-label="Current working set"><div className="set-heading"><h3>{set.done?'Edit set':'Set'} {setIndex+1} <span>of {log.sets.length}</span></h3><span className="set-log-count"><Check className="set-log-check" size={14} aria-hidden="true" style={{visibility:done?'visible':'hidden'}}/>{done} logged</span></div><div className={'set-inputs '+(log.mode==='bodyweight'?'bodyweight-inputs':'')}>
      {log.mode==='bodyweight'?<div className="bodyweight-load"><span>Load</span><strong>Bodyweight</strong></div>:<label>{log.mode==='assistance'?'Assistance':'Weight'} ({unit})<input disabled={saving} ref={weightRef} type="number" min="0" max={fromKg(2000,unit)} step="any" inputMode="decimal" aria-label={`Set ${setIndex+1} ${log.mode==='assistance'?'assistance':'weight'} in ${unit}`} aria-invalid={error?.field==='weight'} aria-describedby={error?.field==='weight'?'set-error':undefined} value={set.weight===null?'':Math.round(fromKg(set.weight,unit)*100)/100} placeholder="—" onFocus={focusInput} onChange={e=>{changeSet({weight:e.target.value===''?null:Math.max(0,Math.min(2000,toKg(Number(e.target.value),unit)))});}}/></label>}
      <label>{exercise.timed?'Seconds':'Reps'}{exercise.perSide?' / side':''}<input disabled={saving} ref={repsRef} type="number" min="1" max="1000" step="1" inputMode="numeric" aria-label={`Set ${setIndex+1} ${exercise.timed?'seconds':'reps'}`} aria-invalid={error?.field==='reps'} aria-describedby={error?.field==='reps'?'set-error':undefined} value={set.reps||''} onFocus={focusInput} onChange={e=>{changeSet({reps:Math.max(0,Math.min(1000,Math.trunc(Number(e.target.value))))});}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submit();}}}/></label>
    </div>
      <div className="set-context">
        <div>{last&&<p>Last time · <strong>{amount(last)}{last.rir!==null?' · '+last.rir+' RIR':''}</strong></p>}
          {!set.done&&<p className="input-hint">Check suggested values before logging.</p>}</div>
        <RirInput label={`Set ${setIndex+1} RIR`} value={set.rir} onChange={rir=>changeSet({rir})} disabled={saving}/>
      </div>
      {exercise.timed&&<HoldStopwatch key={exercise.id+':'+setIndex} disabled={saving} onUse={reps=>changeSet({reps})}/>}
      {error&&<p className="form-error" id="set-error" role="alert">{error.text}</p>}
      {editing!==null&&<button className="text-button full-width" disabled={saving} onClick={()=>{setEditing(null);setEditDraft(null);setError(null);setSaveError('');}}>Cancel edit</button>}
      {editing===null&&setIndex<exercise.sets&&<button className="text-button" disabled={saving} onClick={()=>onSkip(setIndex,true)}>Skip set</button>}
    </section>:<section className="exercise-complete" ref={setRef} tabIndex={-1}>
      {skipped.length===0&&<span className="completion-mark"><Check className="set-log-check" size={24} aria-hidden="true"/></span>}
      <h3>{skipped.length?'Exercise reviewed':'Exercise complete'}</h3><p>{done} of {log.sets.length} sets logged{skipped.length>0&&' · '+skipped.length+' skipped'}</p>
    </section>}
    {saveError&&<div className="set-feedback" role="alert">{saveError} <button className="text-button" disabled={saving} onClick={()=>{if(retryAction==='submit')submit();else void saveSet(retryAction,log.sets[retryAction],'undo');}}>Retry</button></div>}
    {lastLogged&&!saveError&&<div className="set-feedback"><span role="status">{amount(lastLogged.value)} saved on this device</span>
      <button className="text-button" aria-label="Undo last set" disabled={saving} onClick={()=>void saveSet(lastLogged.index,lastLogged.value,'undo')}>Undo</button></div>}
    <button className="secondary full-width add-set" disabled={saving||log.sets.length>=MAX_SETS_PER_EXERCISE} aria-describedby={log.sets.length>=MAX_SETS_PER_EXERCISE?'set-limit':undefined} onClick={addSet}><Plus size={18}/>Add set</button>
    {log.sets.length>=MAX_SETS_PER_EXERCISE&&<p className="input-hint" id="set-limit">10-set limit reached for this exercise.</p>}
    <details className="logged-sets" open={showSets} onToggle={event=>setShowSets(event.currentTarget.open)}><summary>All sets <span>{done} of {log.sets.length} logged</span></summary><div>{log.sets.map((value,i)=><div className="logged-set" key={i}><span>Set {i+1}{i>=exercise.sets?' · Extra':''}<small>{value.done?amount(value):skipped.includes(i)?'Skipped':'Not logged'}</small></span><button className="text-button" disabled={saving} aria-label={'Edit set '+(i+1)} onClick={()=>{setEditing(i);setEditDraft({...log.sets[i]});setShowSets(true);setError(null);requestAnimationFrame(()=>setRef.current?.scrollIntoView({block:'nearest'}));}}>Edit</button>{value.done&&<button className="text-button" disabled={saving} aria-label={'Undo set '+(i+1)} onClick={()=>void saveSet(i,value,'undo')}>Undo</button>}{skipped.includes(i)&&<button className="text-button" disabled={saving} onClick={()=>onSkip(i,false)}>Undo skip</button>}{i>=exercise.sets&&i===log.sets.length-1&&!value.done&&<button className="text-button" disabled={saving} aria-label={'Remove extra set '+(i+1)} onClick={removeSet}>Remove</button>}</div>)}</div></details>
    <div className="exercise-navigation"><button className="text-button" disabled={saving||exerciseIndex===0} onClick={()=>onIndex(exerciseIndex-1)}><ChevronLeft size={18}/>Previous</button>{set&&<button className="text-button" disabled={saving} onClick={()=>lastExercise?onReview():onIndex(exerciseIndex+1)}>{lastExercise?'Review & finish':'Next exercise'}<ChevronRight size={18}/></button>}</div>
    <button className="text-button full-width" disabled={saving} onClick={onGuide}>Training guide</button>
    <div ref={dockRef} className="workout-dock">{rest&&<div inert={saving}>{rest}</div>}{onStartRest&&<button className="text-button" disabled={saving} onClick={onStartRest}>Start rest</button>}<button className="primary full-width" disabled={saving} onClick={set?submit:lastExercise?onReview:()=>onIndex(exerciseIndex+1)}>{saving?'Saving set…':set?((editing!==null&&log.sets[setIndex].done?'Save set ':'Log set ')+(setIndex+1)):lastExercise?'Review & finish':'Next exercise'}{set?<Check size={20}/>:<ChevronRight size={20}/>}</button></div>
    {picker&&<Modal variant="sheet" title="Exercises" onClose={()=>setPicker(false)}><div className="exercise-jump-list">{session.exercises.map((e,i)=><button aria-current={i===exerciseIndex?'step':undefined} className={i===exerciseIndex?'selected':''} key={e.id} onClick={()=>{onIndex(i);setPicker(false);}}><span className="exercise-order"><ExerciseIcon exercise={session.workout.exercises[i]}/><span className="row-number">{i+1}</span></span><span>{e.name}<small>{e.sets.filter(s=>s.done).length} of {e.sets.length} sets</small></span><ChevronRight size={18}/></button>)}</div></Modal>}
    {showHistory&&<Modal variant="sheet" title="Exercise history" onClose={()=>setShowHistory(false)}>
      <p className="history-exercise-name exercise-icon-heading"><ExerciseIcon exercise={exercise}/><span>{log.name}</span></p>
      {history.length?<><p className="input-hint">Latest {history.length} matching {history.length===1?'session':'sessions'} · same exercise variation</p>
        <div className="exercise-history-list">{history.map(entry=><section className="exercise-history-session" key={entry.sessionId}>
          <h3><time dateTime={entry.date}>{dateLabel(entry.date,{day:'numeric',month:'short',year:'numeric'})} · {new Date(entry.startedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</time></h3>
          <p className="input-hint">{entry.week!==undefined?`Week ${entry.week} · `:''}{entry.sets.length} logged {entry.sets.length===1?'set':'sets'}</p>
          <ol className="exercise-history-sets">{entry.sets.map(value=><li value={value.setNumber} key={value.setNumber}>
            <span>Set {value.setNumber}{value.setNumber>entry.exercise.sets&&<small>Extra</small>}</span>
            <span className="history-set-values"><strong>{entry.mode==='bodyweight'?'Bodyweight':`${number(fromKg(value.weight??0,unit))} ${unit}${entry.mode==='assistance'?' assistance':''}`} × {value.reps}{entry.exercise.timed?' sec':' reps'}{entry.exercise.perSide?' / side':''}</strong>{value.rir!==null&&<small>{value.rir} RIR</small>}</span>
          </li>)}</ol>
        </section>)}</div>
      </>:<p className="input-hint">No previous logged sets for this exercise variation yet.</p>}
    </Modal>}
    {more&&<Modal variant="sheet" title="Exercise options" onClose={()=>setMore(false)}><details className="options-details" open><summary>Technique & details</summary><p>{exercise.note??'Use controlled movement and a conservative working load.'}</p><p>{exercise.rest}s rest · {rirTarget(exercise)}</p><p>RIR means how many clean repetitions you could have performed after your set.</p>{exercise.supportCm!==null&&exercise.supportCm!==undefined&&<p>Support height: {exercise.supportCm} cm</p>}{exercise.role==='core'&&exercise.coreLevel&&<p>Core variation: {exercise.coreLevel}</p>}<p>Change exercise choices in Programme for future sessions.</p></details>
      <p className="exercise-icon-heading"><ExerciseIcon exercise={exercise}/><strong>{exercise.name}</strong></p><ExerciseDemo exercise={exercise}/>
      {onSwap&&done===0&&<button className="secondary full-width" onClick={()=>{setMore(false);onSwap();}}>Swap for this session</button>}
      <button className="secondary full-width" disabled={!previous} onClick={()=>onUpdate(s=>({...s,exercises:s.exercises.map((e,i)=>i===exerciseIndex?{...e,sets:e.sets.map((value,si)=>{const previousSet=previousSetAt(previous,si);return !value.done&&previousSet?{...value,weight:previousSet.weight,reps:previousSet.reps}:value;})}:e)}))}><RotateCcw size={18}/>Copy last session</button>
      <label className="field-label" htmlFor="exercise-note"><NotebookPen size={18}/>Exercise notes</label><textarea id="exercise-note" maxLength={2000} value={log.note} onChange={e=>patchLog({note:e.target.value})}/><label className="field-label" htmlFor="session-note">Session notes</label><textarea id="session-note" maxLength={2000} value={session.note} onChange={e=>onUpdate(s=>({...s,note:e.target.value}))}/>
      <button className="text-button full-width" onClick={()=>{setMore(false);onUrgent();}}>Back pain: urgent help</button><button className="danger-outline full-width mt" onClick={()=>{setMore(false);onDiscard();}}><Trash2 size={18}/>Discard workout</button>
    </Modal>}
  </>;
}


export function RirInput({label,value,onChange,disabled=false}:{label:string;value:number|null;onChange:(value:number|null)=>void;disabled?:boolean}) {
  return <label className="rir-input">RIR <small>reps left</small>
    <select aria-label={label} disabled={disabled} value={value??''} onChange={event=>onChange(event.target.value===''?null:Number(event.target.value))}>
      <option value="">Optional</option>
      {Array.from({length:11},(_,i)=><option key={i} value={i}>{i}</option>)}
    </select>
  </label>;
}

function HoldStopwatch({disabled,onUse}:{disabled:boolean;onUse:(seconds:number)=>void}) {
  const [started,setStarted]=useState<number|null>(null),[elapsed,setElapsed]=useState(0),[now,setNow]=useState(0);
  useEffect(()=>{
    if(started===null)return;
    const timer=setInterval(()=>setNow(Date.now()),200);
    return ()=>clearInterval(timer);
  },[started]);
  const seconds=Math.floor((elapsed+(started===null?0:Math.max(0,now-started)))/1000);
  function pause() {
    if(started!==null) setElapsed(elapsed+Date.now()-started);
    setStarted(null);
  }
  return <div className="hold-stopwatch" role="group" aria-label="Hold stopwatch">
    <span>Hold <strong>{seconds}s</strong></span>
    <button className="text-button" disabled={disabled} onClick={()=>{if(started!==null)pause();else{const time=Date.now();setNow(time);setStarted(time);}}}>{started!==null?'Pause hold':'Start hold'}</button>
    <button className="text-button" disabled={disabled||started===null&&!elapsed} onClick={()=>{setStarted(null);setElapsed(0);}}>Reset</button>
    <button className="text-button" disabled={disabled||!seconds} onClick={()=>{pause();onUse(Math.min(1000,seconds));}}>Use seconds</button>
  </div>;
}
