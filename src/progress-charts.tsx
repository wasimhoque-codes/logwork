import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { Unit } from './data';
import { dateLabel, fromKg, number } from './model';
import { useContentFade } from './motion';
import type { ExerciseChartMetric, ExerciseObservation, MovementDay, MovementRecord, MovementSeries, trainingJourney } from './progress-data';

export const fullDate = (date: string) => dateLabel(date, { day: 'numeric', month: 'short', year: 'numeric' });
export const movementUnit = (series: MovementSeries, unit: Unit) => series.exercise.timed ? 'sec' : series.mode === 'bodyweight' ? 'reps' : unit;
export const movementValue = (record: MovementRecord, unit: Unit) => record.exercise.timed || record.log.mode === 'bodyweight' ? record.value : fromKg(record.value, unit);
export function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60), remainder = seconds % 60;
  return minutes ? `${minutes}m${remainder ? ` ${remainder}s` : ''}` : `${seconds}s`;
}
export function setLabel({ exercise, log, best }: Pick<MovementRecord, 'exercise' | 'log' | 'best'>, unit: Unit) {
  const load = log.mode !== 'bodyweight' ? `${number(fromKg(best.weight ?? 0, unit), 2)} ${unit}${log.mode === 'assistance' ? ' assist' : ''} × ` : '';
  return `${load}${exercise.timed ? durationLabel(best.reps) : `${best.reps} ${best.reps === 1 ? 'rep' : 'reps'}`}${exercise.perSide ? ' / side' : ''}`;
}
export function changeLabel(series: MovementSeries, first: MovementRecord, last: MovementRecord, unit: Unit) {
  const delta = movementValue(last, unit) - movementValue(first, unit);
  const rounded = Math.round(delta * 100) / 100;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${number(Math.abs(rounded), 2)} ${movementUnit(series, unit)}${!series.exercise.timed && series.mode !== 'bodyweight' ? series.mode === 'assistance' ? ' assistance' : ' load' : ''}`;
}
export function setupLabel(series: MovementSeries, includeBasic = true) {
  const ex = series.exercise;
  return [series.mode === 'assistance' ? 'Assisted' : series.mode === 'bodyweight' ? 'Bodyweight' : '', ex.supportCm != null ? `${ex.supportCm} cm support` : '', includeBasic || ex.coreLevel !== 'Basic' ? ex.coreLevel : ''].filter(Boolean).join(' · ');
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

export function directoryChange(series: MovementSeries, change: {previous?:MovementRecord;latest:MovementRecord}, unit: Unit) {
  const {previous,latest}=change;
  if(!previous)return '';
  if(previous.value===latest.value&&previous.best.reps===latest.best.reps)return '';
  if(series.exercise.timed){
    const delta=latest.value-previous.value;
    return `${delta>0?'+':'−'}${durationLabel(Math.abs(delta))}${series.exercise.perSide?' / side':''}`;
  }
  if(series.mode!=='bodyweight'&&latest.value===previous.value){
    const load=`${number(fromKg(latest.value,unit),2)} ${unit}${series.mode==='assistance'?' assist':''}`;
    return `${recentMovementChange(series,previous,latest,unit)} at ${load}`;
  }
  return changeLabel(series,previous,latest,unit);
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

type MovementChartProps = { series: MovementSeries; days: MovementDay[]; unit: Unit; metric?:ExerciseChartMetric; observations?:(ExerciseObservation|undefined)[] } & (
  { onSelect?: undefined; selected?: undefined } | { onSelect: (index: number) => void; selected: number }
);

export function MovementChart({ series, days, unit, selected, onSelect, metric='top', observations }: MovementChartProps) {
  const simple = onSelect === undefined;
  const { ref, width } = usePlotWidth();
  const id = useId();
  const index = selected ?? days.length - 1;
  const topUsesLoad=!series.exercise.timed&&series.mode!=='bodyweight';
  const values=observations?observations.map(point=>point?(metric==='estimate'?fromKg(point.value,unit):point.value):null):days.map(day=>movementValue(day.best,unit));
  const isLoad=metric==='top'&&topUsesLoad;
  const present=values.filter((value):value is number=>value!==null);
  const ticks=movementScale(present.length?present:[0],metric==='reps'||metric==='top'&&!isLoad);
  const tickLabels = ticks.map(value => number(value, 2));
  const low = ticks[0], high = ticks.at(-1)!;
  const height = simple ? 108 : 222, top = simple ? 21 : 27, bottom = height - 30;
  const axis = Math.max(29, Math.max(...tickLabels.map(label => label.length)) * 7 + 13);
  const left = simple ? 27 : axis + 25;
  const right = width - 27;
  const first = days[0], last = days.at(-1)!;
  const positions = days.map(({ day }) => first === last ? (left + right) / 2 : left + (day - first.day) / (last.day - first.day) * (right - left));
  const y = (value: number) => bottom - (value - low) / (high - low) * (bottom - top);
  const path = values.map((value,i)=>value===null?'':`${i&&values[i-1]!==null?'L':'M'}${positions[i]},${y(value)}`).join(' ');
  const showYear = first.date.slice(0, 4) !== last.date.slice(0, 4);
  const dates = days.map(({ date }) => dateLabel(date, { day: 'numeric', month: 'short', year: showYear ? '2-digit' : undefined }));
  // Keep long labels inside the chart even when the point is near an edge.
  const datePositions = positions.map((x, i) => {
    const margin = dates[i].length * 3 + 4;
    return Math.min(width - margin, Math.max(margin, x));
  });
  const reps = days.map(({ best }) => `${best.best.reps} ${best.best.reps === 1 ? 'rep' : 'reps'}`);
  const labels = dates.map((date, i) => isLoad && reps[i].length > date.length ? reps[i] : date);
  const labeled = chartLabels(datePositions, labels, index);
  const describe=({date,best}:MovementDay,i:number)=>{
    const observation=observations?.[i];
    return `${fullDate(date)}, ${values[i]===null?'no matching set':setLabel(observation?.record??best,unit)}${metric==='estimate'&&values[i]!==null?', estimated 1RM '+number(values[i])+' '+unit:''}`;
  };

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
            <line x1={axis} x2={right} y1={y(value)} y2={y(value)} className="body-chart-grid"/>
            <text x={axis - 8} y={y(value) + 4} textAnchor="end">{tickLabels[i]}</text>
          </g>)}
          {days.length > 1 && <>
            {present.length===values.length&&<path d={`${path} L${positions.at(-1)},${bottom} L${positions[0]},${bottom} Z`} fill={`url(#${id})`}/>}
            <path d={path} className="movement-line"/>
          </>}
          {!simple && <line x1={positions[index]} x2={positions[index]} y1={values[index]===null?top:y(values[index])} y2={bottom + 5} className="movement-guide"/>}
        </g>
        {days.map((day, i) => {
          const x = positions[i], value=values[i], active=i===index;
          const cy=value===null?bottom:y(value);
          const gapToNeighbour = Math.min(x - (positions[i - 1] ?? -Infinity), (positions[i + 1] ?? Infinity) - x);
          const dense = gapToNeighbour < 11;
          const mark = value===null?null:<g className={onSelect && active ? 'movement-point-depth' : undefined}>
            {active && <circle cx={x} cy={cy} r={9} className="movement-ring"/>}
            <circle cx={x} cy={cy} r={active ? 5 : dense ? 1.7 : 3.5} className={active ? 'movement-dot is-selected' : dense ? 'movement-dot is-dense' : 'movement-dot'}/>
          </g>;
          if (!onSelect) return <g key={day.date} aria-hidden="true">{mark}</g>;
          const hitStart = i === 0 ? 0 : (positions[i - 1] + x) / 2;
          const hitEnd = i === days.length - 1 ? width : (x + positions[i + 1]) / 2;
          return <g key={day.date} data-point={i} role="button" tabIndex={active ? 0 : -1}
            aria-pressed={active} aria-label={describe(day,i)} onClick={() => onSelect(i)}
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
          {isLoad && [...labeled].filter(i=>simple||positions[i]-reps[i].length*3>=axis).map(i => <text key={days[i].date} x={positions[i]} y={y(values[i]!) - 14}
            textAnchor="middle" className={i === index ? 'movement-label-selected' : undefined}>{reps[i]}</text>)}
          {[...labeled].map(i => <text key={days[i].date} x={datePositions[i]} y={height - 7}
            textAnchor="middle" className={i === index ? 'movement-label-selected' : undefined}>{dates[i]}</text>)}
        </g>
      </svg>
    </div>
  </div>;
}
export type TrainingRange='short'|'recent'|'all';
export const trainingRangeLabel: Record<TrainingRange,string> = { short:'Last 4 weeks',recent:'Last 8 weeks',all:'All time' };
export function TrainingRangeSelect({range,onRange}:{range:TrainingRange;onRange:(range:TrainingRange)=>void}) {
  return <select aria-label="Weekly date range" value={range} onChange={event=>onRange(event.target.value as TrainingRange)}>
    {Object.entries(trainingRangeLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}
  </select>;
}

export function WeeklyChart({journey,unit,range,onRange,volumeOnly=false}:{journey:ReturnType<typeof trainingJourney>;unit:Unit;range:TrainingRange;onRange?:(value:TrainingRange)=>void;volumeOnly?:boolean}) {
  const [metric,setMetric]=useState<'sessions'|'volume'>('sessions');
  const [selected,setSelected]=useState<string>();
  const {ref,width}=usePlotWidth();
  const barsRef=useRef<SVGGElement>(null);
  const weeks=range==='all'?journey.weeks:journey.weeks.filter(week=>week.date>=journey.recentWeeks[range==='short'?4:0].date&&week.date<=journey.currentWeek);
  const volume=volumeOnly||metric==='volume';
  useContentFade(barsRef,volume?'volume':'sessions');
  useLayoutEffect(()=>{
    if(ref.current)ref.current.scrollLeft=range==='all'?ref.current.scrollWidth:0;
  },[range,weeks.length,ref]);
  if(!weeks.length)return null;
  const values=weeks.map(week=>volume?fromKg(week.volume,unit):week.sessions);
  const max=values.reduce((total,value)=>Math.max(total,value),1),label=volume?`${unit} × reps`:'sessions';
  const left=Math.max(40,number(max,1).length*7+14),chartWidth=Math.max(width,left+10+weeks.length*25),right=chartWidth-10;
  const step=(right-left)/weeks.length,barWidth=Math.min(32,step*.64);
  const found=weeks.findIndex(week=>week.date===selected),index=found<0?weeks.length-1:found;
  function focusWeek(next:number) {
    const element=ref.current?.querySelector<SVGGElement>(`[data-week="${next}"]`);
    setSelected(weeks[next].date);
    element?.focus({preventScroll:true});
    element?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  return <section className="weekly-history">
    <div className="weekly-chart-heading"><h3>{volumeOnly?`Volume · ${unit} × reps`:'Training trend'}</h3>
      {onRange&&<TrainingRangeSelect range={range} onRange={onRange}/>}
    </div>
      {!volumeOnly&&<div className="volume-detail-switch" role="group" aria-label="Weekly chart metric">
        <button className="small-button" aria-pressed={!volume} onClick={()=>setMetric('sessions')}>Sessions</button>
        <button className="small-button" aria-pressed={volume} onClick={()=>setMetric('volume')}>External-load volume</button>
      </div>}
    <p className="weekly-selection" role="status">Week of {fullDate(weeks[index].date)} · <strong>{number(values[index],2)} {label}</strong>{weeks[index].date===journey.currentWeek&&' · In progress'}</p>
    <div ref={ref} className="weekly-scroll">
      <svg width={chartWidth} height="192" viewBox={`0 0 ${chartWidth} 192`} role="group" aria-label={`Weekly ${label}. Use arrow keys to select a week.`}>
        {[max,max/2,0].filter((value,i)=>volume||i!==1||Number.isInteger(value)).map(value=><g key={value} aria-hidden="true">
          <line x1={left} x2={right} y1={150-value/max*125} y2={150-value/max*125} className="body-chart-grid"/>
          <text x={left-8} y={154-value/max*125} textAnchor="end">{number(value,volume?1:0)}</text>
        </g>)}
        <g ref={barsRef}>{weeks.map((week,i)=><g key={week.date} data-week={i} role="button" tabIndex={i===index?0:-1}
          aria-pressed={i===index} aria-label={`Week of ${fullDate(week.date)}, ${number(values[i],2)} ${label}`}
          onClick={()=>setSelected(week.date)} onKeyDown={event=>{
            const next={ArrowLeft:i-1,ArrowRight:i+1,Home:0,End:weeks.length-1,Enter:i,' ':i}[event.key];
            if(next===undefined)return;
            event.preventDefault();focusWeek(Math.max(0,Math.min(weeks.length-1,next)));
          }}>
          <rect x={left+i*step} y="8" width={step} height="151" fill="transparent"/>
          <rect x={left+i*step+(step-barWidth)/2} y={150-Math.max(2,values[i]/max*125)} width={barWidth} height={Math.max(2,values[i]/max*125)} rx="3" className="weekly-bar" data-current={week.date===journey.currentWeek||undefined}/>
        </g>)}</g>
        {weeks.map((week,i)=>(i===0||i===weeks.length-1||i%Math.ceil(82/step)===0&&i*step>74&&(weeks.length-i-1)*step>74)&&<text key={week.date} aria-hidden="true" x={i===0?left:i===weeks.length-1?right:left+(i+.5)*step} y="181" textAnchor={i===0?'start':i===weeks.length-1?'end':'middle'}>{dateLabel(week.date)}</text>)}
      </svg>
    </div>
    <p className="chart-caption">{volume?`External load × reps, as recorded in ${unit}.`:'Includes partial workouts with logged sets.'}</p>
    <details className="progress-method"><summary>How it’s calculated</summary><p>Weeks start Monday. {volume?'Assisted, bodyweight and timed work is excluded. Values are recorded as entered per hand or side.':'Optional sessions count when they have logged sets.'}</p></details>
  </section>;
}
