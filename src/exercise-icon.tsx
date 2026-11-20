// Gym Hawk exercise pictograms. Bold human poses carry the movement;
// lighter equipment supplies context. Coordinates share an 80-unit grid.
// Keep historical aliases explicit: imported workouts retain their meaning.
type Pictogram = {
  head: readonly [number, number] | null;
  torso: string;
  limbs: string;
  equipment: string;
  weights: string;
  ghost: string;
};
const pose = (head: Pictogram['head'], torso: string, limbs: string, equipment = '', weights = '', ghost = ''): Pictogram =>
  ({ head, torso, limbs, equipment, weights, ghost });
const emblems = {
  dumbbell: pose(null, "", "", "", "M24 39H56 M17 28H25V52H17Z M55 28H63V52H55Z M11 34V46 M69 34V46"),
  inclinePress: pose([25,26], "M30 36L42 51", "M32 38L45 29L44 17 M42 51L56 53L62 67 M42 51L39 65H47", "M18 31L37 57H58 M35 57L29 69 M54 57V69", "M38 14H50 M39 10V18 M49 10V18"),
  flatPress: pose([17,42], "M27 47H47", "M32 46L35 33V20 M47 47L60 49L64 66 M47 47L47 64H54", "M12 54H63 M21 54V69 M56 54V69", "M16 17H59 M20 11V23 M55 11V23"),
  dbBench: pose([17,42], "M27 47H47", "M32 46L35 33V20 M47 47L60 49L64 66 M47 47L47 64H54", "M12 54H63 M21 54V69 M56 54V69", "M28 17H42 M29 12V22 M41 12V22"),
  chestPress: pose([28,19], "M29 29V48", "M30 32L41 38L57 32 M29 48H48L51 66H59", "M20 27V53H45 M24 53V69 M16 69H54 M63 20V45 M58 28V37"),
  chestRow: pose([48,20], "M42 30L31 48", "M42 32L53 41L43 47 M31 48L23 66H16 M31 48L47 56L51 68H58", "M27 48L42 26 M33 45L37 67 M24 68H60 M61 12V61 M61 38L45 47", "M42 43V52"),
  pulldown: pose([40,27], "M40 37V51", "M38 39L25 34L20 21 M42 39L55 34L60 21 M40 51L29 56V67H23 M40 51L51 56V67H57", "M9 69V9H70 M40 9V16 M19 21L40 16L61 21 M27 57H53 M31 57V69 M49 57V69"),
  pushup: pose([57,27], "M48 34L29 43", "M48 34L51 49V64H60 M29 43L13 62H8", "M8 69H72"),
  inclinePushup: pose([53,18], "M46 27L33 41", "M46 27L55 36L58 45 M33 41L14 65H8", "M51 47H72 M55 47V69 M69 47V69 M8 69H72"),
  feetPushup: pose([56,41], "M47 46L29 39", "M47 46L51 56V66H60 M29 39L12 32", "M8 34H24 M11 34V69 M21 34V69 M8 69H72"),
  lateral: pose([40,17], "M40 28V47", "M39 32L26 44L21 39 M42 32L54 29L66 25 M40 47L32 66H26 M40 47L48 66H54", "M10 16V66 M10 62L66 25", "M63 21L68 29", "M45 34L50 45L54 50"),
  pushdown: pose([45,20], "M43 30L41 48", "M43 33L53 43L55 54 M41 48L34 66H27 M41 48L48 66H55", "M10 69V9H64 M62 9V37L55 54 M55 54L50 58 M55 54L60 58", "", "M53 43L63 36"),
  pallof: pose([43,18], "M43 28V47", "M42 32L51 37H67 M43 47L32 66H26 M43 47L51 66H57", "M10 13V65 M10 38L67 37 M8 69H67", "M66 33V41", "M51 37L47 40"),
  legPress: pose([19,37], "M24 47L34 55", "M34 55L45 42L55 26 M28 49L33 40 M34 55L50 48L60 31", "M12 38L24 61H39 M20 63L14 69H44 M39 68L69 19 M49 21L65 31 M46 18L62 28"),
  lunge: pose([38,17], "M38 27V41", "M37 31L23 34H12 M40 32L48 42 M38 41L24 47L25 65H17 M38 41L51 56H64L66 65", "M11 24V68 M7 69H72", "M44 42H53 M45 39V46 M52 39V46"),
  seatedCurl: pose([24,19], "M25 29V47", "M27 33L38 42 M25 47H46L40 65H48", "M16 28V54H44 M20 54V69 M13 69H60 M48 48L58 65 M37 62L45 64", "M42 43H51", "M46 48L65 52"),
  thrust: pose([17,35], "M26 40L41 37", "M41 37L55 41L59 65H67 M31 39L37 35 M41 37L48 49L47 65H54", "M9 44H28V69 M10 69H70 M34 48L45 29 M36 27L49 32", "M36 34H47"),
  seatedCalf: pose([25,19], "M26 29V45", "M28 32L37 40 M26 45H48L50 62L61 66 M48 45L43 62L53 66", "M15 29V51H39 M20 51V69 M12 69H69 M46 68H66 M49 37V44", "M42 37H58 M45 33V41 M55 33V41"),
  deadBug: pose([15,57], "M25 58H42", "M29 57L23 44L13 35 M32 57L35 40V29 M42 58L53 43H67 M42 58L58 61L70 65", "M8 69H72"),
  birdDog: pose([65,30], "M54 37H34", "M53 38L51 64H61 M53 37L70 24 M34 37L29 54L36 64H43 M34 37L12 34H7", "M8 69H72"),
  pullup: pose([40,23], "M40 33V49", "M38 34L23 29V12 M42 34L57 29V12 M40 49L31 59L35 66 M40 49L49 59L45 66", "M10 69V10H70V69 M8 10H72"),
  shoulderPress: pose([40,26], "M40 36V51", "M38 38L25 34V18 M42 38L55 34V18 M40 51L27 55V68H20 M40 51L53 55V68H60", "M34 35V56H51 M35 56V69 M64 14V52 M16 14V52 M22 15H28 M52 15H58"),
  cableRow: pose([39,25], "M37 35L34 50", "M37 36L49 43L43 45 M34 50L54 54L65 65 M34 50L45 61H62", "M12 10V66 M12 42L43 45 M24 55H42 M27 55V69 M8 69H70 M29 35L27 50", "M43 40V49"),
  dip: pose([40,16], "M40 26L43 44", "M38 29L26 35L29 43 M42 29L53 35L51 43 M43 44L51 55L42 63 M43 44L34 55L29 63", "M17 69V44H31 M63 69V44H49"),
  reversePec: pose([40,19], "M40 29V49", "M38 32L23 32L13 22 M42 32L57 32L67 22 M40 49L28 56V67 M40 49L52 56V67", "M33 32H47V47H33Z M28 56H52 M40 56V70 M10 16V27 M70 16V27"),
  cableCurl: pose([43,18], "M43 28V47", "M42 31L53 43L57 30 M43 47L33 66H27 M43 47L51 66H57", "M12 12V66 M12 65L57 30", "M53 27L61 32", "M53 43L62 54"),
  sidePlank: pose([19,28], "M27 36L43 45", "M28 37L25 61H13 M29 37L42 24L34 18 M43 45L66 64H72 M43 45L62 60", "M8 69H72"),
  step: pose([36,17], "M36 27V42", "M35 31L22 33H12 M38 32L47 41 M36 42L50 44V55H58 M36 42L30 65H22", "M42 57H70V69H42Z M11 25V68 M8 69H72"),
  extension: pose([24,19], "M25 29V47", "M27 33L37 42 M25 47H45L65 38", "M16 28V54H44 M20 54V69 M12 69H64 M50 51L61 39 M60 35L65 43", "", "M45 47L45 64"),
  bridge: pose([15,61], "M25 58L42 42", "M42 42L57 46L67 65H72 M28 57L38 64 M42 42L51 52L56 65H63", "M8 69H72"),
  abduction: pose([40,17], "M40 27V45", "M38 31L29 40 M42 31L51 40 M40 45L21 51L17 65H10 M40 45L59 51L63 65H70", "M32 27H48V45 M30 50H50 M40 50V69 M26 51L20 61 M54 51L60 61", "", "M35 51L34 64 M45 51L46 64"),
  plank: pose([57,35], "M48 40L29 47", "M48 41L49 61H64 M29 47L12 64H8", "M8 69H72"),
  invertedRow: pose([53,39], "M45 46L31 54", "M46 45L42 29L47 17 M31 54L12 65H7", "M10 69V17H71 M47 13V20"),
  fly: pose([40,19], "M40 29V46", "M38 32L27 41L34 47 M42 32L53 41L46 47 M40 46L29 65H22 M40 46L51 65H58", "M9 14V66 M71 14V66 M9 28L34 47 M71 28L46 47", "M32 44L37 49 M43 49L48 44"),
  hammer: pose([38,18], "M38 28V47", "M37 31L26 44L27 31 M40 31L50 44L53 31 M38 47L28 66H21 M38 47L48 66H55", "", "M23 25V36 M20 26H26 M20 35H26 M56 25V36 M53 26H59 M53 35H59"),
  squat: pose([41,19], "M39 29L34 42", "M37 31L27 25 M37 31L54 25 M34 42L51 49L42 66H53 M34 42L22 50L24 66H14", "", "M13 26H67 M17 19V33 M63 19V33"),
  beltSquat: pose([40,18], "M40 28V41", "M38 32L27 36 M42 32L53 36 M40 43L23 50L26 64H17 M40 43L57 50L54 64H63", "M16 27V41 M64 27V41 M8 69H72 M40 48V57", "M31 41Q40 48 49 41 M33 58H47V64H33Z"),
  lyingCurl: pose([17,42], "M27 45H46", "M29 45L27 54H18 M46 45L60 44L64 25", "M11 53H65 M18 53V69 M58 53V69 M58 24L69 28", "", "M60 44L71 48"),
  kneeRaise: pose([38,17], "M37 27V45", "M36 31L25 39H17 M39 31L48 39H57 M37 45H57L56 58H48", "M12 69V23H24 M64 69V23H52 M17 39V47 M57 39V47 M29 27V47", "", "M37 45L34 64"),
  rdl: pose([57,27], "M47 32L33 40", "M45 34L48 53 M33 40L28 52L30 66H22 M33 40L38 53L40 66H48", "", "M18 56H64 M22 50V62 M60 50V62"),
  standingCalf: pose([40,16], "M40 26V46", "M38 31L28 41 M42 31L52 41 M40 46L33 61L39 65 M40 46L47 61L53 65", "M25 69H60 M29 69V73 M56 69V73", "M24 23H56 M27 19V27 M53 19V27"),
  crunch: pose([44,31], "M40 40L32 48", "M40 39L48 43L51 34 M32 48L48 58L37 65H58", "M12 69V9H62 M60 9V25L51 34 M23 69H66"),
  overheadPress: pose([40,26], "M40 36V49", "M38 37L25 29V14 M42 37L55 29V14 M40 49L29 67H21 M40 49L51 67H59", "", "M12 12H68 M17 6V18 M63 6V18"),
  pecDeck: pose([40,19], "M40 29V49", "M38 32L25 39L33 29 M42 32L55 39L47 29 M40 49L28 56V67 M40 49L52 56V67", "M32 28V53H50 M30 56H51 M40 56V70 M24 32L32 27 M56 32L48 27", "M33 23V32 M47 23V32"),
  ezCurl: pose([40,18], "M40 28V47", "M38 32L26 43L23 35 M42 32L54 43L57 35 M40 47L29 66H22 M40 47L51 66H58", "", "M12 34H29L34 29L45 36L50 31H68 M16 28V40 M64 25V37"),
  overheadCable: pose([42,27], "M42 37V49", "M41 38L51 23L44 15 M43 38L57 23L49 15 M42 49L32 66H25 M42 49L52 66H59", "M10 17V66 M10 63L46 15", "M42 11L51 16", "M51 23L60 32"),
  hack: pose([48,19], "M43 29L33 44", "M42 31L32 29 M33 44L48 52L37 65H47 M33 44L23 53L20 65H11", "M17 69L60 12 M12 68H57 M33 38L47 21 M42 17L56 26", "M23 28L39 35 M25 24L21 32"),
  splitSquat: pose([32,17], "M32 27V42", "M30 31L23 45 M34 31L42 45 M32 42L20 48L22 66H14 M32 42L49 56L64 48", "M58 50H72 M61 50V69 M70 50V69 M9 69H72", "M18 46H28 M19 42V50 M27 42V50 M37 46H47 M38 42V50 M46 42V50"),
  reverseFly: pose([40,19], "M40 29V47", "M38 32L23 33L14 25 M42 32L57 33L66 25 M40 47L29 66H22 M40 47L51 66H58", "M9 12V66 M71 12V66 M9 25L66 25 M71 25L14 25", "M11 21L17 28 M63 28L69 21"),
  preacher: pose([30,21], "M33 31L40 47", "M35 33L45 42L54 29 M40 47L29 57L26 67H19 M40 47L53 57L55 67H62", "M33 38L54 49 M45 44L40 68 M25 69H65 M29 57H53", "M48 26H60 M49 21V31 M59 21V31"),
  carry: pose([40,16], "M40 26V45", "M38 30L26 47 M42 30L54 47 M40 45L29 65H21 M40 45L51 65H59", "", "M18 50H30V61H18Z M50 50H62V61H50Z M21 50V46H27V50 M53 50V46H59V50"),
  inclineCurl: pose([28,21], "M32 31L41 48", "M34 33L29 45L37 36 M41 48L55 53L60 66H67 M41 48L38 65H46", "M21 31L37 55H54 M35 55L29 69 M52 55V69", "M31 33H43 M32 29V38 M42 29V38"),
  dbCurl: pose([40,18], "M40 28V47", "M38 32L27 44L24 32 M42 32L53 44L56 32 M40 47L29 66H22 M40 47L51 66H58", "", "M18 29H30 M19 25V33 M29 25V33 M50 29H62 M51 25V33 M61 25V33"),
  goblet: pose([40,18], "M40 28V42", "M38 31L28 35L36 29 M42 31L52 35L44 29 M40 42L23 51L27 66H17 M40 42L57 51L53 66H63", "", "M37 25H43V37H37Z M34 26H46 M34 36H46"),
  facePull: pose([42,19], "M42 29V47", "M40 32L28 36L33 25 M44 32L56 36L51 25 M42 47L32 66H25 M42 47L52 66H59", "M10 13V66 M10 23L33 25 M10 23L51 25", "M31 21L35 28 M49 21L53 28"),
  hipAbduction: pose([40,17], "M40 27V44", "M38 31L25 35H13 M42 32L49 42 M40 44L33 66H26 M40 44L62 57L68 59", "M11 24V66 M11 64L62 57", "M59 53L64 61", "M41 47L46 64"),
  hipExtension: pose([39,18], "M36 28L32 43", "M35 31L21 32H12 M32 43L27 66H20 M32 43L49 50L65 43", "M10 22V66 M10 64L65 43", "M62 39L68 46", "M33 45L43 64"),
  curlUp: pose([26,44], "M32 53L44 60", "M34 54L39 63 M44 60L56 45L65 65H72 M44 60L57 64H65", "M8 69H72"),
  suitcase: pose([39,16], "M39 26V45", "M37 30L25 47 M41 30L52 39 M39 45L28 65H20 M39 45L50 65H58", "", "M17 50H30V62H17Z M20 50V46H27V50"),
} as const;

