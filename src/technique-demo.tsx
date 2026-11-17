import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pause, Play } from './icons';
import { MOBILITY, type Exercise } from './data';
import { motionPreference } from './motion';
import { demoScene, drawTrainingModel, type DemoId } from './training-model';

const demos = {
  'dead-bug': {
    label: 'Dead bug', duration: 5200, end: .25, front: .52, side: 1.23, pitch: .68, height: .24, zoom: .47,
    cue: 'Reach the opposite arm and leg away from each other. Keep ribs and pelvis steady and reach only as far as you can control.',
  },
  'incline-pushup': {
    label: 'Incline push-up', duration: 3600, end: .5, front: .22, side: 1.27, pitch: .35, height: .42, zoom: .48,
    cue: 'Place your hands on a steady raised surface. Keep ribs and pelvis aligned as you lower and press back up.',
  },
  'hip-switch': {
    label: '90/90 hip switches', duration: 5200, end: .5, front: .18, side: 1.13, pitch: .42, height: .36, zoom: .65,
    cue: 'Use your hands behind you for support and turn both knees slowly from one side to the other.',
  },
  'open-book': {
    label: 'Thoracic open books', duration: 4800, end: .5, front: .58, side: 1.29, pitch: .65, height: .28, zoom: .46,
    cue: 'Keep the pelvis and bent knees steady as the top arm and upper back open to the other side.',
  },
} satisfies Record<DemoId, { label: string; duration: number; end: number; front: number; side: number; pitch: number; height: number; zoom: number; cue: string }>;

function TechniquePlayer({ id }: { id: DemoId }) {
  const demo = demos[id];
  const canvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);
  const [angle, setAngle] = useState<'front' | 'side'>('side');
  const [playing, setPlaying] = useState(false);
  const [endPose, setEndPose] = useState(false);
  const [reduce, setReduce] = useState(() => motionPreference().matches);

  useEffect(() => {
    const preference = motionPreference();
    const onChange = () => {
      setReduce(preference.matches);
      if (preference.matches) setPlaying(false);
    };
    preference.addEventListener('change', onChange);
    onChange();
    return () => preference.removeEventListener('change', onChange);
  }, []);

  useLayoutEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const draw = (value: number) => drawTrainingModel(surface, demoScene(id, value), demo[angle], demo.pitch, [0, demo.height, 0], demo.zoom);
    if (reduce) {
      phase.current = endPose ? demo.end : 0;
      draw(phase.current);
      return;
    }
    draw(phase.current);
    if (!playing) return;
    const start = performance.now() - phase.current * demo.duration;
    let frame = 0, lastDraw = start - 25;
    const animate = (now: number) => {
      const next = Math.max(0, Math.min(1, (now - start) / demo.duration));
      if (now - lastDraw >= 25 || next === 1) {
        phase.current = next;
        draw(next);
        lastDraw = now;
      }
      if (next < 1) frame = requestAnimationFrame(animate);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [angle, demo, endPose, id, playing, reduce]);

  return <div className="technique-player">
    <canvas ref={canvas} width={600} height={342} role="img" aria-label={`${demo.label} demonstration, ${angle} view${reduce ? endPose ? ', end position' : ', start position' : ''}`}/>
    <div className="model-controls">
      <div className="segmented" role="group" aria-label="Technique camera angle">
        <button type="button" aria-pressed={angle === 'front'} onClick={() => setAngle('front')}>Front</button>
        <button type="button" aria-pressed={angle === 'side'} onClick={() => setAngle('side')}>Side</button>
      </div>
      {reduce ? <button type="button" className="small-button" onClick={() => setEndPose(value => !value)}>{endPose ? 'Show start position' : 'Show end position'}</button>
        : <button type="button" className="small-button" onClick={() => {
          if (phase.current >= 1) phase.current = 0;
          setPlaying(value => !value);
        }}>{playing ? <Pause size={16} aria-hidden="true"/> : <Play size={16} aria-hidden="true"/>}{playing ? 'Pause' : 'Play rep'}</button>}
    </div>
    <p>{demo.cue}</p>
  </div>;
}

function TechniqueDemo({ id, label }: { id: DemoId; label: string }) {
  const [open, setOpen] = useState(false);
  return <details className="guide-section technique-demo" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{label}</summary>
    {open && <TechniquePlayer id={id}/>}
  </details>;
}

export function ExerciseDemo({ exercise }: { exercise: Exercise }) {
  const id = exercise.id === 'p16-dead-bug' ? 'dead-bug' : exercise.id === 'p16-incline-pushup' ? 'incline-pushup' : null;
  return id && <TechniqueDemo key={id} id={id} label={`Watch ${demos[id].label.toLowerCase()} demo`}/>;
}

export function MobilityGuide({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  return <details className="guide-section" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{title}</summary>
    <ul className="guide-list">{MOBILITY.map(text => <li key={text}>{text}</li>)}</ul>
    {open && <>
      <TechniqueDemo id="hip-switch" label="Watch 90/90 hip switches demo"/>
      <TechniqueDemo id="open-book" label="Watch thoracic open books demo"/>
    </>}
  </details>;
}
