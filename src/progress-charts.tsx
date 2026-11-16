import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { Unit } from './data';
import { dateLabel, fromKg, number } from './model';
import { useContentFade } from './motion';
import type { MovementDay, MovementRecord, MovementSeries, trainingJourney } from './progress-data';

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
export function recentMovementChange(series: MovementSeries, first: MovementRecord, last: MovementRecord, unit: Unit) {
  if (!series.exercise.timed && series.mode !== 'bodyweight' && first.value === last.value) {
    const reps = last.best.reps - first.best.reps;
    return `${reps > 0 ? '+' : reps < 0 ? '−' : ''}${Math.abs(reps)} reps${series.exercise.perSide ? ' / side' : ''}`;
  }
  return changeLabel(series, first, last, unit);
}

export function movementMeasure(series: MovementSeries, unit: Unit) {
  const measure = series.exercise.timed ? 'Longest hold'
    : series.mode === 'bodyweight' ? 'Most reps'
    : series.mode === 'assistance' ? 'Least assistance' : 'Heaviest load';
  return `${measure} · ${movementUnit(series, unit)}${series.exercise.perSide ? ' / side' : ''}`;
}

function movementScale(values: number[], whole: boolean) {
  const min = Math.min(...values), max = Math.max(...values);
  const padding = Math.max((max - min) * .08, max * .02, whole ? 1 : .01);
  const lower = Math.max(0, min - padding), upper = max + padding;
  const rawStep = (upper - lower) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.max(whole ? 1 : .01, [1, 2, 5, 10].find(n => n * magnitude >= rawStep)! * magnitude);
  const start = Math.floor(lower / step);
  const end = Math.max(start + 1, Math.ceil(upper / step));
  return Array.from({ length: end - start + 1 }, (_, i) => (start + i) * step);
}

function chartLabels(positions: number[], labels: string[], selected: number) {
  const kept = new Set<number>();
  const priority = new Set([selected, 0, positions.length - 1, ...positions.keys()]);
  for (const index of priority) {
    // Reserve horizontal room for the full label, even on a flat line.
    if ([...kept].every(k => Math.abs(positions[k] - positions[index]) >= (labels[k].length + labels[index].length) * 3 + 5)) {
      kept.add(index);
    }
  }
  return kept;
}

type MovementChartProps = { series: MovementSeries; days: MovementDay[]; unit: Unit } & (
  { onSelect?: undefined; selected?: undefined } | { onSelect: (index: number) => void; selected: number }
);

