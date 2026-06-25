'use client';

/**
 * OriMascot — the live 3D Origin mascot ("Ori").
 *
 * Drop-in replacement for the `<img src="/Dipraj-ChatBot.png">` avatar. Owns the Three.js
 * renderer + RAF loop; the scene is built by `createOriScene`. Ori's emotions are **separate
 * GLB models** (ori-curious, ori-thinking, ori-welldone, …) swapped per chat state — loaded
 * lazily and cached, with a quick pop on each swap.
 *
 * - Client-only (WebGL). Load via `dynamic(..., { ssr:false })` at call sites.
 * - Respects `prefers-reduced-motion`; pauses when tab hidden / element offscreen.
 * - Procedural body shows until the first model loads; PNG fallback if WebGL is unavailable.
 * - While a model is shown the 2D expression pop is suppressed (the model IS the expression).
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { createOriScene, type OriSceneHandle } from './ori-scene';
import { disposeObject, loadOriModel, type LoadedOri } from './ori-model';
import OriExpressionPop from './OriExpressionPop';
import OriMascotStatic from './OriMascotStatic';
import type { MascotState } from './mascot-state';

const B = '/3d/moscot';

/**
 * Emotion model per state, tried in order (first that loads wins). Optimized `*-opt.glb`
 * first, then the raw file, then the base model as a last-resort so something always shows.
 */
const STATE_MODEL: Record<MascotState, string[]> = {
  idle: [`${B}/ori-hi-opt.glb`, `${B}/ori-opt.glb`],
  curious: [`${B}/ori-curious-opt.glb`, `${B}/ori-opt.glb`],
  thinking: [`${B}/ori-thinking-opt.glb`, `${B}/ori-opt.glb`],
  answering: [`${B}/ori-happy-opt.glb`, `${B}/ori-opt.glb`],
  success: [`${B}/ori-welldone-opt.glb`, `${B}/ori-opt.glb`],
  error: [`${B}/ori-curious-opt.glb`, `${B}/ori-opt.glb`],
};

const ALL_STATES: MascotState[] = ['idle', 'curious', 'thinking', 'answering', 'success', 'error'];

export interface OriMascotProps {
  state?: MascotState;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  /**
   * Preload all emotion models for instant state changes. Leave true for the chat
   * mentor (changes states); set false for mostly-idle decorative placements so only
   * the current state's model loads (much lighter).
   */
  preload?: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function OriMascot({
  state = 'idle',
  className,
  style,
  title = 'Origin AI',
  preload = true,
}: OriMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<MascotState>(state);
  const handleRef = useRef<OriSceneHandle | null>(null);
  const cacheRef = useRef<Map<MascotState, LoadedOri>>(new Map());
  const reducedRef = useRef(false);
  const renderOnceRef = useRef<(dt: number) => void>(() => {});
  const disposedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  // True once an emotion model is shown → suppress the 2D pop fallback.
  const [modelActive, setModelActive] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Renderer + scene + RAF (run once) ───────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    disposedRef.current = false;
    const cache = cacheRef.current;

    const initialW = canvas.clientWidth || 96;
    const initialH = canvas.clientHeight || 96;

    const failGracefully = () => queueMicrotask(() => setFailed(true));

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      failGracefully();
      return;
    }
    if (!renderer.getContext()) {
      renderer.dispose();
      failGracefully();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(initialW, initialH, false);

    const handle = createOriScene(initialW, initialH);
    handleRef.current = handle;

    // Environment map: the GLB material is metallic (PBR), so without image-based
    // lighting it renders near-black. RoomEnvironment gives soft studio reflections.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    handle.scene.environment = envRT.texture;
    // Keep the metallic model from blowing out — soft, not glossy-bright.
    handle.scene.environmentIntensity = 0.42;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;

    const reduced = prefersReducedMotion();
    reducedRef.current = reduced;
    const clock = new THREE.Clock();
    let elapsed = 0;
    let raf = 0;
    let visible = true;
    let onScreen = true;

    const renderOnce = (dt: number) => {
      handle.update(elapsed, dt, stateRef.current, reduced);
      renderer.render(handle.scene, handle.camera);
    };
    renderOnceRef.current = renderOnce;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;
      renderOnce(dt);
    };
    const start = () => {
      if (raf || disposedRef.current || reduced) return;
      clock.getDelta();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const sync = () => {
      if (visible && onScreen) start();
      else stop();
    };

    if (reduced) renderOnce(0.016);
    else start();

    const onVisibility = () => {
      visible = document.visibilityState === 'visible';
      sync();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? true;
        sync();
      },
      { threshold: 0.01 },
    );
    io.observe(canvas);

    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        renderer.setSize(r.width, r.height, false);
        handle.resize(r.width, r.height);
        if (reduced) renderOnce(0.016);
      }
    });
    ro.observe(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      stop();
      failGracefully();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    return () => {
      disposedRef.current = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      io.disconnect();
      ro.disconnect();
      handle.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      handleRef.current = null;
      for (const loaded of cache.values()) disposeObject(loaded.object);
      cache.clear();
    };
  }, []);

  // ── Load + swap the emotion model for the current state ─────────────
  useEffect(() => {
    const handle = handleRef.current;
    if (handle === null) return;

    // Deferred so it never fires synchronously inside the effect body.
    const markActive = () => queueMicrotask(() => setModelActive(true));

    const cached = cacheRef.current.get(state);
    if (cached) {
      handle.setModel(cached, reducedRef.current);
      markActive();
      if (reducedRef.current) renderOnceRef.current(0.016);
      return;
    }

    let cancelled = false;
    loadOriModel(STATE_MODEL[state])
      .then((loaded) => {
        if (cancelled || disposedRef.current) {
          if (!cacheRef.current.has(state)) disposeObject(loaded.object);
          return;
        }
        cacheRef.current.set(state, loaded);
        // Only show it if this is still the current state.
        if (stateRef.current === state && handleRef.current) {
          handleRef.current.setModel(loaded, reducedRef.current);
          markActive();
          if (reducedRef.current) renderOnceRef.current(0.016);
        }
      })
      .catch((err) => {
        console.warn(`[OriMascot] model load failed for "${state}", keeping current`, err);
      });

    return () => {
      cancelled = true;
    };
  }, [state]);

  // Preload every emotion model in the background so state changes are instant + smooth.
  useEffect(() => {
    if (!preload) return;
    let cancelled = false;
    (async () => {
      const seenPrimary = new Set<string>();
      for (const st of ALL_STATES) {
        if (cancelled || disposedRef.current) return;
        if (cacheRef.current.has(st)) continue;
        // Skip states whose model file is already being preloaded by another state
        // (e.g. error reuses curious's GLB) — it'll hit the browser cache on demand.
        const primary = STATE_MODEL[st][0];
        if (seenPrimary.has(primary)) continue;
        seenPrimary.add(primary);
        try {
          const loaded = await loadOriModel(STATE_MODEL[st]);
          if (cancelled || disposedRef.current || cacheRef.current.has(st)) {
            disposeObject(loaded.object);
            continue;
          }
          cacheRef.current.set(st, loaded);
        } catch {
          /* ignore preload failures */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preload]);

  if (failed) {
    // WebGL unavailable / context lost → branded static Ori (no canvas).
    return <OriMascotStatic className={className} title={title} />;
  }

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
        role="img"
        aria-label={title}
      />
      {modelActive ? null : <OriExpressionPop state={state} />}
    </div>
  );
}
