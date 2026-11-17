import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, Dumbbell, Plus, Download, Upload, Search, Trash2, Scale, TrendingUp, ArrowUpRight, CalendarDays, Footprints } from './icons';
import { WORKOUTS, DAY_NAMES, FIXED_WORKOUT_WEEK, fixedWorkoutForDay, weekEffort, workoutForDay, type Exercise, type Workout } from './data';
import { completeSession, sessionLabel, dateLabel, doneSets, fromKg, localDate, number, volume, bodyAverages, bodyGuidance, type BodyEntry, type Session, type Store, type Settings } from './model';
import { Empty, Modal } from './components';
import { BodyweightChart } from './body-chart';
import { trainingJourney, volumeDistribution } from './progress-data';
import { WeeklyChart, type TrainingRange } from './progress-charts';
import { motionPreference, useContentFade } from './motion';
import { MobilityGuide } from './technique-demo';
import { MuscleVolume } from './muscle-volume';
import { createTodayArtPlayback, TodayIllustration } from './today-art';
export { ExerciseDetails } from './programme-ui';
export function WeekPicker({day,onDay}:{day:number;onDay:(day:number)=>void}) {
  const stripRef=useRef<HTMLDivElement>(null),firstReveal=useRef(true);
  useLayoutEffect(()=>{
    const strip=stripRef.current;if(!strip)return;
    const preference=motionPreference();
    const stop=()=>strip.scrollTo({left:strip.scrollLeft,behavior:'instant'});
    const reveal=(smooth=false)=>{
      const selected=strip.querySelector<HTMLElement>('[aria-selected=true]');if(!selected)return;
      const bounds=strip.getBoundingClientRect(),button=selected.getBoundingClientRect();
      const delta=button.left<bounds.left+4||button.right>bounds.right-4?button.left-bounds.left-(bounds.width-button.width)/2:0;
      if(delta)strip.scrollTo({left:strip.scrollLeft+delta,behavior:smooth&&!preference.matches?'smooth':'instant'});
    };
    const onPreference=()=>{if(preference.matches){stop();reveal();}};
    reveal(!firstReveal.current);firstReveal.current=false;
    let initialSize=true;const observer=new ResizeObserver(()=>{if(initialSize){initialSize=false;return;}reveal();});observer.observe(strip);
    preference.addEventListener('change',onPreference);
    return()=>{observer.disconnect();preference.removeEventListener('change',onPreference);stop();};
  },[day]);
  return <div ref={stripRef} className="week-picker" role="tablist" aria-label="Weekly programme">{DAY_NAMES.map((name,i)=>{
    const label=workoutForDay((i+1)%7)?.name??'Rest';
    return <button key={name} id={'programme-day-'+i} aria-controls="programme-day-panel" role="tab" aria-label={name.slice(0,3)+' '+label} aria-selected={day===i} tabIndex={day===i?0:-1} onClick={()=>onDay(i)} onKeyDown={e=>{const next=e.key==='ArrowRight'?(i+1)%7:e.key==='ArrowLeft'?(i+6)%7:e.key==='Home'?0:e.key==='End'?6:null;if(next!==null){e.preventDefault();onDay(next);e.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus({preventScroll:true});}}}><span>{name.slice(0,3)}</span><strong>{label==='Active recovery'?'Rest':label}</strong></button>;
  })}</div>;
}
function RestDaySuggestions() {
  return <div className="rest-day-suggestions"><ul aria-label="Optional rest-day activities"><li>Mobility</li><li>Running</li><li>Walking</li></ul><MobilityGuide title="Mobility guide"/></div>;
}
function useTodayDate() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: number;
    const refresh = () => {
      const current = new Date();
      setNow(current.getTime());
      const midnight = new Date(current);
      midnight.setHours(24, 0, 0, 0);
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, midnight.getTime() - current.getTime());
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return new Date(now);
}

const isTrainingDay = (workout?: Workout): workout is Workout & {category: 'strength' | 'optional'} =>
  !!workout && workout.category !== 'recovery' && workout.exercises.length > 0;