type Emblem = keyof typeof emblems;
type IconSpec = { emblem: Emblem; detail?: 'assisted' | 'band' | 'load' | 'dumbbells' | 'hanging' };
const icon = (emblem: Emblem, detail?: IconSpec['detail']): IconSpec => ({ emblem, detail });
const exerciseIcons: Record<string, IconSpec> = {
  'p16-incline-db': icon('inclinePress'), 'p16-chest-machine-row': icon('chestRow'),
  'p16-neutral-pulldown': icon('pulldown'), 'p16-incline-pushup': icon('inclinePushup'),
  'p16-cable-lateral': icon('lateral'), 'p16-rope-pushdown': icon('pushdown'),
  'p16-pallof': icon('pallof'), 'p16-leg-press': icon('legPress'),
  'p16-reverse-lunge': icon('lunge'), 'p16-seated-curl': icon('seatedCurl'),
  'p16-machine-thrust': icon('thrust'), 'p16-seated-calf': icon('seatedCalf'),
  'p16-dead-bug': icon('deadBug'), 'p16-bird-dog': icon('birdDog'),
  'p16-assisted-pullup': icon('pullup', 'assisted'), 'p16-shoulder-machine': icon('shoulderPress'),
  'p16-supported-cable-row': icon('cableRow'), 'p16-assisted-dip': icon('dip', 'assisted'),
  'p16-reverse-pec': icon('reversePec'), 'p16-cable-curl': icon('cableCurl'),
  'p16-side-plank': icon('sidePlank'), 'p16-supported-step': icon('step'),
  'p16-leg-extension': icon('extension'), 'p16-floor-bridge': icon('bridge'),
  'p16-machine-abduction': icon('abduction'), 'p16-forearm-plank': icon('plank'),
  'p16-inverted-row': icon('invertedRow'), 'p16-cable-fly': icon('fly'),
  'p16-hammer-curl': icon('hammer'), 'p16-supported-chest-12': icon('chestPress'),
  'p16-belt-squat': icon('beltSquat'), 'p16-bridge-12': icon('bridge'),
  'p16-pullup': icon('pullup'), 'p16-dip': icon('dip'), 'p16-weighted-dip': icon('dip', 'load'),
  'p16-supported-chest-10': icon('chestPress'), 'p16-lying-curl': icon('lyingCurl'),
  'p16-band-bridge': icon('bridge', 'band'), 'p16-resisted-bridge': icon('bridge', 'load'),
  'p16-floor-pushup': icon('pushup'), 'p16-feet-pushup': icon('feetPushup'),
  'p16-supported-knee-raise': icon('kneeRaise'),
  // Version 1–3 catalogues, including optional and recovery movements.
  bench: icon('flatPress'), 'chest-row': icon('chestRow'), 'incline-press': icon('inclinePress'),
  pulldown: icon('pulldown'), lateral: icon('lateral'), 'rope-triceps': icon('pushdown'),
  'incline-curl': icon('inclineCurl'), squat: icon('squat'), rdl: icon('rdl'),
  'leg-press': icon('legPress'), 'seated-curl': icon('seatedCurl'), 'standing-calf': icon('standingCalf'),
  crunch: icon('crunch'), ohp: icon('overheadPress'), pullups: icon('pullup'),
  'machine-press': icon('chestPress'), 'cable-row': icon('cableRow'), 'pec-deck': icon('pecDeck'),
  'reverse-pec': icon('reversePec'), 'ez-curl': icon('ezCurl'), 'overhead-cable': icon('overheadCable'),
  hack: icon('hack'), 'hip-thrust': icon('thrust'), 'split-squat': icon('splitSquat'),
  'lying-curl': icon('lyingCurl'), extension: icon('extension'), 'seated-calf': icon('seatedCalf'),
  'knee-raise': icon('kneeRaise', 'hanging'), 'reverse-fly': icon('reverseFly'), preacher: icon('preacher'),
  hammer: icon('cableCurl'), 'cable-triceps': icon('pushdown'), 'overhead-triceps': icon('overheadCable'),
  carry: icon('carry'), 'db-bench': icon('dbBench'), 'face-pull': icon('facePull'),
  'db-curl': icon('dbCurl'), 'goblet-squat': icon('goblet'), 'hip-abduction': icon('hipAbduction'),
  'modified-curl-up': icon('curlUp'), 'glute-bridge': icon('bridge'), 'bw-split-squat': icon('lunge'),
  'seated-db-press': icon('shoulderPress', 'dumbbells'), 'suitcase-carry': icon('suitcase'),
  'step-up': icon('step'), 'hinge-curl': icon('seatedCurl'), 'hip-extension': icon('hipExtension'),
  'db-rdl': icon('rdl', 'dumbbells'), 'bird-dog': icon('birdDog'),
  'side-plank': icon('sidePlank'), pallof: icon('pallof'), 'dead-bug': icon('deadBug'),
};

