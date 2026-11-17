type Point = readonly [number, number, number];
type Colour = readonly [number, number, number];
type Shape = { center: Point; size: Point; colour: Colour; axis?: Point; lateral?: Point; box?: 'solid' | 'covered-top'; floor?: boolean };
export type Scene = Shape[];

const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Point, n: number): Point => [a[0] * n, a[1] * n, a[2] * n];
const subtract = (a: Point, b: Point): Point => add(a, scale(b, -1));
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Point) => Math.hypot(...a);
const normal = (a: Point) => scale(a, 1 / (length(a) || 1));
const mix = (a: Point, b: Point, t: number) => add(a, scale(subtract(b, a), t));
const up: Point = [0, 1, 0];
const across: Point = [1, 0, 0];
const forward: Point = [0, 0, 1];

const body: Colour = [71, 91, 77];
const limbs: Colour = [100, 119, 104];
const light: Colour = [177, 196, 177];
const accent: Colour = [157, 212, 92];
const equipment: Colour = [107, 127, 94];
const mat: Colour = [207, 219, 196];
const shadow: Colour = [206, 215, 202];

const sphere: Point[] = [];
const sphereFaces: number[][] = [];
const slices = 12, rings = 8;
for (let j = 0; j <= rings; j++) {
  const latitude = Math.PI * (j / rings - .5);
  for (let i = 0; i < slices; i++) {
    const longitude = 2 * Math.PI * i / slices;
    sphere.push([Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude)]);
    if (j < rings) {
      const next = (i + 1) % slices;
      sphereFaces.push([j * slices + i, (j + 1) * slices + i, (j + 1) * slices + next, j * slices + next]);
    }
  }
}
const cube: Point[] = [[-1,-1,-1], [1,-1,-1], [1,1,-1], [-1,1,-1], [-1,-1,1], [1,-1,1], [1,1,1], [-1,1,1]];
const cubeSides = [[3,2,1,0], [4,5,6,7], [4,7,3,0], [1,2,6,5], [0,1,5,4]];
const cubeFaces = [...cubeSides, [7,6,2,3]];
const sun = normal([-0.45, 0.8, 0.7]);

export function drawTrainingModel(canvas: HTMLCanvasElement, scene: Scene, yaw: number, pitch: number, target: Point, zoom: number) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  const c = Math.cos(yaw), s = Math.sin(yaw), tilt = Math.cos(pitch), rise = Math.sin(pitch);
  const camera: Point = [s * tilt, rise, c * tilt];
  const right: Point = [c, 0, -s];
  const above = cross(camera, right);
  const pixels = Math.min(width, height) * zoom;
  const project = (point: Point) => {
    const relative = subtract(point, target);
    const z = dot(relative, camera);
    const perspective = 5 / (5 - z);
    return [width / 2 + dot(relative, right) * pixels * perspective, height / 2 - dot(relative, above) * pixels * perspective];
  };
  const faces: { points: number[][]; depth: number; fill: string; floor: boolean }[] = [];
  for (const { center, size, colour, axis = up, lateral = across, box, floor } of scene) {
    const y = normal(axis);
    const side = Math.abs(dot(y, normal(lateral))) > .92 ? forward : lateral;
    const x = normal(subtract(side, scale(y, dot(side, y))));
    const z = cross(x, y);
    const vertices = (box ? cube : sphere).map(([a, b, c]) => add(center, add(scale(x, a * size[0]), add(scale(y, b * size[1]), scale(z, c * size[2])))));
    const projected = vertices.map(project);
    const mesh = box === 'covered-top' ? cubeSides : box ? cubeFaces : sphereFaces;
    for (const face of mesh) {
      const center = scale(face.reduce<Point>((sum, i) => add(sum, vertices[i]), [0, 0, 0]), .25);
      const [a, b, c, d] = face.map(i => vertices[i]);
      const facing = normal(cross(subtract(c, a), subtract(d, b)));
      if (dot(facing, subtract(add(target, scale(camera, 5)), center)) <= 0) continue;
      const brightness = .75 + .31 * Math.max(0, dot(facing, sun));
      const fill = `rgb(${colour.map(value => Math.round(value * brightness)).join(',')})`;
      faces.push({ points: face.map(i => projected[i]), depth: dot(center, camera), fill, floor: !!floor });
    }
  }
  context.clearRect(0, 0, width, height);
  context.lineJoin = 'round';
  context.lineWidth = 0.65;
  // A floor surface stays under the figure across the full length of the mat.
  for (const { points, fill } of faces.sort((a, b) => Number(b.floor) - Number(a.floor) || a.depth - b.depth)) {
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) context.lineTo(x, y);
    context.closePath();
    context.fillStyle = context.strokeStyle = fill;
    context.fill();
    context.stroke();
  }
}

