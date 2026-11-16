import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Unit } from './data';
import { ChevronLeft, ChevronRight, Search, Dumbbell } from './icons';
import { fromKg, number, type Store } from './model';
import { exerciseVolume, movementDays, movementSeries, movementSummary, type MovementDay, type MovementSeries } from './progress-data';
import { fullDate, MovementChart, movementMeasure, recentMovementChange, setLabel, setupLabel } from './progress-charts';

export type ExerciseGridState = { query: string; filter: string; scroll: number; focusKey?: string };
export const emptyExerciseGrid: ExerciseGridState = { query: '', filter: 'all', scroll: 0 };
const bestLabel = (s: MovementSeries) => s.exercise.timed ? 'Longest hold' : s.mode === 'assistance' ? 'Least assistance' : s.mode === 'bodyweight' ? 'Most reps' : 'Peak load';
function ComparisonHelp() {
  return <details className="comparison-help">
    <summary>How comparisons work</summary>
    <p>Each date shows one set from the saved workouts for this exact variation and setup. Recent change compares the first and last of up to five training dates.</p>
    <p>For loaded exercises, the chart uses the heaviest set. For assisted exercises, it uses the least assistance. When load or assistance ties, it uses the set with more reps. Bodyweight exercises use most reps and timed exercises use the longest hold.</p>
    <p>Volume adds up external load × reps. Per-hand and per-side values are recorded as entered. Estimated 1RM uses the top set and is shown for sets of up to 12 reps.</p>
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
      <div><dt>Since first</dt><dd>{days.length > 1 ? recentMovementChange(series, first, latest, unit) : '—'}</dd></div>
    </dl>
  </details>;
}
function tileSetupLabel(series: MovementSeries, catalogue: MovementSeries[]) {
  const ex = series.exercise, setup = ex.setup?.trim();
  const parts = [setup && setup.toLowerCase() !== 'basic' ? setup : '', ex.supportCm != null ? `${ex.supportCm} cm support` : '', ex.coreLevel && ex.coreLevel !== 'Basic' ? ex.coreLevel : ''].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return catalogue.some(other => other.key !== series.key && other.exercise.name === ex.name)
    ? series.mode === 'bodyweight' ? 'Bodyweight' : series.mode === 'assistance' ? 'Assisted' : 'Standard setup' : '';
}
export function ExerciseGrid({ store, state, onState, onOpen, onStart }: { store: Store; state: ExerciseGridState; onState: (state: ExerciseGridState) => void; onOpen: (key: string) => void; onStart: () => void }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const series = useMemo(() => movementSeries(store.sessions).sort((a, b) => a.exercise.name.localeCompare(b.exercise.name) || a.key.localeCompare(b.key)), [store.sessions]);
  const query = state.query.trim().toLocaleLowerCase();
  const visible = series.filter(s => (state.filter === 'all' || s.exercise.role === state.filter) && `${s.exercise.name} ${setupLabel(s)}`.toLocaleLowerCase().includes(query));
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (state.focusKey) Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>('[data-exercise-key]') ?? []).find(button => button.dataset.exerciseKey === state.focusKey)?.focus({ preventScroll: true });
      window.scrollTo({ top: state.scroll, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return <div className="exercise-dashboard" ref={gridRef}>
    <div className="exercise-page-heading"><p className="eyebrow">Your lift journey</p><h2>Exercise progress</h2><p>{series.length} recorded {series.length === 1 ? 'exercise' : 'exercises'}</p></div>
    {series.length ? <><label className="exercise-search"><Search size={18}/><span className="sr-only">Search exercises and setups</span><input type="search" value={state.query} placeholder="Search exercises or setups" onChange={event => onState({ ...state, query: event.target.value, scroll: 0, focusKey: undefined })}/></label><div className="exercise-filters" role="group" aria-label="Exercise role">{[['all', 'All'], ['main', 'Main'], ['accessory', 'Accessory'], ['core', 'Core']].map(([value, label]) => <button key={value} aria-pressed={state.filter === value} onClick={() => onState({ ...state, filter: value, scroll: 0, focusKey: undefined })}>{label}</button>)}</div><p className="exercise-result-count" role="status">{visible.length} of {series.length} exercises</p>
    <div className="exercise-grid">{visible.map(s => {
      const recent = movementDays(s).slice(-5);
      const latest = recent.at(-1)!;
      const unit = store.settings.unit;
      const setup = tileSetupLabel(s, series);
      return <article className="exercise-tile" key={s.key} aria-label={`${s.exercise.name}${setupLabel(s) ? ` · ${setupLabel(s)}` : ''}`}>
        <div className="exercise-tile-heading">
          <div><h3>{s.exercise.name}</h3>{setup && <p>{setup}</p>}</div>
          <button className="icon-button" data-exercise-key={s.key} aria-label={`View details for ${s.exercise.name}${setupLabel(s) ? ` · ${setupLabel(s)}` : ''}`}
            onClick={() => { onState({ ...state, scroll: window.scrollY, focusKey: s.key }); onOpen(s.key); }}>
            <ChevronRight size={20} aria-hidden="true"/>
          </button>
        </div>
        <div className="exercise-tile-latest">
          <span>{movementMeasure(s, unit)}</span>
          <strong>{setLabel(latest.best, unit)}</strong>
        </div>
        <MovementChart series={s} days={recent} unit={unit}/>
        <div className="exercise-tile-change">
          {recent.length > 1 ? <>
            <span>Last {recent.length} dates</span>
            <strong>{recentMovementChange(s, recent[0].best, latest.best, unit)}</strong>
          </> : <span>1 recorded date</span>}
        </div>
      </article>;
    })}</div>
    {!visible.length && <div className="dashboard-empty"><h3>No matching exercises</h3><button className="text-button" onClick={() => onState({ ...emptyExerciseGrid })}>Clear filters</button></div>}<ComparisonHelp/></> : <div className="dashboard-empty"><span className="snapshot-icon"><Dumbbell size={22}/></span><h3>Your exercise progress starts here</h3><p>Save a workout with logged sets to see your exercises here.</p><button className="primary" onClick={onStart}>Explore programme</button></div>}
  </div>;
}
function SelectedWorkout({ day, unit, index, count, onSelect }: {
  day: MovementDay; unit: Unit; index: number; count: number; onSelect: (index: number) => void;
}) {
  const top = day.best.best;
  const external = day.best.log.mode === 'external' && !day.best.exercise.timed;
  const setCount = day.workouts.reduce((count, record) => count + record.sets.length, 0);
  const volume = external ? day.workouts.reduce((total, record) => total + exerciseVolume(record.exercise, record.log), 0) : 0;
  // Epley estimate. A logged single already gives the load for one rep.
  const estimate = external && top.reps <= 12 && top.weight !== null && top.weight > 0
    ? top.weight * (top.reps === 1 ? 1 : 1 + top.reps / 30)
    : null;

  return <section className="selected-workout" aria-label="Selected training date">
    <p className="sr-only" role="status" aria-atomic="true">{fullDate(day.date)}, {setLabel(day.best, unit)}.</p>
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
    {day.workouts.map(record => <section className="selected-workout-session" key={record.session.id}>
      <h4>{record.session.workout.name}</h4>
      <ol className="selected-workout-sets">
        {record.log.sets.map((set, i) => {
          if (!set.done) return null;
          const isTop = record === day.best && top === set;
          return <li key={i} value={i + 1} className={isTop ? 'is-top-set' : undefined}>
            <span className="workout-set-label">Set {i + 1}{isTop && <span>Chart set</span>}</span>
            <strong>{setLabel({ ...record, best: set }, unit)}</strong>
          </li>;
        })}
      </ol>
    </section>)}
    <dl className="selected-workout-stats">
      {external ? <>
        <div><dt>Total volume</dt><dd>{number(fromKg(volume, unit), 2)} {unit} × reps</dd></div>
        {estimate !== null && <div><dt>Top-set estimated 1RM</dt><dd>{number(fromKg(estimate, unit))} {unit}</dd></div>}
      </> : <div><dt>Logged sets</dt><dd>{setCount}</dd></div>}
    </dl>
  </section>;
}

function ExerciseTrend({ series, unit }: { series: MovementSeries; unit: Unit }) {
  const days = useMemo(() => movementDays(series), [series]);
  const [range, setRange] = useState<'recent' | 'all'>('recent');
  const [selectedDate, setSelectedDate] = useState<string>();
  const latest = days.at(-1)!;
  const recent = days.slice(-5);
  const visible = range === 'recent' ? recent : days;
  const found = visible.findIndex(day => day.date === selectedDate);
  const index = found < 0 ? visible.length - 1 : found;
  const onSelect = (index: number) => setSelectedDate(visible[index].date);
  function selectRange(next: 'recent' | 'all') {
    setRange(next);
    if (next === 'recent' && !recent.some(day => day.date === selectedDate)) setSelectedDate(undefined);
  }

  return <>
    <section className="journey-chart-card exercise-trend" aria-label="Exercise trend">
      <div className="exercise-trend-heading">
        <div className="exercise-latest">
          <span>{series.exercise.timed || series.mode === 'bodyweight' ? 'Latest best set' : 'Latest top set'} · {fullDate(latest.date)}</span>
          <strong>{setLabel(latest.best, unit)}</strong>
        </div>
        {days.length > 5 && <div className="exercise-filters exercise-trend-range" role="group" aria-label="Chart date range">
          <button type="button" aria-pressed={range === 'recent'} onClick={() => selectRange('recent')}>Latest five</button>
          <button type="button" aria-pressed={range === 'all'} onClick={() => selectRange('all')}>All history</button>
        </div>}
      </div>
      <p className="exercise-trend-measure">
        <span>{movementMeasure(series, unit)}</span>
        <span>{visible.length} {visible.length === 1 ? 'date' : 'dates'}</span>
      </p>
      <MovementChart series={series} days={visible} unit={unit} selected={index} onSelect={onSelect}/>
      <SelectedWorkout day={visible[index]} unit={unit} index={index} count={visible.length} onSelect={onSelect}/>
    </section>
    <ExerciseMetrics series={series} days={days} unit={unit}/>
  </>;
}

export function ExerciseProgressDetail({ store, exerciseKey, onBrowse }: {
  store: Store; exerciseKey?: string; onBrowse: () => void;
}) {
  const series = useMemo(() => movementSeries(store.sessions), [store.sessions]);
  const selected = series.find(s => s.key === exerciseKey)
    ?? (!exerciseKey ? [...series].sort((a, b) => a.exercise.name.localeCompare(b.exercise.name))[0] : undefined);
  if (!selected) return <div className="dashboard-empty">
    <h2>{exerciseKey ? 'This exercise has no saved sets' : 'Your movement progress starts here'}</h2>
    <button className="text-button" onClick={onBrowse}>Browse exercises<ChevronRight size={16}/></button>
  </div>;

  return <div className="exercise-detail">
    <div className="exercise-detail-heading">
      <p className="eyebrow">Your lift journey</p>
      <h2>{selected.exercise.name}</h2>
      {setupLabel(selected) && <p>{setupLabel(selected)}</p>}
      <button className="text-button" onClick={onBrowse}>Browse exercises<ChevronRight size={16}/></button>
    </div>
    <ExerciseTrend key={selected.key} series={selected} unit={store.settings.unit}/>
    <ComparisonHelp/>
  </div>;
}
