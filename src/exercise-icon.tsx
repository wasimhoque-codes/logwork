// Original Gym Hawk emblems: equipment + movement, on a shared 32px grid.
// Keep aliases explicit: persisted historical IDs must retain their own meaning.
const emblems = {
  dumbbell: 'M10 16h12 M7 11v10h3V11z M22 11v10h3V11z M4 14v4 M28 14v4',
  inclinePress: 'M7 25h18 M11 25V14l9 7 M9 11l10 8 M9 7v7 M6 8v5 M12 8v5 M22 8v6 M19 9v4 M25 9v4',
  flatPress: 'M6 21h20 M9 21v5 M23 21v5 M7 11h18 M7 7v8 M4 9v4 M25 7v8 M28 9v4',
  dbBench: 'M6 21h20 M9 21v5 M23 21v5 M10 8v7 M7 9v5 M13 9v5 M23 8v7 M20 9v5 M26 9v5',
  chestPress: 'M9 26V11 M9 20h10v6 M5 26h20 M14 8v7l9-3 M23 8v8 M20 8h6',
  chestRow: 'M8 26h17 M12 26l5-14 M10 16l8-6 M23 8v10 M20 18h6 M22 21l-4 3 M18 21v3h3',
  pulldown: 'M7 27V5h19 M15 5v5 M9 12l6-2 7 2 M10 21h10 M14 21v6 M21 16v3 M19 17l2 2 2-2',
  pushup: 'M5 25h22 M6 19h20 M9 19v6 M23 19v6 M12 8h9 M18 5l3 3-3 3',
  inclinePushup: 'M4 26h24 M6 21l17-8 M23 13v13 M20 13h7 M10 9h7 M14 6l3 3-3 3',
  feetPushup: 'M4 26h24 M7 13l18 8 M7 13v13 M4 13h7 M15 8h8 M20 5l3 3-3 3',
  lateral: 'M6 26V6h5 M6 9l8 12 10-9 M22 10l4 4 M15 11l6-4 M18 6l3 1-1 3',
  pushdown: 'M7 26V5h16 M17 5v11 M17 16l-5 6 M17 16l5 6 M10 21l4 2 M20 23l4-2 M26 14v7l-2-2 M26 21l2-2',
  pallof: 'M5 26V6 M5 15h13 M18 12v6 M23 10a7 7 0 0 1 0 12 M23 22l-1-4 M23 22l4-1',
  legPress: 'M5 25h22 M8 22l5-4-3-8 M7 9l4 1 M13 18l9-9 M20 7l5 5 M19 19l5-5 M21 14h3v3',
  lunge: 'M5 26h22 M6 7v15 M4 12h5 M12 14h8v6h5 M12 14v9 M10 23h5 M18 7v4 M16 9h4',
  seatedCurl: 'M7 6v14h10 M7 26V20 M17 20l5 4 M20 26h6 M16 13h8 M21 10l3 3-3 3',
  thrust: 'M4 22h7v5 M11 22l7-7 9 7 M13 15h10 M15 12v6 M21 12v6 M26 22v5',
  seatedCalf: 'M6 10v11h12 M9 21v6 M18 21v4h7 M15 14h8 M18 11v6 M27 21v-6l-2 2 M27 15l2 2',
  deadBug: 'M5 25h22 M11 19h9 M11 19l-4-6 M20 19l5-6 M9 10l3-4 M20 10l-3-4 M14 15l4-4',
  birdDog: 'M5 25h22 M7 13h12l6-5 M11 13v9 M19 13v9 M5 8h7 M9 5l3 3-3 3',
  pullup: 'M6 27V6h20v21 M11 6v6h10V6 M13 19h6 M16 24V14 M13 17l3-3 3 3',
  shoulderPress: 'M9 26V15 M9 21h11v5 M5 26h20 M13 15V7 M23 15V7 M10 7h6 M20 7h6 M18 12V4 M16 6l2-2 2 2',
  cableRow: 'M5 26V6 M5 16h16 M19 13v6 M13 23h10v4 M13 23v-4 M11 10h7 M15 7l3 3-3 3',
  dip: 'M7 26V12h5 M25 26V12h-5 M11 7v5 M21 7v5 M16 15v9 M13 21l3 3 3-3',
  reversePec: 'M11 26V16h10v10 M16 16V8 M7 10l9 5 9-5 M5 7v6 M27 7v6 M9 5l-4 2 M23 5l4 2',
  cableCurl: 'M6 26V6 M6 25l16-10 M19 12l6 6 M15 8a7 7 0 0 1 10 0 M22 7l3 1 1-3',
  sidePlank: 'M5 26h22 M8 21l16-9 M8 21v5 M21 14l3 7 M24 21h3 M9 10l7-4 M13 5l3 1-1 3',
  step: 'M5 26h8v-7h7v-7h7 M8 16l8-9 M12 7h4v4 M23 20v6',
  extension: 'M7 6v15h10l8-8 M7 21v6 M21 11l6 5 M15 8h6 M18 5l3 3-3 3',
  bridge: 'M4 26h24 M6 22l10-9 10 9 M12 10l4-4 4 4 M16 6v9',
  abduction: 'M9 26V17h14v9 M16 17V7 M9 15l-4-5 M23 15l4-5 M5 6v4h4 M27 6v4h-4',
  plank: 'M4 26h24 M6 19h20 M8 19v7 M25 19v7 M12 11h8 M12 9v4 M20 9v4',
  invertedRow: 'M5 26V6h22 M12 6v8l11 8 M9 24h17 M14 23v-6 M11 20l3-3 3 3',
  fly: 'M5 26V6 M27 26V6 M5 9l9 9 M27 9l-9 9 M12 16l4 4 4-4 M10 24h12',
  hammer: 'M8 10h5v14H8z M19 10h5v14h-5z M7 7h7 M18 7h7 M10 4v3 M21 4v3',
  squat: 'M5 26h22 M7 9h18 M7 6v6 M25 6v6 M12 16h8l-5 5 7 4 M8 17v6 M6 21l2 2 2-2',
  beltSquat: 'M5 26h22 M9 14q7 5 14 0 M9 11v5 M23 11v5 M16 18v5 M11 23h10 M11 6h10',
  lyingCurl: 'M5 20h21 M8 20v7 M24 20v7 M8 15h11l5-7 M22 6l5 4 M10 8h7 M14 5l3 3-3 3',
  kneeRaise: 'M7 27V6h5 M25 27V6h-5 M9 12h14 M16 12v9h7 M21 18l2 3-2 3 M11 18v7',
  rdl: 'M6 26h20 M9 9h8l-5 8 10 6 M9 20h17 M9 17v6 M26 17v6 M23 6v7 M21 11l2 2 2-2',
  standingCalf: 'M5 26h22 M11 6v14h7l4 4 M9 6h6 M26 18v-7 M24 13l2-2 2 2',
  crunch: 'M6 26V5h18 M19 5v8l-6 4 7 6 M11 23h13 M25 14v6 M23 18l2 2 2-2',
  overheadPress: 'M7 8h18 M7 5v6 M25 5v6 M11 15h10 M13 15v11 M19 15v11 M16 13V4 M14 6l2-2 2 2',
  pecDeck: 'M11 26V17h10v9 M16 17V7 M6 7v7l7 4 M26 7v7l-7 4 M10 9l3 3 M22 9l-3 3',
  ezCurl: 'M5 18h6l3-4 4 4h9 M5 14v8 M27 14v8 M11 8h10 M18 5l3 3-3 3',
  overheadCable: 'M6 26V5h18 M6 23l14-9 M16 10l8 8 M24 23v-7 M22 18l2-2 2 2',
  hack: 'M5 26h22 M9 21L22 6 M19 5l6 5 M11 19l-4-4 M7 15l8-9 M19 21l5-6 M21 15h3v3',
  splitSquat: 'M5 26h22 M7 23V12h7l5 8h7 M23 21v5 M11 6v3 M9 7h4 M15 22v4',
  reverseFly: 'M5 26V6 M27 26V6 M5 9l9 13 M27 9L18 22 M7 15l4-1 M25 15l-4-1 M14 8h4',
  preacher: 'M5 26h22 M9 26l7-11 9 7 M10 12l10 6 M13 7h10 M13 4v6 M23 4v6',
  carry: 'M5 15h7v10H5z M20 15h7v10h-7z M7 15v-4h3v4 M22 15v-4h3v4 M12 6h8 M17 3l3 3-3 3',
  inclineCurl: 'M7 26h17 M11 26V14l9 7 M9 10l11 9 M21 6v8 M18 7v6 M24 7v6',
  dbCurl: 'M9 15h14 M9 11v8 M6 12v6 M23 11v8 M26 12v6 M12 8a6 6 0 0 1 10 0 M19 7l3 1 1-3',
  goblet: 'M13 5h6v10h-6z M10 8h3 M19 8h3 M10 19h12l-5 5 M5 26h22',
  facePull: 'M5 26V6 M5 9h9l8 5 M14 9l8-4 M21 12l3 4 M21 3l3 4 M25 21h-8 M20 18l-3 3 3 3',
  hipAbduction: 'M6 26V6 M6 23l10-4 8-9 M21 8l5 4 M13 10h6 M16 7l3 3-3 3',
  hipExtension: 'M6 26V6 M6 23h11l8-10 M22 11l5 4 M14 8v7 M12 13l2 2 2-2',
  curlUp: 'M5 26h22 M7 21h7l6-6 6 6 M10 10l7-4 M14 5l3 1-1 3',
  suitcase: 'M7 15h8v11H7z M9 15v-4h4v4 M18 6h8 M23 3l3 3-3 3 M22 16v10',
} as const;