const oval = (center: Point, size: Point, colour = body, axis?: Point, lateral?: Point): Shape => ({ center, size, colour, axis, lateral });
const block = (center: Point, size: Point, colour: Colour, box: Shape['box'] = 'solid'): Shape => ({ center, size, colour, box });
const segment = (start: Point, end: Point, width: number, depth: number, colour: Colour, padding = .025, lateral?: Point) =>
  oval(mix(start, end, .5), [width, length(subtract(end, start)) / 2 + padding, depth], colour, subtract(end, start), lateral);

type Joint = 'hip' | 'knee' | 'ankle' | 'toe' | 'shoulder' | 'elbow' | 'wrist' | 'hand';
type Side = Record<Joint, Point>;
type Pose = { head: Point; neck: Point; left: Side; right: Side };
const mirror = ([x, y, z]: Point): Point => [-x, y, z];
const mirrored = (side: Side): Side => ({
  hip: mirror(side.hip), knee: mirror(side.knee), ankle: mirror(side.ankle), toe: mirror(side.toe),
  shoulder: mirror(side.shoulder), elbow: mirror(side.elbow), wrist: mirror(side.wrist), hand: mirror(side.hand),
});
const blendSide = (a: Side, b: Side, t: number): Side => ({
  hip: mix(a.hip, b.hip, t), knee: mix(a.knee, b.knee, t), ankle: mix(a.ankle, b.ankle, t), toe: mix(a.toe, b.toe, t),
  shoulder: mix(a.shoulder, b.shoulder, t), elbow: mix(a.elbow, b.elbow, t), wrist: mix(a.wrist, b.wrist, t), hand: mix(a.hand, b.hand, t),
});
const blendPose = (a: Pose, b: Pose, t: number): Pose => ({
  head: mix(a.head, b.head, t), neck: mix(a.neck, b.neck, t), left: blendSide(a.left, b.left, t), right: blendSide(a.right, b.right, t),
});

function figure({ head, neck, left, right }: Pose, { arms = [], legs = [], torso = false }: { arms?: Side[]; legs?: Side[]; torso?: boolean } = {}): Scene {
  const hips = mix(left.hip, right.hip, .5), chest = mix(left.shoulder, right.shoulder, .5);
  const shoulders = subtract(left.shoulder, right.shoulder);
  const waist = mix(hips, chest, .52);
  return [
    segment(hips, chest, .174, .112, torso ? accent : body, .095),
    segment(waist, chest, .213, .109, torso ? accent : body, .075, shoulders),
    segment(left.hip, right.hip, .096, .11, body, .071),
    segment(chest, neck, .065, .066, limbs),
    segment(neck, head, .095, .087, light, .065),
    ...[left, right].flatMap(side => {
      const armColour = arms.includes(side) ? accent : limbs;
      const legColour = legs.includes(side) ? accent : limbs;
      return [
        oval(side.shoulder, [.077, .079, .071], armColour), segment(side.shoulder, side.elbow, .063, .06, armColour),
        oval(side.elbow, [.045, .047, .045], armColour), segment(side.elbow, side.wrist, .048, .045, armColour),
        segment(side.wrist, side.hand, .048, .035, armColour, .04),
        segment(side.hip, side.knee, .092, .083, legColour, .049), oval(side.knee, [.061, .061, .058], legColour),
        segment(side.knee, side.ankle, .066, .062, legColour), segment(side.ankle, side.toe, .064, .043, legColour, .036),
      ];
    }),
  ];
}

