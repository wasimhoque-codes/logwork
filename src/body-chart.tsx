import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { Unit } from './data';
import { dateLabel, fromKg, type BodyEntry } from './model';
import { bodyTrend, bodyTrendBounds } from './body-trend';
import { Scale, Plus } from './icons';

export function BodyweightChart({ body, unit, onLog }: { body: BodyEntry[]; unit: Unit; onLog?: () => void }) {
  const id = useId(), plotRef = useRef<HTMLDivElement>(null), [width, setWidth] = useState(320);
  const points = bodyTrend(body), first = points[0], latest = points.at(-1);
  useLayoutEffect(() => {
    const plot = plotRef.current; if (!plot) return;
    const measure = () => setWidth(Math.max(180, Math.round(plot.getBoundingClientRect().width)));
    measure(); const observer = new ResizeObserver(measure); observer.observe(plot);
    return () => observer.disconnect();
  }, [!!latest]);
  const weight = (kg: number) => fromKg(kg, unit).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fullDate = (date: string) => dateLabel(date, { day: 'numeric', month: 'short', year: 'numeric' });
  if (!latest) return <div className="body-chart-empty"><span className="empty-icon"><Scale size={25}/></span><h3>Your bodyweight trend starts here</h3><p>Log your first weigh-in. Every recorded day will appear here.</p>{onLog && <button className="primary full-width" onClick={onLog}><Plus size={18}/>Log bodyweight</button>}</div>;

  const { low, high } = bodyTrendBounds(points), left = 48, right = width - 10, top = 20, bottom = 190;
  const x = (position: number) => left + position * (right - left);
  const y = (kg: number) => bottom - (kg - low) / (high - low) * (bottom - top);
  const trend = points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.position)} ${y(point.averageKg)}`).join(' ');
  const dates = width < 340 || points.length < 3 ? [first, latest] : [first, points[Math.floor((points.length - 1) / 2)], latest];
  const dateTicks = [...new Map(dates.map(point => [point.date, point])).values()].filter((point, index, ticks) => index === 0 || index === ticks.length - 1 || (x(point.position) - left > 80 && right - x(point.position) > 80));
  const delta = latest.kg - first.kg, roundedDelta = Math.round(fromKg(delta, unit) * 10) / 10;
  const difference = points.length > 1 ? `${roundedDelta > 0 ? '+' : roundedDelta < 0 ? '−' : ''}${Math.abs(roundedDelta).toFixed(1)}` : '—';
  const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', ...(latest.day - first.day >= 365 ? { year: '2-digit' } : {}) };
  const summary = `${points.length} ${points.length === 1 ? 'weigh-in' : 'weigh-ins'} from ${fullDate(first.date)} to ${fullDate(latest.date)}. Latest ${weight(latest.kg)} ${unit}. Seven-day average ${weight(latest.averageKg)} ${unit}, based on ${latest.count} ${latest.count === 1 ? 'reading' : 'readings'}.`;
  return <div className="bodyweight-chart">
    <div className="body-chart-latest"><span className="body-chart-label">Latest weigh-in</span><strong>{weight(latest.kg)} <span>{unit}</span></strong><time dateTime={latest.date}>{fullDate(latest.date)}</time></div>
    <div className="body-chart-stats"><div><span className="body-chart-label">7-day average</span><strong>{weight(latest.averageKg)} <small>{unit}</small></strong><span>{latest.count} {latest.count === 1 ? 'reading' : 'readings'} in 7 days</span></div><div><span className="body-chart-label">Change since first</span><strong>{difference} {points.length > 1 && <small>{unit}</small>}</strong><span>Since {fullDate(first.date)}</span></div></div>
    <div className="body-chart-legend" aria-label="Chart legend"><span><i className="weigh-in-key"/>Weigh-ins</span>{points.length > 1 && <span><i className="average-key"/>7-day average</span>}<span className="body-chart-unit">{unit}</span></div>
    <div ref={plotRef} className="body-chart-plot"><svg width="100%" height="228" viewBox={`0 0 ${width} 228`} role="img" aria-label={`Bodyweight trend. ${summary}`}>
      <defs><linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart-fill)" stopOpacity=".3"/><stop offset="100%" stopColor="var(--chart-fill)" stopOpacity=".03"/></linearGradient></defs>
      {[high, (low + high) / 2, low].map((kg, index) => <g key={index} aria-hidden="true"><line x1={left} x2={right} y1={y(kg)} y2={y(kg)} className="body-chart-grid"/><text x={left - 8} y={y(kg) + 4} textAnchor="end">{weight(kg)}</text></g>)}
      {points.length > 1 && <><path d={`${trend} L ${x(latest.position)} ${bottom} L ${x(first.position)} ${bottom} Z`} fill={`url(#${id}-fill)`}/><path className="body-average-line" d={trend}/></>}
      {points.map(point => <circle className="body-weigh-in" key={point.id} cx={x(point.position)} cy={y(point.kg)} r="3.5" aria-hidden="true"/>)}
      {dateTicks.map((point, index) => <text key={point.date} x={x(point.position)} y="216" textAnchor={dateTicks.length === 1 ? 'middle' : index === 0 ? 'start' : index === dateTicks.length - 1 ? 'end' : 'middle'} aria-hidden="true">{dateLabel(point.date, dateOptions)}</text>)}
    </svg></div>
    <p className="body-chart-caption">{points.length === 1 ? 'One weigh-in recorded. Log another day to see your change over time.' : `${points.length} weigh-ins · ${fullDate(first.date)} – ${fullDate(latest.date)}`}<span>The 7-day average uses recorded readings only. Missing days are not estimated.</span></p>
    <div className="sr-only"><table><caption>Bodyweight chart readings in {unit}</caption><thead><tr><th scope="col">Date</th><th scope="col">Weigh-in</th><th scope="col">7-day average</th></tr></thead><tbody>{points.map(point => <tr key={point.id}><th scope="row">{fullDate(point.date)}</th><td>{weight(point.kg)} {unit}</td><td>{weight(point.averageKg)} {unit} ({point.count} readings)</td></tr>)}</tbody></table></div>
  </div>;
}
