import { ArrowRight, ArrowUpRight, ChevronRight, Clock3, Dumbbell, Footprints, Layers, Settings2 } from './icons';
import { DAY_NAMES, fixedWorkoutForDay, prescription, rirTarget, type Exercise, type Workout } from './data';
import { doneSets, type Store } from './model';
import { ExerciseIcon } from './exercise-icon';
import { MobilityGuide } from './technique-demo';
import { programmePage, type ProgrammePage } from './routes';
import { useTodayDate } from './screens';

const setCount = (workout: Workout) => workout.exercises.reduce((total, exercise) => total + exercise.sets, 0);
const training = (workout?: Workout): workout is Workout & {category:'strength' | 'optional'} => !!workout?.exercises.length && workout.category !== 'recovery';

type ResourcesProps = { onGuide: () => void; onUrgent: () => void };
function ProgrammeResources({ onGuide, onUrgent }: ResourcesProps) {
  return <section className="programme-resources-card" aria-label="Programme guidance">
    <span className="programme-section-label">TRAIN WITH CONFIDENCE</span>
    <h2>A little guidance.<br/>A stronger routine.</h2>
    <p>Technique, effort and progression, when you need a refresher.</p>
    <button className="programme-resource-link" onClick={onGuide}><span>Training guide<small>Movement, recovery and nutrition</small></span><ArrowUpRight size={18}/></button>
    <button className="programme-help-link" onClick={onUrgent}>Back pain: urgent help<ArrowUpRight size={15}/></button>
  </section>;
}

function ActiveProgramme({ store, onResume }: { store: Store; onResume: () => void }) {
  const active = store.active;
  if (!active) return null;
  const total = active.exercises.reduce((n, exercise) => n + exercise.sets.length, 0);
  return <aside className="programme-active" aria-label="Workout in progress">
    <span className="programme-section-label"><span className="programme-live-dot"/>IN PROGRESS</span>
    <h2>{active.workout.name} is in progress</h2>
    <p>{doneSets(active)} of {total} sets logged. Finish or discard it before starting another session.</p>
    <button className="primary full-width" onClick={onResume}>Resume {active.workout.name}<ArrowRight size={18}/></button>
  </aside>;
}

export function ProgrammeOverview({ store, onOpen, onResume, onGuide, onUrgent }: ResourcesProps & {
  store: Store; onOpen: (page: ProgrammePage) => void; onResume: () => void;
}) {
  const today = (useTodayDate().getDay() + 6) % 7;
  const week = DAY_NAMES.map((name, day) => ({ name, day, workout: fixedWorkoutForDay((day + 1) % 7, store.programme.options) }));
  const main = week.filter(({workout}) => training(workout) && !workout.optional).length;
  const optional = week.filter(({workout}) => training(workout) && workout.optional).length;
  return <div className="programme-layout programme-overview">
    <div className="programme-main">
      <ActiveProgramme store={store} onResume={onResume}/>
      <div className="programme-intro">
        <p className="programme-section-label">YOUR WEEKLY SPLIT</p>
        <h2>A routine to<br/><span>build on.</span></h2>
        <p>Four focused sessions. Room to recover.<br/>Repeat the week and make it your own.</p>
        <div className="programme-split-key"><span><Dumbbell size={15}/>{main} training days</span><span><PlusMark/>{optional} optional session</span></div>
      </div>
      <ol className="programme-week" aria-label="Weekly programme">
        {week.map(({name, day, workout}) => {
          const isTraining = training(workout);
          const label = workout?.name ?? 'Rest day';
          const isToday = day === today;
          return <li key={name}>
            <a className="programme-day-card" data-kind={isTraining ? workout.optional ? 'optional' : 'strength' : 'recovery'} data-today={isToday || undefined}
              data-programme-day={day} href={'#' + programmePage(day)} aria-label={`${name} ${label}`}
              onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); onOpen(programmePage(day)); } }}>
              <span className="programme-day-stamp"><span aria-hidden="true">{name.slice(0,3)}</span><span className="programme-day-mark" aria-hidden="true">{isToday ? <span/> : String(day + 1).padStart(2,'0')}</span></span>
              <span className="programme-day-copy"><span className="programme-day-title"><strong>{label}</strong>{isToday && <span className="programme-today-label">Today</span>}{workout?.optional && <span className="programme-optional-label">Optional</span>}</span>
                <span className="programme-day-focus">{workout?.focus ?? 'Take a breather. Come back stronger.'}</span>
                <span className="programme-day-meta">{isTraining ? `${workout.exercises.length} exercises · ${setCount(workout)} working sets` : workout ? 'Keep it easy' : 'No session scheduled'}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true"/>
            </a>
          </li>;
        })}
      </ol>
      <p className="programme-repeat-note"><Layers size={15}/>This split repeats each week. Train any session on a day that suits you.</p>
    </div>
    <aside className="programme-rail">
      <section className="programme-rhythm" aria-label="Weekly rhythm"><span className="programme-section-label">THE RHYTHM</span><div className="programme-rhythm-bars" aria-hidden="true">{week.map(({day,workout})=><span key={day} data-kind={training(workout)?workout.optional?'optional':'strength':'recovery'}><i/><small>{DAY_NAMES[day].slice(0,1)}</small></span>)}</div><h2>Train. Recover. Repeat.</h2><p>The same structure each week, with space to build clean reps before adding resistance.</p></section>
      <ProgrammeResources onGuide={onGuide} onUrgent={onUrgent}/>
    </aside>
  </div>;
}