const standing: Side = {
  hip: [.13, .96, 0], knee: [.16, .55, .014], ankle: [.17, .12, 0], toe: [.17, .07, .13],
  shoulder: [.22, 1.47, 0], elbow: [.32, 1.18, 0], wrist: [.38, .92, .015], hand: [.39, .85, .02],
};
const standingPose: Pose = { head: [0, 1.72, 0], neck: [0, 1.60, 0], left: standing, right: mirrored(standing) };
type Region = { back?: boolean; patches: Shape[] };
const paired = (point: Point, size: Point, axis?: Point) => [oval(point, size, accent, axis), oval(mirror(point), size, accent, axis && mirror(axis))];
export const muscleRegions: ReadonlyMap<string, Region> = new Map([
  ['Back', { back: true, patches: paired([.095, 1.32, -.085], [.091, .22, .052]) }],
  ['Biceps', { patches: paired([.267, 1.33, .046], [.051, .104, .036], [.10, -.29, 0]) }],
  ['Calves', { back: true, patches: paired([.165, .38, -.041], [.060, .131, .04]) }],
  ['Chest', { patches: paired([.097, 1.397, .102], [.104, .080, .034]) }],
  ['Core', { patches: [oval([0, 1.132, .094], [.123, .138, .045], accent)] }],
  ['Full body', { patches: [] }],
  ['Glutes', { back: true, patches: paired([.104, .955, -.060], [.092, .113, .073]) }],
  ['Hamstrings', { back: true, patches: paired([.147, .76, -.056], [.064, .158, .045]) }],
  ['Quads', { patches: paired([.145, .758, .066], [.074, .154, .041]) }],
  ['Shoulders', { patches: paired([.228, 1.485, .01], [.078, .086, .081]) }],
  ['Triceps', { back: true, patches: paired([.268, 1.33, -.048], [.051, .108, .036], [.10, -.29, 0]) }],
]);

export function muscleScene(label: string | undefined): Scene {
  const whole = label === 'Full body';
  const pose = standingPose;
  const all = whole ? [pose.left, pose.right] : [];
  return [{ ...oval([0, -.04, 0], [.43, .012, .24], shadow), floor: true }, ...figure(pose, { arms: all, legs: all, torso: whole }), ...(muscleRegions.get(label ?? '')?.patches ?? [])];
}

const pushUp: Side = {
  hip: [.15, .49, -.22], knee: [.13, .32, -.60], ankle: [.13, .14, -.98], toe: [.13, .056, -.88],
  shoulder: [.21, .77, .43], elbow: [.23, .63, .52], wrist: [.22, .52, .62], hand: [.22, .51, .69],
};
const pushUpBottom: Side = { ...pushUp, hip: [.15, .36, -.18], knee: [.13, .25, -.57], shoulder: [.21, .59, .53], elbow: [.34, .65, .40] };
const lying: Side = {
  hip: [.125, .159, .02], knee: [.13, .55, .07], ankle: [.13, .52, .45], toe: [.13, .62, .47],
  shoulder: [.21, .16, -.50], elbow: [.22, .42, -.50], wrist: [.22, .67, -.50], hand: [.22, .74, -.50],
};
const extendedArm: Side = { ...lying, elbow: [.21, .32, -.75], wrist: [.21, .22, -.99], hand: [.21, .20, -1.09] };
const extendedLeg: Side = { ...lying, knee: [.13, .265, .418], ankle: [.13, .19, .82], toe: [.13, .28, .88] };
const seated: Side = {
  hip: [.12, .165, -.13], knee: [.31, .39, .16], ankle: [.21, .09, .46], toe: [.16, .07, .53],
  shoulder: [.205, .66, -.17], elbow: [.33, .37, -.20], wrist: [.38, .1, -.26], hand: [.38, .065, -.21],
};
const foldedLeft: Side = { ...seated, knee: [.46, .10, .13], ankle: [.25, .065, .46], toe: [.16, .06, .52] };
const foldedRight: Side = { ...mirrored(seated), knee: [.07, .095, .28], ankle: [-.29, .065, .39], toe: [-.38, .058, .41] };
const curled: Side = {
  hip: [.09, .17, .02], knee: [.35, .12, .37], ankle: [.25, .085, .71], toe: [.35, .073, .75],
  shoulder: [.08, .10, -.44], elbow: [.37, .10, -.45], wrist: [.61, .095, -.46], hand: [.73, .09, -.47],
};
const topSide: Side = { ...curled, hip: [.08, .24, .02], knee: [.35, .21, .37], ankle: [.25, .155, .71], toe: [.35, .15, .75],
  shoulder: [0, .32, -.44], elbow: [.29, .26, -.44], wrist: [.53, .20, -.45], hand: [.64, .175, -.46] };