const countLabel = (count: number, label: string) => `${count} ${label}${count === 1 ? '' : 's'}`;
const prescription = (workout: Workout) =>
  `${countLabel(workout.exercises.length, 'exercise')} · ${countLabel(workout.exercises.reduce((total, exercise) => total + exercise.sets, 0), 'working set')}`;

function TodayStatusGraphic({progress}: {progress?: number}) {
  const done = progress === undefined;
  return <span className={done ? 'today-graphic' : 'today-graphic today-active-ring'} aria-hidden="true">
    <svg viewBox="0 0 96 96" fill="none">
      <circle className="today-ring-track" cx="48" cy="48" r="43"/>
      <circle className="today-ring-inner" cx="48" cy="48" r="34"/>
      <circle className="today-ring-progress" cx="48" cy="48" r="43" pathLength="100" strokeDasharray="100 100" strokeDashoffset={100 - (progress ?? 100)}/>
      {done && <path className="today-check" d="M34 48l9 9 19-19" pathLength="1"/>}
    </svg>
  </span>;
}

function UpcomingDay({date, workout, onOpen}: {date: Date; workout?: Workout; onOpen: () => void}) {
  const dateValue = localDate(date);
  const training = isTrainingDay(workout);
  const Icon = training ? Dumbbell : Footprints;
  const summary = training ? workout.focus : workout?.category === 'recovery'
    ? 'Easy cardio and gentle mobility. Try hip switches or open books.'
    : 'Rest, or take an easy walk and do some gentle mobility.';
  return <button className="today-preview" onClick={onOpen}>
    <span className="today-preview-date"><span>Up next</span><time dateTime={dateValue}>{dateLabel(dateValue, {weekday:'long', day:'numeric', month:'short'})}</time></span>
    <span className="today-preview-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.65}/></span>
    <span className="today-preview-copy">
      <span className="today-preview-title"><strong>{workout?.name ?? 'Rest day'}</strong>{training && workout.optional && <span className="today-preview-optional">Optional</span>}</span>
      <span>{summary}</span>
      {training && <span>{prescription(workout)}</span>}
    </span>
    <ChevronRight className="today-preview-arrow" size={18} aria-hidden="true"/>
  </button>;
}

type TodayProps = {
  store: Store;
  handoffId?: string | null;
  onStart: (workout?: Workout) => void;
  onPlan: (day: number) => void;
  onDetail: (session: Session) => void;
  onBody: () => void;
  onProgress: () => void;
  onHistory: () => void;
};