export function MovementChart({ series, days, unit, selected, onSelect }: MovementChartProps) {
  const simple = onSelect === undefined;
  const { ref, width } = usePlotWidth();
  const id = useId();
  const index = selected ?? days.length - 1;
  const values = days.map(day => movementValue(day.best, unit));
  const isLoad = !series.exercise.timed && series.mode !== 'bodyweight';
  const ticks = movementScale(values, !isLoad);
  const tickLabels = ticks.map(value => number(value, 2));
  const low = ticks[0], high = ticks.at(-1)!;
  const height = simple ? 108 : 222, top = simple ? 21 : 27, bottom = height - 30;
  const left = simple ? 27 : Math.max(29, Math.max(...tickLabels.map(label => label.length)) * 7 + 13);
  const right = width - 27;
  const first = days[0], last = days.at(-1)!;
  const positions = days.map(({ day }) => first === last ? (left + right) / 2 : left + (day - first.day) / (last.day - first.day) * (right - left));
  const y = (value: number) => bottom - (value - low) / (high - low) * (bottom - top);
  const path = days.map((_, i) => `${i ? 'L' : 'M'}${positions[i]},${y(values[i])}`).join(' ');
  const showYear = first.date.slice(0, 4) !== last.date.slice(0, 4);
  const dates = days.map(({ date }) => dateLabel(date, { day: 'numeric', month: 'short', year: showYear ? '2-digit' : undefined }));
  // Keep long labels inside the chart even when the point is near an edge.
  const datePositions = positions.map((x, i) => {
    const margin = dates[i].length * 3 + 4;
    return Math.min(width - margin, Math.max(margin, x));
  });
  const reps = days.map(({ best }) => `${best.best.reps} reps`);
  const labels = dates.map((date, i) => isLoad && reps[i].length > date.length ? reps[i] : date);
  const labeled = chartLabels(datePositions, labels, index);
  const describe = ({ date, best }: MovementDay) => `${fullDate(date)}, ${setLabel(best, unit)}`;

  return <div className={simple ? 'movement-preview' : 'movement-detail-plot'}>
    <div ref={ref} className="journey-plot movement-plot">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}
        role={simple ? 'img' : 'group'}
        aria-label={simple ? `${series.exercise.name}. ${days.map(describe).join('; ')}` : `${series.exercise.name} progress. Use arrow keys to select a date.`}>
        <defs><linearGradient id={id} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop stopColor="var(--chart-fill)" stopOpacity=".32"/>
          <stop offset="100%" stopColor="var(--chart-fill)" stopOpacity="0"/>
        </linearGradient></defs>
        <g aria-hidden="true" pointerEvents="none">
          {!simple && ticks.map((value, i) => <g key={value}>
            <line x1={left} x2={right} y1={y(value)} y2={y(value)} className="body-chart-grid"/>
            <text x={left - 8} y={y(value) + 4} textAnchor="end">{tickLabels[i]}</text>
          </g>)}
          {days.length > 1 && <>
            <path d={`${path} L${positions.at(-1)},${bottom} L${positions[0]},${bottom} Z`} fill={`url(#${id})`}/>
            <path d={path} className="movement-line"/>
          </>}
          {!simple && <line x1={positions[index]} x2={positions[index]} y1={y(values[index])} y2={bottom + 5} className="movement-guide"/>}
        </g>
        {days.map((day, i) => {
          const x = positions[i], cy = y(values[i]), active = i === index;
          const gapToNeighbour = Math.min(x - (positions[i - 1] ?? -Infinity), (positions[i + 1] ?? Infinity) - x);
          const dense = gapToNeighbour < 11;
          const mark = <g className={onSelect && active ? 'movement-point-depth' : undefined}>
            {active && <circle cx={x} cy={cy} r={9} className="movement-ring"/>}
            <circle cx={x} cy={cy} r={active ? 5 : dense ? 1.7 : 3.5} className={active ? 'movement-dot is-selected' : dense ? 'movement-dot is-dense' : 'movement-dot'}/>
          </g>;
          if (!onSelect) return <g key={day.date} aria-hidden="true">{mark}</g>;
          const hitStart = i === 0 ? 0 : (positions[i - 1] + x) / 2;
          const hitEnd = i === days.length - 1 ? width : (x + positions[i + 1]) / 2;
          return <g key={day.date} data-point={i} role="button" tabIndex={active ? 0 : -1}
            aria-pressed={active} aria-label={describe(day)} onClick={() => onSelect(i)}
            onKeyDown={event => {
              const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: days.length - 1, Enter: i, ' ': i }[event.key];
              if (next === undefined) return;
              event.preventDefault();
              const target = Math.min(days.length - 1, Math.max(0, next));
              onSelect(target);
              ref.current?.querySelector<SVGGElement>(`[data-point="${target}"]`)?.focus({ preventScroll: true });
            }}>
            <rect x={hitStart} width={hitEnd - hitStart} y={5} height={height - 6} fill="transparent"/>
            <g aria-hidden="true" pointerEvents="none">{mark}</g>
          </g>;
        })}
        <g aria-hidden="true" pointerEvents="none">
          {isLoad && [...labeled].map(i => <text key={days[i].date} x={positions[i]} y={y(values[i]) - 14}
            textAnchor="middle" className={i === index ? 'movement-label-selected' : undefined}>{reps[i]}</text>)}
          {[...labeled].map(i => <text key={days[i].date} x={datePositions[i]} y={height - 7}
            textAnchor="middle" className={i === index ? 'movement-label-selected' : undefined}>{dates[i]}</text>)}
        </g>
      </svg>
    </div>
  </div>;
}
export function WeeklyChart({ weeks, unit }: { weeks: ReturnType<typeof trainingJourney>['weeks']; unit: Unit }) {
  const [metric, setMetric] = useState<'sessions' | 'volume'>('sessions'), { ref, width } = usePlotWidth();
  const barsRef = useRef<SVGGElement>(null);
  useContentFade(barsRef, metric);
  const chartWidth = Math.max(width, 52 + weeks.length * 18), left = 44, right = chartWidth - 10;
  const values = weeks.map(week => metric === 'sessions' ? week.sessions : fromKg(week.volume, unit));
  const max = Math.max(...values, 1), step = (right - left) / Math.max(weeks.length, 1), label = metric === 'sessions' ? 'sessions' : `${unit} × reps`;
  const barWidth = Math.min(32, step * .64);
  return <div className="weekly-history"><div className="weekly-chart-heading"><h3>Training over time</h3><div className="volume-detail-switch" role="group" aria-label="Weekly chart metric"><button className="small-button" aria-pressed={metric === 'sessions'} onClick={() => setMetric('sessions')}>Sessions</button><button className="small-button" aria-pressed={metric === 'volume'} onClick={() => setMetric('volume')}>Training volume</button></div></div>
    <div ref={ref} className="weekly-scroll" tabIndex={weeks.length > 12 ? 0 : undefined} role="region" aria-label="Weekly training chart, scroll horizontally for long histories"><svg width={chartWidth} height="192" viewBox={`0 0 ${chartWidth} 192`} role="img" aria-label={`Weekly ${label} since your first workout, including weeks with no logged sessions.`}>
      {[max, max / 2, 0].filter((value, i) => metric !== 'sessions' || i !== 1 || Number.isInteger(value)).map(value => <g key={value} aria-hidden="true"><line x1={left} x2={right} y1={150 - value / max * 125} y2={150 - value / max * 125} className="body-chart-grid"/><text x={left - 8} y={154 - value / max * 125} textAnchor="end">{number(value, metric === 'sessions' ? 0 : 1)}</text></g>)}
      <g ref={barsRef}>{weeks.map((week, i) => <g key={week.date}><title>Week of {fullDate(week.date)}: {number(values[i])} {label}</title><rect x={left + i * step + (step - barWidth) / 2} y={150 - values[i] / max * 125} width={barWidth} height={values[i] / max * 125} rx="3" className="weekly-bar"/></g>)}</g>
      {weeks.map((week, i) => (i === 0 || i === weeks.length - 1 || i % Math.max(1, Math.ceil(80 / step)) === 0 && i * step > 70 && (weeks.length - i - 1) * step > 70) && <text key={week.date} x={i === 0 ? left : i === weeks.length - 1 ? right : left + (i + .5) * step} y="181" textAnchor={i === 0 ? 'start' : i === weeks.length - 1 ? 'end' : 'middle'}>{dateLabel(week.date, { month: 'short', year: '2-digit', day: 'numeric' })}</text>)}
    </svg></div><p className="chart-caption">{metric === 'sessions' ? 'Saved workouts with logged sets, including partial and optional sessions.' : 'Recorded external load × reps. Assistance, bodyweight and timed work excluded; per-hand and per-side values are not doubled.'} Weeks start Monday. Gaps show weeks without logged training.{weeks.length > 12 && ' Scroll the chart to explore every week.'}</p>
    <div className="sr-only"><table><caption>Weekly training history in {label}</caption><thead><tr><th scope="col">Week starting</th><th scope="col">{label}</th></tr></thead><tbody>{weeks.map((week, i) => <tr key={week.date}><th scope="row">{fullDate(week.date)}</th><td>{number(values[i], 2)}</td></tr>)}</tbody></table></div>
  </div>;
}
