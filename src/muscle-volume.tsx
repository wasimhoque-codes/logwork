import { trainingRangeLabel, type TrainingRange } from './progress-charts';
import type { volumeDistribution } from './progress-data';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fromKg, number } from './model';
import type { Unit } from './data';
import { motionDuration, motionPreference } from './motion';
import { drawTrainingModel, muscleRegions, muscleScene, type Scene } from './training-model';
import type { createMuscleModelRenderer } from './muscle-model-renderer';

type View = 'front' | 'back';
const cameraAngle = (view: View) => (view === 'back' ? Math.PI : 0) + .18;
const regionView = (label: string | undefined): View => muscleRegions.get(label ?? '')?.back ? 'back' : 'front';

function MuscleModel({ label, view }: { label: string; view: View }) {
  const stage = useRef<HTMLDivElement>(null);
  const fallback = useRef<HTMLCanvasElement>(null);
  const detailed = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Awaited<ReturnType<typeof createMuscleModelRenderer>>>(null);
  const fallbackScene = useRef<Scene>(null);
  const selected = useRef(label);
  const yaw = useRef(cameraAngle(view));
  const draw = useCallback((angle: number) => {
    yaw.current = angle;
    if (renderer.current) {
      try {
        renderer.current.draw(selected.current, angle);
        stage.current?.setAttribute('data-renderer', '3d');
        return;
      } catch {
        renderer.current.dispose();
        renderer.current = null;
      }
    }
    stage.current?.removeAttribute('data-renderer');
    if (fallback.current) {
      fallbackScene.current ??= muscleScene(selected.current);
      drawTrainingModel(fallback.current, fallbackScene.current, angle, .12, [0, .92, 0], .49);
    }
  }, []);

  useEffect(() => {
    const canvas = detailed.current;
    const container = stage.current;
    if (!canvas || !container) return;
    const request = new AbortController();
    const redraw = () => { if (renderer.current) draw(yaw.current); };
    const onContextLost = () => {
      request.abort();
      renderer.current?.dispose();
      renderer.current = null;
      draw(yaw.current);
    };
    const observer = new ResizeObserver(redraw);
    observer.observe(container);
    canvas.addEventListener('webglcontextlost', onContextLost);
    void import('./muscle-model-renderer').then(async module => {
      if (request.signal.aborted) return;
      const loaded = await module.createMuscleModelRenderer(canvas, request.signal);
      if (request.signal.aborted) {
        loaded.dispose();
        return;
      }
      renderer.current = loaded;
      redraw();
    }).catch(() => { /* The canvas fallback is already visible. */ });
    return () => {
      request.abort();
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.current?.dispose();
      renderer.current = null;
      container.removeAttribute('data-renderer');
    };
  }, [draw]);

  useLayoutEffect(() => {
    if (selected.current !== label) fallbackScene.current = null;
    selected.current = label;
    const preference = motionPreference();
    const target = cameraAngle(view);
    const duration = motionDuration('--motion-sheet');
    if (yaw.current === target || preference.matches || !duration) {
      draw(target);
      return;
    }
    const from = yaw.current;
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - start) / duration));
      draw(target + (from - target) * Math.pow(1 - progress, 3));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    const settle = () => { if (preference.matches) { cancelAnimationFrame(frame); draw(target); } };
    preference.addEventListener('change', settle);
    frame = requestAnimationFrame(animate);
    return () => { preference.removeEventListener('change', settle); cancelAnimationFrame(frame); };
  }, [draw, label, view]);

  return <div className="muscle-model-stage" ref={stage} aria-hidden="true">
    <canvas ref={fallback} width={370} height={400}/>
    <canvas ref={detailed} className="muscle-model-detail"/>
  </div>;
}

export function MuscleVolume({muscles,unit,range}:{muscles:ReturnType<typeof volumeDistribution>['muscles'];unit:Unit;range:TrainingRange}) {
  const [metric,setMetric]=useState<'sets'|'volume'>('sets');
  const [selection,setSelection]=useState<{label:string;view:View}>();
  const values=muscles.filter(row=>row[metric]>0).sort((a,b)=>b[metric]-a[metric]||a.label.localeCompare(b.label));
  const selected=values.find(row=>row.label===selection?.label)??values[0];
  const label=selected?.label;
  const view=selection?.label===label&&selection?selection.view:regionView(label);
  const max=values[0]?.[metric]??1;
  const format=(value:number)=>metric==='sets'?`${value} ${value===1?'set':'sets'}`:`${number(fromKg(value,unit),2)} ${unit} × reps`;
  return <section className="distribution-card muscle-breakdown">
    <h2>{metric==='sets'?'Logged sets by muscle':'External load by muscle'}</h2>
    <p className="muted">{trainingRangeLabel[range]}</p>
    <div className="volume-detail-switch" role="group" aria-label="Muscle chart metric">
      <button className="small-button" aria-pressed={metric==='sets'} onClick={()=>setMetric('sets')}>Logged sets</button>
      <button className="small-button" aria-pressed={metric==='volume'} onClick={()=>setMetric('volume')}>External-load volume</button>
    </div>
    {selected?<div className="muscle-volume-layout" data-has-model={muscleRegions.has(selected.label)}>
      {muscleRegions.has(selected.label)&&<div className="muscle-model">
        <MuscleModel label={selected.label} view={view}/>
        <p role="status">{label} · {view==='front'?'Front':'Back'} view</p>
        <div className="segmented" role="group" aria-label="Body model view">
          <button type="button" aria-pressed={view==='front'} onClick={()=>setSelection({label:selected.label,view:'front'})}>Front</button>
          <button type="button" aria-pressed={view==='back'} onClick={()=>setSelection({label:selected.label,view:'back'})}>Back</button>
        </div>
      </div>}
      <div className="muscle-rows" aria-label={metric==='sets'?'Logged sets by muscle':'Recorded volume by muscle'}>
        {values.map(row=><div key={row.label}>
          <button type="button" className="distribution-row muscle-row" aria-pressed={label===row.label}
            onClick={()=>setSelection({label:row.label,view:regionView(row.label)})}>
            <span className="muscle-row-value"><strong>{row.label}</strong><span>{format(row[metric])}</span></span>
            <span className="distribution-track" aria-hidden="true"><span style={{width:`${row[metric]/max*100}%`}}/></span>
          </button>
          {label===row.label&&<details className="progress-method muscle-exercises">
            <summary>Exercises for {row.label}</summary>
            <ul>{[...row.exercises].filter(([,value])=>value[metric]>0).sort(([aName,a],[bName,b])=>b[metric]-a[metric]||aName.localeCompare(bName)).map(([name,value])=>
              <li key={name}><span>{name}</span><strong>{format(value[metric])}</strong></li>)}</ul>
          </details>}
        </div>)}
      </div>
    </div>:<p className="empty-chart-copy">{metric==='sets'?'No sets logged in this period.':'No external load logged in this period.'}</p>}
    <details className="progress-method"><summary>How it’s calculated</summary><p>{metric==='sets'?'Each set counts once under the exercise’s recorded muscle group, including assisted, bodyweight and timed work.':'External load × reps is grouped by the muscle recorded for each exercise. Assisted, bodyweight and timed work is excluded. Values use the logged load per hand or side.'}</p></details>
  </section>;
}
