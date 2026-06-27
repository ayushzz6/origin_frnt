/**
 * ori-model.ts — loads the real Ori GLB and prepares it for the scene.
 *
 * All GLBs are meshopt-compressed (EXT_meshopt_compression). The MeshoptDecoder
 * is bundled with Three.js so no external decoder path is needed.
 *
 * The model is centred at the origin and uniformly scaled to a fixed height so it frames
 * identically to the procedural mascot, then returned wrapped in a Group the scene can
 * drop into its head pivot.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Target on-screen height (world units) — matches the procedural body framing. */
const TARGET_HEIGHT = 2.4;

/** A single morph target located on a specific mesh. */
export interface MorphRef {
  mesh: THREE.Mesh;
  index: number;
}

export interface LoadedOri {
  /** Centred + scaled group ready to drop into the scene's head pivot. */
  object: THREE.Group;
  /** Animation clips baked into the GLB (may be empty). */
  clips: THREE.AnimationClip[];
  /** Morph targets by lowercased name → every mesh/index exposing it. */
  morphTargets: Map<string, MorphRef[]>;
  /** True if the model can show real expressions (morph targets and/or clips). */
  hasExpressions: boolean;
}

let sharedLoader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (sharedLoader) return sharedLoader;
  const loader = new GLTFLoader();
  // Models are meshopt-compressed (EXT_meshopt_compression); decoder is bundled.
  loader.setMeshoptDecoder(MeshoptDecoder as unknown as Parameters<GLTFLoader['setMeshoptDecoder']>[0]);
  sharedLoader = loader;
  return loader;
}

/** Centre at origin + uniform-scale to TARGET_HEIGHT, wrapped in a fresh Group. */
function fit(scene: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  scene.position.sub(center);
  const wrap = new THREE.Group();
  wrap.name = 'OriModel';
  wrap.add(scene);
  wrap.scale.setScalar(TARGET_HEIGHT / (size.y || 1));
  return wrap;
}

/** Collect every morph target in the model, keyed by lowercased name. */
function collectMorphTargets(root: THREE.Object3D): Map<string, MorphRef[]> {
  const map = new Map<string, MorphRef[]>();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    if (!dict || !mesh.morphTargetInfluences) return;
    for (const [name, index] of Object.entries(dict)) {
      const key = name.toLowerCase();
      const list = map.get(key) ?? [];
      list.push({ mesh, index });
      map.set(key, list);
    }
  });
  return map;
}

/** Load the first URL that resolves; later entries are fallbacks (e.g. un-optimized). */
export async function loadOriModel(urls: string[]): Promise<LoadedOri> {
  const loader = getLoader();
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const gltf = await loader.loadAsync(url);
      const object = fit(gltf.scene);
      const morphTargets = collectMorphTargets(object);
      const clips = gltf.animations ?? [];
      return { object, clips, morphTargets, hasExpressions: morphTargets.size > 0 || clips.length > 0 };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('No Ori model URL could be loaded');
}

/** Dispose a loaded model's geometries, materials and textures. */
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of mats) {
      for (const key of Object.keys(m)) {
        const val = (m as unknown as Record<string, unknown>)[key];
        if (val instanceof THREE.Texture) val.dispose();
      }
      m.dispose();
    }
  });
}
