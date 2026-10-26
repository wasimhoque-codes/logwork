export type Unit = 'kg' | 'lb';
export type LoadMode = 'external' | 'bodyweight' | 'assistance';
export type Exercise = {
    id: string;
    name: string;
    muscle: string;
    sets: number;
    min: number;
    max: number;
    rest: number;
    rir: string;
    kind: 'upper' | 'lower' | 'isolation' | 'core' | 'carry';
    note?: string;
    mode?: LoadMode;
    timed?: boolean;
    perSide?: boolean;
    recovery?: boolean;
};
export type Workout = {
    id: string;
    name: string;
    subtitle: string;
    focus: string;
    days: number[];
    label: string;
    exercises: Exercise[];
    optional?: boolean;
    category: 'strength' | 'recovery' | 'optional';
};
import { LEGACY_WORKOUTS } from './legacy-data';
const exercise = (id: string, name: string, muscle: string, sets: number, min: number, max: number, rest: number, kind: Exercise['kind'], extra: Partial<Exercise> = {}): Exercise => ({ id, name, muscle, sets, min, max, rest, rir: kind === 'core' || kind === 'carry' ? '—' : '2–3', kind, ...extra });
const bodyCore = (id: string, name: string, sets: number, min: number, max: number, note: string, extra: Partial<Exercise> = {}) => exercise(id, name, 'Core', sets, min, max, 60, 'core', { mode: 'bodyweight', note, ...extra });
const birdDog = (sets = 3, min = 6, max = 8) => bodyCore('bird-dog', 'Bird Dog', sets, min, max, 'Brace your abdomen; keep your pelvis still. Do not chase height. Log reps per side; complete both sides before logging a set.', { perSide: true });
const sidePlank = (sets = 3, min = 20, max = 40) => bodyCore('side-plank', 'Side Plank', sets, min, max, 'Bend your knees initially if needed. Log seconds per side; complete both sides before logging a set.', { perSide: true, timed: true });
const pallof = (sets = 3, min = 10, max = 12) => exercise('pallof', 'Pallof Press', 'Core', sets, min, max, 60, 'core', { perSide: true, note: 'Resist rotation. Log reps per side; complete both sides before logging a set.' });
const dbNote = 'Log the weight of one dumbbell.';
export const RDL_WARNING = 'Start light and learn the hip hinge first. Stop and replace with hamstring curls if radiating leg pain, tingling or numbness increases. Do not use heavy barbell RDLs yet.';
export const DUMBBELL_RDL = exercise('db-rdl', 'Dumbbell Romanian Deadlift', 'Hamstrings', 3, 8, 10, 120, 'lower', { note: `${dbNote} Optional. ${RDL_WARNING}` });
export const WORKOUTS: Workout[] = [
  { id: 'upper-a', name: 'Upper A', subtitle: 'Upper back and trunk stability.', focus: 'Upper body + core stability', days: [1], label: 'Upper body', category: 'strength', exercises: [
    exercise('db-bench', 'Dumbbell Bench Press', 'Chest', 4, 6, 10, 120, 'upper', { note: dbNote }),
    exercise('chest-row', 'Chest-Supported Row', 'Back', 4, 8, 12, 150, 'upper', { note: 'Keep your chest supported rather than holding a loaded bent-over position.' }),
    exercise('incline-press', 'Incline Dumbbell Press', 'Chest', 3, 8, 12, 120, 'upper', { note: `${dbNote} A machine press is an alternative; record substitutions in notes.` }),
    exercise('pulldown', 'Neutral-Grip Lat Pulldown', 'Back', 3, 8, 12, 120, 'upper'),
    exercise('lateral', 'Cable Lateral Raise', 'Shoulders', 3, 12, 20, 90, 'isolation'),
    exercise('face-pull', 'Face Pull', 'Back', 3, 12, 15, 90, 'isolation'),
    exercise('rope-triceps', 'Rope Triceps Pressdown', 'Triceps', 2, 10, 15, 90, 'isolation'),
    exercise('db-curl', 'Dumbbell Curl', 'Biceps', 2, 10, 15, 90, 'isolation', { note: dbNote }),
    birdDog(), sidePlank(), pallof(),
  ] },
  { id: 'lower-a', name: 'Lower A', subtitle: 'Leg strength, hips and glutes.', focus: 'Legs + hips/glutes', days: [2], label: 'Lower body', category: 'strength', exercises: [
    exercise('goblet-squat', 'Goblet Squat', 'Quads', 4, 8, 12, 120, 'lower', { note: 'A belt squat is an alternative if available. Record substitutions in notes. Log the single held load for goblet squats.' }),
    exercise('hip-thrust', 'Hip Thrust', 'Glutes', 4, 8, 12, 120, 'lower', { note: 'Ribs down, abdomen braced, squeeze glutes; do not hyperextend your lower back. Keep the equipment consistent.' }),
    exercise('split-squat', 'Bulgarian Split Squat', 'Quads', 3, 8, 10, 120, 'lower', { perSide: true, note: `Start light. Hold dumbbells beside you. ${dbNote} Reps per leg; complete both legs before logging a set.` }),
    exercise('seated-curl', 'Seated Leg Curl', 'Hamstrings', 3, 10, 15, 90, 'isolation'),
    exercise('extension', 'Leg Extension', 'Quads', 3, 10, 15, 90, 'isolation'),
    exercise('standing-calf', 'Standing Calf Raise', 'Calves', 3, 10, 15, 90, 'isolation'),
    exercise('hip-abduction', 'Cable Hip Abduction', 'Hips', 3, 12, 15, 90, 'isolation', { perSide: true, note: 'Control your pelvis. Reps per side; complete both sides before logging a set.' }),
  ] },
  { id: 'recovery', name: 'Active recovery', subtitle: 'Easy movement and controlled core work.', focus: 'Walking/bike + back-support circuit', days: [3], label: 'Recovery', category: 'recovery', exercises: [
    bodyCore('modified-curl-up', 'Modified Curl-Up', 2, 6, 8, 'Use controlled trunk endurance rather than repeated loaded spinal bending.'),
    birdDog(2, 6, 6), sidePlank(2, 20, 30),
    exercise('glute-bridge', 'Glute Bridge', 'Glutes', 2, 12, 15, 60, 'lower', { mode: 'bodyweight', note: 'Keep your ribs down; squeeze your glutes without arching your back.' }),
    exercise('bw-split-squat', 'Bodyweight Split Squat', 'Quads', 2, 8, 8, 60, 'lower', { mode: 'bodyweight', perSide: true, note: 'Reps per leg; complete both legs before logging a round.' }),
    pallof(2, 10, 10),
  ].map(e => ({ ...e, recovery: true, rest: 60, rir: '—' })) },
  { id: 'upper-b', name: 'Upper B', subtitle: 'Upper strength and stable movement.', focus: 'Upper body + core stability', days: [4], label: 'Upper body', category: 'strength', exercises: [
    exercise('seated-db-press', 'Seated Dumbbell Shoulder Press', 'Shoulders', 3, 6, 10, 120, 'upper', { note: `Use a seated position initially. ${dbNote}` }),
    exercise('pullups', 'Pull-Ups', 'Back', 3, 6, 10, 150, 'upper', { mode: 'bodyweight', note: 'Choose bodyweight, added weight or assistance. Record any pulldown substitution in notes.' }),
    exercise('machine-press', 'Machine Chest Press', 'Chest', 3, 8, 12, 120, 'upper'),
    exercise('cable-row', 'Seated Cable Row', 'Back', 3, 8, 12, 120, 'upper'),
    exercise('pec-deck', 'Pec Deck', 'Chest', 2, 10, 15, 90, 'isolation'),
    exercise('reverse-pec', 'Reverse Pec Deck', 'Shoulders', 3, 12, 20, 90, 'isolation'),
    exercise('lateral', 'Cable Lateral Raise', 'Shoulders', 3, 12, 20, 90, 'isolation'),
    exercise('ez-curl', 'EZ-Bar Curl', 'Biceps', 3, 8, 12, 90, 'isolation'),
    exercise('overhead-cable', 'Overhead Cable Triceps Extension', 'Triceps', 3, 10, 15, 90, 'isolation'),
    bodyCore('dead-bug', 'Dead Bug', 3, 6, 10, 'Keep ribs and pelvis stable; do not chase maximum leg extension. Reps per side; complete both sides before logging.', { perSide: true }),
    exercise('suitcase-carry', 'Suitcase Carry', 'Core', 3, 30, 45, 60, 'carry', { timed: true, perSide: true, note: 'Carry one dumbbell and stay upright. Log the one-hand load and seconds per side; complete both sides before logging. Excluded from lifting volume.' }),
  ] },
  { id: 'lower-b', name: 'Lower B', subtitle: 'Glutes, legs and hip control.', focus: 'Legs + hips/glutes', days: [5], label: 'Lower body', category: 'strength', exercises: [
    exercise('hack', 'Hack Squat', 'Quads', 3, 8, 12, 150, 'lower', { note: 'Control the descent. Do not force deep hip flexion if it causes sciatic symptoms.' }),
    exercise('step-up', 'Step-Ups', 'Glutes', 3, 8, 12, 120, 'lower', { perSide: true, note: `Start with a low box. ${dbNote} Reps per leg; complete both legs before logging.` }),
    exercise('hinge-curl', 'Hamstring Curl (Hinge Replacement)', 'Hamstrings', 3, 10, 15, 90, 'isolation', { note: `Use lying or seated curls. This replaces the optional RDL and is separate from the later leg curls. ${RDL_WARNING}` }),
    exercise('hip-thrust', 'Hip Thrust', 'Glutes', 3, 10, 15, 120, 'lower', { note: 'Glute bridge is an alternative; record it in notes. Ribs down and abdomen braced; do not hyperextend your back.' }),
    exercise('lying-curl', 'Lying Leg Curl', 'Hamstrings', 3, 10, 15, 90, 'isolation', { note: 'Seated leg curl is an alternative. This is separate from the hinge-replacement slot.' }),
    exercise('seated-calf', 'Seated Calf Raise', 'Calves', 3, 12, 15, 90, 'isolation'),
    exercise('hip-abduction', 'Cable Hip Abduction', 'Hips', 2, 15, 15, 90, 'isolation', { perSide: true, note: 'Reps per side; complete both sides before logging.' }),
    exercise('hip-extension', 'Cable Hip Extension', 'Hips', 2, 12, 12, 90, 'isolation', { perSide: true, note: 'Reps per side; complete both sides before logging.' }),
  ] },
  { id: 'optional', name: 'Arms & shoulders', subtitle: 'Keep it easy, if recovered.', focus: 'Arms/shoulders + easy cardio · Optional', days: [6], label: 'Accessories', category: 'optional', optional: true, exercises: [
    exercise('lateral', 'Cable Lateral Raise', 'Shoulders', 4, 12, 20, 90, 'isolation'),
    exercise('reverse-fly', 'Reverse Cable Fly', 'Shoulders', 3, 15, 20, 90, 'isolation'),
    exercise('preacher', 'Preacher Curl', 'Biceps', 3, 10, 15, 90, 'isolation'),
    exercise('hammer', 'Rope Hammer Curl', 'Biceps', 2, 10, 15, 90, 'isolation'),
    exercise('cable-triceps', 'Cable Triceps Pressdown', 'Triceps', 3, 10, 15, 90, 'isolation'),
    exercise('overhead-triceps', 'Overhead Triceps Extension', 'Triceps', 2, 10, 15, 90, 'isolation'),
  ] },
];
export const allExercises = [...new Map([...LEGACY_WORKOUTS, ...WORKOUTS].flatMap(w => w.exercises).concat(DUMBBELL_RDL).map(e => [e.id, e])).values()];
export function workoutForDay(day: number) { return WORKOUTS.find(w => w.days.includes(day)); }
export function plannedSets(e: Exercise, phase: 'full' | 'ramp') { return phase === 'ramp' && !e.recovery ? Math.min(2, e.sets) : e.sets; }
export function rirTarget(e: Exercise, phase: 'full' | 'ramp') { return e.rir === '—' ? 'Controlled' : phase === 'ramp' ? '3 RIR' : `${e.rir} RIR`; }
export function prescription(e: Exercise) { return `${e.min === e.max ? e.min : `${e.min}–${e.max}`}${e.timed ? ' sec' : ' reps'}${e.perSide ? ' / side' : ''}`; }
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export type RoutineOptions = { recoveryRounds: 2 | 3; fridayHinge: 'curl' | 'rdl' };
export const DEFAULT_ROUTINE_OPTIONS: RoutineOptions = { recoveryRounds: 2, fridayHinge: 'curl' };
export function configuredWorkout(w: Workout, options: RoutineOptions): Workout {
  return { ...w, exercises: w.exercises.map(e => w.category === 'recovery' ? { ...e, sets: options.recoveryRounds } : w.id === 'lower-b' && e.id === 'hinge-curl' && options.fridayHinge === 'rdl' ? { ...DUMBBELL_RDL } : { ...e }) };
}
export const LOWER_PREPARATION = [
  '5 minutes brisk walking', 'Bird dog · 1 × 6 each side', 'Glute bridge · 1 × 12',
  'Bodyweight squat · 1 × 10', 'Hip abduction · 1 × 12 each side', 'Dead bug · 1 × 6 each side', 'Light split squat · 1 × 6 each leg',
];
export const RECOVERY_CARDIO = '20–30 minutes easy walking or stationary bike, then 2–3 rounds of the back-support circuit (about 15–20 minutes).';
export const SATURDAY_CARDIO = 'Finish with 20–30 minutes easy Zone-2 cardio. If Friday irritated your back or leg, skip the cardio and walk gently instead.';
