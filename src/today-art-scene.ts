import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, Color, CylinderGeometry, DirectionalLight,
  Group, InstancedMesh, LatheGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Object3D, OrthographicCamera,
  PlaneGeometry, PMREMGenerator, Scene, SRGBColorSpace, TorusGeometry, TubeGeometry,
  CatmullRomCurve3, Vector2, Vector3, WebGLRenderer,
  type BufferGeometry, type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { TodayArtKind } from './today-art';

type Pose = (amount: number, progress: number) => void;
type Model = { scene: Scene; camera: OrthographicCamera; pose: Pose };

const paint = (color: number, roughness: number, metalness = 0) =>
  new MeshPhysicalMaterial({ color, roughness, metalness });

function addMesh(group: Group, geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function surface(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot draw Today artwork texture');
  draw(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function softShadow(group: Group, radius: number, depth: number, y: number, opacity: number) {
  const map = surface(64, 64, ctx => {
    const fade = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    fade.addColorStop(0, '#162219');
    fade.addColorStop(.36, '#162219aa');
    fade.addColorStop(.7, '#16221938');
    fade.addColorStop(1, '#16221900');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 64, 64);
  });
  const shadow = addMesh(group, new PlaneGeometry(radius, depth), new MeshBasicMaterial({
    map, transparent: true, depthWrite: false, opacity, toneMapped: false,
  }), 0, y);
  shadow.rotation.x = -Math.PI / 2;
}

function turned(profile: ReadonlyArray<readonly [number, number]>, segments = 64) {
  return new LatheGeometry(profile.map(([radius, height]) => new Vector2(radius, height)), segments);
}

function strength(root: Group): Pose {
  const dumbbell = new Group();
  dumbbell.rotation.order = 'ZYX';
  root.add(dumbbell);

  const rubber = paint(0x242c27, .48);
  const graphite = paint(0x515e53, .33, .67);
  const lime = paint(0xb4d960, .29, .48);
  const steel = paint(0x687469, .25, .89);
  const grip = paint(0x303a32, .42, .32);

  const handle = addMesh(dumbbell, turned([
    [0, -.72], [.103, -.72], [.103, -.43], [.127, -.35], [.136, 0],
    [.127, .35], [.103, .43], [.103, .72], [0, .72],
  ]), grip);
  handle.rotation.z = -Math.PI / 2;

  const plate = turned([
    [0, -.16], [.35, -.16], [.436, -.145], [.48, -.095], [.487, -.04],
    [.487, .085], [.465, .13], [.404, .154], [.31, .154], [.285, .13], [0, .13],
  ]);
  const rim = turned([[0, -.039], [.426, -.039], [.454, -.026], [.457, .02], [.434, .042], [0, .042]]);
  const hub = turned([[0, -.054], [.276, -.054], [.295, -.02], [.295, .03], [.26, .079], [.135, .101], [0, .101]]);
  const bolt = new CylinderGeometry(.106, .12, .084, 8);

  for (const side of [-1, 1]) {
    const end = new Group();
    end.position.x = side * .83;
    end.rotation.z = -side * Math.PI / 2;
    dumbbell.add(end);
    addMesh(end, plate, rubber);
    addMesh(end, rim, graphite, 0, -.11);
    addMesh(end, hub, lime, 0, .137);
    addMesh(end, bolt, steel, 0, .241);
    const seam = addMesh(end, new TorusGeometry(.375, .012, 8, 64), graphite, 0, .156);
    seam.rotation.x = -Math.PI / 2;
  }

  const rings = new Group();
  rings.rotation.order = 'ZYX';
  root.add(rings);
  const ringMetal = new MeshPhysicalMaterial({
    color: 0xb1d486, roughness: .29, metalness: .44, clearcoat: .54,
    emissive: new Color(0x829a54), emissiveIntensity: .11,
  });
  addMesh(rings, new TorusGeometry(1.425, .05, 16, 96), ringMetal);
  addMesh(rings, new TorusGeometry(1.248, .032, 12, 96), ringMetal, 0, 0, -.024);

  return amount => {
    dumbbell.rotation.set(.08 - .15 * amount, .52 + .28 * amount, .51 + .09 * amount);
    dumbbell.position.y = .065 * amount;
    rings.rotation.set(.8 - .16 * amount, -.19 + .18 * amount, .45 - .09 * amount);
  };
}

function recovery(root: Group): Pose {
  softShadow(root, 3.8, 2.1, -.58, .8);
  const mat = new Group();
  mat.position.y = -.055;
  mat.rotation.order = 'YXZ';
  root.add(mat);
  const foam = paint(0x718866, .85);
  const edge = paint(0x9ab68a, .76);
  const strap = paint(0x304538, .7);
  const buckle = paint(0xbad77b, .42, .28);
  foam.map = surface(256, 64, ctx => {
    ctx.fillStyle = '#d0d6c8';
    ctx.fillRect(0, 0, 256, 64);
    for (let y = 0; y < 64; y += 4) {
      ctx.fillStyle = y % 8 ? '#b7c0b0' : '#edf0e9';
      ctx.fillRect(0, y, 256, 1);
    }
  });
  const roll = addMesh(mat, turned([[0, -1.06], [.44, -1.06], [.48, -1.015], [.49, -.98], [.49, .98], [.48, 1.02], [.44, 1.06], [0, 1.06]]), foam);
  roll.rotation.z = -Math.PI / 2;
  for (const side of [-1, 1]) {
    const belt = addMesh(mat, turned([[.48, -.086], [.505, -.086], [.516, -.07], [.516, .07], [.505, .086], [.48, .086]]), strap, side * .64);
    belt.rotation.z = -Math.PI / 2;
    const catchMesh = addMesh(mat, new RoundedBoxGeometry(.19, .075, .22, 2, .032), buckle, side * .64, .512, .08);
    catchMesh.rotation.x = .18;

    const coil = Array.from({ length: 129 }, (_, i) => {
      const angle = i / 128 * Math.PI * 7;
      const radius = .038 + i / 128 * .393;
      return new Vector3(side * 1.064, radius * Math.cos(angle), radius * Math.sin(angle));
    });
    addMesh(mat, new TubeGeometry(new CatmullRomCurve3(coil), 128, .012, 7, false), edge);
  }
  return amount => mat.rotation.set(.14 + .24 * amount, -.33 + .12 * amount, .16);
}

function bodyweight(root: Group): Pose {
  softShadow(root, 3.5, 2.65, -.31, .74);
  const base = paint(0x6e826e, .38, .55);
  const bezel = paint(0xb6bfb0, .26, .81);
  const face = new MeshPhysicalMaterial({ color: 0xaabca4, metalness: .78, roughness: .36, anisotropy: .52 });
  const needlePaint = paint(0x476341, .35, .42);
  const tickInk = paint(0x47594b, .76);
  base.map = surface(512, 64, ctx => {
    ctx.fillStyle = '#b1bcb0';
    ctx.fillRect(0, 0, 512, 64);
    ctx.lineWidth = 1.5;
    for (const slope of [-1, 1]) {
      ctx.strokeStyle = slope < 0 ? '#798a7b' : '#d6dfd4';
      ctx.beginPath();
      for (let x = -64; x <= 576; x += 8) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + slope * 32, 64);
      }
      ctx.stroke();
    }
  });
  addMesh(root, turned([[0, -.29], [.88, -.29], [1.02, -.267], [1.08, -.168], [1.08, .087], [1.045, .17], [.99, .192], [0, .192]]), base);
  addMesh(root, turned([[0, .10], [.96, .10], [1.035, .15], [1.038, .195], [1.002, .241], [.959, .251], [.78, .256], [.751, .238], [0, .238]]), bezel);
  addMesh(root, turned([[0, .234], [.75, .234], [.753, .247], [.726, .269], [.66, .275], [0, .275]]), face);

  const majorTicks = new InstancedMesh(new RoundedBoxGeometry(.018, .008, .091, 1, .003), tickInk, 12);
  const minorTicks = new InstancedMesh(new RoundedBoxGeometry(.011, .008, .042, 1, .002), tickInk, 36);
  const mark = new Object3D();
  let minorIndex = 0;
  for (let i = 0; i < 48; i++) {
    const angle = i / 48 * Math.PI * 2;
    const major = i % 4 === 0;
    const radius = major ? .866 : .9;
    mark.position.set(Math.sin(angle) * radius, .259, Math.cos(angle) * radius);
    mark.rotation.y = angle;
    mark.updateMatrix();
    if (major) majorTicks.setMatrixAt(i / 4, mark.matrix);
    else minorTicks.setMatrixAt(minorIndex++, mark.matrix);
  }
  root.add(majorTicks, minorTicks);

  const needle = new Group();
  root.add(needle);
  addMesh(needle, new RoundedBoxGeometry(.043, .025, .69, 2, .012), needlePaint, 0, .29, .34);
  addMesh(root, new CylinderGeometry(.119, .145, .051, 48), bezel, 0, .303);
  addMesh(root, new CylinderGeometry(.066, .073, .016, 40), needlePaint, 0, .327);
  return amount => { needle.rotation.y = 2.13 + .89 * amount; };
}

