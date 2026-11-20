import { useMemo } from 'react';
import { Dumbbell, Plus, Scale } from './icons';
import { ExerciseIcon } from './exercise-icon';
import { bodyTrend } from './body-trend';
import { dateLabel, fromKg, localDate, number, type Store } from './model';
import { featuredMovements, movementDays, trainingJourney, volumeDistribution } from './progress-data';
import { fullDate, setLabel, setupLabel, WeeklyChart, type TrainingRange } from './progress-charts';
import { LiftComparison, LiftSparkline, LiftTrendLabel } from './progress-ui';
import type { Page } from './routes';

export function ProgressOverview({ store, range, onRange, onGo, onBody, onVolume }: {
  store: Store; range: TrainingRange; onRange: (range: TrainingRange)=>void; onGo: (page: Page, exerciseKey?: string) => void; onBody: () => void;
  onVolume: (range: TrainingRange) => void;
}) {
  const journey = useMemo(() => trainingJourney(store), [store.sessions]);
  const muscles = useMemo(() => volumeDistribution(journey.sessions.filter(session => session.date >= journey.recentWeeks[0].date && session.date <= localDate())).muscles.sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label)), [journey.sessions, journey.recentWeeks]);
  const lifts = featuredMovements(journey.series);
  const unit = store.settings.unit;
  const body = useMemo(() => bodyTrend(store.body), [store.body]);
  const latestBody = body.at(-1);
  const difference = journey.currentSessions - journey.previousSessions;
  const comparison = difference === 0 ? 'Same as this time last week' : `${Math.abs(difference)} ${difference > 0 ? 'more' : 'fewer'} ${Math.abs(difference) === 1 ? 'session' : 'sessions'} than this time last week`;
  return <div className="progress-dashboard strength-dashboard">
    <section className="your-lifts" aria-labelledby="your-lifts-title">
      <div className="progress-section-heading"><div><p className="progress-kicker">Strength, over time</p><h2 id="your-lifts-title">Your lifts</h2><p>Real sets. A clearer view of your progress.</p></div><button className="text-button" onClick={() => onGo('progress/exercises')}>All exercises</button></div>
      {lifts.length ? <div className="featured-lifts">{lifts.map(series => {
        const latest = movementDays(series).at(-1)!.best;
        return <button type="button" className="featured-lift" key={series.key} data-featured-exercise-key={series.key} onClick={() => onGo('progress/movement', series.key)} aria-label={`View progress for ${series.exercise.name}${setupLabel(series) ? ` · ${setupLabel(series)}` : ''}`}>
          <span className="featured-lift-heading"><ExerciseIcon exercise={series.exercise} size={48}/><span><strong>{series.exercise.name}</strong><small>{[series.exercise.muscle, setupLabel(series, false)].filter(Boolean).join(' · ')}</small></span></span>
          <span className="featured-performance"><strong>{setLabel(latest, unit)}</strong><small>Latest · {dateLabel(latest.session.date)}</small></span>
          <LiftSparkline series={series}/><LiftTrendLabel series={series} unit={unit}/>
          <LiftComparison series={series} unit={unit}/>
        </button>;
      })}</div> : <div className="dashboard-empty strength-empty"><span className="snapshot-icon"><Dumbbell size={26}/></span><h3>Your first set is the starting point</h3><p>Save a workout with logged sets to see your lifts and build a picture of your progress.</p><button className="primary" onClick={() => onGo('programme')}>Explore programme</button></div>}
    </section>
    <section className="activity-overview" aria-labelledby="activity-title">
      <div className="progress-section-heading"><div><p className="progress-kicker">Keep showing up</p><h2 id="activity-title">Your training</h2></div><button className="text-button" onClick={() => onGo('progress/history')}>Workout history</button></div>
      <div className="training-week-banner"><div><span>This week</span><strong>{journey.currentSessions}<small>{journey.currentSessions === 1 ? 'session' : 'sessions'} so far</small></strong></div>{journey.firstDate && journey.firstDate < journey.currentWeek && <p>{comparison}</p>}</div>
      {journey.sessions.length > 0 && <WeeklyChart journey={journey} unit={unit} range={range} onRange={onRange}/>}
    </section>
    <div className="progress-support-grid">
      <section className="progress-card muscle-summary" aria-labelledby="muscle-summary-title">
        <div className="progress-section-heading"><div><p className="progress-kicker">Last 8 weeks</p><h2 id="muscle-summary-title">Where the work goes</h2></div></div>
        {muscles.length ? <div className="muscle-summary-rows">{muscles.slice(0, 4).map(muscle => <div key={muscle.label}><span>{muscle.label}<strong>{muscle.sets} sets</strong></span><span className="distribution-track" aria-hidden="true"><span style={{ width: `${muscle.sets / muscles[0].sets * 100}%` }}/></span></div>)}</div> : <p className="muted">Your logged sets by muscle will appear here.</p>}
        <button className="secondary full-width" onClick={() => onVolume('recent')}>Explore training volume</button>
      </section>
      <section className="progress-card body-summary" aria-labelledby="body-summary-title">
        <div className="progress-section-heading"><div><p className="progress-kicker">Alongside your training</p><h2 id="body-summary-title">Bodyweight</h2></div><Scale size={22} aria-hidden="true"/></div>
        {latestBody ? <><div className="body-summary-value"><strong>{number(fromKg(latestBody.kg, unit), 1)} <small>{unit}</small></strong><span>Latest weigh-in · {fullDate(latestBody.date)}</span></div><div className="body-summary-average"><span>7-day average<strong>{number(fromKg(latestBody.averageKg, unit), 1)} {unit}</strong></span><small>{latestBody.count} {latestBody.count === 1 ? 'reading' : 'readings'} through {dateLabel(latestBody.date)}</small></div></> : <p className="body-summary-empty">Log a weigh-in to follow your bodyweight alongside your lifts.</p>}
        <div className="body-summary-actions"><button className="secondary" onClick={onBody}><Plus size={16}/>Log bodyweight</button>{latestBody && <button className="text-button" onClick={() => onGo('progress/bodyweight')}>View trend</button>}</div>
      </section>
    </div>
    {journey.firstDate && <section className="progress-lifetime" aria-labelledby="lifetime-title"><div className="progress-section-heading"><div><h2 id="lifetime-title">Every session counts</h2><p>Since {fullDate(journey.firstDate)}</p></div></div><dl className="lifetime-totals">{[[journey.sessions.length, 'Workouts'], [journey.sets, 'Logged sets'], [journey.activeWeeks, 'Active weeks']].map(([value, label]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
  </div>;
}
