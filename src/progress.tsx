import { useState } from 'react';
import { ArrowRight, ChevronRight, Check, Dumbbell, Activity, Scale, Plus, Clock3, CircleHelp } from './icons';
import { BodyweightChart } from './body-chart';
import { Modal } from './components';
import { dateLabel, fromKg, number, type Store, type Session } from './model';
import { attemptSummary, bodySnapshot, recoverySnapshot, strengthSpotlight, volumeDistribution } from './progress-data';
import type { Page } from './routes';

const signed = (value: number, decimals = 1) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), decimals)}`;

function WeightSparkline({ snapshot }: { snapshot: ReturnType<typeof bodySnapshot> }) {
  const { points, startDay } = snapshot;
  if (!points.length) return <span className="snapshot-empty">No weigh-ins in the last 7 days.</span>;
  const values = points.flatMap(p => [p.kg, p.averageKg]), low = Math.min(...values) - .15, high = Math.max(...values) + .15;
  const x = (day: number) => 8 + (day - startDay) / 6 * 264, y = (kg: number) => 48 - (kg - low) / (high - low) * 36;
  return <svg className="weight-sparkline" viewBox="0 0 280 60" role="img" aria-label={`${points.length} weigh-ins in the last 7 days. Dots show recorded weights; the line shows the 7-day average.`}>
    <line x1="8" x2="272" y1="52" y2="52" className="sparkline-baseline"/>
    {points.length > 1 && <path d={points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day)},${y(p.averageKg)}`).join(' ')} className="body-average-line"/>}
    {points.map(p => <circle key={p.id} cx={x(p.day)} cy={y(p.kg)} r="3.5" className="body-weigh-in"/>)}
  </svg>;
}

