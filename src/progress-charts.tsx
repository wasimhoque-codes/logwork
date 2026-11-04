import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { Unit } from './data';
import { dateLabel, fromKg, number } from './model';
import type { MovementRecord, MovementSeries, trainingJourney } from './progress-data';

export const fullDate = (date: string) => dateLabel(date, { day: 'numeric', month: 'short', year: 'numeric' });
export const movementUnit = (series: MovementSeries, unit: Unit) => series.exercise.timed ? 'sec' : series.mode === 'bodyweight' ? 'reps' : unit;
export const movementValue = (record: MovementRecord, unit: Unit) => record.exercise.timed || record.log.mode === 'bodyweight' ? record.value : fromKg(record.value, unit);
export function setLabel(record: MovementRecord, unit: Unit) {
  const { exercise, log, best } = record;
  const load = log.mode !== 'bodyweight' ? `${number(fromKg(best.weight ?? 0, unit), 2)} ${unit}${log.mode === 'assistance' ? ' assist' : ''} × ` : '';
  return `${load}${best.reps} ${exercise.timed ? 'sec' : 'reps'}${exercise.perSide ? ' / side' : ''}`;
}
export function changeLabel(series: MovementSeries, first: MovementRecord, last: MovementRecord, unit: Unit) {
  const delta = movementValue(last, unit) - movementValue(first, unit);
  const rounded = Math.round(delta * 100) / 100;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${number(Math.abs(rounded), 2)} ${movementUnit(series, unit)}${!series.exercise.timed && series.mode !== 'bodyweight' ? series.mode === 'assistance' ? ' assistance' : ' load' : ''}`;
}
export function setupLabel(series: MovementSeries) {
  const ex = series.exercise;
  return [series.mode === 'assistance' ? 'Assisted' : series.mode === 'bodyweight' ? 'Bodyweight' : '', ex.setup, ex.supportCm != null ? `${ex.supportCm} cm support` : '', ex.coreLevel].filter(Boolean).join(' · ');
}
function usePlotWidth() {
  const ref = useRef<HTMLDivElement>(null), [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const element = ref.current; if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(180, element.getBoundingClientRect().width)));
    observer.observe(element); setWidth(Math.max(180, element.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}
export function MovementTable({ series, records, unit }: { series: MovementSeries; records: MovementRecord[]; unit: Unit }) {
  return <div className="sr-only"><table><caption>{series.exercise.name} recorded sets</caption><thead><tr><th scope="col">Date</th><th scope="col">Representative set</th><th scope="col">Logged sets</th></tr></thead><tbody>{records.map(record => <tr key={record.session.id}><th scope="row">{fullDate(record.session.date)}</th><td>{setLabel(record, unit)}</td><td>{record.sets.length}</td></tr>)}</tbody></table></div>;
}
export function MovementChart({ series, unit, mini = false, compact = false }: { series: MovementSeries; unit: Unit; mini?: boolean; compact?: boolean }) {
  const simple = mini || compact;
  const { ref, width } = usePlotWidth(), id = useId(), [selectedId, setSelectedId] = useState('');
  const records = mini ? series.records.slice(-5) : series.records;
  const selected = records.findIndex(r => r.session.id === selectedId), index = selected < 0 ? records.length - 1 : selected;
  const current = records[index], values = records.map(r => movementValue(r, unit));
  const min = Math.min(...values), max = Math.max(...values), pad = Math.max((max - min) * .18, max === 0 ? 1 : Math.abs(max) * .04);
  const low = Math.max(0, min - pad), high = max + pad;
  const left = simple ? 8 : 49, right = width - (simple ? 8 : 14), bottom = compact ? 126 : mini ? 62 : 188, top = simple ? 12 : 22;
  const start = records[0].session.startedAt, end = records.at(-1)!.session.startedAt;
  const x = (i: number) => records.length === 1 ? (left + right) / 2 : left + (end === start ? i / (records.length - 1) : (records[i].session.startedAt - start) / (end - start)) * (right - left);
  const y = (value: number) => bottom - (value - low) / (high - low) * (bottom - top);
  const path = records.map((record, i) => `${i ? 'L' : 'M'}${x(i)},${y(movementValue(record, unit))}`).join(' ');
  const recentStart = Math.max(0, records.length - 5);
  function select(i: number, focus = false) {
    setSelectedId(records[i].session.id);
    if (focus) ref.current?.querySelector<SVGGElement>(`[data-point="${i}"]`)?.focus();
  }
  return <div className={simple ? 'movement-spark' : 'movement-chart'}>
    {!simple && <div className="journey-legend"><span><i/>Full history</span><span><i className="recent-key"/>Latest {Math.min(5, records.length)}</span><span>{movementUnit(series, unit)}</span></div>}
    <div ref={ref} className="journey-plot"><svg width="100%" height={compact ? 140 : mini ? 76 : 222} viewBox={`0 0 ${width} ${compact ? 140 : mini ? 76 : 222}`} role={simple ? 'img' : 'group'} aria-label={simple ? `${series.exercise.name}: ${records.map(r => `${fullDate(r.session.date)}, ${setLabel(r, unit)}`).join('; ')}` : `${series.exercise.name} full-history chart. Use arrow keys to explore recorded sessions.`}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--chart-fill)" stopOpacity=".2"/><stop offset="1" stopColor="var(--chart-fill)" stopOpacity="0"/></linearGradient></defs>
      {!simple && [high, (low + high) / 2, low].map((value, i) => <g key={i} aria-hidden="true"><line x1={left} x2={right} y1={y(value)} y2={y(value)} className="body-chart-grid"/><text x={left - 8} y={y(value) + 4} textAnchor="end">{number(value, 1)}</text></g>)}
      {records.length > 1 && <><path d={`${path} L${x(records.length - 1)},${bottom} L${x(0)},${bottom} Z`} fill={`url(#${id})`} aria-hidden="true"/><path d={path} className="journey-history-line" aria-hidden="true"/><path d={records.slice(recentStart).map((record, j) => `${j ? 'L' : 'M'}${x(j + recentStart)},${y(movementValue(record, unit))}`).join(' ')} className="body-average-line" aria-hidden="true"/></>}
      {records.map((record, i) => simple ? <circle key={record.session.id} cx={x(i)} cy={y(movementValue(record, unit))} r="3.5" className={compact && i < recentStart ? 'journey-old-point' : 'body-weigh-in'}/> : <g key={record.session.id} data-point={i} role="button" tabIndex={i === index ? 0 : -1} aria-pressed={i === index} aria-label={`${fullDate(record.session.date)}: ${setLabel(record, unit)}`} onClick={() => select(i)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? Math.min(records.length - 1, i + 1) : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? Math.max(0, i - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? records.length - 1 : event.key === 'Enter' || event.key === ' ' ? i : null;
        if (next !== null) { event.preventDefault(); select(next, true); }
      }}><rect x={x(i) - 22} y={y(movementValue(record, unit)) - 22} width="44" height="44" fill="transparent"/><circle cx={x(i)} cy={y(movementValue(record, unit))} r={i === index ? 6 : 3.5} className={i >= recentStart ? 'body-weigh-in' : 'journey-old-point'} pointerEvents="none"/></g>)}
      {!simple && <g aria-hidden="true"><text x={left} y="216" textAnchor="start">{dateLabel(records[0].session.date, { month: 'short', year: '2-digit', day: 'numeric' })}</text>{records.length > 1 && <text x={right} y="216" textAnchor="end">{dateLabel(records.at(-1)!.session.date, { month: 'short', year: '2-digit', day: 'numeric' })}</text>}</g>}
    </svg></div>
    {compact && <div className="compact-chart-dates"><span>{dateLabel(records[0].session.date, { day: 'numeric', month: 'short', year: '2-digit' })}</span><span>{records.length > 1 ? dateLabel(records.at(-1)!.session.date, { day: 'numeric', month: 'short', year: '2-digit' }) : ""}</span></div>}
    {!simple && <><div className="selected-observation" aria-live="polite" aria-atomic="true"><span>{fullDate(current.session.date)}<small>{current.session.workout.name}</small></span><strong>{setLabel(current, unit)}<small>{current.sets.length} logged sets</small></strong></div><p className="chart-caption">{records.length} recorded sessions · Select a point to inspect its set.</p><MovementTable series={series} records={records} unit={unit}/></>}
  </div>;
}
export function WeeklyChart({ weeks, unit }: { weeks: ReturnType<typeof trainingJourney>['weeks']; unit: Unit }) {
  const [metric, setMetric] = useState<'sessions' | 'volume'>('sessions'), { ref, width } = usePlotWidth();
  const chartWidth = Math.max(width, 52 + weeks.length * 18), left = 44, right = chartWidth - 10;
  const values = weeks.map(week => metric === 'sessions' ? week.sessions : fromKg(week.volume, unit));
  const max = Math.max(...values, 1), step = (right - left) / Math.max(weeks.length, 1), label = metric === 'sessions' ? 'sessions' : `${unit} × reps`;
  return <div className="weekly-history"><div className="weekly-chart-heading"><h3>Training over time</h3><div className="volume-detail-switch" role="group" aria-label="Weekly chart metric"><button className="small-button" aria-pressed={metric === 'sessions'} onClick={() => setMetric('sessions')}>Sessions</button><button className="small-button" aria-pressed={metric === 'volume'} onClick={() => setMetric('volume')}>Training volume</button></div></div>
    <div ref={ref} className="weekly-scroll" tabIndex={weeks.length > 12 ? 0 : undefined} role="region" aria-label="Weekly training chart, scroll horizontally for long histories"><svg width={chartWidth} height="192" viewBox={`0 0 ${chartWidth} 192`} role="img" aria-label={`Weekly ${label} since your first workout, including weeks with no logged sessions.`}>
      {[max, max / 2, 0].filter((value, i) => metric !== 'sessions' || i !== 1 || Number.isInteger(value)).map(value => <g key={value} aria-hidden="true"><line x1={left} x2={right} y1={150 - value / max * 125} y2={150 - value / max * 125} className="body-chart-grid"/><text x={left - 8} y={154 - value / max * 125} textAnchor="end">{number(value, metric === 'sessions' ? 0 : 1)}</text></g>)}
      {weeks.map((week, i) => <g key={week.date}><title>Week of {fullDate(week.date)}: {number(values[i])} {label}</title><rect x={left + i * step + step * .18} y={150 - values[i] / max * 125} width={step * .64} height={values[i] / max * 125} rx="3" className="weekly-bar"/>{(i === 0 || i === weeks.length - 1 || i % Math.max(1, Math.ceil(80 / step)) === 0 && i * step > 70 && (weeks.length - i - 1) * step > 70) && <text x={i === 0 ? left : i === weeks.length - 1 ? right : left + (i + .5) * step} y="181" textAnchor={i === 0 ? 'start' : i === weeks.length - 1 ? 'end' : 'middle'}>{dateLabel(week.date, { month: 'short', year: '2-digit', day: 'numeric' })}</text>}</g>)}
    </svg></div><p className="chart-caption">{metric === 'sessions' ? 'Saved workouts with logged sets, including partial and optional sessions.' : 'Recorded external load × reps. Assistance, bodyweight and timed work excluded; per-hand and per-side values are not doubled.'} Weeks start Monday. Gaps show weeks without logged training.{weeks.length > 12 && ' Scroll the chart to explore every week.'}</p>
    <div className="sr-only"><table><caption>Weekly training history in {label}</caption><thead><tr><th scope="col">Week starting</th><th scope="col">{label}</th></tr></thead><tbody>{weeks.map((week, i) => <tr key={week.date}><th scope="row">{fullDate(week.date)}</th><td>{number(values[i], 2)}</td></tr>)}</tbody></table></div>
  </div>;
}
