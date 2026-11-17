import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Unit } from './data';
import { dateLabel, fromKg, localDate, type BodyEntry } from './model';
import { bodyTrend, bodyTrendBounds } from './body-trend';
import { calendarDay } from './progress-data';
import { ChevronLeft, ChevronRight, Scale, Plus } from './icons';

export function BodyweightChart({body,unit,onLog}:{body:BodyEntry[];unit:Unit;onLog?:()=>void}) {
  const id=useId(),plotRef=useRef<HTMLDivElement>(null),[width,setWidth]=useState(320);
  const [range,setRange]=useState<'recent'|'all'>('recent'),[selectedId,setSelectedId]=useState<string>();
  const all=useMemo(()=>bodyTrend(body),[body]),latest=all.at(-1);
  const today=calendarDay(localDate());
  const points=range==='all'?all:all.filter(point=>point.day>=today-29&&point.day<=today);
  const hasPlot=points.length>0;
  useLayoutEffect(()=>{
    const plot=plotRef.current;if(!plot)return;
    const measure=()=>setWidth(Math.max(180,Math.round(plot.getBoundingClientRect().width)));
    measure();
    const observer=new ResizeObserver(measure);observer.observe(plot);
    return ()=>observer.disconnect();
  },[hasPlot]);
  const weight=(kg:number)=>fromKg(kg,unit).toLocaleString('en-GB',{minimumFractionDigits:1,maximumFractionDigits:1});
  const fullDate=(date:string)=>dateLabel(date,{day:'numeric',month:'short',year:'numeric'});
  if(!latest)return <div className="body-chart-empty"><span className="empty-icon"><Scale size={25}/></span><h3>Your bodyweight trend starts here</h3><p>Log your first weigh-in to start the trend.</p>
    {onLog&&<button className="primary full-width" onClick={onLog}><Plus size={18}/>Log bodyweight</button>}</div>;
  const matched=points.findIndex(point=>point.id===selectedId),index=matched<0?points.length-1:matched;
  const selected=points[index]??latest,first=points[0],last=points.at(-1);
  const previous=all.filter(point=>point.day>=selected.day-13&&point.day<=selected.day-7);
  const change=previous.length?Math.round(fromKg(selected.averageKg-previous.reduce((total,point)=>total+point.kg,0)/previous.length,unit)*10)/10:null;
  const {low,high}=bodyTrendBounds(points),left=Math.max(42,weight(high).length*7+10),right=width-12,top=20,bottom=190;
  const x=(day:number)=>first&&last&&first.day!==last.day?left+(day-first.day)/(last.day-first.day)*(right-left):(left+right)/2;
  const y=(kg:number)=>bottom-(kg-low)/(high-low)*(bottom-top);
  const trend=points.map((point,i)=>`${i?'L':'M'} ${x(point.day)} ${y(point.averageKg)}`).join(' ');
  const dates=first&&last?(first===last?[first]:[first,last]):[];
  function select(i:number,focus=false){
    setSelectedId(points[i].id);
    if(focus)plotRef.current?.querySelector<SVGGElement>(`[data-weigh-in="${i}"]`)?.focus({preventScroll:true});
  }

  return <div className="bodyweight-chart">
    <div className="body-chart-latest"><span className="body-chart-label">Latest weigh-in</span><strong>{weight(latest.kg)} <span>{unit}</span></strong><time dateTime={latest.date}>{fullDate(latest.date)}</time></div>
    <div className="exercise-filters" role="group" aria-label="Bodyweight date range">
      <button aria-pressed={range==='recent'} onClick={()=>setRange('recent')}>Last 30 days</button>
      <button aria-pressed={range==='all'} onClick={()=>setRange('all')}>All time</button>
    </div>
    <div className="body-chart-stats">
      {change!==null&&<div><span className="body-chart-label">Change vs previous 7 days</span><strong>{change>0?'+':''}{change.toFixed(1)} <small>{unit}</small></strong><span>{previous.length} {previous.length===1?'reading':'readings'} in the previous period</span></div>}
      <div><span className="body-chart-label">7-day average</span><strong>{weight(selected.averageKg)} <small>{unit}</small></strong><span>{selected.count} {selected.count===1?'reading':'readings'} through {fullDate(selected.date)}</span></div>
    </div>
    {first&&last?<>
      <div className="body-chart-legend" aria-label="Chart legend"><span><i className="weigh-in-key"/>Weigh-ins</span><span><i className="average-key"/>7-day average</span><span className="body-chart-unit">{unit}</span></div>
      <div ref={plotRef} className="body-chart-plot"><svg width="100%" height="228" viewBox={`0 0 ${width} 228`} role="group" aria-label="Bodyweight trend. Use arrow keys to select a reading.">
        <defs><linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart-fill)" stopOpacity=".3"/><stop offset="100%" stopColor="var(--chart-fill)" stopOpacity=".03"/></linearGradient></defs>
        {[high,(low+high)/2,low].map(kg=><g key={kg} aria-hidden="true"><line x1={left} x2={right} y1={y(kg)} y2={y(kg)} className="body-chart-grid"/><text x={left-8} y={y(kg)+4} textAnchor="end">{weight(kg)}</text></g>)}
        {points.length>1&&<g aria-hidden="true"><path d={`${trend} L ${x(last.day)} ${bottom} L ${x(first.day)} ${bottom} Z`} fill={`url(#${id}-fill)`}/><path className="body-average-line" d={trend}/></g>}
        {points.map((point,i)=>{
          const position=x(point.day),hitStart=i?(x(points[i-1].day)+position)/2:0,hitEnd=i<points.length-1?(x(points[i+1].day)+position)/2:width;
          return <g key={point.id} data-weigh-in={i} role="button" tabIndex={i===index?0:-1} aria-pressed={i===index}
            aria-label={`${fullDate(point.date)}, ${weight(point.kg)} ${unit}`} onClick={()=>select(i)}
            onKeyDown={event=>{
              const next={ArrowLeft:i-1,ArrowRight:i+1,Home:0,End:points.length-1,Enter:i,' ':i}[event.key];
              if(next===undefined)return;
              event.preventDefault();select(Math.max(0,Math.min(points.length-1,next)),true);
            }}>
            <rect x={hitStart} y="4" width={hitEnd-hitStart} height="190" fill="transparent"/>
            <circle className="body-weigh-in" cx={position} cy={y(point.kg)} r={i===index?5:3.5} aria-hidden="true"/>
          </g>;
        })}
        {dates.map((point,i)=><text key={point.date} x={x(point.day)} y="216" textAnchor={dates.length===1?'middle':i===0?'start':'end'} aria-hidden="true">{dateLabel(point.date,{day:'numeric',month:'short',year:first.date.slice(0,4)!==last.date.slice(0,4)?'2-digit':undefined})}</text>)}
      </svg></div>
      <div className="body-reading">
        <p role="status"><strong>{weight(selected.kg)} {unit}</strong> · {fullDate(selected.date)}</p>
        <div className="selected-workout-nav" role="group" aria-label="Browse weigh-ins">
          <button className="icon-button" aria-label="Previous weigh-in" disabled={index===0} onClick={()=>select(index-1)}><ChevronLeft size={18}/></button>
          <button className="icon-button" aria-label="Next weigh-in" disabled={index===points.length-1} onClick={()=>select(index+1)}><ChevronRight size={18}/></button>
        </div>
      </div>
    </>:<p className="empty-chart-copy">No readings in the last 30 days. Select All time to view earlier weigh-ins.</p>}
    <p className="body-chart-caption">The seven-day rolling average uses readings recorded within each seven-day period.</p>
  </div>;
}