export function ProgressOverview({ store, onGo, onBody, onFollowup, onMovement, onVolume }: {
  store: Store; onGo: (page: Page) => void; onBody: () => void;
  onFollowup: (s: Session) => void; onMovement: (key?: string) => void; onVolume: (attemptId: string) => void;
}) {
  const [bodyOpen, setBodyOpen] = useState(false);
  const summary = attemptSummary(store), spotlight = strengthSpotlight(store), body = bodySnapshot(store), recovery = recoverySnapshot(store);
  const distribution = volumeDistribution(summary.sessions), unit = store.settings.unit;
  const weight = (kg: number) => number(fromKg(kg, unit), 2);
  const maxVolume = Math.max(...distribution.groups.map(g => g.volume), 1);
  const setValue = (card: typeof spotlight.cards[number], previous = false) => {
    const set = previous ? card.previousBest : card.best;
    if (!set) return '';
    return `${card.log.mode === 'bodyweight' || card.exercise.timed ? '' : `${weight(set.weight ?? 0)} ${unit}${card.log.mode === 'assistance' ? ' assist' : ''} × `}${set.reps}${card.exercise.timed ? ' sec' : ' reps'}${card.exercise.perSide ? ' / side' : ''}`;
  };
  return <div className="progress-dashboard">
    <section className="attempt-card" aria-label="Current programme attempt">
      <div className="attempt-topline"><p className="eyebrow">Week {summary.attempt.week} <span>·</span> Attempt {summary.number}</p><span className="attempt-status">{store.programme.status === 'complete' ? 'Block complete' : summary.previous ? 'Repeat' : 'In progress'}</span></div>
      <p className="attempt-start">{store.programme.status === 'complete' ? 'Completed' : 'Started'} {dateLabel(store.programme.status === 'complete' ? summary.attempt.ended ?? summary.attempt.started : summary.attempt.started, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      <h2><strong>{summary.complete}<span> / 4</span></strong> main sessions complete</h2>
      <ul className="attempt-workouts" aria-label="Main session completion">{summary.workouts.map(w => <li key={w.id} className={w.status}><span className="attempt-check" aria-hidden="true">{w.status === 'complete' ? <Check size={13}/> : w.status === 'partial' ? '−' : null}</span>{w.name}<span className="sr-only">: {w.status === 'pending' ? 'not logged' : w.status}</span></li>)}</ul>
      <div className="attempt-totals"><span><Activity size={15}/>{summary.recoveryDays} recovery {summary.recoveryDays === 1 ? 'day' : 'days'} logged</span><span><Clock3 size={15}/>{summary.cardio} min cardio</span></div>
      {summary.previous && <p className="attempt-context"><CircleHelp size={17}/><span>Last attempt: <strong>{summary.previousComplete}/4 complete</strong> · {dateLabel(summary.previous.started)}{summary.previous.ended ? ` – ${dateLabel(summary.previous.ended)}` : ''}.<br/>Build on your previous attempt, at your pace.</span></p>}
    </section>

    <section className="strength-spotlight" aria-labelledby="spotlight-title">
      <div className="dashboard-section-head"><div><p className="eyebrow">Your training, compared</p><h2 id="spotlight-title">Strength spotlight</h2></div><button className="text-button" onClick={() => onMovement()}>All lifts<ChevronRight size={16}/></button></div>
      {spotlight.session ? <>
        <p className="spotlight-context"><strong>{spotlight.session.workout.name}</strong> · {dateLabel(spotlight.session.date)}{spotlight.baseline ? ` vs ${dateLabel(spotlight.baseline.date)} · ${spotlight.repeat ? 'previous attempt' : 'previous workout'}` : ' · No comparable workout yet'}</p>
        <div className="spotlight-grid">{spotlight.cards.map(card => {
          const delta = card.previousBest ? card.log.mode === 'bodyweight' || card.exercise.timed ? card.best.reps - card.previousBest.reps : fromKg((card.best.weight ?? 0) - (card.previousBest.weight ?? 0), unit) : null;
          const deltaUnit = card.log.mode === 'bodyweight' || card.exercise.timed ? card.exercise.timed ? 'sec' : 'reps' : `${unit} ${card.log.mode === 'assistance' ? 'assistance' : 'load'}`;
          return <button className="spotlight-card" key={card.key} onClick={() => onMovement(card.key)}>
            <span className="lift-card-top"><span className="lift-role">{card.exercise.role ?? 'Movement'}</span><ChevronRight size={17}/></span>
            <h3>{card.exercise.name}</h3>
            {(card.exercise.setup || card.exercise.supportCm != null || card.exercise.role === 'core' && card.exercise.coreLevel) && <span className="lift-setup">{[card.exercise.setup, card.exercise.supportCm != null ? `${card.exercise.supportCm} cm support` : '', card.exercise.role === 'core' ? card.exercise.coreLevel : ''].filter(Boolean).join(' · ')}</span>}
            <strong className="lift-value">{setValue(card)}</strong>
            <span className="lift-change">{delta !== null ? `${signed(delta, 2)} ${deltaUnit}` : 'No comparable record'}{card.loadPR && <span className="load-pr">Load PR</span>}</span>
            {card.previousBest && <span className="lift-previous">Previously {setValue(card, true)}</span>}
            <span className="lift-card-foot">{card.log.mode === 'external' && !card.exercise.timed ? <span>Volume <strong>{weight(card.volume)} {unit} × reps</strong>{card.volumeChange !== null && <span className="volume-change">{signed(card.volumeChange, 0)}% vs baseline</span>}</span> : <span>{card.exercise.timed ? `Target ${card.exercise.min === card.exercise.max ? card.exercise.max : `${card.exercise.min}–${card.exercise.max}`} sec${card.exercise.perSide ? ' / side' : ''}` : 'Bodyweight movement'}</span>}<span>{card.sets} logged {card.sets === 1 ? 'set' : 'sets'}{card.previousBest ? ` vs ${card.previousSets}` : ''}</span></span>
            {card.suggestion && <span className="lift-suggestion">{card.suggestion.title}<span>Conditional on technique & recovery</span></span>}
          </button>;
        })}</div>
      </> : <div className="dashboard-empty"><span className="snapshot-icon"><Dumbbell size={21}/></span><h3>{store.programme.status === 'complete' ? 'Your block is complete' : store.sessions.length ? 'A fresh attempt starts here' : 'Start with one session'}</h3><p>{store.programme.status === 'complete' ? 'Explore your saved lifts and workout history, or review your programme before your next block.' : 'Save a workout in this attempt to see your lifts, logged sets and comparisons.'}</p><button className="text-button" onClick={() => onGo('programme')}>Explore programme<ArrowRight size={16}/></button></div>}
    </section>

    <section aria-labelledby="body-recovery-title"><div className="dashboard-section-head"><div><p className="eyebrow">Last 7 days</p><h2 id="body-recovery-title">Body & recovery</h2></div></div>
      <div className="snapshot-grid">
        <article className="snapshot-card body-trend"><div className="snapshot-heading"><h3><Scale size={18}/>Bodyweight</h3><button className="text-button" onClick={onBody} aria-label="Log bodyweight"><Plus size={16}/>Log</button></div>
          {body.latest ? <button className="body-snapshot-button" onClick={() => setBodyOpen(true)} aria-label="Open full bodyweight chart">
            <strong className="snapshot-value">{number(fromKg(body.latest.kg, unit), 1)} <span>{unit}</span></strong><span className="snapshot-date">Latest · {dateLabel(body.latest.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="body-snapshot-average">7-day avg <strong>{body.average !== null ? `${number(fromKg(body.average, unit), 1)} ${unit}` : '—'}</strong>{body.change !== null && <span>{signed(fromKg(body.change, unit))} {unit} vs prior 7 days</span>}</span>
            <WeightSparkline snapshot={body}/><span className="snapshot-chart-link">{body.count} {body.count === 1 ? 'weigh-in' : 'weigh-ins'} in 7 days<span>Full chart<ChevronRight size={15}/></span></span>
          </button> : <div className="snapshot-empty"><p>Your bodyweight trend starts here.</p><button className="text-button" onClick={onBody}>Log your first weigh-in<ArrowRight size={16}/></button></div>}
        </article>
        <article className="snapshot-card recovery-snapshot"><div className="snapshot-heading"><h3><Activity size={18}/>Recovery & mobility</h3></div><strong className="snapshot-value">{recovery.logs}<span> recovery {recovery.logs === 1 ? 'log' : 'logs'}</span></strong><p className="snapshot-date">Across {recovery.days} {recovery.days === 1 ? 'day' : 'days'} in the last 7 days</p><div className="recovery-minute-grid"><div><strong>{recovery.cardio}<small> min</small></strong><span>Easy cardio</span></div><div><strong>{recovery.mobility}<small> min</small></strong><span>Mobility</span></div></div>
          {recovery.pending.length > 0 ? <button className="pending-feedback" onClick={() => onFollowup(recovery.pending[0])}><CircleHelp size={17}/><span>{recovery.pending.length} {recovery.pending.length === 1 ? 'workout needs' : 'workouts need'} feedback<small>Pending next-day responses · all dates</small></span><ChevronRight size={16}/></button> : <p className="feedback-clear"><Check size={16}/>{store.sessions.length ? 'No next-day feedback pending' : 'Recovery counts as progress, too.'}</p>}
          <button className="text-button recovery-detail-link" onClick={() => onGo('progress/recovery')}>Recovery details<ChevronRight size={16}/></button>
        </article>
      </div>
    </section>

    <section className="volume-overview" aria-labelledby="distribution-title"><div className="dashboard-section-head"><div><p className="eyebrow">Current attempt</p><h2 id="distribution-title">Volume & load</h2></div><button className="text-button" onClick={() => onVolume(summary.attempt.id)}>By muscle<ChevronRight size={16}/></button></div>
      <div className="distribution-card">{distribution.groups.map(group => <div className="distribution-row" key={group.label}><div><strong>{group.label}</strong><span>{weight(group.volume)} {unit} × reps</span></div><div className="distribution-track" aria-hidden="true"><span style={{ width: `${group.volume / maxVolume * 100}%` }}/></div><p>{group.sessions} {group.sessions === 1 ? 'session' : 'sessions'} with external load</p></div>)}<div className="core-hold-total"><span><Activity size={18}/><strong>Core holds</strong></span><strong>{distribution.coreSeconds} <small>sec logged</small></strong></div><p className="distribution-caption">Recorded load × reps, grouped by workout. Assistance, bodyweight and timed work excluded. Per-hand and per-side values are not doubled; core seconds are shown as logged.</p></div>
    </section>
    {bodyOpen && <div className="body-chart-dialog"><Modal title="Bodyweight trend" wide onClose={() => setBodyOpen(false)}><BodyweightChart body={store.body} unit={unit}/><button className="secondary full-width" onClick={() => { setBodyOpen(false); onGo('progress/bodyweight'); }}>View bodyweight records<ChevronRight size={17}/></button></Modal></div>}
  </div>;
}
