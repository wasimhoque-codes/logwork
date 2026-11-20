import { ExerciseIcon } from './exercise-icon';
import { useMemo, useState } from 'react';
import { Check, ChevronRight } from './icons';
import { Modal } from './components';
import { ExerciseDemo, MobilityGuide } from './technique-demo';
import { WARMUP, COOLDOWN, variantsFor, prescription, rirTarget, RECOVERY_CARDIO, fixedWorkoutForDay, SATURDAY_CORE, type Unit, type Exercise, type ExerciseChoice, type ProgrammeOptions } from './data';
import { dateLabel, fromKg, number, recentExerciseSets, type Session } from './model';
export function ExerciseDetails({ exercise, choice, sessions, unit, forSession = false, onClose, onSave }: {
  exercise: Exercise;
  choice?: ExerciseChoice;
  sessions: Session[];
  unit: Unit;
  forSession?: boolean;
  onClose: () => void;
  onSave: (choice: ExerciseChoice) => void;
}) {
  const [draft, setDraft] = useState<ExerciseChoice>(choice ?? {
    variantId: exercise.id, supportCm: exercise.supportCm ?? null, coreLevel: exercise.coreLevel ?? 'Basic',
  });
  const variants = variantsFor(exercise);
  const selected = variants.find(ex => ex.id === draft.variantId) ?? exercise;
  const recent = useMemo(
    () => recentExerciseSets(sessions, { ...selected, supportCm: draft.supportCm, coreLevel: draft.coreLevel }),
    [sessions, selected, draft.supportCm, draft.coreLevel],
  );
  return <Modal className="programme-sheet" variant="sheet" title={forSession ? 'Swap for this session' : 'Exercise details'} onClose={onClose}>
    <div className="programme-sheet-body">
    <div className="programme-exercise-detail-heading"><ExerciseIcon exercise={selected} size={64}/><div><p className="programme-section-label">{selected.muscle}</p><h3>{selected.name}</h3></div></div>
    <div className="programme-prescription"><span className="programme-section-label">YOUR PRESCRIPTION</span><strong>{exercise.sets} × {prescription(selected)}</strong></div>
    <dl className="programme-detail-stats"><div><dt>Rest</dt><dd>{selected.rest}s</dd></div><div><dt>Effort</dt><dd>{rirTarget({...selected,rir:exercise.rir})}</dd></div><div><dt>Tempo</dt><dd>{selected.tempo ?? 'Controlled'}</dd></div></dl>
    <section className="programme-technique"><h3>Move with control</h3><p>{selected.note}</p><ExerciseDemo exercise={selected}/></section>
    <section className="programme-variation"><h3>Make it your own</h3><p>{forSession ? 'This choice applies to this workout only.' : 'Your choice applies to future workouts. A workout in progress keeps its original exercises.'}</p>
    <label className="option-field">Exercise variation
      <select aria-label="Exercise variation" value={draft.variantId} onChange={e => setDraft({ variantId: e.target.value, supportCm: null, coreLevel: 'Basic' })}>
        {variants.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
      </select>
    </label>
    {['pushup', 'row', 'range'].includes(selected.method ?? '') && <label className="option-field">Support / step height (cm, optional)
      <input className="text-input" aria-label="Support height in cm" type="number" inputMode="decimal" min={0} max={300}
        value={draft.supportCm ?? ''} onChange={e => setDraft(d => ({ ...d, supportCm: e.target.value === '' ? null : Number(e.target.value) }))}/>
    </label>}
    {selected.role === 'core' && <label className="option-field">Core variation
      <select aria-label="Core variation" value={draft.coreLevel} onChange={e => setDraft(d => ({ ...d, coreLevel: e.target.value }))}>
        <option>Basic</option><option>Controlled extension</option><option>Longer lever</option>
      </select>
    </label>}
    </section>
    <section className="recent-exercise-sets" aria-label="Last two logged sets">
      <h3>Last two logged sets</h3>
      {recent.length ? <ul>{recent.map(({sessionId, date, exerciseIndex, setNumber, set}) => <li key={sessionId + ':' + exerciseIndex + ':' + setNumber}>
        <span>{dateLabel(date, {day:'numeric', month:'short', year:'numeric'})} · Set {setNumber}</span>
        <strong>{selected.mode === 'bodyweight' ? 'Bodyweight' : `${number(fromKg(set.weight ?? 0, unit))} ${unit}${selected.mode === 'assistance' ? ' assistance' : ''}`}
          {' × '}{set.reps} {selected.timed ? 'sec' : 'reps'}{selected.perSide ? ' / side' : ''}{set.rir !== null ? ` · ${set.rir} RIR` : ''}
        </strong>
      </li>)}</ul> : <p className="input-hint">No logged sets yet</p>}
    </section>
    </div>
    <div className="programme-sheet-footer"><button className="primary full-width" disabled={draft.supportCm !== null && (!Number.isFinite(draft.supportCm) || draft.supportCm < 0 || draft.supportCm > 300)}
      onClick={() => onSave(draft)}>{forSession ? 'Use this exercise' : 'Save exercise choice'}<Check size={17}/></button></div>
  </Modal>;
}
type UpperCOptions = Pick<ProgrammeOptions, 'saturdayTwoSets' | 'saturdayCore'>;
export function OptionsModal({options,onClose,onSave}:{options:ProgrammeOptions;onClose:()=>void;onSave:(v:UpperCOptions)=>void}) {
  const [draft,setDraft]=useState<UpperCOptions>({saturdayTwoSets:options.saturdayTwoSets,saturdayCore:options.saturdayCore});
  const workout=fixedWorkoutForDay(6,{...options,...draft})!;
  return <Modal className="programme-sheet" variant="sheet" title="Upper C settings" onClose={onClose}>
    <div className="programme-sheet-body">
      <p className="programme-sheet-intro">A little extra practice, at your pace. Changes apply to future Upper C workouts.</p>
      <fieldset className="programme-options"><legend>Sets per exercise</legend><div className="programme-set-options">{[false,true].map(two=><label className="programme-radio-card" key={String(two)}>
        <input type="radio" name="upper-c-sets" checked={draft.saturdayTwoSets===two} onChange={()=>setDraft(d=>({...d,saturdayTwoSets:two}))}/><span><strong>{two?'Two sets':'One set'}</strong><small>{two?'More practice':'Keep it light'}</small></span>
      </label>)}</div></fieldset>
      <fieldset className="programme-options"><legend>Saturday core skill</legend><p>Optional core work adds two sets.</p>{(['none','dead-bug','knee-raise'] as const).map(core=><label className="programme-radio-card" key={core}>
        <input type="radio" name="upper-c-core" checked={draft.saturdayCore===core} onChange={()=>setDraft(d=>({...d,saturdayCore:core}))}/><span><strong>{core==='none'?'No additional core work':SATURDAY_CORE[core].name}</strong><small>{core==='none'?'Finish with your six main exercises':`2 × ${prescription(SATURDAY_CORE[core])}${core==='knee-raise'?' · Confirmation before each session':''}`}</small></span>
      </label>)}</fieldset>
      <div className="programme-options-preview" role="status" aria-label="Upper C preview"><span className="programme-section-label">YOUR UPPER C SESSION</span><strong>{workout.exercises.length} exercises <span>·</span> {workout.exercises.reduce((n,ex)=>n+ex.sets,0)} working sets</strong></div>
    </div>
    <div className="programme-sheet-footer"><button className="primary full-width" onClick={()=>onSave(draft)}>Save settings<Check size={17}/></button></div>
  </Modal>;
}
export function PreparationModal({kind,session,previewChecks,onClose,onChange}:{previewChecks?:boolean[];kind:'warmup'|'cooldown';session:Session|null;onClose:()=>void;onChange:(checks:boolean[])=>void}) {
  const steps=kind==='warmup'?WARMUP:COOLDOWN,checks=session?.[kind]??previewChecks??steps.map(()=>false),[preview,setPreview]=useState(checks);
  const current=session?.programId==='programme-16',values=current?checks:preview;
  return <Modal className="programme-sheet" variant="sheet" title={kind==='warmup'?'Warm-up':'Cool-down'} onClose={onClose}>
    <div className="programme-sheet-body">
      <div className="programme-prep-intro"><p className="programme-section-label">{kind==='warmup'?'BEFORE YOU LIFT':'FINISH COMFORTABLY'}</p><h3>{kind==='warmup'?'Ease into your session.':'Bring the pace down.'}</h3><p>{kind==='warmup'?'10–15 minutes before resistance training.':'5–8 minutes to finish comfortably.'} These steps do not count as working sets.</p></div>
      <div className="programme-prep-progress" role="status">{values.filter(Boolean).length} of {steps.length} steps checked<div aria-hidden="true"><span style={{width:`${values.filter(Boolean).length/steps.length*100}%`}}/></div></div>
      <ol className="programme-prep-list">{steps.map((text,i)=><li key={text}><label><span className="programme-step-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><span>{text}</span><input type="checkbox" aria-label={text} checked={values[i]??false} onChange={e=>{const next=steps.map((_,j)=>j===i?e.target.checked:values[j]??false);if(!current)setPreview(next);onChange(next);}}/></label></li>)}</ol>
      <MobilityGuide title="Mobility technique"/>
      <p className="programme-sheet-note">Start the first lift with very light resistance and approach the working load without fatigue. Avoid forceful stretching.</p>
    </div>
  </Modal>;
}
export function TrainingGuide({onClose}:{onClose:()=>void}) {
  return <Modal className="programme-sheet programme-guide-sheet" variant="sheet" title="Training guide" onClose={onClose}><div className="programme-sheet-body"><p className="programme-sheet-intro">Build clean reps, understand your effort and find a rhythm you can repeat.</p><details className="guide-section" open><summary>Effort, tempo and progression</summary><p>3-1-1 means lower for three seconds, pause for one, then lift in one. RIR is the number of additional clean reps you could have performed. You can record actual RIR with each set.</p><p>Build reps before resistance. Machine pull-ups and dips progress by less assistance. Push-ups progress through lower hand support; rows through a more horizontal position. Planks progress through holds and leverage; dead bugs and bird-dogs through controlled extension. Never progress all core exercises at once.</p><p>Meet every prescribed set target with controlled technique before increasing the load.</p></details><details className="guide-section"><summary>Recovery and food</summary><p>{RECOVERY_CARDIO} Sunday is rest. Short walking breaks support a sedentary baseline; build activity gradually.</p><p>Start with maintenance +200–300 kcal/day. At 60 kg, aim for approximately 100–130 g protein/day (1.6–2.2 g/kg), spread across three or four meals. Aim for 7–9 hours sleep. Track average bodyweight, not one weigh-in.</p><p>The Bodyweight view shows the programme’s weight-gain target and intake guidance when enough consecutive weekly measurements are available. No maintenance-calorie estimate is invented here.</p><p>Useful foods: eggs, chicken, fish, dal, chickpeas, tofu, rice, oats, potatoes, lactose-free milk or yoghurt, nuts, olive oil, peanut butter, fruit and vegetables. Whey isolate is optional if tolerated.</p></details><details className="guide-section"><summary>Back-conscious movement</summary><p>Keep a comfortable, controlled spine position, brace gently, exhale on exertion, and avoid momentum or forced depth. Prefer belt squat/controlled leg press, supported rows and presses, hamstring curls, hip thrusts or bridges, and stability core work.</p><p>Initially limit heavy barbell squats, conventional deadlifts, bent-over rows, good mornings, unsupported overhead presses, weighted sit-ups, heavy side bends and swinging leg raises. These choices reflect the programme’s circumstances rather than declaring those exercises inherently dangerous.</p><p>Ordinary muscular effort or familiar non-worsening discomfort can be monitored. Stop and modify sharp or increasing pain or new symptoms into the buttock/leg. Reduce load or range, substitute, and seek professional advice if symptoms persist.</p></details><details className="guide-section"><summary>Assessment and urgent help</summary><p>The plan assumes mild, stable discomfort. Persistent, unexplained or radiating pain, tingling or weakness warrants GP or physiotherapist assessment before loaded training.</p><UrgentHelpContent/></details></div></Modal>;
}

function UrgentHelpContent() {
  return <><h3>Call 999 or go to A&amp;E</h3><p>For back pain accompanied by symptoms affecting both legs, reduced sensation around the genitals or anus, changed bladder/bowel control, changes in sexual sensation or function, chest pain, or pain after a serious accident. Arrange transport or an ambulance; do not drive yourself.</p><h3>Urgent GP appointment or NHS 111</h3><p>For severe pain that begins suddenly or worsens rapidly, or back pain with shivering, temperature changes or feeling generally unwell.</p><p>Persistent pain, pain affecting everyday activities, unexplained weight loss or pain worse at night should be assessed by a GP. Stop exercises that worsen pain.</p><a href="https://www.nhs.uk/conditions/back-pain/" target="_blank" rel="noreferrer">Read NHS back-pain guidance<ChevronRight size={14}/></a></>;
}
export function UrgentHelp({onClose}:{onClose:()=>void}) {
  return <Modal className="programme-sheet" variant="sheet" title="Back pain: urgent help" onClose={onClose}><div className="programme-sheet-body programme-urgent-content"><UrgentHelpContent/></div></Modal>;
}