type Emblem = keyof typeof emblems;
type IconSpec = { emblem: Emblem; detail?: 'assisted' | 'band' | 'load' | 'dumbbells' };
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
  'p16-pullup': icon('pullup'), 'p16-dip': icon('dip'),
  'p16-supported-chest-10': icon('chestPress'), 'p16-lying-curl': icon('lyingCurl'),
  'p16-band-bridge': icon('bridge', 'band'), 'p16-resisted-bridge': icon('bridge', 'load'),
  'p16-floor-pushup': icon('pushup'), 'p16-feet-pushup': icon('feetPushup'),
  'p16-supported-knee-raise': icon('kneeRaise', 'assisted'),
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
  'knee-raise': icon('kneeRaise'), 'reverse-fly': icon('reverseFly'), preacher: icon('preacher'),
  hammer: icon('cableCurl', 'band'), 'cable-triceps': icon('pushdown'), 'overhead-triceps': icon('overheadCable'),
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

/** Decorative: always pair with a visible exercise name. No requests or animation. */
export function ExerciseIcon({ exercise, size = 32 }: { exercise: { id: string }; size?: 24 | 32 | 40 }) {
  const { emblem, detail } = exerciseIconSpec(exercise.id);
  return <svg className="exercise-emblem" width={size} height={size} viewBox="0 0 32 32"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" data-exercise-icon={exercise.id}>
    <path d={emblems[emblem]}/>
    {detail && <g className="exercise-emblem-detail" strokeWidth="1.5">
      <circle cx="25" cy="25" r="5" fill="var(--surface, white)"/>
      {detail === 'assisted' && <path d="M23 25h4 M25 23v4"/>}
      {detail === 'band' && <path d="M22 25q3-5 6 0-3 5-6 0Z"/>}
      {detail === 'load' && <path d="M23 24h4v3h-4z M24 24v-1h2v1"/>}
      {detail === 'dumbbells' && <path d="M23 25h4 M23 23v4 M27 23v4"/>}
    </g>}
  </svg>;
}
