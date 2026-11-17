import { useMemo } from 'react';
import { ArrowRight, ChevronRight, Dumbbell, Activity, Plus } from './icons';
import { BodyweightChart } from './body-chart';
import { dateLabel, fromKg, number, type Store } from './model';
import { exerciseChange, recentMovements, trainingJourney, volumeDistribution } from './progress-data';
import { directoryChange, durationLabel, fullDate, WeeklyChart, type TrainingRange } from './progress-charts';
import type { Page } from './routes';

export function ProgressOverview({ store, range, onRange, onGo, onBody, onVolume }: {
  store: Store; range: TrainingRange; onRange: (range: TrainingRange)=>void; onGo: (page: Page, exerciseKey?: string) => void; onBody: () => void;
  onVolume: (range: TrainingRange) => void;
}) {
  const journey = useMemo(() => trainingJourney(store), [store.sessions]);
  const distribution = useMemo(()=>volumeDistribution(journey.sessions),[journey.sessions]);
  const unit = store.settings.unit;
  const totalVolume = distribution.groups.reduce((sum,group)=>sum+group.volume,0);
  const upperShare = totalVolume ? Math.round(distribution.groups[0].volume * 100 / totalVolume) : 0;
  const difference = journey.currentSessions - journey.previousSessions;
  const comparison = difference === 0 ? 'Same as this time last week'
    : `${Math.abs(difference)} ${difference > 0 ? 'more' : Math.abs(difference) === 1 ? 'fewer session' : 'fewer sessions'} than this time last week`;
  const recent = recentMovements(journey.series).flatMap(series=>{
    const change = exerciseChange(series);
    const label = directoryChange(series,change,unit);
    return change.previous && label ? [{series,previous:change.previous,label}] : [];
  }).slice(0,2);
  return <div className="progress-dashboard journey-dashboard">
    <section className="journey-intro" aria-labelledby="journey-title">
      <div className="progress-card week-summary">
        <h2 id="journey-title">This week</h2>
        <div className="week-comparison"><strong>{journey.currentSessions} {journey.currentSessions===1?'session':'sessions'} so far</strong>
          {journey.firstDate&&journey.firstDate<journey.currentWeek&&<span>{comparison}</span>}</div>
      </div>
      {journey.sessions.length > 0
        ? <WeeklyChart journey={journey} unit={unit} range={range} onRange={onRange}/>
        : <div className="dashboard-empty"><span className="snapshot-icon"><Dumbbell size={21}/></span><h3>Start with one session</h3><p>Save a workout with logged sets to see your training history and lift trends here.</p><button className="text-button" onClick={() => onGo('programme')}>Explore programme<ArrowRight size={16}/></button></div>}
    </section>
    <section className="recent-progress progress-card" aria-labelledby="recent-progress-title">
      <div className="dashboard-section-head"><h2 id="recent-progress-title">Recent exercise progress</h2>
        <button className="text-button" onClick={()=>onGo('progress/exercises')}>{recent.length?'See all exercises':'Explore exercises'}<ChevronRight size={16}/></button></div>
      {recent.length>0&&<ul>{recent.map(({series,previous,label})=><li key={series.key}>
        <button type="button" onClick={()=>onGo('progress/movement',series.key)}>
          <span>{series.exercise.name}<small>vs {dateLabel(previous.session.date)}</small></span>
          <strong>{label}</strong><ChevronRight size={16}/>
        </button>
      </li>)}</ul>}
    </section>
    <section aria-labelledby="bodyweight-overview-title">
      <div className="dashboard-section-head"><h2 id="bodyweight-overview-title">Bodyweight</h2><button className="text-button" onClick={onBody}><Plus size={16}/>Log bodyweight</button></div>
      <div className="journey-chart-card body-trend"><BodyweightChart body={store.body} unit={unit}/><button className="text-button body-records-link" onClick={() => onGo('progress/bodyweight')}>View records<ChevronRight size={16}/></button></div>
    </section>
    {journey.firstDate&&<section className="volume-overview" aria-labelledby="distribution-title">
      <div className="dashboard-section-head"><div><h2 id="distribution-title">All time</h2><p className="muted">Since {fullDate(journey.firstDate)}</p></div>
        <button className="text-button" onClick={()=>onVolume('all')}>Training volume<ChevronRight size={16}/></button></div>
      <dl className="lifetime-totals progress-card">{[[journey.sessions.length,'Workouts'],[journey.sets,'Logged sets'],[journey.activeWeeks,'Active weeks']].map(([value,label])=>
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="distribution-card">
        <h3>External load by workout type</h3>
        {totalVolume>0 ? <>
          <div className="volume-split" aria-hidden="true"><span style={{width:`${upperShare}%`}}/><span/></div>
          <dl className="volume-split-labels">{distribution.groups.map((group,index)=><div key={group.label}>
            <dt>{group.label} · {index===0?upperShare:100-upperShare}%</dt>
            <dd>{number(fromKg(group.volume,unit),2)} {unit} × reps</dd>
          </div>)}</dl>
        </> : <p className="muted">No external load logged yet.</p>}
        {distribution.coreSeconds>0&&<div className="core-hold-total"><span><Activity size={18}/><strong>Core holds</strong></span><strong>{durationLabel(distribution.coreSeconds)}</strong></div>}
        <details className="progress-method"><summary>How it’s calculated</summary><p>External load × reps is grouped by workout type. Assisted, bodyweight and timed work is excluded. Per-hand and per-side values use the logged values. Core holds show total seconds as logged.</p></details>
      </div>
    </section>}
  </div>;
}
