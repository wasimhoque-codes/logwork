import { ExerciseIcon } from './exercise-icon';
import { useMemo, useRef, useState } from 'react';
import type { Unit } from './data';
import { ChevronLeft, ChevronRight, Search, Dumbbell } from './icons';
import { compareTrainingDates, dateLabel, fromKg, number, type Session, type Store } from './model';
import { exerciseChange, exerciseObservation, exerciseVolume, movementDays, movementSeries, movementSummary, type ExerciseChartMetric, type ExerciseObservation, type MovementDay, type MovementSeries } from './progress-data';
import { fullDate, MovementChart, movementMeasure, recentMovementChange, directoryChange, setLabel, setupLabel } from './progress-charts';
import { useContentFade } from './motion';

export type ExerciseTrendSelection = { date: string; range: 'recent' | 'all'; metric: ExerciseChartMetric; load?: number };

export type ExerciseGridState = { query: string; filter: string; role: string; sort:'recent'|'alphabetical'; focusKey?: string };
export const emptyExerciseGrid: ExerciseGridState = { query: '', filter: 'all', role: 'all', sort:'recent' };
const bestLabel = (s: MovementSeries) => s.exercise.timed ? 'Longest hold' : s.mode === 'assistance' ? 'Least assistance' : s.mode === 'bodyweight' ? 'Most reps' : 'Peak load';
function ComparisonHelp() {
  return <details className="progress-method">
    <summary>How comparisons work</summary>
    <p>Each date shows one set from the saved workouts for this exact exercise variation. Directory changes compare with the previous logged date.</p>
    <p>For loaded exercises, the chart uses the heaviest set. For assisted exercises, it uses the least assistance. When load or assistance ties, it uses the set with more reps. Bodyweight exercises use most reps and timed exercises use the longest hold.</p>
    <p>Volume adds up external load × reps. Per-hand and per-side values are recorded as entered. Estimated 1RM uses the highest estimate from sets of 1–12 reps on each date.</p>
  </details>;
}

