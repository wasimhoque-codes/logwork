import type { Unit } from './data';
import { dateLabel, fromKg, number } from './model';
import { movementComparison, movementDays, type MovementSeries } from './progress-data';
import { movementMeasure, setLabel } from './progress-charts';

export function LiftSparkline({ series }: { series: MovementSeries }) {
  const days = movementDays(series).slice(-5);
  const values = days.map(day => day.best.value);
  const low = Math.min(...values), high = Math.max(...values);
  const first = days[0].day, last = days.at(-1)!.day;
  const x = (day: number) => last === first ? 110 : 8 + (day - first) / (last - first) * 204;
  const y = (value: number) => high === low ? 32 : 52 - (value - low) / (high - low) * 40;
  const points = days.map(day => `${x(day.day)},${y(day.best.value)}`).join(' ');
  return <span className="lift-sparkline" aria-hidden="true">
    <svg viewBox="0 0 220 64" preserveAspectRatio="none">
      <path d="M8 56H212" className="spark-baseline"/>
      {days.length > 1 && <polyline points={points} fill="none" className="spark-line"/>}
      {days.map((day, i) => <circle key={day.date} cx={x(day.day)} cy={y(day.best.value)} r={i === days.length - 1 ? 4 : 2.5} className={i === days.length - 1 ? 'spark-latest' : 'spark-point'}/>)}
    </svg>
  </span>;
}

export function LiftComparison({ series, unit }: { series: MovementSeries; unit: Unit }) {
  const { latest, previous, comparable, delta, direction, assistanceReduction } = movementComparison(series);
  const load = series.mode === 'bodyweight' ? '' : ` at ${number(fromKg(latest.best.weight ?? 0, unit), 2)} ${unit}${series.mode === 'assistance' ? ' assistance' : ''}`;
  return <span className="lift-comparison" data-direction={direction}>
    {!previous ? <span>First recorded date</span> : comparable ? <>
      <strong>{delta === 0 ? 'Same performance' : `${delta! > 0 ? '+' : '−'}${Math.abs(delta!)} ${series.exercise.timed ? 'sec' : 'reps'}${load}`}</strong>
      <small>vs {dateLabel(comparable.session.date)}</small>
    </> : assistanceReduction ? <>
      <strong>{number(fromKg(assistanceReduction, unit), 2)} {unit} less assistance</strong>
      <small>Previous: {setLabel(previous, unit)} · {dateLabel(previous.session.date)}</small>
    </> : <>
      <span>Previous: {setLabel(previous, unit)}</span>
      <small>{dateLabel(previous.session.date)} · different {series.mode === 'assistance' ? 'assistance' : 'load'}</small>
    </>}
  </span>;
}

export function LiftTrendLabel({ series, unit }: { series: MovementSeries; unit: Unit }) {
  const count = Math.min(5, movementDays(series).length);
  return <span className="lift-trend-label">{movementMeasure(series, unit).split(' · ')[0]} · {count === 1 ? '1 date' : `last ${count} dates`}</span>;
}
