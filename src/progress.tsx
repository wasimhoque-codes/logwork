import { useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, Check, Dumbbell, Activity, Plus, Clock3, CircleHelp } from './icons';
import { BodyweightChart } from './body-chart';
import { dateLabel, fromKg, number, type Store, type Session } from './model';
import { attemptSummary, defaultMovement, recentMovements, recoverySnapshot, trainingJourney, volumeDistribution } from './progress-data';
import { changeLabel, fullDate, MovementChart, MovementTable, setLabel, setupLabel, WeeklyChart } from './progress-charts';
import type { Page } from './routes';

export function ProgressOverview({ store, onGo, onBody, onFollowup, onMovement, onVolume }: {
  store: Store; onGo: (page: Page) => void; onBody: () => void;
  onFollowup: (s: Session) => void; onMovement: (key?: string) => void; onVolume: (attemptId: string) => void;
}) {
  const journey = useMemo(() => trainingJourney(store), [store.sessions]);
  const [selectedKey, setSelectedKey] = useState('');
  const selected = journey.series.find(s => s.key === selectedKey) ?? defaultMovement(journey.series);
  const cards = recentMovements(journey.series), summary = attemptSummary(store), recovery = recoverySnapshot(store);
  const distribution = volumeDistribution(summary.sessions), unit = store.settings.unit;
  const weight = (kg: number) => number(fromKg(kg, unit), 2);
  const maxVolume = Math.max(...distribution.groups.map(g => g.volume), 1);
  const first = selected?.records[0], latest = selected?.records.at(-1), recent = selected?.records.slice(-5);
  return <div className="progress-dashboard journey-dashboard">
    <section className="journey-intro" aria-labelledby="journey-title">
      <p className="eyebrow">Your journey</p><h2 id="journey-title">Since you started</h2>
      <p className="journey-subtitle">{journey.firstDate ? `Every session counts. Your story since ${fullDate(journey.firstDate)}.` : 'Your first workout is the start of your story.'}</p>
      <div className="journey-totals">{[[journey.sessions.length, 'Workouts logged'], [journey.sets, 'Sets logged'], [journey.activeWeeks, 'Weeks trained'], [journey.series.length, 'Exercises tracked']].map(([value, label]) => <div className="journey-stat" key={label}><strong>{number(Number(value), 0)}</strong><span>{label}</span></div>)}</div>
      {journey.sessions.length > 0 ? <WeeklyChart weeks={journey.weeks} unit={unit}/> : <div className="dashboard-empty"><span className="snapshot-icon"><Dumbbell size={21}/></span><h3>Start with one session</h3><p>Save a workout with logged sets to see your training history and lift trends here.</p><button className="text-button" onClick={() => onGo('programme')}>Explore programme<ArrowRight size={16}/></button><button className="text-button" onClick={() => onMovement()}>All lifts<ChevronRight size={16}/></button></div>}
    </section>
    {selected && first && latest && recent && <section className="journey-lift" aria-labelledby="lift-journey-title">
      <div className="dashboard-section-head"><div><p className="eyebrow">From your first rep</p><h2 id="lift-journey-title">Your lift journey</h2></div><button className="text-button" onClick={() => onMovement(selected.key)}>Records<ChevronRight size={16}/></button></div>
      <div className="journey-chart-card"><label className="journey-selector">Exercise<select aria-label="Select exercise for lift journey" value={selected.key} onChange={event => setSelectedKey(event.target.value)}>{journey.series.map(s => <option key={s.key} value={s.key}>{s.exercise.name}{setupLabel(s) ? ` · ${setupLabel(s)}` : ''}</option>)}</select></label>
        <div className="journey-comparisons">
          <div><span>First recorded</span><strong>{setLabel(first, unit)}</strong><small>{fullDate(first.session.date)}</small></div>
          <div><span>Latest</span><strong>{setLabel(latest, unit)}</strong><small>{fullDate(latest.session.date)}</small></div>
          <div><span>Change since first</span><strong>{selected.records.length > 1 ? changeLabel(selected, first, latest, unit) : '—'}</strong><small>{selected.records.length > 1 ? `Since ${fullDate(first.session.date)}` : 'One recorded session'}</small></div>
          <div><span>Change across latest {recent.length < 5 ? recent.length : 'five'}</span><strong>{recent.length > 1 ? changeLabel(selected, recent[0], latest, unit) : '—'}</strong><small>{recent.length > 1 ? `${fullDate(recent[0].session.date)} – ${fullDate(latest.session.date)}` : 'Log another to compare'}</small></div>
        </div><MovementChart key={selected.key} series={selected} unit={unit}/>
      </div>
    </section>}
    {cards.length > 0 && <section aria-labelledby="recent-title"><div className="dashboard-section-head"><div><p className="eyebrow">Per exercise</p><h2 id="recent-title">Last 5 sessions</h2></div><button className="text-button" onClick={() => onMovement()}>All lifts<ChevronRight size={16}/></button></div><p className="spotlight-context">Each lift’s latest five recorded appearances, across all workouts and programme attempts.</p>
      <div className="spotlight-grid">{cards.map(card => { const records = card.records.slice(-5), last = records.at(-1)!; return <article className="recent-lift" key={card.key}><button className="spotlight-card" onClick={() => onMovement(card.key)}><span className="lift-card-top"><span className="lift-role">{card.exercise.role ?? 'Movement'}</span><ChevronRight size={17}/></span><h3>{card.exercise.name}</h3>{setupLabel(card) && <span className="lift-setup">{setupLabel(card)}</span>}<strong className="lift-value">{setLabel(last, unit)}</strong><span className="recent-neutral-change">{records.length > 1 ? `${changeLabel(card, records[0], last, unit)} across latest ${records.length}` : 'One recorded session · no comparison yet'}</span><MovementChart series={card} unit={unit} mini/><span className="lift-card-foot"><span>{records.length} recorded {records.length === 1 ? 'session' : 'sessions'}</span><span>{fullDate(records[0].session.date)}{records.length > 1 ? ` – ${fullDate(last.session.date)}` : ''}</span></span></button><MovementTable series={card} records={records} unit={unit}/></article>; })}</div>
    </section>}
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
