/**
 * ori-scene.ts — framework-agnostic Three.js builder for the Origin mascot "Ori".
 *
 * Pure three.js (no R3F) to match this repo's convention (see OriginLogoBackground.tsx,
 * ParticleBackground.tsx). The React wrapper (OriMascot.tsx) owns the renderer + RAF loop
 * and the mount/cleanup lifecycle; this module builds the scene/camera/meshes and exposes a
 * per-frame `update()` plus `resize()` / `dispose()`.
 *
 * Phase 2: `update()` eases live parameters toward the per-state targets from
 * `ori-animator.ts`, animating all six MascotStates (idle / curious / thinking / answering /
 * success / error) with smooth transitions.
 */
import * as THREE from 'three';
import type { MascotState } from './mascot-state';
import { damp, makeParams, REDUCED_PARAMS, STATE_TARGETS, type OriParams } from './ori-animator';
import type { LoadedOri } from './ori-model';

export interface OriSceneHandle {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Advance the animation. `elapsed`/`dt` in seconds; `elapsed` is monotonic & pause-aware. */
  update(elapsed: number, dt: number, state: MascotState, reducedMotion: boolean): void;
  /**
   * Swap the procedural body for a loaded GLB (or `null` to restore procedural).
   * Returns true if the model exposes real expressions (morph targets / clips),
   * in which case the 2D expression pop should be suppressed. `instant` skips the
   * crossfade (reduced motion).
   */
  setModel(loaded: LoadedOri | null, instant?: boolean): boolean;
  /**
   * Toggle the built-in cursor-follow. Disable it when an external camera
   * control (OrbitControls) drives rotation so the two don't fight.
   */
  setMouseTracking(enabled: boolean): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const COL = {
  bodyBottom: new THREE.Color('#1E8FC8'),
  bodyTop: new THREE.Color('#7FD6F7'),
  rim: new THREE.Color('#C5EFFF'),
  electron: new THREE.Color('#CFefff'),
  ring: new THREE.Color('#5FC6F0'),
  eyeIris: new THREE.Color('#0D2A42'),
};

/** Error tint colour for the loaded model's material. */
const RED = new THREE.Color('#ff4d4d');

function dropletProfile(): THREE.Vector2[] {
  return [
    [0.0, -1.06],
    [0.14, -1.02],
    [0.32, -0.92],
    [0.47, -0.74],
    [0.56, -0.5],
    [0.61, -0.22],
    [0.62, 0.08],
    [0.575, 0.36],
    [0.49, 0.62],
    [0.37, 0.86],
    [0.24, 1.08],
    [0.12, 1.28],
    [0.035, 1.44],
    [0.004, 1.55],
  ].map(([x, y]) => new THREE.Vector2(x, y));
}

function makeAuraTexture(): THREE.Texture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(150,225,255,0.55)');
  g.addColorStop(0.35, 'rgba(90,200,245,0.28)');
  g.addColorStop(1, 'rgba(60,180,240,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlyphTexture(glyph: string): THREE.Texture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#7FE0FF';
  ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(120,220,255,0.9)';
  ctx.shadowBlur = 18;
  ctx.fillText(glyph, size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createOriScene(width: number, height: number): OriSceneHandle {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
  camera.position.set(0, 0.25, 4.7);
  camera.lookAt(0, 0.18, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x5fa9d6, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 0.5);
  key.position.set(2.5, 4, 4);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  // Mouse tracking variables
  const mouse = { x: 0, y: 0 };
  const targetMouse = { x: 0, y: 0 };
  let mouseTracking = true;

  const onMouseMove = (e: MouseEvent) => {
    if (!mouseTracking) return;
    targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 0.8;  // max +-0.4 rad yaw
    targetMouse.y = (e.clientY / window.innerHeight - 0.5) * 0.5; // max +-0.25 rad pitch
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!mouseTracking) return;
    if (e.touches[0]) {
      targetMouse.x = (e.touches[0].clientX / window.innerWidth - 0.5) * 0.8;
      targetMouse.y = (e.touches[0].clientY / window.innerHeight - 0.5) * 0.5;
    }
  };

  function setMouseTracking(enabled: boolean): void {
    mouseTracking = enabled;
    if (!enabled) { targetMouse.x = 0; targetMouse.y = 0; }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
  }

  // headGroup holds the body + face so we can tilt / squash the "head" without
  // disturbing the electron orbits.
  const head = new THREE.Group();
  root.add(head);

  /* ── Body (lathe droplet + fresnel-glow shader) ─────────────────────── */
  const bodyGeo = new THREE.LatheGeometry(dropletProfile(), 80);
  bodyGeo.computeVertexNormals();
  let yMin = Infinity;
  let yMax = -Infinity;
  const pos = bodyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }

  const bodyUniforms = {
    uTime: { value: 0 },
    uColorBottom: { value: COL.bodyBottom },
    uColorTop: { value: COL.bodyTop },
    uRim: { value: COL.rim },
    uGlow: { value: 1.0 },
    uYmin: { value: yMin },
    uYmax: { value: yMax },
    uWobble: { value: 1.0 },
    uSat: { value: 1.0 },
    uTint: { value: new THREE.Color('#ff4d4d') },
    uTintAmt: { value: 0.0 },
  };
  const bodyMat = new THREE.ShaderMaterial({
    uniforms: bodyUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWobble;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vY;
      void main() {
        vec3 p = position;
        float wob = sin(uTime * 1.4 + p.y * 3.0) * 0.012 * uWobble;
        p += normal * wob;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vY = p.y;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorBottom;
      uniform vec3 uColorTop;
      uniform vec3 uRim;
      uniform float uGlow;
      uniform float uSat;
      uniform vec3 uTint;
      uniform float uTintAmt;
      uniform float uYmin;
      uniform float uYmax;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vY;
      void main() {
        float t = clamp((vY - uYmin) / (uYmax - uYmin), 0.0, 1.0);
        vec3 base = mix(uColorBottom, uColorTop, t);
        float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.4);
        vec3 col = mix(base, uRim, clamp(fres * 0.95 * uGlow, 0.0, 1.0));
        col += uRim * fres * 0.35 * uGlow;
        float grey = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(grey), col, uSat);
        // Error tint: keep shading luminance, push hue toward red.
        col = mix(col, uTint * (0.45 + 0.9 * grey), uTintAmt);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  head.add(body);

  /* ── Face (eyes + smile) ────────────────────────────────────────────── */
  const face = new THREE.Group();
  head.add(face);

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0 });
  const irisMat = new THREE.MeshStandardMaterial({ color: COL.eyeIris, roughness: 0.25, metalness: 0 });
  const eyeGeo = new THREE.SphereGeometry(0.165, 28, 28);
  const irisGeo = new THREE.SphereGeometry(0.092, 24, 24);
  const glintGeo = new THREE.SphereGeometry(0.032, 12, 12);

  const eyes: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * 0.21, 0.42, 0.43);
    const w = new THREE.Mesh(eyeGeo, whiteMat);
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(0, 0, 0.12);
    const glint = new THREE.Mesh(glintGeo, whiteMat);
    glint.position.set(0.04, 0.05, 0.17);
    eye.add(w, iris, glint);
    face.add(eye);
    eyes.push(eye);
  }

  const smileGeo = new THREE.TorusGeometry(0.12, 0.022, 12, 40, Math.PI * 0.95);
  const smileMat = new THREE.MeshStandardMaterial({ color: COL.eyeIris, roughness: 0.3 });
  const smile = new THREE.Mesh(smileGeo, smileMat);
  smile.position.set(0, 0.16, 0.5);
  smile.rotation.z = Math.PI + Math.PI * 0.025;
  face.add(smile);

  /* ── O³ electrons (3 tilted orbits + faint rings) ───────────────────── */
  const electronMat = new THREE.MeshBasicMaterial({ color: COL.electron });
  const electronGeo = new THREE.SphereGeometry(0.07, 18, 18);
  const ringMat = new THREE.MeshBasicMaterial({
    color: COL.ring,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringGeo = new THREE.TorusGeometry(0.96, 0.006, 8, 96);

  const orbits: THREE.Group[] = [];
  const orbitGroups: THREE.Group[] = [];
  const orbAngle: number[] = [];
  const tilts: Array<[number, number, number]> = [
    [0.42, 0, 0.1],
    [-0.5, 0, 0.7],
    [0.25, 0, -0.8],
  ];
  tilts.forEach(([rx, ry, rz], i) => {
    const orbit = new THREE.Group();
    orbit.rotation.set(rx, ry, rz);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    const electron = new THREE.Mesh(electronGeo, electronMat);
    electron.position.set(0.96, 0, 0);
    const inner = new THREE.Group();
    inner.add(electron);
    inner.userData.spin = 0.8 + i * 0.35;
    orbit.add(ring, inner);
    root.add(orbit);
    orbits.push(inner);
    orbitGroups.push(orbit);
    orbAngle.push((i / tilts.length) * Math.PI * 2);
  });

  /* ── Aura sprite ────────────────────────────────────────────────────── */
  const auraTex = makeAuraTexture();
  const auraMat = new THREE.SpriteMaterial({
    map: auraTex,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const aura = new THREE.Sprite(auraMat);
  aura.scale.set(3.4, 3.6, 1);
  aura.position.set(0, 0.15, -0.6);
  scene.add(aura);

  /* ── Floating "?" (thinking) ────────────────────────────────────────── */
  const qTex = makeGlyphTexture('?');
  const qMat = new THREE.SpriteMaterial({ map: qTex, transparent: true, opacity: 0, depthWrite: false });
  const qmark = new THREE.Sprite(qMat);
  qmark.scale.set(0.5, 0.5, 1);
  qmark.position.set(0.5, 1.7, 0.2);
  root.add(qmark);

  /* ── Sparkle burst (success) ────────────────────────────────────────── */
  const SPARK_N = 36;
  const sparkPos = new Float32Array(SPARK_N * 3);
  for (let i = 0; i < SPARK_N; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    const r = 0.9 + Math.random() * 0.5;
    sparkPos[i * 3] = r * Math.sin(v) * Math.cos(u);
    sparkPos[i * 3 + 1] = 0.2 + r * Math.cos(v) * 0.8;
    sparkPos[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: new THREE.Color('#DFF6FF'),
    size: 0.11,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sparkles = new THREE.Points(sparkGeo, sparkMat);
  root.add(sparkles);

  /* ── Loaded GLB model (swaps in for the procedural body) ────────────── */
  interface ModelMat {
    mat: THREE.MeshStandardMaterial;
    color: THREE.Color;
    emissive: THREE.Color;
    ei: number;
  }
  // Per-emotion model variants (separate GLBs) cached in the head; one visible at a time.
  const modelObjs = new Set<THREE.Object3D>();
  const matsByObj = new Map<THREE.Object3D, ModelMat[]>();
  let activeModel: THREE.Object3D | null = null;
  let activeMats: ModelMat[] = [];
  let modelPop = 0;
  // Crossfade between emotion models on swap.
  const CROSSFADE_DUR = 0.32;
  let fadingOut: THREE.Object3D | null = null;
  let crossfade = 1;

  function setObjOpacity(obj: THREE.Object3D, o: number): void {
    const mats = matsByObj.get(obj);
    if (!mats) return;
    const opaque = o >= 0.999;
    for (const r of mats) {
      r.mat.transparent = !opaque;
      r.mat.opacity = o;
      r.mat.depthWrite = opaque;
    }
  }

  function setProceduralVisible(v: boolean): void {
    body.visible = v;
    face.visible = v;
    orbitGroups.forEach((o) => (o.visible = v));
  }

  function collectMats(obj: THREE.Object3D): ModelMat[] {
    const out: ModelMat[] = [];
    obj.traverse((node) => {
      const m = (node as THREE.Mesh).material;
      const mats = Array.isArray(m) ? m : m ? [m] : [];
      for (const mat of mats) {
        if (mat && 'emissive' in mat) {
          const sm = mat as THREE.MeshStandardMaterial;
          out.push({ mat: sm, color: sm.color.clone(), emissive: sm.emissive.clone(), ei: sm.emissiveIntensity ?? 1 });
        }
      }
    });
    return out;
  }

  // Swap to a loaded emotion model (cached + reused), crossfading from the previous one.
  // `instant` skips the fade (reduced motion / first model). Returns true while shown.
  function setModel(loaded: LoadedOri | null, instant = false): boolean {
    if (!loaded) {
      modelObjs.forEach((o) => (o.visible = false));
      activeModel = null;
      activeMats = [];
      fadingOut = null;
      setProceduralVisible(true);
      return false;
    }
    const object = loaded.object;
    if (!modelObjs.has(object)) {
      head.add(object);
      modelObjs.add(object);
      matsByObj.set(object, collectMats(object));
    }
    if (activeModel === object) {
      activeMats = matsByObj.get(object) ?? [];
      setProceduralVisible(false);
      return true;
    }

    // Finalize any in-progress fade before starting a new one.
    if (fadingOut && fadingOut !== object) {
      fadingOut.visible = false;
      setObjOpacity(fadingOut, 1);
    }

    const doFade = !instant && activeModel !== null;
    fadingOut = doFade ? activeModel : null;
    crossfade = doFade ? 0 : 1;
    modelPop = 1;
    activeModel = object;
    activeMats = matsByObj.get(object) ?? [];

    modelObjs.forEach((o) => (o.visible = o === object || o === fadingOut));
    setObjOpacity(object, doFade ? 0 : 1);
    setProceduralVisible(false);
    return true;
  }

  /* ── Per-frame state-driven update ──────────────────────────────────── */
  const cur: OriParams = makeParams();
  let prevState: MascotState | null = null;
  let popLife = 0;
  let blinkBase = 1;

  function update(elapsed: number, dt: number, state: MascotState, reducedMotion: boolean): void {
    bodyUniforms.uTime.value = elapsed;
    const d = Math.min(dt, 0.05);

    // Detect transitions for one-shot effects (success pop).
    if (state !== prevState) {
      if (state === 'success') popLife = 1;
      prevState = state;
    }
    popLife = Math.max(0, popLife - d * 1.8);

    const target = reducedMotion ? REDUCED_PARAMS : STATE_TARGETS[state];
    const lambda = 6;
    cur.bob = damp(cur.bob, target.bob, lambda, d);
    cur.sway = damp(cur.sway, target.sway, lambda, d);
    cur.orbitSpeed = damp(cur.orbitSpeed, target.orbitSpeed, lambda, d);
    cur.headTilt = damp(cur.headTilt, target.headTilt, lambda, d);
    cur.lean = damp(cur.lean, target.lean, lambda, d);
    cur.squashY = damp(cur.squashY, target.squashY, lambda, d);
    cur.glow = damp(cur.glow, target.glow, lambda, d);
    cur.wobble = damp(cur.wobble, target.wobble, lambda, d);
    cur.sat = damp(cur.sat, target.sat, lambda, d);
    cur.mouth = damp(cur.mouth, target.mouth, lambda, d);
    cur.talk = damp(cur.talk, target.talk, lambda, d);
    cur.lookY = damp(cur.lookY, target.lookY, lambda, d);
    cur.qmark = damp(cur.qmark, target.qmark, lambda * 1.6, d);
    cur.sparkle = damp(cur.sparkle, target.sparkle, lambda, d);
    cur.red = damp(cur.red, target.red, lambda, d);

    // Body shader (procedural body).
    bodyUniforms.uGlow.value = cur.glow;
    bodyUniforms.uWobble.value = cur.wobble;
    bodyUniforms.uSat.value = cur.sat;
    bodyUniforms.uTintAmt.value = cur.red;

    // Active emotion model: convey glow via emissive, error via red tint.
    if (activeModel) {
      const glowBoost = Math.max(0, cur.glow - 1) * 1.4;
      for (const r of activeMats) {
        r.mat.emissive.copy(r.emissive);
        r.mat.emissiveIntensity = r.ei + glowBoost;
        const lum = 0.299 * r.color.r + 0.587 * r.color.g + 0.114 * r.color.b;
        r.mat.color.setRGB(
          THREE.MathUtils.lerp(lum, r.color.r, cur.sat),
          THREE.MathUtils.lerp(lum, r.color.g, cur.sat),
          THREE.MathUtils.lerp(lum, r.color.b, cur.sat),
        );
        if (cur.red > 0.001) r.mat.color.lerp(RED, cur.red);
      }
    }

    // Crossfade between the outgoing and incoming emotion models.
    if (fadingOut) {
      crossfade = Math.min(1, crossfade + d / CROSSFADE_DUR);
      if (activeModel) setObjOpacity(activeModel, crossfade);
      setObjOpacity(fadingOut, 1 - crossfade);
      if (crossfade >= 1) {
        fadingOut.visible = false;
        setObjOpacity(fadingOut, 1);
        if (activeModel) setObjOpacity(activeModel, 1);
        fadingOut = null;
      }
    }

    // Smoothly interpolate mouse position towards target
    const easeSpeed = reducedMotion ? 0 : 0.08;
    mouse.x += (targetMouse.x - mouse.x) * easeSpeed;
    mouse.y += (targetMouse.y - mouse.y) * easeSpeed;

    // Root float + sway + mouse tracking
    root.position.y = Math.sin(elapsed * 1.3) * cur.bob;
    root.rotation.y = Math.sin(elapsed * 0.55) * cur.sway + mouse.x;
    root.rotation.z = Math.sin(elapsed * 0.4) * cur.sway * 0.15;

    // Head tilt / lean / squash (+ success pop + model-swap pop bounce) + mouse tracking
    modelPop = Math.max(0, modelPop - d * 2.2);
    const pop = Math.sin(popLife * Math.PI) * 0.22 + Math.sin(modelPop * Math.PI) * 0.12;
    const sy = cur.squashY * (1 + pop);
    const sxz = (1 + (1 - cur.squashY) * 0.55) * (1 + pop * 0.5);
    head.scale.set(sxz, sy, sxz);
    head.rotation.z = cur.headTilt + Math.sin(elapsed * 0.9) * 0.012;
    head.rotation.x = -cur.lean + mouse.y;

    // Electron orbits (accumulated angle → no jump when speed eases).
    orbits.forEach((inner, i) => {
      orbAngle[i] += d * cur.orbitSpeed * (inner.userData.spin as number);
      (inner.parent as THREE.Group).rotation.y = orbAngle[i];
    });

    // Aura breathing scales with glow.
    aura.material.opacity = (reducedMotion ? 0.55 : 0.5 + Math.sin(elapsed * 1.6) * 0.12) * (0.7 + cur.glow * 0.3);

    // Face look + mouth.
    face.rotation.x = cur.lookY;
    const talkMod = cur.talk * (0.5 + 0.5 * Math.sin(elapsed * 13)) * 0.6;
    smile.scale.set(1 + cur.mouth * 1.1, 1 + (cur.mouth + talkMod) * 2.4, 1);

    // Blink (suppressed under reduced motion).
    if (!reducedMotion) {
      const peak = Math.sin((elapsed % 4.0) * Math.PI * 2 - 1.4);
      blinkBase = peak > 0.985 ? 0.12 : 1;
    } else {
      blinkBase = 1;
    }
    eyes.forEach((e) => {
      e.scale.y += (blinkBase - e.scale.y) * 0.5;
    });

    // Floating "?".
    qMat.opacity = cur.qmark * (0.55 + 0.45 * Math.sin(elapsed * 4));
    qmark.visible = cur.qmark > 0.02;
    qmark.position.y = 1.7 + Math.sin(elapsed * 3) * 0.06;
    const qs = 0.2 + cur.qmark * 0.32;
    qmark.scale.set(qs, qs, 1);

    // Sparkle burst.
    sparkMat.opacity = cur.sparkle * (0.55 + 0.45 * Math.sin(elapsed * 9));
    sparkles.visible = cur.sparkle > 0.02;
    const ss = 0.85 + cur.sparkle * 0.35 + Math.sin(elapsed * 6) * 0.04 * cur.sparkle;
    sparkles.scale.setScalar(ss);
    sparkles.rotation.y = elapsed * 0.6;
  }

  function resize(w: number, h: number): void {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    }
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    auraTex.dispose();
    qTex.dispose();
  }

  return { scene, camera, update, setModel, setMouseTracking, resize, dispose };
}