function ExerciseMetrics({ series, days, unit }: { series: MovementSeries; days: MovementDay[]; unit: Unit }) {
  const { best } = movementSummary(series);
  const first = days[0].best;
  const latest = days.at(-1)!.best;
  return <details className="comparison-help exercise-comparisons">
    <summary>Compare with earlier workouts</summary>
    <dl className="exercise-metrics">
      <div><dt>First recorded date</dt><dd>{setLabel(first, unit)}</dd></div>
      <div><dt>{bestLabel(series)}</dt><dd>{setLabel(best, unit)}</dd></div>
      <div><dt>Latest recorded date</dt><dd>{setLabel(latest,unit)}</dd></div>
      <div><dt>Since first</dt><dd>{days.length > 1 ? recentMovementChange(series, first, latest, unit) : '—'}</dd></div>
    </dl>
  </details>;
}
function tileSetupLabel(series: MovementSeries, catalogue: MovementSeries[]) {
  const ex = series.exercise;
  const parts = [ex.supportCm != null ? `${ex.supportCm} cm support` : '', ex.coreLevel && ex.coreLevel !== 'Basic' ? ex.coreLevel : ''].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return catalogue.some(other => other.key !== series.key && other.exercise.name === ex.name)
    ? series.mode === 'bodyweight' ? 'Bodyweight' : series.mode === 'assistance' ? 'Assisted' : 'Standard setup' : '';
}
export function ExerciseGrid({ store, state, onState, onOpen, onStart }: {
  store: Store; state: ExerciseGridState; onState: (state: ExerciseGridState) => void; onOpen: (key: string) => void; onStart: () => void;
}) {
  const series = useMemo(() => movementSeries(store.sessions), [store.sessions]);
  const groups = [...new Set(series.map(item=>item.exercise.muscle))].sort();
  const query = state.query.trim().toLocaleLowerCase();
  const visible = series.filter(s => (state.filter === 'all' || s.exercise.muscle === state.filter)
    && (state.role === 'all' || s.exercise.role === state.role)
    && `${s.exercise.name} ${s.exercise.muscle} ${setupLabel(s)}`.toLocaleLowerCase().includes(query)).sort((a,b)=>
    (state.sort==='recent'?compareTrainingDates(b.records.at(-1)!.session,a.records.at(-1)!.session):0)
    ||a.exercise.name.localeCompare(b.exercise.name)||a.key.localeCompare(b.key));
  const change = (patch: Partial<ExerciseGridState>) => onState({ ...state, ...patch, focusKey: undefined });
  return <div className="exercise-dashboard">
    <div className="exercise-page-heading"><h2>Exercise progress</h2></div>
    {!series.length ? <div className="dashboard-empty"><span className="snapshot-icon"><Dumbbell size={22}/></span><h3>Your exercise progress starts here</h3><p>Save a workout with logged sets to see your exercises here.</p><button className="primary" onClick={onStart}>Explore programme</button></div> : <>
      <label className="exercise-search"><Search size={18}/><span className="sr-only">Search exercises</span><input type="search" value={state.query} placeholder="Search exercises" onChange={event => change({query:event.target.value})}/></label>
      <div className="directory-controls exercise-directory-controls">
        <select aria-label="Muscle group" value={state.filter} onChange={event=>change({filter:event.target.value})}>
          <option value="all">Muscle</option>{groups.map(group=><option key={group}>{group}</option>)}
        </select>
        <select aria-label="Sort exercises" value={state.sort} onChange={event=>change({sort:event.target.value as ExerciseGridState['sort']})}>
          <option value="recent">Recent</option><option value="alphabetical">A–Z</option>
        </select>
        <select aria-label="Exercise role" value={state.role} onChange={event=>change({role:event.target.value})}>
          <option value="all">Role</option><option value="main">Main</option><option value="accessory">Accessory</option><option value="core">Core</option>
        </select>
      </div>
      <p className="exercise-result-count" role="status">{visible.length} of {series.length} exercises</p>
      <div className="exercise-directory">{visible.map((s,index) => {
        const delta = exerciseChange(s);
        const latest = delta.latest;
        const setup = tileSetupLabel(s, series);
        return <article className="exercise-tile" key={s.key}>
          <button type="button" className="exercise-directory-row" data-exercise-key={s.key}
            aria-label={`View details for ${s.exercise.name}${setup ? ` · ${setup}` : ''}`}
            aria-describedby={`exercise-summary-${index}`}
            onClick={() => { onState({ ...state, focusKey: s.key }); onOpen(s.key); }}>
            <span className="directory-exercise"><ExerciseIcon exercise={s.exercise}/><span className="directory-name"><strong>{s.exercise.name}</strong><small>{[dateLabel(latest.session.date),setup].filter(Boolean).join(' · ')}</small></span></span>
            <span className="directory-result" id={`exercise-summary-${index}`}><strong>{setLabel(latest,store.settings.unit)}</strong>
              <small className="exercise-tile-change">{directoryChange(s,delta,store.settings.unit) || (!delta.previous?'1 recorded date':'')}</small></span>
            <ChevronRight size={17} aria-hidden="true"/>
          </button>
        </article>;
      })}</div>
      {!visible.length && <div className="dashboard-empty"><h3>No matching exercises</h3><button className="text-button" onClick={() => change({query:'',filter:'all',role:'all'})}>Clear filters</button></div>}
    </>}
  </div>;
}
function SelectedWorkout({ day, unit, index, count, onSelect, observation, metric, onWorkout }: {
  day: MovementDay; unit: Unit; observation:ExerciseObservation|undefined;metric:ExerciseChartMetric;index: number; count: number; onSelect: (index: number) => void; onWorkout: (session: Session) => void;
}) {
  const setsRef = useRef<HTMLDivElement>(null);
  useContentFade(setsRef, day.date, 'selection');
  const top=observation?.record.best;
  const external = day.best.log.mode === 'external' && !day.best.exercise.timed;
  const setCount = day.workouts.reduce((count, record) => count + record.sets.length, 0);
  const volume = external ? day.workouts.reduce((total, record) => total + exerciseVolume(record.exercise, record.log), 0) : 0;
  const estimate=external?exerciseObservation(day,'estimate'):undefined;

  return <section className="selected-workout" aria-label="Selected training date">
    <p className="sr-only" role="status" aria-atomic="true">{fullDate(day.date)}, {observation?setLabel(observation.record,unit):'no matching set'}.</p>
    <div className="selected-workout-heading">
      <div>
        <p className="eyebrow">{day.workouts.length === 1 ? 'Selected workout' : 'Selected training date'}</p>
        <h3><time dateTime={day.date}>{fullDate(day.date)}</time></h3>
      </div>
      {count > 1 && <div className="selected-workout-nav" role="group" aria-label="Browse training dates">
        <button type="button" className="icon-button" aria-label="Previous date" aria-disabled={index === 0}
          onClick={() => { if (index > 0) onSelect(index - 1); }}><ChevronLeft size={18} aria-hidden="true"/></button>
        <button type="button" className="icon-button" aria-label="Next date" aria-disabled={index === count - 1}
          onClick={() => { if (index < count - 1) onSelect(index + 1); }}><ChevronRight size={18} aria-hidden="true"/></button>
      </div>}
    </div>
    <div className="selected-workout-data" ref={setsRef}>
    {metric!=='top'&&!observation&&<p className="input-hint">{metric==='estimate'?'No eligible set on this date.':'No sets at the selected load or assistance on this date.'}</p>}
    {day.workouts.map(record => <section className="selected-workout-session" key={record.session.id}>
      <div className="selected-session-title"><h4>{record.session.workout.name}</h4><button type="button" className="text-button" data-detail-focus={`workout-${record.session.id}`} onClick={event=>{event.currentTarget.focus({preventScroll:true});onWorkout(record.session);}}>View workout<ChevronRight size={15}/></button></div>
      <ol className="selected-workout-sets">
        {record.log.sets.map((set, i) => {
          if (!set.done) return null;
          const isTop=record.session.id===observation?.record.session.id&&top===set;
          return <li key={i} value={i + 1} className={isTop ? 'is-top-set' : undefined}>
            <span className="workout-set-label">Set {i + 1}{isTop && <span>Chart set</span>}</span>
            <strong>{setLabel({...record,best:set},unit)}{set.rir!==null&&<small> · {set.rir} RIR</small>}</strong>
          </li>;
        })}
      </ol>
    </section>)}
    <dl className="selected-workout-stats">
      {external ? <>
        <div><dt>Total volume</dt><dd>{number(fromKg(volume, unit), 2)} {unit} × reps</dd></div>
        {estimate&&<div><dt>Estimated 1RM</dt><dd>{number(fromKg(estimate.value,unit))} {unit}
          <small className="estimate-source">{setLabel(estimate.record,unit)}{estimate.record.best.rir!==null?' · '+estimate.record.best.rir+' RIR':''}</small>
        </dd></div>}
      </> : <div><dt>Logged sets</dt><dd>{setCount}</dd></div>}
    </dl>
    </div>
  </section>;
}

