import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Unit } from './data';
import { ChevronRight, Search, Dumbbell } from './icons';
import { dateLabel, fromKg, number, progression, localDate, type Store, type Session } from './model';
import { exerciseVolume, movementSeries, movementSummary, type MovementSeries } from './progress-data';
import { changeLabel, fullDate, MovementChart, MovementTable, setLabel, setupLabel } from './progress-charts';

export type ExerciseGridState = { query: string; filter: string; scroll: number; focusKey?: string };
export const emptyExerciseGrid: ExerciseGridState = { query: '', filter: 'all', scroll: 0 };
const bestLabel = (s: MovementSeries) => s.exercise.timed ? 'Longest hold' : s.mode === 'assistance' ? 'Least assistance' : s.mode === 'bodyweight' ? 'Most reps' : 'Peak load';
export function ComparisonHelp() {
  return <details className="comparison-help"><summary>How comparisons work</summary><p>Each point uses logged sets from one saved workout in this exact variation and setup. Recent change compares the oldest and newest of up to five appearances, including the latest.</p><p>External load uses the heaviest set with its paired reps. Assistance uses the least assistance; compare reps and control too. Bodyweight uses most reps, timed work uses the longest hold. Load changes alone do not measure strength.</p><p>Volume is external load × reps, excluding assistance, bodyweight and timed work. Per-hand and per-side values are not doubled.</p></details>;
}
export function ExerciseMetrics({ series, unit }: { series: MovementSeries; unit: Unit }) {
  const { first, latest, recent, best } = movementSummary(series);
  return <dl className="exercise-metrics"><div><dt>First recorded</dt><dd>{setLabel(first, unit)}</dd></div><div><dt>{bestLabel(series)}</dt><dd>{setLabel(best, unit)}</dd></div><div><dt>Since first</dt><dd>{series.records.length > 1 ? changeLabel(series, first, latest, unit) : '—'}</dd></div><div><dt>Latest {recent.length < 5 ? recent.length : 'five'} change</dt><dd>{recent.length > 1 ? changeLabel(series, recent[0], latest, unit) : '—'}</dd></div></dl>;
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
    {visible.length > 0 && <div className="journey-legend exercise-grid-legend" aria-label="Exercise chart legend"><span><i/>Full history</span><span><i className="recent-key"/>Latest 5 highlighted</span></div>}
    <div className="exercise-grid">{visible.map(s => {
      const { first, latest, recent } = movementSummary(s), setup = tileSetupLabel(s, series);
      return <article className="exercise-tile" key={s.key} aria-label={`${s.exercise.name}${setupLabel(s) ? ` · ${setupLabel(s)}` : ''}`}>
        <div className="exercise-tile-heading"><div><h3>{s.exercise.name}</h3>{setup && <p>{setup}</p>}</div><button className="icon-button" data-exercise-key={s.key} aria-label={`View details for ${s.exercise.name}${setupLabel(s) ? ` · ${setupLabel(s)}` : ''}`} onClick={() => { onState({ ...state, scroll: window.scrollY, focusKey: s.key }); onOpen(s.key); }}><ChevronRight size={20} aria-hidden="true"/></button></div>
        <div className="exercise-tile-latest" aria-label="Latest recorded set"><strong>{setLabel(latest, store.settings.unit)}</strong></div>
        <MovementChart series={s} unit={store.settings.unit} compact/>
        <dl className="exercise-tile-changes"><div><dt>Since first</dt><dd>{s.records.length > 1 ? changeLabel(s, first, latest, store.settings.unit) : '—'}</dd></div><div><dt>Last {recent.length}</dt><dd>{recent.length > 1 ? changeLabel(s, recent[0], latest, store.settings.unit) : '—'}</dd></div></dl>
        <MovementTable series={s} records={s.records} unit={store.settings.unit}/>
      </article>;
    })}</div>
    {!visible.length && <div className="dashboard-empty"><h3>No matching exercises</h3><button className="text-button" onClick={() => onState({ ...emptyExerciseGrid })}>Clear filters</button></div>}<ComparisonHelp/></> : <div className="dashboard-empty"><span className="snapshot-icon"><Dumbbell size={22}/></span><h3>Your exercise progress starts here</h3><p>Save a workout with logged sets to see your exercises here.</p><button className="primary" onClick={onStart}>Explore programme</button></div>}
  </div>;
}
function WorkloadChart({ series, unit }: { series: MovementSeries; unit: Unit }) {
  const records = series.records.slice(-5), external = series.mode === 'external' && !series.exercise.timed;
  const values = records.map(r => external ? fromKg(exerciseVolume(r.exercise, r.log), unit) : r.sets.length), max = Math.max(...values, 1);
  const label = external ? `${unit} × reps` : 'logged sets';
  return <section className="journey-chart-card workload-card"><div className="dashboard-section-head"><div><p className="eyebrow">Latest {records.length} appearances</p><h2>{external ? 'Training volume' : 'Logged sets'}</h2></div></div><div className="workload-bars" role="img" aria-label={records.map((r, i) => `${fullDate(r.session.date)}: ${number(values[i], 2)} ${label}`).join('; ')}>{records.map((r, i) => <div key={r.session.id}><strong>{number(values[i], 1)}</strong><div className="workload-track"><span style={{ height: `${values[i] / max * 100}%` }}/></div><span>{dateLabel(r.session.date)}</span></div>)}</div><p className="workload-unit">{label}</p><div className="sr-only"><table><caption>Recent workload in {label}</caption><thead><tr><th>Date</th><th>{label}</th></tr></thead><tbody>{records.map((r, i) => <tr key={r.session.id}><th scope="row">{fullDate(r.session.date)}</th><td>{number(values[i], 2)}</td></tr>)}</tbody></table></div></section>;
}
export function ExerciseProgressDetail({ store, exerciseKey, onBrowse, onFollowup }: { store: Store; exerciseKey?: string; onBrowse: () => void; onFollowup: (session: Session) => void }) {
  const series = movementSeries(store.sessions), selected = series.find(s => s.key === exerciseKey) ?? (!exerciseKey ? [...series].sort((a, b) => a.exercise.name.localeCompare(b.exercise.name))[0] : undefined);
  if (!selected) return <div className="dashboard-empty"><h2>{exerciseKey ? 'This exercise has no saved sets' : 'Your movement progress starts here'}</h2><button className="text-button" onClick={onBrowse}>Browse exercises<ChevronRight size={16}/></button></div>;
  const latest = selected.records.at(-1)!, suggestion = progression(latest.exercise, latest.log, latest.session);
  return <div className="exercise-detail"><div className="exercise-detail-heading"><p className="eyebrow">Your lift journey</p><h2>{selected.exercise.name}</h2><p>{setupLabel(selected)}</p><button className="text-button" onClick={onBrowse}>Browse exercises<ChevronRight size={16}/></button></div><section className="journey-chart-card"><div className="exercise-latest"><span>Latest set · {fullDate(latest.session.date)}</span><strong>{setLabel(latest, store.settings.unit)}</strong></div><ExerciseMetrics series={selected} unit={store.settings.unit}/><MovementChart key={selected.key} series={selected} unit={store.settings.unit}/></section><WorkloadChart series={selected} unit={store.settings.unit}/><section className="metric-records list-card" aria-label="Movement records">{[...selected.records].reverse().map(r => <div key={r.session.id}><span>{fullDate(r.session.date)}<small>{r.session.workout.name}</small></span><strong>{r.sets.map(set => setLabel({ ...r, best: set }, store.settings.unit)).join(' · ')}</strong></div>)}</section>{suggestion && <section className="coaching-card"><span className="badge">Conditional progression</span><h3>{suggestion.title}</h3><p>{suggestion.description}</p></section>}{latest.session.date < localDate() && <button className="summary-link" onClick={() => onFollowup(latest.session)}><span>Review following-day response</span><ChevronRight size={17}/></button>}<ComparisonHelp/></div>;
}
