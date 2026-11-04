import { useMemo } from 'react';
import { ArrowRight, ChevronRight, Check, Dumbbell, Activity, Plus, Clock3, CircleHelp } from './icons';
import { BodyweightChart } from './body-chart';
import { dateLabel, fromKg, number, type Store, type Session } from './model';
import { attemptSummary, recoverySnapshot, trainingJourney, volumeDistribution } from './progress-data';
import { fullDate, WeeklyChart } from './progress-charts';
import type { Page } from './routes';

export function ProgressOverview({ store, onGo, onBody, onFollowup, onVolume }: {
  store: Store; onGo: (page: Page) => void; onBody: () => void;
  onFollowup: (s: Session) => void; onVolume: (attemptId: string) => void;
}) {
  const journey = useMemo(() => trainingJourney(store), [store.sessions]);
  const summary = attemptSummary(store), recovery = recoverySnapshot(store);
  const distribution = volumeDistribution(summary.sessions), unit = store.settings.unit;
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
    <section aria-labelledby="support-title"><div className="dashboard-section-head"><div><p className="eyebrow">Keep building</p><h2 id="support-title">Programme & recovery</h2></div></div><div className="support-grid">
    <section className="attempt-card" aria-label="Current programme attempt">
      <div className="attempt-topline"><p className="eyebrow">Week {summary.attempt.week} <span>·</span> Attempt {summary.number}</p><span className="attempt-status">{store.programme.status === 'complete' ? 'Block complete' : summary.previous ? 'Repeat' : 'In progress'}</span></div>
      <p className="attempt-start">{store.programme.status === 'complete' ? 'Completed' : 'Started'} {dateLabel(store.programme.status === 'complete' ? summary.attempt.ended ?? summary.attempt.started : summary.attempt.started, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      <h2><strong>{summary.complete}<span> / 4</span></strong> main sessions complete</h2>
      <ul className="attempt-workouts" aria-label="Main session completion">{summary.workouts.map(w => <li key={w.id} className={w.status}><span className="attempt-check" aria-hidden="true">{w.status === 'complete' ? <Check size={13}/> : w.status === 'partial' ? '−' : null}</span>{w.name}<span className="sr-only">: {w.status === 'pending' ? 'not logged' : w.status}</span></li>)}</ul>
      <div className="attempt-totals"><span><Activity size={15}/>{summary.recoveryDays} recovery {summary.recoveryDays === 1 ? 'day' : 'days'} logged</span><span><Clock3 size={15}/>{summary.cardio} min cardio</span></div>
      {summary.previous && <p className="attempt-context"><CircleHelp size={17}/><span>Last attempt: <strong>{summary.previousComplete}/4 complete</strong> · {dateLabel(summary.previous.started)}{summary.previous.ended ? ` – ${dateLabel(summary.previous.ended)}` : ''}.<br/>Build on your previous attempt, at your pace.</span></p>}
    </section>

        <article className="snapshot-card recovery-snapshot"><div className="snapshot-heading"><h3><Activity size={18}/>Recovery & mobility</h3></div><strong className="snapshot-value">{recovery.logs}<span> recovery {recovery.logs === 1 ? 'log' : 'logs'}</span></strong><p className="snapshot-date">Across {recovery.days} {recovery.days === 1 ? 'day' : 'days'} in the last 7 days</p><div className="recovery-minute-grid"><div><strong>{recovery.cardio}<small> min</small></strong><span>Easy cardio</span></div><div><strong>{recovery.mobility}<small> min</small></strong><span>Mobility</span></div></div>
          {recovery.pending.length > 0 ? <button className="pending-feedback" onClick={() => onFollowup(recovery.pending[0])}><CircleHelp size={17}/><span>{recovery.pending.length} {recovery.pending.length === 1 ? 'workout needs' : 'workouts need'} feedback<small>Pending next-day responses · all dates</small></span><ChevronRight size={16}/></button> : <p className="feedback-clear"><Check size={16}/>{store.sessions.length ? 'No next-day feedback pending' : 'Recovery counts as progress, too.'}</p>}
          <button className="text-button recovery-detail-link" onClick={() => onGo('progress/recovery')}>Recovery details<ChevronRight size={16}/></button>
        </article>
    </div></section>
    <section className="volume-overview" aria-labelledby="distribution-title"><div className="dashboard-section-head"><div><p className="eyebrow">Current attempt</p><h2 id="distribution-title">Volume & load</h2></div><button className="text-button" onClick={() => onVolume(summary.attempt.id)}>By muscle<ChevronRight size={16}/></button></div>
      <div className="distribution-card">{distribution.groups.map(group => <div className="distribution-row" key={group.label}><div><strong>{group.label}</strong><span>{weight(group.volume)} {unit} × reps</span></div><div className="distribution-track" aria-hidden="true"><span style={{ width: `${group.volume / maxVolume * 100}%` }}/></div><p>{group.sessions} {group.sessions === 1 ? 'session' : 'sessions'} with external load</p></div>)}<div className="core-hold-total"><span><Activity size={18}/><strong>Core holds</strong></span><strong>{distribution.coreSeconds} <small>sec logged</small></strong></div><p className="distribution-caption">Recorded load × reps, grouped by workout. Assistance, bodyweight and timed work excluded. Per-hand and per-side values are not doubled; core seconds are shown as logged.</p></div>
    </section>
  </div>;
}