const mobilityMat = { ...block([0, 0, -.06], [.64, .025, 1.19], mat), floor: true };

export type DemoId = 'dead-bug' | 'incline-pushup' | 'hip-switch' | 'open-book';

// Movement is authored in world coordinates, so each camera shows the same pose.
export function demoScene(id: DemoId, phase: number): Scene {
  if (id === 'incline-pushup') {
    const t = .5 - .5 * Math.cos(phase * 2 * Math.PI);
    const left = blendSide(pushUp, pushUpBottom, t);
    const pose = { left, right: mirrored(left), head: mix([0, .84, .65], [0, .65, .78], t), neck: mix([0, .79, .53], [0, .60, .65], t) } as const;
    return [
      { ...oval([0, -.025, -.1], [.49, .009, 1.1], shadow), floor: true },
      block([0, .46, .724], [.39, .039, .22], equipment),
      block([0, .21, .76], [.29, .211, .132], mat, 'covered-top'),
      ...figure(pose),
    ];
  }
  if (id === 'dead-bug') {
    const t = .5 - .5 * Math.cos(phase * 4 * Math.PI);
    const otherSide = phase >= .5;
    const left = blendSide(lying, otherSide ? extendedLeg : extendedArm, t);
    const right = mirrored(blendSide(lying, otherSide ? extendedArm : extendedLeg, t));
    return [mobilityMat, ...figure({ left, right, head: [0, .115, -.80], neck: [0, .143, -.655] }, { arms: [otherSide ? right : left], legs: [otherSide ? left : right] })];
  }
  if (id === 'hip-switch') {
    const start: Pose = { head: [0, .89, -.19], neck: [0, .77, -.16], left: foldedLeft, right: foldedRight };
    const middle: Pose = { ...start, left: seated, right: mirrored(seated) };
    const end: Pose = { ...start, left: mirrored(foldedRight), right: mirrored(foldedLeft) };
    const sweep = .5 - .5 * Math.cos(phase * 2 * Math.PI);
    const pose = sweep < .5 ? blendPose(start, middle, sweep * 2) : blendPose(middle, end, (sweep - .5) * 2);
    return [mobilityMat, ...figure(pose, { legs: [pose.left, pose.right] })];
  }
  const sweep = .5 - .5 * Math.cos(phase * 2 * Math.PI);
  const angle = -.29 + sweep * (Math.PI + .45);
  const shoulder: Point = [-.155 * sweep, .32 - .14 * sweep, -.44];
  const arm: Point = [Math.cos(angle), Math.sin(angle), -.095];
  const moving = { ...topSide, shoulder, elbow: add(shoulder, scale(arm, .30)), wrist: add(shoulder, scale(arm, .55)), hand: add(shoulder, scale(arm, .66)) };
  return [mobilityMat, ...figure({ left: curled, right: moving, head: mix([.025, .172, -.708], [-.06, .13, -.708], sweep), neck: mix([.04, .19, -.58], [-.025, .15, -.58], sweep) }, { arms: [moving] })];
}