export function exerciseIconSpec(id: string): IconSpec {
  return Object.hasOwn(exerciseIcons, id) ? exerciseIcons[id] : icon('dumbbell');
}

export function hasExerciseIcon(id: string): boolean {
  return Object.hasOwn(exerciseIcons, id);
}

/** Decorative: pair with a visible exercise name. Self-contained for offline use. */
export function ExerciseIcon({ exercise, size = 48 }: { exercise: { id: string }; size?: 24 | 32 | 40 | 48 | 64 }) {
  const { emblem, detail } = exerciseIconSpec(exercise.id);
  const drawing = emblems[emblem];
  const dumbbells = detail === 'dumbbells';
  const hanging = detail === 'hanging';
  return <svg className="exercise-emblem" width={size} height={size} viewBox="0 0 80 80"
    fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" data-exercise-icon={exercise.id}>
    <rect className="exercise-emblem-tile" width="80" height="80" rx="18" stroke="none"/>
    <g className="exercise-emblem-equipment" strokeWidth="2.6">
      {drawing.equipment && !hanging && <path d={dumbbells && emblem === 'shoulderPress'
        ? 'M34 35V56H51 M35 56V69' : drawing.equipment}/>}
      {hanging && <path d="M12 69V9H66V69 M24 9V18 M52 9V18"/>}
      {detail === 'assisted' && <path className="exercise-emblem-support" d={emblem === 'pullup'
        ? 'M24 63H56 M31 63V72 M49 63V72' : 'M27 63H49 M32 63V72 M44 63V72'}/>}
    </g>
    {drawing.ghost && <path className="exercise-emblem-ghost" d={drawing.ghost} strokeWidth="3" strokeDasharray="3 5"/>}
    <g className="exercise-emblem-person">
      {drawing.torso && <path d={drawing.torso} strokeWidth="7"/>}
      {drawing.limbs && <path d={hanging ? "M37 45H57L56 58H48" : drawing.limbs} strokeWidth="4.8"/>}
      {hanging && <path d="M36 31L24 22V10 M39 31L52 22V10" strokeWidth="4.8"/>}
      {drawing.head && <circle cx={drawing.head[0]} cy={drawing.head[1]} r="5.2" fill="currentColor" stroke="none"/>}
    </g>
    <g className="exercise-emblem-load" strokeWidth="3.4">
      {drawing.weights && !dumbbells && <path d={drawing.weights}/>}
      {dumbbells && <path d={emblem === 'rdl'
        ? 'M41 55H55 M42 50V60 M54 50V60'
        : 'M18 15H32 M19 10V20 M31 10V20 M48 15H62 M49 10V20 M61 10V20'}/>}
      {detail === 'band' && <path d="M51 45L46 51L55 58L61 52Z" strokeWidth="3"/>}
      {detail === 'load' && <path d="M33 42L44 33 M32 38L37 44 M40 32L45 38"/>}
    </g>
  </svg>;
}