function ExerciseTrend({ series, unit, initialDate, initialTrend, onWorkout }: { series: MovementSeries; unit: Unit; initialDate?: string; initialTrend?: ExerciseTrendSelection; onWorkout: (session: Session, trend: ExerciseTrendSelection) => void }) {
  const days = useMemo(() => movementDays(series), [series]);
  const [range, setRange] = useState<'recent' | 'all'>(()=>initialTrend?.range??(initialDate && days.slice(0,-5).some(day=>day.date===initialDate)?'all':'recent'));
  const [selectedDate,setSelectedDate]=useState<string|undefined>(initialTrend?.date??initialDate);
  const [metric,setMetric]=useState<ExerciseChartMetric>(initialTrend?.metric??'top');
  const [selectedLoad,setSelectedLoad]=useState<number|undefined>(initialTrend?.load);
  const loadMetric=!series.exercise.timed&&series.mode!=='bodyweight';
  const estimateMetric=loadMetric&&series.mode==='external';
  const loadLabel=series.mode==='assistance'?'Assistance':'Load';
  const loads=useMemo(()=>[...new Set(series.records.flatMap(record=>record.sets.flatMap(set=>set.weight===null?[]:[set.weight])))].sort((a,b)=>a-b),[series]);
  const latest = days.at(-1)!;
  const recent = days.slice(-5);
  const visible = range === 'recent' ? recent : days;
  const found = visible.findIndex(day => day.date === selectedDate);
  const index = found < 0 ? visible.length - 1 : found;
  const load=selectedLoad!==undefined&&loads.includes(selectedLoad)?selectedLoad:latest.best.best.weight??undefined;
  const observations=visible.map(day=>exerciseObservation(day,metric,load));
  const selected=observations[index];
  const earlierMetric=metric==='top'&&loadMetric?'reps':metric;
  const earlierLoad=metric==='top'?selected?.record.best.weight??undefined:load;
  const earlier=days.slice(0,days.findIndex(day=>day.date===visible[index].date)).reverse().flatMap(day=>{
    const observation=exerciseObservation(day,earlierMetric,earlierLoad);
    return observation?[{day,observation}]:[];
  })[0];
  const onSelect = (index: number) => setSelectedDate(visible[index].date);
  function selectRange(next: 'recent' | 'all') {
    setRange(next);
    if (next === 'recent' && !recent.some(day => day.date === selectedDate)) setSelectedDate(undefined);
  }

  return <>
    <section className="journey-chart-card exercise-trend" aria-label="Exercise trend">
      {(loadMetric||days.length>5)&&<div className="exercise-chart-controls">
        {loadMetric&&<>
        <label>Metric<select value={metric} onChange={event=>setMetric(event.target.value as ExerciseChartMetric)}>
          <option value="top">Top set</option><option value="reps">Reps at a given {loadLabel.toLowerCase()}</option>
          {estimateMetric&&<option value="estimate">Estimated 1RM</option>}
        </select></label>
        {metric==='reps'&&<label>{loadLabel}<select value={load} onChange={event=>setSelectedLoad(Number(event.target.value))}>
          {loads.map(value=><option value={value} key={value}>{number(fromKg(value,unit),2)} {unit}</option>)}
        </select></label>}
        </>}
        {days.length > 5 && <label>Date range<select aria-label="Chart date range" value={range} onChange={event=>selectRange(event.target.value as 'recent'|'all')}>
          <option value="recent">Latest five</option><option value="all">All history</option>
        </select></label>}
      </div>}
      <div className="exercise-latest" role="status">
        <span>{fullDate(visible[index].date)} · {metric==='estimate'?'Estimated 1RM':metric==='reps'?`Reps at selected ${loadLabel.toLowerCase()}`:movementMeasure(series,unit).split(' · ')[0]}</span>
        <strong>{selected ? metric==='estimate'?`${number(fromKg(selected.value,unit))} ${unit}`:setLabel(selected.record,unit):'No eligible set'}</strong>
        {earlier&&<small>Previous comparable date · {fullDate(earlier.day.date)} · {metric==='estimate'?`${number(fromKg(earlier.observation.value,unit))} ${unit}`:setLabel(earlier.observation.record,unit)}</small>}
      </div>
      <p className="exercise-trend-measure">
        <span>{metric==='estimate'?'Estimated 1RM · '+unit:metric==='reps'?'Best reps at selected '+loadLabel.toLowerCase():movementMeasure(series,unit)}</span>
        <span>{visible.length} {visible.length === 1 ? 'date' : 'dates'}</span>
      </p>
      <MovementChart series={series} days={visible} unit={unit} selected={index} onSelect={onSelect} metric={metric}
        observations={metric==='top'?undefined:observations}/>
      <SelectedWorkout day={visible[index]} unit={unit} index={index} count={visible.length} onSelect={onSelect} metric={metric} observation={observations[index]} onWorkout={session=>onWorkout(session,{date:visible[index].date,range,metric,load})}/>
    </section>
    <ExerciseMetrics series={series} days={days} unit={unit}/>
  </>;
}

