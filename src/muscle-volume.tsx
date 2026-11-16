import { useLayoutEffect, useRef, useState } from 'react';
import { fromKg, number } from './model';
import type { Unit } from './data';
import { motionDuration, motionPreference } from './motion';
import { drawTrainingModel, muscleRegions, muscleScene } from './training-model';

type View = 'front' | 'back';
const cameraAngle = (view: View) => (view === 'back' ? Math.PI : 0) + .18;
const regionView = (label: string | undefined): View => muscleRegions.get(label ?? '')?.back ? 'back' : 'front';

function MuscleModel({ label, view }: { label?: string; view: View }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const yaw = useRef(cameraAngle(view));
  useLayoutEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const scene = muscleScene(label);
    const preference = motionPreference();
    const target = cameraAngle(view);
    const draw = (angle: number) => {
      yaw.current = angle;
      drawTrainingModel(surface, scene, angle, .12, [0, .92, 0], .49);
    };
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
  }, [label, view]);

  return <canvas ref={canvas} width={370} height={400} aria-hidden="true"/>;
}

export function MuscleVolume({ muscles, unit }: { muscles: { label: string; volume: number }[]; unit: Unit }) {
  const initial = muscles.find(row => muscleRegions.has(row.label))?.label;
  const [selection, setSelection] = useState<{ label: string; view: View }>();
  const label = selection && muscles.some(row => row.label === selection.label) ? selection.label : initial;
  const view = selection && selection.label === label ? selection.view : regionView(label);
  const max = Math.max(1, ...muscles.map(row => row.volume));
  const rows = muscles.map(row => {
    const contents = <>
      <span className="muscle-row-value"><strong>{row.label}</strong><span>{number(fromKg(row.volume, unit), 2)} {unit} × reps</span></span>
      <span className="distribution-track" aria-hidden="true"><span style={{ width: `${row.volume / max * 100}%` }}/></span>
    </>;
    return muscleRegions.has(row.label)
      ? <button type="button" key={row.label} className="distribution-row muscle-row" aria-pressed={label === row.label}
        onClick={() => setSelection({ label: row.label, view: regionView(row.label) })}>{contents}</button>
      : <div className="distribution-row muscle-row" key={row.label}>{contents}</div>;
  });
  return <section className="distribution-card muscle-breakdown">
    <h2>Volume by muscle</h2>
    <p className="muted">All time · {unit} × reps</p>
    {muscles.length ? <div className="muscle-volume-layout" data-has-model={!!label}>
      {label && <div className="muscle-model">
        <MuscleModel label={label} view={view}/>
        <p role="status">{label} · {view === 'front' ? 'Front' : 'Back'} view</p>
        <div className="segmented" role="group" aria-label="Body model view">
          <button type="button" aria-pressed={view === 'front'} onClick={() => setSelection({ label, view: 'front' })}>Front</button>
          <button type="button" aria-pressed={view === 'back'} onClick={() => setSelection({ label, view: 'back' })}>Back</button>
        </div>
      </div>}
      <div className="muscle-rows" aria-label="Recorded volume by muscle">{rows}</div>
    </div> : <p className="empty-chart-copy">No external load logged yet.</p>}
    <p className="distribution-caption">Recorded external load × reps, grouped by the muscle label saved with each exercise. Assistance, bodyweight and timed work excluded. Per-hand and per-side values are not doubled.</p>
  </section>;
}
