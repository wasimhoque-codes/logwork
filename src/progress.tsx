import { useMemo } from 'react';
import { ArrowRight, ChevronRight, Dumbbell, Activity, Plus } from './icons';
import { BodyweightChart } from './body-chart';
import { fromKg, number, type Store } from './model';
import { trainingJourney, volumeDistribution } from './progress-data';
import { fullDate, WeeklyChart } from './progress-charts';
import type { Page } from './routes';

export function ProgressOverview({ store, onGo, onBody, onVolume }: {
  store: Store; onGo: (page: Page) => void; onBody: () => void;
  onVolume: () => void;
}) {
  const journey = useMemo(() => trainingJourney(store), [store.sessions]);
  const distribution = volumeDistribution(journey.sessions), unit = store.settings.unit;
  const weight = (kg: number) => number(fromKg(kg, unit), 2);
  const maxVolume = Math.max(...distribution.groups.map(g => g.volume), 1);
  return <div className="progress-dashboard journey-dashboard">
    <section className="journey-intro" aria-labelledby="journey-title">
      <p className="eyebrow">Your journey</p><h2 id="journey-title">Since you started</h2>
      <p className="journey-subtitle">{journey.firstDate ? `Every session counts. Your story since ${fullDate(journey.firstDate)}.` : 'Your first workout is the start of your story.'}</p>
      <div className="journey-totals">{[[journey.sessions.length, 'Workouts logged'], [journey.sets, 'Sets logged'], [journey.activeWeeks, 'Weeks trained'], [journey.series.length, 'Exercises tracked']].map(([value, label]) => <div className="journey-stat" key={label}><strong>{number(Number(value), 0)}</strong><span>{label}</span></div>)}</div>
      {journey.sessions.length > 0 ? <WeeklyChart weeks={journey.weeks} unit={unit}/> : <div className="dashboard-empty"><span className="snapshot-icon"><Dumbbell size={21}/></span><h3>Start with one session</h3><p>Save a workout with logged sets to see your training history and lift trends here.</p><button className="text-button" onClick={() => onGo('programme')}>Explore programme<ArrowRight size={16}/></button><button className="text-button" onClick={() => onGo('progress/exercises')}>All lifts<ChevronRight size={16}/></button></div>}
    </section>
    <button className="exercise-explore" onClick={() => onGo('progress/exercises')}><span className="snapshot-icon"><Dumbbell size={22}/></span><span><strong>Explore exercises</strong><small>{journey.series.length} recorded exercises · charts & comparisons</small></span><ChevronRight size={20}/></button>
    <section aria-labelledby="bodyweight-overview-title"><div className="dashboard-section-head"><div><p className="eyebrow">The bigger picture</p><h2 id="bodyweight-overview-title">Bodyweight</h2></div><button className="text-button" onClick={onBody} aria-label="Log bodyweight"><Plus size={16}/>Log</button></div><div className="journey-chart-card body-trend"><BodyweightChart body={store.body} unit={unit}/><button className="text-button body-records-link" onClick={() => onGo('progress/bodyweight')}>View bodyweight records<ChevronRight size={16}/></button></div></section>
    <section className="volume-overview" aria-labelledby="distribution-title"><div className="dashboard-section-head"><div><p className="eyebrow">All time</p><h2 id="distribution-title">Volume & load</h2></div><button className="text-button" onClick={onVolume}>By muscle<ChevronRight size={16}/></button></div>
      <div className="distribution-card">{distribution.groups.map(group => <div className="distribution-row" key={group.label}><div><strong>{group.label}</strong><span>{weight(group.volume)} {unit} × reps</span></div><div className="distribution-track" aria-hidden="true"><span style={{ width: `${group.volume / maxVolume * 100}%` }}/></div><p>{group.sessions} {group.sessions === 1 ? 'session' : 'sessions'} with external load</p></div>)}<div className="core-hold-total"><span><Activity size={18}/><strong>Core holds</strong></span><strong>{distribution.coreSeconds} <small>sec logged</small></strong></div><p className="distribution-caption">Recorded load × reps, grouped by workout. Assistance, bodyweight and timed work excluded. Per-hand and per-side values are not doubled; core seconds are shown as logged.</p></div>
    </section>
  </div>;
}