export function ExerciseProgressDetail({ store, exerciseKey, initialDate, initialTrend, onBrowse, onWorkout }: {
  store: Store; exerciseKey?: string; initialDate?: string; initialTrend?: ExerciseTrendSelection; onBrowse: () => void; onWorkout: (session: Session, trend: ExerciseTrendSelection) => void;
}) {
  const series = useMemo(() => movementSeries(store.sessions), [store.sessions]);
  const selected = series.find(s => s.key === exerciseKey)
    ?? (!exerciseKey ? [...series].sort((a, b) => a.exercise.name.localeCompare(b.exercise.name))[0] : undefined);
  if (!selected) return <div className="dashboard-empty">
    <h2>{exerciseKey ? 'This exercise has no saved sets' : 'Your movement progress starts here'}</h2>
    <button className="text-button" onClick={onBrowse}>Browse exercises<ChevronRight size={16}/></button>
  </div>;

  return <div className="exercise-detail">
    {setupLabel(selected,false)&&<div className="exercise-detail-heading"><p>{setupLabel(selected,false)}</p></div>}
    <ExerciseTrend key={selected.key} series={selected} unit={store.settings.unit} initialDate={initialDate} initialTrend={initialTrend} onWorkout={onWorkout}/>
    <ComparisonHelp/>
  </div>;
}
