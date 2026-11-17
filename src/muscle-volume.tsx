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

export function MuscleVolume({muscles,unit,range}:{muscles:{label:string;volume:number;sets:number}[];unit:Unit;range:'recent'|'all'}) {
  const [metric,setMetric]=useState<'sets'|'volume'>('sets');
  const [selection,setSelection]=useState<{label:string;view:View}>();
  const values=muscles.filter(row=>row[metric]>0).sort((a,b)=>b[metric]-a[metric]||a.label.localeCompare(b.label));
  const initial=values.find(row=>muscleRegions.has(row.label))?.label;
  const label=selection&&values.some(row=>row.label===selection.label)?selection.label:initial;
  const view=selection?.label===label&&selection?selection.view:regionView(label);
  const max=values[0]?.[metric]??1;
  const rows=values.map(row=>{
    const contents=<>
      <span className="muscle-row-value"><strong>{row.label}</strong><span>{metric==='sets'?`${row.sets} ${row.sets===1?'set':'sets'}`:`${number(fromKg(row.volume,unit),2)} ${unit} × reps`}</span></span>
      <span className="distribution-track" aria-hidden="true"><span style={{width:`${row[metric]/max*100}%`}}/></span>
    </>;
    return muscleRegions.has(row.label)?
      <button type="button" key={row.label} className="distribution-row muscle-row" aria-pressed={label===row.label}
        onClick={()=>setSelection({label:row.label,view:regionView(row.label)})}>{contents}</button>:
      <div className="distribution-row muscle-row" key={row.label}>{contents}</div>;
  });
  return <section className="distribution-card muscle-breakdown">
    <h2>{metric==='sets'?'Working sets by muscle':'Volume by muscle'}</h2>
    <p className="muted">{range==='all'?'All time':'Last 8 weeks'}</p>
    <div className="volume-detail-switch" role="group" aria-label="Muscle chart metric">
      <button className="small-button" aria-pressed={metric==='sets'} onClick={()=>setMetric('sets')}>Working sets</button>
      <button className="small-button" aria-pressed={metric==='volume'} onClick={()=>setMetric('volume')}>External-load volume</button>
    </div>
    {values.length?<div className="muscle-volume-layout" data-has-model={!!label}>
      {label&&<div className="muscle-model">
        <MuscleModel label={label} view={view}/>
        <p role="status">{label} · {view==='front'?'Front':'Back'} view</p>
        <div className="segmented" role="group" aria-label="Body model view">
          <button type="button" aria-pressed={view==='front'} onClick={()=>setSelection({label,view:'front'})}>Front</button>
          <button type="button" aria-pressed={view==='back'} onClick={()=>setSelection({label,view:'back'})}>Back</button>
        </div>
      </div>}
      <div className="muscle-rows" aria-label={metric==='sets'?'Working sets by muscle':'Recorded volume by muscle'}>{rows}</div>
    </div>:<p className="empty-chart-copy">{metric==='sets'?'No working sets logged in this period.':'No external load logged in this period.'}</p>}
    <p className="distribution-caption">{metric==='sets'?'Each logged set counts once under the exercise’s stored muscle label, including assisted, bodyweight and timed work.':'Recorded external load × reps, grouped by the muscle label saved with each exercise. Assistance, bodyweight and timed work excluded. Per-hand and per-side values are recorded as entered.'}</p>
  </section>;
}