function PlusMark() { return <span className="programme-plus" aria-hidden="true">+</span>; }

export function ProgrammeSession({store, day, onStart, onResume, onOptions, onWarmup, onGuide, onUrgent, onExercise}: ResourcesProps & {
  store: Store; day: number; onStart: () => void; onResume: () => void; onOptions: () => void; onWarmup: () => void; onExercise: (exercise: Exercise) => void;
}) {
  const workout = fixedWorkoutForDay((day + 1) % 7, store.programme.options);
  const isTraining = training(workout);
  const today = (useTodayDate().getDay() + 6) % 7;
  return <div className="programme-layout programme-session">
    <div className="programme-main">
      <section className="programme-session-summary" aria-label="Session overview" data-recovery={!isTraining || undefined}>
        <div className="programme-session-topline"><p className="programme-section-label">{DAY_NAMES[day]}{today === day && ' · TODAY'}</p>{workout?.optional && <span className="programme-optional-label">Optional</span>}</div>
        <h2>{workout?.name ?? 'Rest day'}</h2>
        <p className="programme-session-focus">{workout?.focus ?? 'Take a breather. Come back stronger.'}</p>
        {isTraining ? <>
          <dl className="programme-session-stats"><div><dt>Exercises</dt><dd>{workout.exercises.length}</dd></div><div><dt>Working sets</dt><dd>{setCount(workout)}</dd></div><div><dt>Reps in reserve</dt><dd>{workout.exercises.find(exercise=>exercise.role !== 'core')?.rir ?? '—'}</dd></div></dl>
          {!store.active && <button className="primary full-width programme-start" onClick={onStart}>Start workout<ArrowRight size={19}/></button>}
          <p className="programme-session-note">Train this session today. Choose your workout date when you save.</p>
        </> : <div className="programme-recovery-symbol" aria-hidden="true"><Footprints size={36} strokeWidth={1.35}/></div>}
        {workout?.optional && <button className="programme-inline-action" onClick={onOptions}><Settings2 size={16}/>Upper C settings<ChevronRight size={16}/></button>}
      </section>
      {store.active && <div className="programme-session-active"><ActiveProgramme store={store} onResume={onResume}/></div>}
      {isTraining ? <>
        <button className="programme-warmup" onClick={onWarmup}><span className="programme-warmup-icon"><Clock3 size={21}/></span><span><strong>First, find your rhythm</strong><small>Warm-up · 10–15 min</small></span><ArrowUpRight size={18}/></button>
        <section className="programme-exercises" aria-label="Planned exercises">
          <div className="programme-list-heading"><h2>The session</h2><span>{workout.exercises.length} exercises</span></div>
          <ol>{workout.exercises.map((exercise,index)=><li key={exercise.slot ?? exercise.id}>
            <button className="programme-exercise" onClick={()=>onExercise(exercise)}>
              <span className="programme-exercise-icon"><ExerciseIcon exercise={exercise} size={48}/><span className="programme-exercise-number">{String(index+1).padStart(2,'0')}</span></span>
              <span className="programme-exercise-copy"><span className="programme-exercise-muscle">{exercise.muscle}</span><strong>{exercise.name}</strong><span className="programme-exercise-prescription">{exercise.sets} × {prescription(exercise)}</span><span className="programme-exercise-rest">{exercise.rest}s rest <span aria-hidden="true">·</span> {rirTarget(exercise)}</span></span>
              <ChevronRight size={17} aria-hidden="true"/>
            </button>
          </li>)}</ol>
        </section>
        <p className="programme-repeat-note">Tap an exercise for technique, variations and your recent sets.</p>
      </> : <section className="programme-recovery" aria-label="Recovery suggestions"><p className="programme-section-label">{workout ? 'MOVE AT YOUR OWN PACE' : 'A LITTLE SPACE TO RECOVER'}</p><h2>{workout ? 'Easy movement counts.' : 'Rest is part of the plan.'}</h2><p>{workout ? 'Keep cardio easy and conversational. Add gentle mobility if it feels comfortable.' : 'Take the day off, or enjoy some easy movement. There’s nothing to log.'}</p><ul aria-label="Optional rest-day activities"><li>Mobility</li><li>Running</li><li>Walking</li></ul><MobilityGuide title="Mobility guide"/></section>}
    </div>
    <aside className="programme-rail">
      {isTraining && <section className="programme-rhythm programme-effort-guide"><span className="programme-section-label">MAKE EACH REP COUNT</span><span className="programme-effort-value">{workout.exercises.find(exercise=>exercise.role !== 'core')?.rir ?? '—'}<small>reps in reserve</small></span><p>Finish your sets with controlled technique and a few clean reps left in the tank.</p><button className="programme-inline-action" onClick={onGuide}>Understand effort<ArrowUpRight size={16}/></button></section>}
      <ProgrammeResources onGuide={onGuide} onUrgent={onUrgent}/>
    </aside>
  </div>;
}
