import {
  BufferAttribute, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial,
  OrthographicCamera, Scene, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function createMuscleModelRenderer(canvas: HTMLCanvasElement, signal: AbortSignal) {
  const response = await fetch('/muscle-model/anatomy.glb', { signal });
  if (!response.ok) throw new Error('Muscle model unavailable');
  const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
  const body = gltf.scene.children[0];
  if (!(body instanceof Mesh)) throw new Error('Muscle model mesh unavailable');
  const geometry = body.geometry;
  body.material.dispose();
  if (signal.aborted) {
    geometry.dispose();
    signal.throwIfAborted();
  }

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (error) {
    geometry.dispose();
    throw error;
  }
  geometry.computeVertexNormals();
  const colors = new BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3);
  geometry.setAttribute('color', colors);
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: .91 });
  body.material = material;

  const scene = new Scene();
  scene.add(body, new HemisphereLight(0xf9fcff, 0x929088, 2.15));
  const key = new DirectionalLight(0xfff7eb, 2.45);
  const fill = new DirectionalLight(0xe8f1ff, .85);
  const camera = new OrthographicCamera(-.5, .5, .55, -.55, .1, 10);
  scene.add(key, fill);

  const ivory = new Color('#c9c7bd');
  const green = new Color('#79a93e');
  const color = new Color();
  let previousLabel: string | undefined;
  let width = 0, height = 0, pixelRatio = 0;

  return {
    draw(label: string, yaw: number) {
      const nextWidth = canvas.clientWidth;
      const nextHeight = canvas.clientHeight;
      if (!nextWidth || !nextHeight) return;
      const nextRatio = Math.min(window.devicePixelRatio || 1, 2.5);
      if (width !== nextWidth || height !== nextHeight || pixelRatio !== nextRatio) {
        width = nextWidth;
        height = nextHeight;
        pixelRatio = nextRatio;
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        camera.left = -.55 * width / height;
        camera.right = -camera.left;
        camera.updateProjectionMatrix();
      }
      if (previousLabel !== label) {
        const mask = geometry.getAttribute(`_${label.toLowerCase()}`);
        for (let index = 0; index < colors.count; index++) {
          const weight = label === 'Full body' ? 1 : mask?.getX(index) ?? 0;
          color.copy(ivory).lerp(green, weight);
          colors.setXYZ(index, color.r, color.g, color.b);
        }
        colors.needsUpdate = true;
        previousLabel = label;
      }
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      camera.position.set(sin * 3, .61, cos * 3);
      camera.lookAt(0, .497, 0);
      key.position.set(2 * sin - 2.4 * cos, 3.5, 2 * cos + 2.4 * sin);
      fill.position.set(sin + 2.8 * cos, 1.4, cos - 2.8 * sin);
      renderer.render(scene, camera);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