function progress(root: Group): Pose {
  softShadow(root, 3.55, 2.65, -1.02, .75);
  const tile = new RoundedBoxGeometry(.56, .56, .56, 3, .062);
  const jade = [paint(0x849d87, .32, .26), paint(0x65836d, .29, .32), paint(0xa3ba9d, .3, .24)];
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y <= x; y++) {
      const top = x === 3 && y === 3;
      if (!top) addMesh(root, tile, jade[(x + y) % 3], (x - 1.5) * .59, y * .59 - .723, .24);
      if (x > 0 && y < x) addMesh(root, tile, jade[(x + 2 * y + 1) % 3], (x - 1.5) * .59, y * .59 - .723, -.35);
    }
  }
  const lime = new MeshPhysicalMaterial({
    color: 0xb5e64f, roughness: .24, clearcoat: .56, metalness: .12,
    emissive: 0x94c43d, emissiveIntensity: .13,
  });
  const cap = addMesh(root, tile, lime, .885, 1.047, .24);
  return (amount, time) => {
    cap.position.y = 1.047 + .28 * amount;
    cap.rotation.y = .19 * amount;
    lime.emissiveIntensity = .13 + .16 * amount * Math.sin(time * Math.PI);
  };
}

const models = { strength, recovery, bodyweight, progress };
const compositions: Record<TodayArtKind, { eye: [number, number, number]; targetY: number; height: number }> = {
  strength: { eye: [0, 0, 5], targetY: 0, height: 2.52 },
  recovery: { eye: [3.3, 2.15, 5.1], targetY: -.06, height: 2.34 },
  bodyweight: { eye: [2.6, 3.65, 4.2], targetY: -.045, height: 2.21 },
  progress: { eye: [3.75, 2.85, 6], targetY: .06, height: 2.98 },
};

