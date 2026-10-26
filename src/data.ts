export type Unit = 'kg' | 'lb';
export type LoadMode = 'external' | 'bodyweight' | 'assistance';
export type Exercise = {
  id: string; name: string; muscle: string; sets: number; min: number; max: number; rest: number; rir: string;
  kind: 'upper' | 'lower' | 'isolation' | 'core' | 'carry';
  note?: string; mode?: LoadMode; timed?: boolean; perSide?: boolean; recovery?: boolean;
  slot?: string; role?: 'main' | 'accessory' | 'core'; tempo?: string;
  method?: 'load' | 'assistance' | 'pushup' | 'row' | 'core' | 'range' | 'bridge';
  setup?: string; supportCm?: number | null; coreLevel?: string;
};
export type Workout = { id: string; name: string; subtitle: string; focus: string; days: number[]; label: string; exercises: Exercise[]; optional?: boolean; category: 'strength' | 'recovery' | 'optional' };
export type ExerciseChoice = { variantId: string; setup: string; supportCm: number | null; coreLevel: string };
export type ProgrammeOptions = { choices: Record<string, ExerciseChoice>; saturdayTwoSets: boolean; saturdayCore: 'none' | 'dead-bug' | 'knee-raise'; extraSlot: string | null };
export const DEFAULT_OPTIONS: ProgrammeOptions = { choices: {}, saturdayTwoSets: false, saturdayCore: 'none', extraSlot: null };
export const SOURCE_URL = 'https://chatgpt.com/s/t_6ac8e755a9188191a08cf1a3ae3211f9';
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const oneHand = 'Log the weight of one dumbbell.';
const bothSides = 'Log reps or seconds per side; complete both sides before logging a set.';
const e = (id: string, name: string, muscle: string, sets: number, min: number, max: number, rest: number, tempo: string, role: Exercise['role'], extra: Partial<Exercise> = {}): Exercise => ({ id: 'p16-' + id, name, muscle, sets, min, max, rest, tempo, role, kind: role === 'core' ? 'core' : role === 'accessory' ? 'isolation' : ['Quads','Glutes','Hamstrings'].includes(muscle) ? 'lower' : 'upper', rir: role === 'core' ? '—' : '2–3', method: role === 'core' ? 'core' : 'load', ...extra });
const deadBug = () => e('dead-bug', 'Dead Bug', 'Core', 2, 8, 8, 45, 'Slow', 'core', { mode:'bodyweight', perSide:true, note:'Exhale gently, keep ribs and pelvis steady, and extend only as far as control permits. ' + bothSides });
const slot = (workout: string, name: string, exercise: Exercise) => ({ ...exercise, slot: workout + ':' + name });
const make = (id: string, name: string, focus: string, day: number, exercises: [string, Exercise][], optional = false): Workout => ({ id, name, focus, subtitle: optional ? 'Optional, lower-fatigue practice · 45–60 min' : 'Controlled movement · about 65–80 min', days:[day], label: id.startsWith('lower') ? 'Lower body' : 'Upper body', category: optional ? 'optional' : 'strength', optional, exercises: exercises.map(([key, ex]) => slot(id,key,ex)) });
export const WORKOUTS: Workout[] = [
  make('upper-a','Upper A','Chest, back and shoulders',1,[
    ['press',e('incline-db','Incline Dumbbell Press, Neutral Grip','Chest',3,8,12,120,'3-0-1','main',{note:oneHand + ' Keep a gentle natural arch without excessive lumbar extension. Use a back-supported chest press if uncomfortable.'})],
    ['row',e('chest-machine-row','Chest-Supported Machine Row','Back',3,8,12,120,'2-1-1','main',{note:'Keep your chest against the pad; do not pull with your torso.'})],
    ['pulldown',e('neutral-pulldown','Neutral-Grip Lat Pulldown','Back',2,8,12,90,'2-1-1','main',{note:'Keep the trunk stable; avoid leaning back to finish reps.'})],
    ['pushup',e('incline-pushup','Incline Push-Ups','Chest',2,8,15,75,'2-0-1','main',{mode:'bodyweight',method:'pushup',note:'Keep ribs and pelvis aligned. Lower hand support only after controlled repetitions.'})],
    ['lateral',e('cable-lateral','Cable Lateral Raise','Shoulders',2,12,20,60,'2-1-1','accessory',{note:'Raise without swinging or arching the lower back.'})],
    ['triceps',e('rope-pushdown','Rope Triceps Pushdown','Triceps',2,10,15,60,'2-0-1','accessory',{note:'Keep your upper arms steady and your trunk controlled.'})],
    ['pallof',e('pallof','Pallof Press','Core',2,10,10,45,'2s hold','core',{perSide:true,note:'Resist rotation and breathe steadily. ' + bothSides})],
  ]),
  make('lower-a','Lower A','Legs, glutes and core',2,[
    ['squat',e('leg-press','Leg Press','Quads',3,8,12,120,'3-0-1','main',{note:'Stop the descent before the pelvis rolls backward or the lower back loses contact with the seat. Belt squat is an alternative.'})],
    ['lunge',e('reverse-lunge','Supported Reverse Lunges','Quads',2,8,10,90,'2-0-1','main',{perSide:true,method:'range',note:'Hold a rail or rack to reduce balance demands. Build stable, comfortable range and reps before load. ' + oneHand + ' ' + bothSides})],
    ['curl',e('seated-curl','Seated Hamstring Curl','Hamstrings',3,10,15,90,'2-1-1','accessory',{note:'Keep hips against the seat and control the return.'})],
    ['thrust',e('machine-thrust','Hip Thrust Machine','Glutes',3,8,12,90,'2-1-1','main',{note:'Finish by extending the hips, not arching the spine. Ribs down. A floor glute bridge is an alternative.'})],
    ['calf',e('seated-calf','Seated Calf Raise','Calves',3,10,15,60,'2-1-1','accessory',{note:'Use a controlled range, without bouncing.'})],
    ['dead-bug',deadBug()],
    ['bird-dog',e('bird-dog','Bird-Dog','Core',2,6,6,45,'5s hold','core',{mode:'bodyweight',perSide:true,note:'Keep your pelvis still and avoid chasing limb height. ' + bothSides})],
  ]),
  {id:'recovery',name:'Active recovery',focus:'Easy cardio + mobility',subtitle:'Conversational pace, no intervals or sprints.',days:[3],label:'Recovery',category:'recovery',exercises:[]},
  make('upper-b','Upper B','Calisthenics and shoulders',4,[
    ['pullup',e('assisted-pullup','Assisted Pull-Ups','Back',3,5,8,120,'2-1-1','main',{mode:'assistance',method:'assistance',note:'Start with generous machine assistance. Reduce assistance gradually before moving to unassisted reps.'})],
    ['press',e('shoulder-machine','Back-Supported Machine Shoulder Press','Shoulders',3,8,12,120,'2-0-1','main',{note:'Maintain contact with the backrest. Avoid leaning back to complete reps.'})],
    ['row',e('supported-cable-row','Supported Seated Cable Row','Back',2,10,12,90,'2-1-1','main',{note:'Keep your torso supported and avoid momentum.'})],
    ['dip',e('assisted-dip','Assisted Dips','Chest',2,6,10,90,'2-0-1','main',{mode:'assistance',method:'assistance',note:'Start with generous machine assistance. Do not descend until shoulders roll forward or the back arches. Use a chest press if uncomfortable.'})],
    ['rear-delt',e('reverse-pec','Reverse Pec Deck','Shoulders',2,12,20,60,'2-1-1','accessory',{note:'Keep your chest supported and shoulders controlled.'})],
    ['curl',e('cable-curl','Cable Biceps Curl','Biceps',2,10,15,60,'2-0-1','accessory',{note:'Keep elbows and trunk steady.'})],
    ['side-plank',e('side-plank','Side Plank','Core',2,20,40,45,'Hold','core',{mode:'bodyweight',timed:true,perSide:true,note:'Start with bent knees if needed. Maintain alignment through shoulders, hips and ankles. ' + bothSides})],
  ]),
  make('lower-b','Lower B','Single-leg strength, hips and core',5,[
    ['step-up',e('supported-step','Supported Low Step-Ups','Glutes',2,8,12,90,'2-0-1','main',{perSide:true,method:'range',note:'Use a low step initially. Increase height only when hip and pelvic control remain steady. ' + oneHand + ' ' + bothSides})],
    ['extension',e('leg-extension','Leg Extension Machine','Quads',3,10,15,90,'2-1-1','accessory',{note:'Keep your back supported and use a controlled return.'})],
    ['curl',e('seated-curl','Seated Hamstring Curl','Hamstrings',3,10,15,90,'2-1-1','accessory',{note:'Keep hips against the seat; lying curls are an alternative.'})],
    ['bridge',e('floor-bridge','Floor Glute Bridge','Glutes',3,10,15,75,'2-2-1','main',{mode:'bodyweight',method:'bridge',note:'Control your pelvis and extend at the hips. Add a band or modest resistance only after consistent pelvic control.'})],
    ['abduction',e('machine-abduction','Hip Abduction Machine','Hips',2,12,20,60,'2-1-1','accessory',{note:'Control your pelvis; avoid leaning or swinging.'})],
    ['calf',e('seated-calf','Seated Calf Raise','Calves',2,12,20,60,'2-1-1','accessory',{note:'Control the return and avoid bouncing.'})],
    ['plank',e('forearm-plank','Forearm Plank','Core',2,20,40,45,'Hold','core',{mode:'bodyweight',timed:true,note:'Keep ribs and pelvis aligned. Stop the hold before control is lost.'})],
  ]),
  make('optional','Upper C','Calisthenics, shoulders and arms',6,[
    ['pushup',e('incline-pushup','Incline Push-Ups','Chest',2,8,15,75,'2-0-1','main',{mode:'bodyweight',method:'pushup',note:'Choose a controlled push-up variation. Align ribs and pelvis.'})],
    ['row',e('inverted-row','Inverted Bodyweight Rows','Back',2,8,12,75,'2-1-1','main',{mode:'bodyweight',method:'row',note:'Move your feet forward to become more horizontal only while maintaining trunk control. Record the bar and foot setup.'})],
    ['fly',e('cable-fly','Cable Chest Fly','Chest',2,12,15,60,'2-0-1','accessory',{note:'Use a comfortable range and avoid lumbar extension.'})],
    ['lateral',e('cable-lateral','Cable Lateral Raise','Shoulders',2,12,20,60,'2-1-1','accessory',{note:'Raise without momentum.'})],
    ['curl',e('hammer-curl','Hammer Curls','Biceps',2,10,15,60,'2-0-1','accessory',{note:oneHand + ' Keep your trunk steady.'})],
    ['triceps',e('rope-pushdown','Rope Triceps Pushdown','Triceps',2,10,15,60,'2-0-1','accessory',{note:'Keep your upper arms steady.'})],
  ],true),
];
function baseSlot(key: string) { return WORKOUTS.flatMap(w=>w.exercises).find(ex=>ex.slot===key)!; }
function alt(key: string, id: string, name: string, changes: Partial<Exercise> = {}) { return { ...baseSlot(key), id:'p16-'+id, name, ...changes }; }
const pushupVariants = (key:string) => [baseSlot(key),alt(key,'floor-pushup','Standard Push-Ups'),alt(key,'feet-pushup','Feet-Elevated Push-Ups')];
export const VARIANTS: Record<string,Exercise[]> = {
  'upper-a:press':[baseSlot('upper-a:press'),alt('upper-a:press','supported-chest-12','Back-Supported Chest Press',{note:'Keep your back supported and use a comfortable range.'})],
  'lower-a:squat':[baseSlot('lower-a:squat'),alt('lower-a:squat','belt-squat','Belt Squat',{note:'Load around the hips. Use a stable stance and comfortable range.'})],
  'lower-a:thrust':[baseSlot('lower-a:thrust'),alt('lower-a:thrust','bridge-12','Floor Glute Bridge',{mode:'bodyweight',method:'bridge',note:'Start on the floor. Extend at the hips without arching your spine.'})],
  'upper-b:pullup':[baseSlot('upper-b:pullup'),alt('upper-b:pullup','pullup','Unassisted Pull-Ups',{mode:'bodyweight',note:'Use controlled unassisted reps without swinging. Reduce machine assistance before choosing this variation.'})],
  'upper-b:dip':[baseSlot('upper-b:dip'),alt('upper-b:dip','dip','Unassisted Dips',{mode:'bodyweight'}),alt('upper-b:dip','supported-chest-10','Chest Press Machine',{mode:'external',method:'load',note:'Keep your back supported and use a comfortable range.'})],
  'lower-b:curl':[baseSlot('lower-b:curl'),alt('lower-b:curl','lying-curl','Lying Leg Curl',{note:'Control the return without lifting your hips or arching your back.'})],
  'lower-b:bridge':[baseSlot('lower-b:bridge'),alt('lower-b:bridge','band-bridge','Banded Glute Bridge',{mode:'bodyweight',note:'Use modest band resistance only after controlling pelvic position. Record the band in Setup.'}),alt('lower-b:bridge','resisted-bridge','Glute Bridge with Modest Resistance',{mode:'external',note:'Add modest resistance only after controlling pelvic position; avoid lumbar arching.'})],
  'upper-a:pushup':pushupVariants('upper-a:pushup'), 'optional:pushup':pushupVariants('optional:pushup'),
};
export const SATURDAY_CORE = {
  'dead-bug':slot('optional','core',deadBug()),
  'knee-raise':slot('optional','core',e('supported-knee-raise','Supported Captain’s-Chair Knee Raises','Core',2,6,10,45,'Slow','core',{mode:'bodyweight',note:'Only if symptom-free and able to avoid swinging or excessive spinal movement. Continue dead bugs otherwise.'})),
};
VARIANTS['optional:core'] = Object.values(SATURDAY_CORE);
export function variantsFor(exercise:Exercise) { return exercise.slot ? VARIANTS[exercise.slot] ?? [exercise] : [exercise]; }
export const allExercises = [...new Map(WORKOUTS.flatMap(w=>w.exercises).concat(...Object.values(VARIANTS).flat()).map(ex=>[ex.id,ex])).values()];
export function programmePhase(week:number) {
  return week<=4?'Movement foundation':week<=8?'Hypertrophy base':week<=12?'Strength & calisthenics':week<=15?'Muscle-building consolidation':'Deload & reassessment';
}
export function phaseGoal(week:number) {
  return week<=4?'Learn setup, breathing and controlled movement. Consistency comes before load.':week<=8?'Accumulate clean reps and introduce Saturday gradually.':week<=12?'Reduce assistance and improve bodyweight leverage with control.':week<=15?'Consolidate strength; extra volume is optional.':'Recover with comfortable loads and review the next block.';
}
export function weekEffort(week:number) { return week===1?'4':week===2?'3–4':week===16?'4+':'2–3'; }
export function workoutForDay(day:number) { return WORKOUTS.find(w=>w.days.includes(day)); }
export function resolveWorkout(w:Workout, week:number, options:ProgrammeOptions):Workout {
  if(w.optional && (week<5||week===16)) return {...w,category:'recovery',exercises:[],focus:'Walking or mobility only',subtitle:week===16?'Skip optional resistance work during the deload.':'Upper C becomes optional from Week 5.'};
  let exercises=w.exercises.map(ex=>{
    const choice=ex.slot?options.choices[ex.slot]:undefined;
    const variant=choice?variantsFor(ex).find(v=>v.id===choice.variantId)??ex:ex;
    let sets=variant.sets;
    if(w.optional) sets=week===5?1:options.saturdayTwoSets?2:1;
    else if(week<=4) sets=variant.role==='core'?Math.min(2,sets):Math.min(variant.role==='main'?(week<=2?2:3):(week===1?1:2),sets);
    else if(week>=13&&week<=15&&options.extraSlot===ex.slot) sets++;
    return {...variant,slot:ex.slot,sets,rir:variant.role==='core'?'—':weekEffort(week),setup:choice?.setup??'',supportCm:choice?.supportCm??null,coreLevel:choice?.coreLevel??'Basic'};
  });
  if(w.optional&&week>=9&&options.saturdayCore!=='none') {
    const ex=SATURDAY_CORE[options.saturdayCore], choice=options.choices['optional:core'];
    exercises.push({...ex,setup:choice?.setup??'',supportCm:choice?.supportCm??null,coreLevel:choice?.coreLevel??'Basic'});
  }
  if(week===16&&exercises.length) {
    const total=Math.ceil(exercises.reduce((n,ex)=>n+ex.sets,0)/2);
    const limits=exercises.map(ex=>ex.sets);exercises=exercises.map(ex=>({...ex,sets:1}));
    let remaining=total-exercises.length;
    for(const role of ['main','accessory','core']) for(let i=0;i<exercises.length&&remaining>0;i++) if(exercises[i].role===role&&limits[i]>1) {exercises[i].sets++;remaining--;}
  }
  return {...w,exercises};
}
export function prescription(ex:Exercise) { return (ex.min===ex.max?String(ex.min):ex.min+'–'+ex.max)+(ex.timed?' sec':' reps')+(ex.perSide?' / side':''); }
export function rirTarget(ex:Exercise) { return ex.rir==='—'?'Controlled':ex.rir+' RIR'; }
export const WARMUP = ['Easy treadmill walking or cycling · 4–5 min','Gentle hip flexor mobility · 30s/side','90/90 hip switches · 6/side','Side-lying thoracic open books · 6/side','Gentle dynamic hamstring movements · 8/side','Glute bridges or dead bugs · 1 × 8','Light warm-up sets for the first main lift · 2–3 sets'];
export const COOLDOWN = ['A few minutes of gentle walking','Easy hip flexor or chest stretches, as tolerated','Slow relaxed breathing · 1–2 min'];
export const MOBILITY = ['Half-kneeling hip flexor mobility: gentle pelvic tuck, ribs down; do not arch the lower back.','90/90 hip switches: move slowly, supporting yourself with your hands.','Thoracic open books: rotate through the upper back while keeping the pelvis steady.','Gentle hamstring mobility: slightly bend the knee; avoid forceful stretching. Stop if tingling, burning or radiating pain occurs.'];
export const RECOVERY_CARDIO = '20–30 minutes easy walking or cycling at a conversational pace, then 15–20 minutes gentle mobility. No intervals or sprints.';
