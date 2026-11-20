import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Unit } from './data';
import { dateLabel, fromKg, localDate, type BodyEntry } from './model';
import { bodyTrend, bodyTrendBounds, bodyRangePoints, bodyRangeDays, bodyTrendSegments, bodyNetChange, type BodyRange } from './body-trend';
import { calendarDay } from './progress-data';
import { ChevronLeft, ChevronRight, Scale, Plus } from './icons';

const ranges: BodyRange[] = ['1W', '1M', '3M', '1Y', 'All'];

export function BodyweightChart({body,unit,onLog}:{body:BodyEntry[];unit:Unit;onLog?:()=>void}) {
  const plotRef=useRef<HTMLDivElement>(null),[width,setWidth]=useState(320);
  const [range,setRange]=useState<BodyRange>('1M'),[selectedId,setSelectedId]=useState<string>();
  const all=useMemo(()=>bodyTrend(body),[body]);
  const today=calendarDay(localDate());
  const points=bodyRangePoints(all,range,today),latest=all.filter(point=>point.day<=today).at(-1);
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
  const selected=points[index],first=points[0],last=points.at(-1);
  const change=selected?Math.round(fromKg(bodyNetChange(points,selected),unit)*10)/10:0;
  const bounds=bodyTrendBounds(points);
  const rawStep=fromKg(bounds.high-bounds.low,unit)/3;
  const magnitude=10**Math.floor(Math.log10(rawStep));
  const step=Math.max(.5, [1,2,5,10].find(value=>value*magnitude>=rawStep)!*magnitude);
  const start=Math.floor(fromKg(bounds.low,unit)/step),end=Math.ceil(fromKg(bounds.high,unit)/step);
  const ticks=Array.from({length:end-start+1},(_,index)=>(index+start)*step);
  const high=ticks.at(-1)!,low=ticks[0],left=Math.max(42,String(high).length*7+12),right=width-12,top=20,bottom=190;
  const startDay=range==='All'?(first?.day??today):today-bodyRangeDays[range]+1;
  const endDay=range==='All'?(last?.day??today):today;
  const x=(day:number)=>startDay!==endDay?left+(day-startDay)/(endDay-startDay)*(right-left):(left+right)/2;
  const y=(kg:number)=>bottom-(fromKg(kg,unit)-low)/(high-low)*(bottom-top);
  const segments=bodyTrendSegments(points);
  const axisDate=(day:number)=>dateLabel(new Date(day*86400000).toISOString().slice(0,10),{day:'numeric',month:'short',year:new Date(startDay*86400000).getUTCFullYear()!==new Date(endDay*86400000).getUTCFullYear()?'2-digit':undefined});
  function select(i:number,focus=false){
    if(!points[i])return;
    setSelectedId(points[i].id);
    if(focus)plotRef.current?.querySelector<SVGGElement>(`[data-weigh-in="${i}"]`)?.focus({preventScroll:true});
  }
  function selectAt(clientX:number,svg:SVGSVGElement){
    const rect=svg.getBoundingClientRect(),position=(clientX-rect.left)*width/rect.width;
    let nearest=0;
    points.forEach((point,i)=>{if(Math.abs(x(point.day)-position)<Math.abs(x(points[nearest].day)-position))nearest=i;});
    select(nearest);
  }

  return <div className="bodyweight-chart">
    <div className="exercise-filters body-range-filters" role="group" aria-label="Bodyweight date range">
      {ranges.map(value=><button key={value} aria-pressed={range===value} onClick={()=>{setRange(value);setSelectedId(undefined);}}>{value}</button>)}
    </div>
    {selected&&first&&last?<>
      <div className="body-chart-readout" role="status" aria-live="polite" aria-atomic="true">
        <div className="body-chart-latest"><span className="body-chart-label">Trend weight · 7-day average</span><strong>{weight(selected.averageKg)} <span>{unit}</span></strong><time dateTime={selected.date}>{fullDate(selected.date)}</time></div>
        <div className="body-chart-change"><span className="body-chart-label">Net change</span><strong>{change>0?'+':''}{change.toFixed(1)} <small>{unit}</small></strong><span>Since {fullDate(first.date)}</span></div>
      </div>
      <div className="body-chart-legend" aria-label="Chart legend"><span><i className="average-key"/>7-day average</span><span><i className="weigh-in-key"/>Weigh-ins</span><span className="body-chart-unit">{unit}</span></div>
      <div ref={plotRef} className="body-chart-plot"><svg width="100%" height="228" viewBox={`0 0 ${width} 228`} role="group" aria-label="Bodyweight trend. Use arrow keys to select a reading."
        onPointerDown={event=>{if(event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);selectAt(event.clientX,event.currentTarget);}}
        onPointerMove={event=>{if(event.pointerType==='mouse'||event.currentTarget.hasPointerCapture(event.pointerId))selectAt(event.clientX,event.currentTarget);}}
        onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}>
        {ticks.map(tick=><g key={tick} aria-hidden="true"><line x1={left} x2={right} y1={y(tick/fromKg(1,unit))} y2={y(tick/fromKg(1,unit))} className="body-chart-grid"/><text x={left-8} y={y(tick/fromKg(1,unit))+4} textAnchor="end">{tick.toLocaleString('en-GB',{maximumFractionDigits:1})}</text></g>)}
        {points.map((point,i)=>{
          const position=x(point.day),hitStart=i?(x(points[i-1].day)+position)/2:left,hitEnd=i<points.length-1?(x(points[i+1].day)+position)/2:right;
          return <g key={point.id} data-weigh-in={i} role="button" tabIndex={i===index?0:-1} aria-pressed={i===index}
            aria-label={`${fullDate(point.date)}, trend ${weight(point.averageKg)} ${unit}, logged ${weight(point.kg)} ${unit}`} onClick={()=>select(i)} onFocus={()=>select(i)}
            onKeyDown={event=>{
              const next={ArrowLeft:i-1,ArrowRight:i+1,Home:0,End:points.length-1,Enter:i,' ':i}[event.key];
              if(next===undefined)return;
              event.preventDefault();select(Math.max(0,Math.min(points.length-1,next)),true);
            }}>
            <rect x={hitStart} y="4" width={Math.max(1,hitEnd-hitStart)} height="190" fill="transparent"/>
            <circle className="body-weigh-in" cx={position} cy={y(point.kg)} r={i===index?4.5:3} aria-hidden="true"/>
          </g>;
        })}
        <g aria-hidden="true" pointerEvents="none">{segments.map(segment=>segment.length>1?
          <path key={segment[0].id} className="body-average-line" d={segment.map((point,i)=>`${i?'L':'M'} ${x(point.day)} ${y(point.averageKg)}`).join(' ')}/>:
          <circle key={segment[0].id} className="body-average-marker" cx={x(segment[0].day)} cy={y(segment[0].averageKg)} r="4"/>)}</g>
        <g aria-hidden="true" pointerEvents="none"><line className="body-selection-line" x1={x(selected.day)} x2={x(selected.day)} y1={top} y2={bottom}/><circle className="body-average-marker" cx={x(selected.day)} cy={y(selected.averageKg)} r="4.5"/></g>
        <text x={startDay===endDay?x(startDay):left} y="216" textAnchor={startDay===endDay?'middle':'start'} aria-hidden="true">{axisDate(startDay)}</text>
        {startDay!==endDay&&<text x={right} y="216" textAnchor="end" aria-hidden="true">{axisDate(endDay)}</text>}
      </svg></div>
      <div className="body-reading">
        <div className="selected-workout-nav" role="group" aria-label="Browse weigh-ins">
          <button className="icon-button" aria-label="Previous weigh-in" disabled={index===0} onClick={()=>select(index-1)}><ChevronLeft size={18}/></button>
          <button className="icon-button" aria-label="Next weigh-in" disabled={index===points.length-1} onClick={()=>select(index+1)}><ChevronRight size={18}/></button>
        </div>
      </div>
      <div className="body-chart-stats">
        <div className="body-summary-value"><span className="body-chart-label">Logged weight</span><strong>{weight(selected.kg)} <small>{unit}</small></strong><span>{selected.id===latest.id?'Latest weigh-in':'Selected weigh-in'}</span></div>
        <div><span className="body-chart-label">7-day average</span><strong>{weight(selected.averageKg)} <small>{unit}</small></strong><span>{selected.count} {selected.count===1?'reading':'readings'} through {fullDate(selected.date)}</span></div>
      </div>
    </>:<div className="empty-chart-copy"><p>No weigh-ins in this period. Latest reading: {weight(latest.kg)} {unit} on {fullDate(latest.date)}.</p><button className="text-button" onClick={()=>{setRange('All');setSelectedId(undefined);}}>Show all weigh-ins</button></div>}
    <details className="progress-method"><summary>How it’s calculated</summary><p>The trend is the average of recorded weigh-ins on each date and the preceding six calendar days. Missing days do not count as zero. The line connects across up to three missed days and breaks for longer gaps. Net change compares the selected trend with the first trend in the chosen period.</p></details>
  </div>;
}