export function Today({store, handoffId, onStart, onPlan, onDetail, onBody, onProgress, onHistory}: TodayProps) {
  const [registerIllustration] = useState(createTodayArtPlayback);
  const today = useTodayDate();
  const date = localDate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const options = store.programme.options;
  const recent = store.sessions.reduce<Session | undefined>((latest, session) => {
    if (session.date !== date || session.endedAt === undefined) return latest;
    if (!latest || session.endedAt > (latest.endedAt ?? 0) || (session.endedAt === latest.endedAt && session.startedAt > latest.startedAt)) return session;
    return latest;
  }, undefined);
  const active = store.active;
  const saved=active?undefined:recent;
  const scheduled=fixedWorkoutForDay(today.getDay(),options);
  const pendingSchedule=isTrainingDay(scheduled)&&!store.sessions.some(session=>
    session.date===date&&session.workoutId===scheduled.id&&completeSession(session));
  const workout=active?.workout??saved?.workout??scheduled;
  const training = isTrainingDay(workout);
  const totalSets = active?.exercises.reduce((total, exercise) => total + exercise.sets.length, 0) ?? 0;
  const activeSets = active ? doneSets(active) : 0;
  const complete=saved?completeSession(saved):false;
  const status=active?'In progress':saved?complete?'Done':'Partial workout saved':training?'Scheduled':'Recovery';
  const statusClass=active?'active':saved?complete?'done':'partial':training?'ready':'rest';
  const loggedExercises = saved?.exercises.filter(exercise => exercise.sets.some(set => set.done)).length ?? 0;
  const latestBody=[...store.body].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = store.settings.name.trim().split(/\s+/)[0];
  return <div className="today-layout">
    <div className="today-intro">
      <p>{greeting}{firstName && `, ${firstName}`}</p>
      <time className="today-date" dateTime={date}><CalendarDays size={15} aria-hidden="true"/>{dateLabel(date, {weekday:'short', day:'numeric', month:'long'})}</time>
    </div>
    <section className="today-card" data-state={statusClass} data-handoff={saved && saved.id === handoffId ? completeSession(saved) ? 'complete' : 'partial' : undefined} aria-label="Today’s workout">
      <div className={saved ? 'today-card-summary' : 'today-card-summary has-art'}>
        <div className="today-card-status" role="status" aria-atomic="true">
          <span className="badge">{status}</span>
          {!saved && !active && training && workout.optional && <span className="today-optional">Optional</span>}
        </div>
        <div className="today-card-copy">
          <h2>{workout?.name ?? 'Rest day'}</h2>
          {saved ? <p className="workout-meta">{countLabel(loggedExercises, 'exercise')} · {countLabel(doneSets(saved), 'set')} logged</p>
            : active ? <p className="workout-meta">{activeSets} of {totalSets} sets logged</p>
            : <><p className="workout-meta">{workout?.focus ?? 'Optional movement, at your own pace.'}</p>
              {training && <p className="today-prescription">{prescription(workout)}</p>}</>}
        </div>
        {saved ? complete?<TodayStatusGraphic/>:null : <span className="today-card-visual" aria-hidden="true">
          <TodayIllustration kind={training || active ? 'strength' : 'recovery'} register={registerIllustration}/>
          {active && <TodayStatusGraphic progress={activeSets / Math.max(totalSets, 1) * 100}/>}
        </span>}
      </div>
      {saved ? <>
        <div className="today-saved-actions">
          <button className="today-card-link" onClick={() => onDetail(saved)}>View workout<ArrowUpRight size={16} aria-hidden="true"/></button>
        </div>
        {pendingSchedule&&<button className="today-card-link" onClick={()=>onPlan(today.getDay())}>Scheduled today · {scheduled.name}<ChevronRight size={16}/></button>}
        {complete&&<UpcomingDay date={tomorrow} workout={fixedWorkoutForDay(tomorrow.getDay(), options)} onOpen={() => onPlan(tomorrow.getDay())}/>}
      </> : active || training ? <button className="primary hero-button" onClick={() => onStart(workout)}>{active ? `Resume ${active.workout.name}` : 'Start workout'}<ArrowRight size={20} aria-hidden="true"/></button>
        : <><RestDaySuggestions/><button className="today-card-link" onClick={() => onPlan(today.getDay())}>View your programme<ArrowUpRight size={16} aria-hidden="true"/></button></>}
      {active&&pendingSchedule&&active.workoutId!==scheduled.id&&<button className="today-card-link" onClick={()=>onPlan(today.getDay())}>Scheduled today · {scheduled.name}<ChevronRight size={16}/></button>}
    </section>
    <button className="today-history" onClick={onHistory}><strong>View workout history<ArrowRight size={17}/></strong></button>
    <button className="daily-card daily-body" onClick={onBody} aria-label="Log bodyweight">
      <span className="daily-icon" aria-hidden="true"><Scale size={21}/></span>
      <span className="daily-card-action" aria-hidden="true"><Plus size={18}/><span>Log weight</span></span>
      <span className="daily-card-copy">
        <span className="eyebrow">BODYWEIGHT</span>
        <strong>{latestBody ? <>{number(fromKg(latestBody.kg, store.settings.unit))}<small> {store.settings.unit}</small></> : 'Find your baseline'}</strong>
        <small>{latestBody ? 'Last recorded ' + dateLabel(latestBody.date) : 'Start with your first weigh-in'}</small>
      </span>
      <TodayIllustration kind="bodyweight" register={registerIllustration}/>
    </button>
    <button className="daily-card daily-progress" onClick={onProgress}>
      <span className="daily-icon" aria-hidden="true"><TrendingUp size={21}/></span>
      <span className="daily-card-action" aria-hidden="true"><ArrowUpRight size={20}/></span>
      <span className="daily-card-copy">
        <span className="eyebrow">YOUR PROGRESS</span>
        <strong>{store.sessions.length} <small>{store.sessions.length === 1 ? 'workout' : 'workouts'} logged</small></strong>
        <small>See the bigger picture</small>
      </span>
      <TodayIllustration kind="progress" register={registerIllustration}/>
    </button>
  </div>;
}
export function Plan({store,day,onDay,workout,onStart,onResume,onOptions,onWarmup,onGuide,onUrgent,onExercise}:{store:Store;day:number;onDay:(day:number)=>void;workout?:Workout;onStart:()=>void;onResume:()=>void;onOptions:()=>void;onWarmup:()=>void;onGuide:()=>void;onUrgent:()=>void;onExercise:(e:Exercise)=>void}) {
  const restDay=!workout||workout.category==='recovery'||!workout.exercises.length;
  const dayRef=useRef<HTMLDivElement>(null);useContentFade(dayRef,day,'panel');
  return <><div className="programme-heading"><p className="eyebrow">Weekly schedule</p>{workout?.optional&&<button className="text-button" onClick={onOptions}>Upper C settings</button>}</div><WeekPicker day={day} onDay={onDay}/>
    {store.active&&<aside className="active-banner"><p><strong>{store.active.workout.name} is in progress</strong><span>Finish or discard it before starting another session.</span></p><button className="secondary full-width" onClick={onResume}>Resume {store.active.workout.name}<ArrowRight size={18}/></button></aside>}
    <div ref={dayRef} id="programme-day-panel" role="tabpanel" aria-labelledby={'programme-day-'+day} tabIndex={0}><section className="plan-card"><p className="overline">{DAY_NAMES[day]}</p><h2>{restDay?'Rest day':workout?.name}</h2><p className="dialog-description">{restDay?'Optional movement, at your own pace.':workout?.focus}</p>{workout?.exercises.length?<p className="plan-effort">{workout.exercises.reduce((n,e)=>n+e.sets,0)} working sets · {weekEffort(FIXED_WORKOUT_WEEK)} reps in reserve</p>:null}
      {!restDay&&<button className="primary full-width" disabled={!!store.active} onClick={onStart}>Train this session today<ArrowRight size={18}/></button>}
      {!!workout?.exercises.length&&<p className="input-hint">The set and effort targets repeat each week. Your session is logged on the workout date you choose.</p>}
    </section>
    {!!workout?.exercises.length&&<section className="exercise-list" aria-label="Planned exercises">{workout.exercises.map((e,i)=><button className="exercise-row" key={e.slot??e.id} onClick={()=>onExercise(e)}><span className="row-number">{i+1}</span><span className="exercise-row-name">{e.name}<small>{e.sets} × {e.min===e.max?e.min:e.min+'–'+e.max}{e.timed?' sec':' reps'}{e.perSide?' / side':''} · {e.rest}s rest</small></span><ChevronRight size={18}/></button>)}</section>}
    {restDay&&<RestDaySuggestions/>}
    </div><details className="programme-resources"><summary>Preparation & guidance</summary><div className="guide-actions">{!!workout?.exercises.length&&<button className="secondary" onClick={onWarmup}>Warm-up</button>}<button className="secondary" onClick={onGuide}>Training guide</button></div><button className="text-button full-width" onClick={onUrgent}>Back pain: urgent help</button></details>
  </>;
}
export function History({store,onDetail,onStart}:{store:Store;onDetail:(s:Session)=>void;onStart:()=>void}) {
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('all');
  const [status,setStatus]=useState('all'),[from,setFrom]=useState(''),[to,setTo]=useState('');
  const currentYear=localDate().slice(0,4);
  const sessions=store.sessions.filter(s=>(filter==='all'||filter===s.workoutId)&&
    (status==='all'||completeSession(s)===(status==='complete'))&&(!from||s.date>=from)&&(!to||s.date<=to)&&[s.workout.name,s.date,s.note,sessionLabel(s),...s.exercises.map((e,i)=>e.name+' '+e.note+' '+(s.workout.exercises[i].setup??''))].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const dates=[...new Set(sessions.map(s=>s.date))].sort((a,b)=>b.localeCompare(a));
  return <><div className="filter-bar"><label className="search-field"><Search size={18}/><input aria-label="Search workout history" placeholder="Search workouts" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filter workout history" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All workouts</option>{WORKOUTS.filter(w=>w.category!=='recovery').map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
    <div className="history-filters">
      <label>Status<select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">All statuses</option><option value="complete">Complete</option><option value="partial">Partial</option></select></label>
      <label>From<input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
      <label>To<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    </div>
    {!dates.length?<Empty title={store.sessions.length?'No matching workouts':'No workouts yet'} text="Saved workouts appear here." action={<button className="primary" onClick={onStart}>View programme<ArrowRight size={17}/></button>}/>:<div className="history-list">{dates.map(date=>{const rows=sessions.filter(s=>s.date===date).sort((a,b)=>b.startedAt-a.startedAt);return <section key={date}><h2 className="date-heading">{dateLabel(date,{weekday:'short',day:'numeric',month:'short',year:date.startsWith(currentYear)?undefined:'numeric'})}</h2><div className="list-card">{rows.map(s=>{const label=sessionLabel(s);return <button className="history-row" key={s.id} onClick={()=>onDetail(s)}><span className="history-icon"><Dumbbell size={20}/></span><span className="history-main"><strong>{s.workout.name}</strong><small>{label && label+' · '}{completeSession(s)?'Complete':'Partial'}{rows.length>1&&' · '+new Date(s.startedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}<br/>{doneSets(s)} sets · {number(fromKg(volume(s),store.settings.unit),0)} {store.settings.unit} × reps volume</small></span><ChevronRight size={18}/></button>;})}</div></section>;})}</div>}
  </>;
}
export type ProgressMetric='volume'|'body';
export function ProgressDetail({store,segment,initialVolumeView,onBody,onEditBody,onDeleteBody,onStart}:{store:Store;segment:ProgressMetric;initialVolumeView?:'muscles';onBody:()=>void;onEditBody:(entry:BodyEntry)=>void;onDeleteBody:(id:string)=>void;onStart:()=>void}) {
  const [range,setRange]=useState<TrainingRange>('recent'),[deleteBody,setDeleteBody]=useState<string|null>(null),[nutrition,setNutrition]=useState(false);
  const [volumeView,setVolumeView]=useState<'trend'|'muscles'>(initialVolumeView??'trend');
  const journey=segment==='volume'?trainingJourney(store):null;
  const sessions=journey?.sessions.filter(session=>range==='all'||session.date>=journey.recentWeeks[0].date&&session.date<=localDate())??[];
  const unit=store.settings.unit,body=[...store.body].sort((a,b)=>a.date.localeCompare(b.date)),averages=bodyAverages(body);
  return <>
    {segment==='body'&&<><div className="progress-toolbar"><button className="small-button" onClick={onBody}><Plus size={16}/>Log bodyweight</button></div><section className="chart-panel bodyweight-panel"><h2>Bodyweight trend</h2><BodyweightChart body={body} unit={unit}/></section></>}
    {journey&&<>
      <div className="progress-toolbar"><select aria-label="Insights date range" value={range} onChange={event=>setRange(event.target.value as TrainingRange)}>
        <option value="recent">Last 8 weeks</option><option value="all">All time</option>
      </select></div>
      <div className="volume-detail-switch" role="group" aria-label="Volume views">
        <button className="small-button" aria-pressed={volumeView==='trend'} onClick={()=>setVolumeView('trend')}>Weekly trend</button>
        <button className="small-button" aria-pressed={volumeView==='muscles'} onClick={()=>setVolumeView('muscles')}>By muscle</button>
      </div>
      {volumeView==='muscles'?<MuscleVolume muscles={volumeDistribution(sessions).muscles} unit={unit} range={range}/>:
        journey.sessions.length?<WeeklyChart journey={journey} unit={unit} range={range} volumeOnly/>:
        <Empty title="No training volume yet" text="Log a workout to see weekly training volume." action={<button className="primary" onClick={onStart}>Explore programme</button>}/>}
    </>}
    {segment==='body'&&<><p className="recovery-callout">{bodyGuidance(store.body)}</p>{averages.length>0&&<><h2 className="body-weekly-heading">Weekly summaries</h2><section className="metric-records list-card" aria-label="Weekly bodyweight summaries">{averages.map(a=><div key={a.date}><span>Week of {dateLabel(a.date)}<small>{a.count} weigh-in{a.count===1?'':'s'}</small></span><strong>{number(fromKg(a.kg,unit))} {unit}</strong></div>)}</section></>}{body.length>0&&<section className="body-entries list-card" aria-label="Bodyweight entries">{[...body].reverse().map(b=><div key={b.id}><span>{dateLabel(b.date)}</span><strong>{number(fromKg(b.kg,unit))} {unit}</strong><button className="text-button" aria-label={'Edit bodyweight for '+b.date} onClick={()=>onEditBody(b)}>Edit</button><button className="icon-button" aria-label={'Delete bodyweight for '+b.date} onClick={()=>setDeleteBody(b.id)}><Trash2 size={17}/></button></div>)}</section>}<button className="summary-link" onClick={()=>setNutrition(true)}><span>Nutrition reference</span><ChevronRight size={17}/></button></>}
    {deleteBody&&<Modal variant="sheet" title="Delete this weigh-in?" onClose={()=>setDeleteBody(null)}><button className="danger full-width" onClick={()=>{onDeleteBody(deleteBody);setDeleteBody(null);}}>Delete entry</button><button className="text-button full-width" onClick={()=>setDeleteBody(null)}>Keep entry</button></Modal>}
    {nutrition&&<Modal variant="sheet" title="Nutrition reference" onClose={()=>setNutrition(false)}><ul className="guide-list"><li>Maintenance +200–300 kcal/day. No maintenance estimate is assumed.</li><li>At 60 kg: approximately 100–130 g protein/day, or 1.6–2.2 g/kg. Spread across three or four meals.</li><li>Sleep: 7–9 hours each night.</li></ul><p className="recovery-callout">{bodyGuidance(store.body)}</p><p className="input-hint">Programme references, not a personalized calorie prescription.</p></Modal>}
  </>;
}
export function SettingsScreen({settings,onChange,onExport,onImport}:{settings:Settings;onChange:(patch:Partial<Settings>)=>void;onExport:()=>void;onImport:()=>void}) {
  return <><section className="settings-group"><h2>Preferences</h2><div className="settings-card"><label className="name-field">What should we call you?<input className="text-input" maxLength={60} value={settings.name} placeholder="Your name" onChange={e=>onChange({name:e.target.value})}/></label><div className="setting-row"><span>Weight units</span><div className="segmented">{(['kg','lb'] as const).map(u=><button className={settings.unit===u?'selected':''} key={u} onClick={()=>onChange({unit:u})}>{u}</button>)}</div></div><div className="setting-row"><span>Automatic rest timer</span><button className={'switch '+(settings.autoRest?'on':'')} role="switch" aria-checked={settings.autoRest} aria-label="Automatic rest timer" onClick={()=>onChange({autoRest:!settings.autoRest})}><span/></button></div></div></section><section className="settings-group"><h2>Data</h2><div className="settings-card"><button className="settings-action" onClick={onExport}><Download size={19}/><span>Export backup</span><ChevronRight size={16}/></button><button className="settings-action" onClick={onImport}><Upload size={19}/><span>Import backup</span><ChevronRight size={16}/></button></div><p className="input-hint">Saved on this device first, then synced privately across your devices. Export a backup before clearing browser data. Version-4 backups include bodyweight, active and saved workouts, and historical programme and feedback data. Older backups cannot be restored.</p></section><section className="settings-group"><details className="settings-card install-details"><summary>Install & offline use</summary><p>iPhone: Safari → Share → Add to Home Screen.<br/>Android: browser menu → Install app.</p><p>Open once online to use the app offline.</p></details></section></>;
}
