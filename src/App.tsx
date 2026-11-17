import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { LayoutDashboard, Layers, ChartNoAxesCombined, Settings2, ChevronLeft, Clock3, Pause, Play, X } from './icons';
import { fixedWorkoutForDay, fixedSetCount, variantsFor, SATURDAY_CORE, weekEffort, FIXED_WORKOUT_WEEK, type Exercise, type ExerciseChoice, type Workout } from './data';
import { savedRaw, newSession, localDate, doneSets, validateStore, previousExercise, exerciseHistory, sessionResume, restSeconds, markSetSkipped, prefillExercise, exerciseKey, normalizeExerciseKey, workoutDateError, type BodyEntry, type Store, type Session, type SetLog, type ResumeState } from './model';
import { Hawk, Modal, ModalTriggerContext } from './components';
import { Today, Plan, History, emptyHistory, ProgressDetail, SettingsScreen, type ProgressMetric } from './screens';
import type { TrainingRange } from './progress-charts';
import { movementSeries } from './progress-data';
import { ProgressOverview } from './progress';
import { ExerciseGrid, ExerciseProgressDetail, emptyExerciseGrid, type ExerciseGridState, type ExerciseTrendSelection } from './exercise-progress';
import { ExerciseDetails, OptionsModal, PreparationModal, TrainingGuide, UrgentHelp } from './programme-ui';
import { WorkoutScreen } from './workout';
import { ReviewWorkout, WorkoutSaved } from './flow';
import { BodyModal, SessionDetail } from './details';
import { useContentFade, useTabHighlight } from './motion';
import { useKeyboardViewport } from './keyboard-viewport';
import { useTrainingStore } from './persistence/use-training-store';
import { SyncPanel } from './persistence/sync-panel';
import { resolvePage, pageTitles, type Page } from './routes';
type DetailLocation = { scroll: number; focus?: string; trend?: ExerciseTrendSelection };
type DetailView = ({ kind:'workout'; id:string } | { kind:'exercise'; key:string; name:string; date:string }) & { location?: DetailLocation };
type Dialog='body'|'discard'|'restore'|'guide'|'urgent'|'warmup'|'options'|'knee-check'|null;
const nav=[{id:'today',label:'Today',icon:LayoutDashboard},{id:'programme',label:'Programme',icon:Layers},{id:'progress',label:'Progress',icon:ChartNoAxesCombined}] as const;
const progressTabs = [['progress','Overview'],['progress/exercises','Exercises'],['progress/history','History']] as const;
const hashExercise = () => normalizeExerciseKey(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('exercise') ?? undefined);
const progressMetrics:Partial<Record<Page,ProgressMetric>>={'progress/volume':'volume','progress/bodyweight':'body'};
export default function App() {
  const persistence=useTrainingStore();
  const {store,setStore,commitStore,blocked:readBlocked}=persistence;
  const [savingSet,setSavingSet]=useState(false);
  const setWrite=useRef(false);
  const warmupDrafts=useRef(new Map<string,boolean[]>());
  const [swapOpen,setSwapOpen]=useState(false),[pendingSwap,setPendingSwap]=useState<ExerciseChoice|null>(null);
  const [reviewSet,setReviewSet]=useState<number>();
  const [workoutDateDraft,setWorkoutDateDraft]=useState<{id:string;date:string}>();
  const [bodyToEdit,setBodyToEdit]=useState<BodyEntry|null>(null);
  const openBody=()=>{setBodyToEdit(null);setDialog('body');};
  const [storageError,setStorageError]=useState('');
  const [page,setPage]=useState<Page>(()=>resolvePage(window.location.hash)),[selectedDay,setSelectedDay]=useState((new Date().getDay()+6)%7);
  const [dialog,setDialog]=useState<Dialog>(null),[details,setDetails]=useState<DetailView[]>([]),[previewExercise,setPreviewExercise]=useState<Exercise|null>(null),[pendingImport,setPendingImport]=useState<Store|null>(null),[toast,setToast]=useState('');
  const navigationPage=useRef(page),freshSave=useRef<string|null>(null);
  const [savingSession,setSavingSession]=useState<Session|null>(null),[todayHandoff,setTodayHandoff]=useState<string|null>(null);
  const [progressSelection,setProgressSelection]=useState<{exerciseKey?:string;volumeView?:'muscles';range?:TrainingRange}>(()=>({exerciseKey:hashExercise()}));
  const [overviewRange,setOverviewRange]=useState<TrainingRange>('recent');
  const [historyFilters,setHistoryFilters]=useState(emptyHistory);
  const [exerciseGrid,setExerciseGrid]=useState<ExerciseGridState>({...emptyExerciseGrid});
  const [pendingWorkout,setPendingWorkout]=useState<Workout|null>(null),[kneeReady,setKneeReady]=useState(false),[savedId,setSavedId]=useState<string|null>(null),[now,setNow]=useState(Date.now());
  const uploadRef=useRef<HTMLInputElement>(null),settingsOrigin=useRef<Page>('today'),headingRef=useRef<HTMLHeadingElement>(null),mainRef=useRef<HTMLElement>(null),progressTabsRef=useRef<HTMLDivElement>(null),focusProgressTab=useRef(false);
  const contentRef=useRef<HTMLDivElement>(null),movementOrigin=useRef<Page>('progress/exercises');
  const scrollPositions=useRef(new Map<Page,number>()),restorePageScroll=useRef(false);
  const detailView=details.at(-1);
  const detail=detailView?.kind==='workout'?store.sessions.find(session=>session.id===detailView.id):undefined;
  const modalTriggerRef=useRef<HTMLElement>(null),detailTrigger=useRef<HTMLElement>(null);
  const progressTab=progressTabs.some(([id])=>id===page);
  useContentFade(mainRef,page,'page');
  useTabHighlight(progressTabsRef,page,progressTab&&persistence.ready);
  useKeyboardViewport();
  const alert=useCallback((message:string)=>setToast(message),[]),closeDialog=useCallback(()=>setDialog(null),[]),closeExercise=useCallback(()=>setPreviewExercise(null),[]);
  const scrollPage=useCallback((top:number)=>{
    if(contentRef.current)contentRef.current.scrollTop=top;
    window.scrollTo({top,behavior:'instant'});
  },[]);
  const trackScroll=useCallback(()=>{
    const scroll=contentRef.current?.dataset.dock==='true'&&window.matchMedia('(max-width:760px)').matches
      ? contentRef.current.scrollTop : window.scrollY;
    scrollPositions.current.set(navigationPage.current,scroll);
  },[]);
  const go=useCallback((next:Page,exerciseKey?:string,restore=false)=>{
    setTodayHandoff(null);
    if(next!=='workout/saved')freshSave.current=null;
    if(next!==navigationPage.current){
      trackScroll();
      if(next==='progress/movement')movementOrigin.current=navigationPage.current;
    }
    restorePageScroll.current=restore;
    navigationPage.current=next;
    setProgressSelection({exerciseKey});
    setPage(next);
    setDetails([]);
    window.location.hash=next+(exerciseKey?'?exercise='+encodeURIComponent(exerciseKey):'');
    if(!restore)scrollPage(0);
  },[scrollPage,trackScroll]);
  function openDetail(view:DetailView,trend?:ExerciseTrendSelection){
    if(!detailView)detailTrigger.current=modalTriggerRef.current;
    const modal=document.querySelector<HTMLElement>('.page-overlay .modal-page');
    const trigger=modal?.querySelector<HTMLElement>(':focus')??null;
    setDetails(stack=>stack.length
      ? [...stack.slice(0,-1),{...stack.at(-1)!,location:{scroll:modal?.scrollTop??0,focus:trigger?.dataset.detailFocus,trend}},view]
      : [view]);
  }
  const openWorkoutDetail=(session:Session,trend?:ExerciseTrendSelection)=>openDetail({kind:'workout',id:session.id},trend);
  const closeDetail=useCallback(()=>setDetails(stack=>stack.slice(0,-1)),[]);
  useLayoutEffect(()=>{
    if(!detailView){
      const trigger=detailTrigger.current;
      detailTrigger.current=null;
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
      return;
    }
    const location=detailView.location;
    if(!location)return;
    const overlay=document.querySelector<HTMLElement>('.page-overlay .modal-page');
    if(!overlay)return;
    overlay.scrollTop=location.scroll;
    [...overlay.querySelectorAll<HTMLElement>('[data-detail-focus]')].find(control=>control.dataset.detailFocus===location.focus)?.focus({preventScroll:true});
  },[detailView]);
  const updateSession=useCallback((fn:(s:Session)=>Session)=>setStore(s=>s.active&&!setWrite.current?{...s,active:fn(s.active)}:s),[]);
  const updateResume=useCallback((patch:Partial<ResumeState>)=>updateSession(s=>({...s,resume:{...sessionResume(s),...patch}})),[updateSession]);
  useEffect(()=>{
    const handler=()=>{
      const next=resolvePage(window.location.hash);
      if(navigationPage.current!==next){
        trackScroll();
        restorePageScroll.current=scrollPositions.current.has(next);
        setTodayHandoff(null);
        if(next!=='workout/saved')freshSave.current=null;
        setProgressSelection({exerciseKey:next==='progress/movement'?hashExercise():undefined});
        setDetails([]);
      }else if(next==='progress/movement'){
        setProgressSelection({exerciseKey:hashExercise()});
      }
      navigationPage.current=next;
      setPage(next);
      if(next!=='progress/movement'&&window.location.hash!=='#'+next)window.history.replaceState(null,'','#'+next);
    };
    handler();
    window.addEventListener('hashchange',handler);
    return()=>window.removeEventListener('hashchange',handler);
  },[trackScroll]);
  useLayoutEffect(()=>{
    const restore=restorePageScroll.current;
    restorePageScroll.current=false;
    scrollPage(restore?scrollPositions.current.get(page)??0:0);
    if(focusProgressTab.current){
      focusProgressTab.current=false;
      progressTabsRef.current?.querySelector<HTMLElement>('[aria-selected=true]')?.focus({preventScroll:true});
    }else if(page==='progress/exercises'&&restore&&exerciseGrid.focusKey){
      [...(mainRef.current?.querySelectorAll<HTMLButtonElement>('[data-exercise-key]')??[])].find(row=>row.dataset.exerciseKey===exerciseGrid.focusKey)?.focus({preventScroll:true});
    }else{
      headingRef.current?.focus({preventScroll:true});
    }
  },[page,scrollPage]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{if(!store.active)return;const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer);},[store.active?.id]);
  const active=store.active,resume=active?sessionResume(active):{exerciseIndex:0,restEnd:null,restPaused:null},remaining=restSeconds(resume,now);
  useEffect(()=>{if(active&&!savingSet&&resume.restEnd!==null&&resume.restEnd<=now){updateResume({restEnd:null});alert('Rest complete.');if('vibrate' in navigator)navigator.vibrate([100,60,100]);}},[active?.id,resume.restEnd,now,savingSet,updateResume,alert]);
  const savedSession=store.sessions.find(s=>s.id===savedId)??[...store.sessions].sort((a,b)=>(b.endedAt??0)-(a.endedAt??0))[0];
  useEffect(()=>{if((page==='workout'||page==='workout/review')&&!active&&!savingSession)go('today');if(page==='workout/saved'&&!savedSession)go('today');},[page,active,savingSession,savedSession,go]);
  const options=store.programme.options;
  const selectedWorkout=fixedWorkoutForDay((selectedDay+1)%7,options),unit=store.settings.unit;
  const currentIndex=resume.exerciseIndex,totalSets=active?.exercises.reduce((n,e)=>n+e.sets.length,0)??0,completedSets=active?doneSets(active):0;
  const focused=page.startsWith('workout'),metric=progressMetrics[page];
  function openWorkout(){setReviewSet(undefined);updateResume({origin:page==='programme'?'programme':'today'});go('workout');}
  function start(w?:Workout) {
    if(readBlocked){alert('Restore a valid backup to enable saving.');settingsOrigin.current=page;go('settings');return;}
    if(active){if(page==='today')openWorkout();return;}
    if(!w)return;
    if(w.category==='recovery'||!w.exercises.length)return;
    if(w.exercises.some(e=>e.id==='p16-supported-knee-raise')){setPendingWorkout(w);setKneeReady(false);setDialog('knee-check');return;}
    beginWorkout(w);
  }
  function beginWorkout(w:Workout){
    setNow(Date.now());
    const key=w.id+'|'+localDate(), warmup=warmupDrafts.current.get(key);
    void setStore(s=>{
      const session=newSession(w,s);
      session.resume={...sessionResume(session),origin:page==='programme'?'programme':'today'};
      if(warmup) session.warmup=warmup;
      return {...s,active:session};
    }).then(()=>warmupDrafts.current.delete(key)).catch(()=>{});
    closeDialog();
    go('workout');
  }
  function updateSet(si:number,patch:Partial<SetLog>) {
    updateSession(s=>({...s,exercises:s.exercises.map((e,i)=>i===currentIndex?{...e,
      sets:e.sets.map((set,j)=>j===si?{...set,...patch}:set)}:e)}));
  }
  async function commitSet(index:number,values:SetLog,action:'log'|'edit'|'undo') {
    if(!active||setWrite.current) throw new Error('A set is already being saved.');
    const expected=active.exercises[currentIndex].sets[index];
    const key=exerciseKey(active.workout.exercises[currentIndex],active.exercises[currentIndex].mode);
    setWrite.current=true;
    setSavingSet(true);
    try {
      await commitStore(store=>{
        const session=store.active;
        const exercise=session?.workout.exercises[currentIndex],log=session?.exercises[currentIndex];
        const set=log?.sets[index];
        if(!session||session.id!==active.id||!exercise||!log||exerciseKey(exercise,log.mode)!==key||
          !set||set.done!==(action!=='log')||(set.done&&(set.reps!==expected.reps||set.weight!==expected.weight||set.rir!==expected.rir))) {
          throw new Error('This set has changed. Check the latest workout before retrying.');
        }
        const base=action==='undo'?session:markSetSkipped(session,currentIndex,index,false);
        const exercises=base.exercises.map((entry,i)=>i!==currentIndex?entry:{...entry,sets:entry.sets.map((row,j)=>
          j===index?action==='undo'?{...row,done:false}:{...values,done:true}:
          action==='log'&&j>index&&row.weight===null?{...row,weight:values.weight}:row)});
        const resume=sessionResume(base);
        if(action==='log') {
          const allDone=exercises.every((entry,i)=>entry.sets.every((row,j)=>row.done||base.resume?.skippedSets?.[i]?.includes(j)));
          return {...store,active:{...base,exercises,resume:{...resume,
            restEnd:store.settings.autoRest&&!allDone?Date.now()+exercise.rest*1000:null,restPaused:null}}};
        }
        return {...store,active:{...base,exercises}};
      });
      setNow(Date.now());
      if(action==='log'&&'vibrate' in navigator)navigator.vibrate(30);
    } finally {
      setWrite.current=false;
      setSavingSet(false);
    }
  }
  async function finish(date:string) {
    if(!active||!completedSets||savingSession||setWrite.current||workoutDateError(active,date)) return;
    setWrite.current=true;
    setSavingSession(active);
    try {
      await commitStore(s=>{
        if(s.active?.id!==active.id||!doneSets(s.active)) throw new Error('The active workout changed.');
        const completed={...s.active,date,endedAt:Date.now(),resume:{...sessionResume(s.active),restEnd:null,restPaused:null}};
        return {...s,sessions:[...s.sessions,completed],active:null};
      });
      freshSave.current=active.id;
      setSavedId(active.id);
      go('workout/saved');
    } catch {
      alert('Could not save the workout on this device. Try again.');
    } finally {
      setWrite.current=false;
      setSavingSession(null);
    }
  }
  async function swapForSession(choice:ExerciseChoice) {
    if(!active||setWrite.current) return;
    const original=active.workout.exercises[currentIndex];
    const variant=variantsFor(original).find(exercise=>exercise.id===choice.variantId);
    if(!variant) return;
    try {
      await commitStore(store=>{
        const session=store.active;
        const current=session?.workout.exercises[currentIndex];
        if(!session||session.id!==active.id||session.workout.prescriptionMode!=='fixed'||!current||
          exerciseKey(current)!==exerciseKey(original)||session.exercises[currentIndex].sets.some(set=>set.done)) {
          throw new Error('This exercise has changed.');
        }
        const spec={...variant,slot:original.slot,
          sets:original.slot==='optional:core'?variant.sets:fixedSetCount(variant,!!session.workout.optional,session.workout.exercises[0].sets===2),
          rir:variant.role==='core'?'—':weekEffort(FIXED_WORKOUT_WEEK),supportCm:choice.supportCm,coreLevel:choice.coreLevel};
        const resume=sessionResume(session),skippedSets={...resume.skippedSets};
        delete skippedSets[currentIndex];
        const log={...prefillExercise(spec,store.sessions),note:session.exercises[currentIndex].note};
        return {...store,active:{...session,resume:{...resume,skippedSets},
          workout:{...session.workout,exercises:session.workout.exercises.map((exercise,i)=>i===currentIndex?spec:exercise)},
          exercises:session.exercises.map((exercise,i)=>i===currentIndex?log:exercise)}};
      });
      setSwapOpen(false);
      setPendingSwap(null);
      closeDialog();
      alert('Exercise changed for this workout.');
    } catch {
      alert('Could not save the substitution. Check the current exercise and try again.');
    }
  }
  function returnToToday() {
    const handoff = freshSave.current;
    go('today');
    setTodayHandoff(handoff);
  }
  function downloadBackup() {let backup=JSON.stringify(store,null,2);if(readBlocked){try{backup=savedRaw()??backup;}catch{/* Keep in-memory data available. */}}const url=URL.createObjectURL(new Blob([backup],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='gym-hawk-backup-'+localDate()+'.json';link.click();URL.revokeObjectURL(url);alert('Backup downloaded.');}
  async function importBackup(file?:File) {if(!file)return;try{if(file.size>15*1024*1024)throw new Error('Choose a backup smaller than 15 MB.');setPendingImport(validateStore(JSON.parse(await file.text())));setDialog('restore');}catch(error){alert(error instanceof Error?error.message:'Could not read this backup.');}if(uploadRef.current)uploadRef.current.value='';}
  const changeIndex=(exerciseIndex:number)=>{setReviewSet(undefined);updateResume({exerciseIndex});window.scrollTo({top:0,behavior:'instant'});};
  const saveHistory=(session:Session)=>commitStore(s=>{
    if(!s.sessions.some(record=>record.id===session.id))throw new Error('This workout was removed.');
    return {...s,sessions:s.sessions.map(record=>record.id===session.id?session:record)};
  });
  function back(){if(page==='settings')go(settingsOrigin.current);else if(page==='workout')go(active?.resume?.origin??'today');else if(page==='workout/review')go('workout');else if(page==='progress/movement')go(movementOrigin.current,undefined,true);else go('progress',undefined,true);}
  const progressDetail=!!metric||page==='progress/movement';
  const backVisible=page==='settings'||!!metric||page==='progress/movement'||page==='workout'||page==='workout/review';
  const rest=(resume.restEnd!==null||resume.restPaused!==null)?<div className="rest-timer" role="group" aria-label="Rest timer"><Clock3 size={20}/><div><span>{resume.restPaused!==null?'Paused':'Rest'}</span><strong aria-live="off">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong></div><button className="icon-button" aria-label={resume.restPaused!==null?'Resume rest timer':'Pause rest timer'} onClick={()=>{if(resume.restPaused!==null){updateResume({restEnd:Date.now()+resume.restPaused*1000,restPaused:null});setNow(Date.now());}else updateResume({restPaused:remaining,restEnd:null});}}>{resume.restPaused!==null?<Play size={18}/>:<Pause size={18}/>}</button><button className="small-button" aria-label="Add 30 seconds rest" onClick={()=>resume.restPaused!==null?updateResume({restPaused:Math.min(86400,resume.restPaused+30)}):updateResume({restEnd:Math.min(Date.now()+86400000,(resume.restEnd??Date.now())+30000)})}>+30s</button><button className="icon-button" aria-label="Skip rest timer" onClick={()=>updateResume({restEnd:null,restPaused:null})}><X size={20}/></button></div>:undefined;
  const warmupKey=selectedWorkout?.id+'|'+localDate();
  const movementName=page==='progress/movement'?movementSeries(store.sessions).find(series=>series.key===progressSelection.exerciseKey)?.exercise.name:undefined;
  if(!persistence.ready)return <main className="app-loading" role="status">Opening Gym Hawk…</main>;
  return <ModalTriggerContext.Provider value={modalTriggerRef}><div data-page={page} onClickCapture={event=>{
    // Safari can activate a button without moving focus to it.
    const trigger=event.target instanceof Element?event.target.closest<HTMLElement>('button, a[href]'):null;
    if(trigger&&!trigger.closest('.modal-overlay'))modalTriggerRef.current=trigger;
  }} className={'app-shell '+(focused?'workout-shell':'')+' '+(page==='workout/review'?'review-shell':'')}><div ref={contentRef} className="app-content" data-dock={progressTab} inert={!!detailView}><header className="app-header">{backVisible?<button className="icon-button" disabled={savingSet||page==='workout/review'&&!!savingSession} aria-label={page==='workout/review'?'Back to workout':page==='workout'?'Leave workout':'Go back'} onClick={back}><ChevronLeft size={23}/></button>:<span className="brand-mark"><Hawk size={24}/></span>}<div className="header-heading"><h1 ref={headingRef} tabIndex={-1}>{page==='workout'?active?.workout.name??'Workout':movementName??pageTitles[page]}</h1>{page==='workout'&&<p className="session-meta">{completedSets} of {totalSets} sets · {Math.max(0,Math.floor((now-(active?.startedAt??now))/60000))} min elapsed</p>}<SyncPanel persistence={persistence} actions={page==='settings'} compact={progressTab||progressDetail}/></div>{page==='workout'?<button className="small-button" disabled={savingSet} aria-label="Review and finish workout" onClick={()=>go('workout/review')}>Finish</button>:!focused&&!progressDetail&&page!=='settings'?<button className="icon-button" aria-label="Open settings" onClick={()=>{settingsOrigin.current=page;go('settings');}}><Settings2 size={21}/></button>:null}</header>
    {(storageError||persistence.error)&&<div className="storage-error" role="alert">{storageError||persistence.error}<button onClick={downloadBackup}>Export data</button></div>}<main ref={mainRef}>
      {page==='today'&&<Today handoffId={todayHandoff} onProgress={()=>go('progress')} onHistory={()=>go('progress/history')} store={store} onStart={workout=>active?openWorkout():start(workout)} onDetail={openWorkoutDetail} onPlan={day=>{setSelectedDay((day+6)%7);go('programme');}} onBody={openBody}/>}
      {page==='programme'&&<Plan store={store} day={selectedDay} onDay={setSelectedDay} workout={selectedWorkout} onStart={()=>start(selectedWorkout)} onResume={openWorkout} onOptions={()=>setDialog('options')} onWarmup={()=>setDialog('warmup')} onGuide={()=>setDialog('guide')} onUrgent={()=>setDialog('urgent')} onExercise={setPreviewExercise}/>}
      {progressTab&&<><div ref={progressTabsRef} className="progress-switch" role="tablist" aria-label="Progress views">{progressTabs.map(([id,label],index)=><button key={id} id={'progress-tab-'+index} aria-controls="progress-panel" role="tab" aria-selected={page===id} tabIndex={page===id?0:-1} onClick={()=>{if(page!==id){setExerciseGrid(s=>({...s,focusKey:undefined}));focusProgressTab.current=true;go(id as Page,undefined,true);}}} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%progressTabs.length:event.key==='ArrowLeft'?(index+progressTabs.length-1)%progressTabs.length:event.key==='Home'?0:event.key==='End'?progressTabs.length-1:null;if(next!==null){event.preventDefault();if(next!==index){setExerciseGrid(s=>({...s,focusKey:undefined}));focusProgressTab.current=true;go(progressTabs[next][0],undefined,true);}}}}>{label}</button>)}</div><div id="progress-panel" role="tabpanel" aria-labelledby={'progress-tab-'+progressTabs.findIndex(([id])=>id===page)} tabIndex={0}>
        {page==='progress'?<ProgressOverview store={store} range={overviewRange} onRange={setOverviewRange} onGo={go} onBody={openBody} onVolume={range=>{go('progress/volume');setProgressSelection({volumeView:'muscles',range});}}/>:page==='progress/exercises'?<ExerciseGrid store={store} state={exerciseGrid} onState={setExerciseGrid} onOpen={key=>go('progress/movement',key)} onStart={()=>go('programme')}/>:<History store={store} filters={historyFilters} onFilters={setHistoryFilters} onDetail={openWorkoutDetail} onStart={()=>go('programme')}/>}
      </div></>}
      {page==='progress/movement'?<ExerciseProgressDetail store={store} exerciseKey={progressSelection.exerciseKey} onWorkout={openWorkoutDetail} onBrowse={()=>go('progress/exercises')}/>:metric&&<ProgressDetail key={metric} store={store} segment={metric} initialVolumeView={progressSelection.volumeView} initialRange={progressSelection.range} onBody={openBody} onEditBody={entry=>{setBodyToEdit(entry);setDialog('body');}} onDeleteBody={id=>setStore(s=>({...s,body:s.body.filter(b=>b.id!==id)}))} onStart={()=>go('programme')}/>}
      {page==='settings'&&<SettingsScreen settings={store.settings} onChange={patch=>setStore(s=>({...s,settings:{...s.settings,...patch}}))} onExport={downloadBackup} onImport={()=>uploadRef.current?.click()}/>}
      {page==='workout'&&active&&<WorkoutScreen key={active.id} session={active} exerciseIndex={currentIndex} unit={unit} saving={savingSet} initialSet={reviewSet} previous={previousExercise(store.sessions,active.workout.exercises[currentIndex],active.exercises[currentIndex].mode)} history={exerciseHistory(store.sessions,active,currentIndex)} onIndex={changeIndex} onSet={updateSet} onCommit={commitSet}
        onSkip={(set,skip)=>updateSession(s=>markSetSkipped(s,currentIndex,set,skip))}
        onSwap={active.workout.prescriptionMode==='fixed'&&variantsFor(active.workout.exercises[currentIndex]).length>1?()=>setSwapOpen(true):undefined}
        onStartRest={!store.settings.autoRest&&!rest?()=>{updateResume({restEnd:Date.now()+active.workout.exercises[currentIndex].rest*1000,restPaused:null});setNow(Date.now());}:undefined} onUpdate={updateSession} onDiscard={()=>setDialog('discard')} onGuide={()=>setDialog('guide')} onUrgent={()=>setDialog('urgent')} onWarmup={()=>setDialog('warmup')} onReview={()=>go('workout/review')} rest={rest}/>}
      {page==='workout/review'&&(active||savingSession)&&<ReviewWorkout session={(active??savingSession)!} saving={!!savingSession}
        date={workoutDateDraft?.id===(active??savingSession)!.id?workoutDateDraft.date:(active??savingSession)!.date}
        onDate={date=>setWorkoutDateDraft({id:(active??savingSession)!.id,date})} onUpdate={updateSession} onSave={finish} onContinue={()=>{setReviewSet(undefined);go('workout');}} onJump={(index,set)=>{changeIndex(index);setReviewSet(set);go('workout');}}/>}
      {page==='workout/saved'&&savedSession&&<WorkoutSaved session={savedSession} animate={freshSave.current===savedSession.id} onToday={returnToToday} onView={()=>openWorkoutDetail(savedSession)}/>}
    </main></div>{!focused&&<nav inert={!!detailView} className="bottom-nav" aria-label="Main navigation"><div className="nav-brand"><span><Hawk size={27}/></span><strong>Gym Hawk<small>YOUR TRAINING SPACE</small></strong></div><p className="nav-caption">WORKSPACE</p>{nav.map(item=><button key={item.id} aria-current={page===item.id||item.id==='progress'&&page.startsWith('progress/')?'page':undefined} onClick={()=>go(item.id)}><item.icon size={22}/><span>{item.label}</span></button>)}<div className="nav-spacer"/><button className="nav-settings" aria-current={page==='settings'?'page':undefined} onClick={()=>{settingsOrigin.current=page;go('settings');}}><Settings2 size={21}/><span>Settings</span></button></nav>}
    {toast&&!dialog&&!detailView&&!previewExercise&&<div className="toast" role="status"><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={18}/></button></div>}
    <input type="file" ref={uploadRef} accept="application/json,.json" hidden aria-label="Import backup file" onChange={e=>void importBackup(e.target.files?.[0])}/>
    {dialog==='body'&&<BodyModal unit={unit} entry={bodyToEdit??undefined} onClose={closeDialog} onSave={async(date,kg)=>{
      await setStore(s=>{
        if(bodyToEdit&&s.body.some(entry=>entry.date===date&&entry.id!==bodyToEdit.id)) throw new Error('A weigh-in already exists for this date.');
        const existing=s.body.find(entry=>entry.date===date);
        return {...s,body:[...s.body.filter(entry=>entry.date!==date&&entry.id!==bodyToEdit?.id),{id:bodyToEdit?.id??existing?.id??crypto.randomUUID(),date,kg}]};
      });
      closeDialog();
      alert('Bodyweight saved.');
    }}/>}
    {dialog==='knee-check'&&(pendingSwap||pendingWorkout)&&<Modal variant="sheet" title="Optional core skill" onClose={()=>{setPendingSwap(null);closeDialog();}}><p className="dialog-description">Supported knee raises are optional. Use them only when symptom-free and able to avoid swinging or excessive spinal movement.</p><label className="check-line"><input type="checkbox" checked={kneeReady} onChange={e=>setKneeReady(e.target.checked)}/><span>I meet these conditions for today’s session.</span></label><button className="primary full-width" disabled={!kneeReady} onClick={()=>pendingSwap?void swapForSession(pendingSwap):beginWorkout(pendingWorkout!)}>{pendingSwap?'Use knee raises this session':'Start with knee raises'}</button><button className="secondary full-width mt" onClick={()=>{
      if(pendingSwap){void swapForSession({variantId:SATURDAY_CORE['dead-bug'].id,supportCm:null,coreLevel:'Basic'});return;}
      const adjusted=structuredClone(pendingWorkout!),ex=SATURDAY_CORE['dead-bug'];
      adjusted.exercises[adjusted.exercises.length-1]={...ex,supportCm:null,coreLevel:'Basic'};
      beginWorkout(adjusted);
    }}>Use dead bugs this session</button></Modal>}
    {dialog==='discard'&&<Modal variant="sheet" title="Discard this workout?" onClose={closeDialog}><p className="dialog-description">This removes the active session and its logged sets.</p><button className="danger full-width" onClick={()=>{setStore(s=>({...s,active:null}));closeDialog();go('today');}}>Discard workout</button><button className="text-button full-width" onClick={closeDialog}>Keep workout</button></Modal>}
    {dialog==='restore'&&pendingImport&&<Modal variant="sheet" title="Restore your backup?" onClose={closeDialog}><p className="dialog-description">{pendingImport.sessions.length} workouts and {pendingImport.body.length} weigh-ins. This replaces current data.</p><button className="secondary full-width" onClick={downloadBackup}>Back up current data first</button><button className="primary full-width mt" onClick={()=>{void persistence.restore(pendingImport).then(()=>{setPendingImport(null);setNow(Date.now());closeDialog();alert('Backup restored locally.');}).catch(()=>setStorageError('Could not restore locally. Your previous data is retained.'));}}>Replace data and restore</button></Modal>}
    {dialog==='options'&&<OptionsModal options={options} onClose={closeDialog} onSave={patch=>{setStore(s=>({...s,programme:{...s.programme,options:{...s.programme.options,...patch}}}));closeDialog();}}/>}
    {dialog==='warmup'&&<PreparationModal kind="warmup" session={page==='workout'?active:null} previewChecks={warmupDrafts.current.get(warmupKey)} onClose={closeDialog} onChange={warmup=>{if(page==='workout')updateSession(s=>({...s,warmup}));else warmupDrafts.current.set(warmupKey,warmup);}}/>}
    {dialog==='guide'&&<TrainingGuide onClose={closeDialog}/>}{dialog==='urgent'&&<UrgentHelp onClose={closeDialog}/>}
    {swapOpen&&active&&<ExerciseDetails sessions={store.sessions} unit={unit} exercise={active.workout.exercises[currentIndex]} forSession onClose={()=>setSwapOpen(false)}
      onSave={choice=>{
        if(choice.variantId==='p16-supported-knee-raise'&&active.workout.exercises[currentIndex].id!==choice.variantId){
          setSwapOpen(false);setPendingSwap(choice);setKneeReady(false);setDialog('knee-check');
        }else void swapForSession(choice);
      }}/>}
    {previewExercise&&<ExerciseDetails sessions={store.sessions} unit={unit} exercise={previewExercise} choice={store.programme.options.choices[previewExercise.slot!]} onClose={closeExercise} onSave={choice=>{const key=previewExercise.slot!;setStore(s=>({...s,programme:{...s.programme,options:{...s.programme.options,choices:{...s.programme.options.choices,[key]:choice},...(key==='optional:core'?{saturdayCore:choice.variantId==='p16-dead-bug'?'dead-bug' as const:'knee-raise' as const}:{})}}}));closeExercise();alert('Exercise choice saved for future workouts.');}}/>}
    {detail&&<SessionDetail key={`workout-${details.length}-${detail.id}`} session={detail} unit={unit}
      expandFromHistory={page==='progress/history'&&details.length===1&&!detailView?.location}
      onExercise={(key,name,date)=>openDetail({kind:'exercise',key,name,date})} onClose={closeDetail}
      onSave={async session=>{await saveHistory(session);alert('Workout updated.');}}
      onDelete={async()=>{await commitStore(s=>({...s,sessions:s.sessions.filter(x=>x.id!==detail.id)}));closeDetail();alert('Workout deleted.');}}
      sessions={store.sessions}/>}
    {detailView?.kind==='workout'&&!detail&&<Modal variant="page" title="Workout unavailable" onClose={closeDetail}><p>This workout is no longer in your history.</p></Modal>}
    {detailView?.kind==='exercise'&&<Modal key={`exercise-${details.length}-${detailView.key}`} variant="page" title={detailView.name} onClose={closeDetail}>
      <ExerciseProgressDetail store={store} exerciseKey={detailView.key} initialDate={detailView.date} initialTrend={detailView.location?.trend} onBrowse={closeDetail} onWorkout={openWorkoutDetail}/>
    </Modal>}
  </div></ModalTriggerContext.Provider>;
}