function createModel(kind: TodayArtKind, environment: Scene['environment']): Model {
  const { eye, targetY, height } = compositions[kind];
  const camera = new OrthographicCamera(-height * 2 / 3, height * 2 / 3, height / 2, -height / 2, .1, 40);
  camera.position.set(...eye);
  camera.lookAt(0, targetY, 0);
  const scene = new Scene();
  scene.environment = environment;
  scene.environmentIntensity = kind === 'strength' ? .88 : .83;
  const key = new DirectionalLight(0xfff6e5, kind === 'progress' ? 1.65 : 2.2);
  key.position.set(-3, 6, 4);
  const rim = new DirectionalLight(0xd1eed6, kind === 'progress' ? 1.1 : 1.55);
  rim.position.set(4, 2, -4);
  const ambient = new AmbientLight(0xeaf5e7, .45);
  const root = new Group();
  scene.add(key, rim, ambient, root);
  return { scene, camera, pose: models[kind](root) };
}

export function createTodayArtRenderer(onLost: () => void) {
  const source = document.createElement('canvas');
  source.width = 4;
  source.height = 3;
  const context = source.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!context) return null;

  const renderer = new WebGLRenderer({ canvas: source, context, alpha: true, antialias: true });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const studio = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const lighting = (() => {
    try {
      return pmrem.fromScene(studio, .045, .1, 100, { size: 128 });
    } catch (error) {
      renderer.dispose();
      renderer.forceContextLoss();
      throw error;
    } finally {
      studio.dispose();
      pmrem.dispose();
    }
  })();

  const scenes = new Map<TodayArtKind, Model>();
  source.addEventListener('webglcontextlost', onLost);

  return {
    draw(kind: TodayArtKind, target: CanvasRenderingContext2D, progress: number) {
      const { width, height } = target.canvas;
      // Keep the shared buffer large enough for the biggest card without resizing between cards.
      if (source.width < width) renderer.setSize(width, height, false);
      let model = scenes.get(kind);
      if (!model) {
        model = createModel(kind, lighting.texture);
        scenes.set(kind, model);
      }
      const amount = Math.sin(Math.PI * progress) ** 2;
      model.pose(amount, progress);
      renderer.setViewport(0, 0, width, height);
      renderer.setScissor(0, 0, width, height);
      renderer.setScissorTest(true);
      renderer.render(model.scene, model.camera);
      target.clearRect(0, 0, width, height);
      target.drawImage(source, 0, source.height - height, width, height, 0, 0, width, height);
    },
    dispose() {
      source.removeEventListener('webglcontextlost', onLost);
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<MeshBasicMaterial | MeshPhysicalMaterial>();
      for (const { scene } of scenes.values()) {
        scene.traverse(object => {
          if (object instanceof Mesh) {
            geometries.add(object.geometry);
            materials.add(object.material);
          }
          if (object instanceof InstancedMesh) object.dispose();
        });
      }
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
      scenes.clear();
      lighting.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
