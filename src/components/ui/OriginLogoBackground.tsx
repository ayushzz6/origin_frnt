'use client';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * Parse the vertex block of an ASCII PLY (x y z r g b per line).
 * Returns a BufferGeometry with 'position' and 'aColor' attributes.
 */
function parsePLYVertices(text: string): THREE.BufferGeometry {
  const endHeaderIdx = text.indexOf('end_header');
  const header = text.slice(0, endHeaderIdx);

  let vertexCount = 0;
  for (const line of header.split('\n')) {
    const m = line.match(/^element vertex (\d+)/);
    if (m) { vertexCount = parseInt(m[1], 10); break; }
  }

  const positions = new Float32Array(vertexCount * 3);
  const aColors   = new Float32Array(vertexCount * 3);

  // Start right after "end_header\n"
  let cursor = endHeaderIdx + 'end_header'.length + 1;

  for (let i = 0; i < vertexCount; i++) {
    // Collect exactly 6 whitespace-separated tokens then advance to next line
    const nums: number[] = [];
    let s = cursor;

    while (nums.length < 6 && cursor < text.length) {
      const ch = text.charCodeAt(cursor);
      const isSep = (ch === 32 || ch === 9 || ch === 10 || ch === 13);
      if (isSep) {
        if (cursor > s) nums.push(+text.slice(s, cursor));
        s = cursor + 1;
      }
      cursor++;
      // Stop consuming once we have 6 numbers
      if (nums.length === 6) break;
    }

    // ── BUG FIX ─────────────────────────────────────────────────────────────
    // When the 6th token ends at a '\n', cursor is already on the next line.
    // Do NOT skip another line here — just move to the start of the next line
    // if cursor is still mid-line (e.g. trailing spaces before \n).
    while (cursor < text.length && text.charCodeAt(cursor - 1) !== 10) {
      if (text.charCodeAt(cursor) === 10) { cursor++; break; }
      cursor++;
    }

    positions[i * 3]     = nums[0];
    positions[i * 3 + 1] = nums[1];
    positions[i * 3 + 2] = nums[2];
    aColors[i * 3]       = nums[3] / 255;
    aColors[i * 3 + 1]   = nums[4] / 255;
    aColors[i * 3 + 2]   = nums[5] / 255;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor',   new THREE.BufferAttribute(aColors,   3));
  return geo;
}

export default function OriginLogoBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* ── renderer ────────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    /* ── scene / camera ──────────────────────────────────── */
    const scene  = new THREE.Scene();
    // Model is ≈83.8 units wide, centered at origin.
    // At FOV 50° the model fills ~80% of the screen at z=115.
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1e5);
    camera.position.z = 115;

    /* ── interaction ─────────────────────────────────────── */
    let tgtX = 0, tgtY = 0, curX = 0, curY = 0;
    const onMouse = (e: MouseEvent) => {
      tgtY =  (e.clientX / window.innerWidth  - 0.5) * 1.4;
      tgtX = -(e.clientY / window.innerHeight - 0.5) * 0.8;
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      tgtY =  (t.clientX / window.innerWidth  - 0.5) * 1.4;
      tgtX = -(t.clientY / window.innerHeight - 0.5) * 0.8;
    };
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchmove', onTouch, { passive: true });

    /* ── single animation loop ───────────────────────────── */
    let points: THREE.Points | null = null;
    let uTime = 0;
    let clock = 0;
    let raf: number;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      uTime += 0.015;
      clock += 0.003;
      if (points) {
        const mat = points.material as THREE.ShaderMaterial;
        mat.uniforms.uTime.value = uTime;
        curX += (tgtX - curX) * 0.04;
        curY += (tgtY - curY) * 0.04;
        points.rotation.x = curX;
        points.rotation.y = curY + clock * 0.18; // slow auto-spin
      }
      renderer.render(scene, camera);
    };
    loop();

    /* ── load PLY via fetch — no three/examples/jsm needed ── */
    fetch('/3d/origin-new-logo-3d.ply')
      .then(r => {
        if (!r.ok) throw new Error(`PLY fetch ${r.status}`);
        return r.text();
      })
      .then(text => {
        const geo = parsePLYVertices(text);
        const verts = geo.getAttribute('position').count;
        console.info(`[OriginLogoBackground] loaded ${verts.toLocaleString()} vertices`);

        const mat = new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 } },
          vertexShader: /* glsl */ `
            attribute vec3 aColor;
            varying   vec3 vColor;
            uniform  float uTime;
            void main() {
              vColor = aColor;
              vec3 p = position;
              // subtle breathing ripple
              p.z += sin(uTime + p.x * 0.1 + p.y * 0.1) * 0.35;
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              gl_PointSize = clamp(180.0 / -mv.z, 1.0, 3.5);
              gl_Position  = projectionMatrix * mv;
            }
          `,
          fragmentShader: /* glsl */ `
            varying vec3 vColor;
            void main() {
              float d = length(gl_PointCoord - 0.5);
              if (d > 0.5) discard;
              float a = 1.0 - smoothstep(0.15, 0.5, d);
              gl_FragColor = vec4(vColor, a * 0.92);
            }
          `,
          blending:    THREE.AdditiveBlending,
          transparent: true,
          depthWrite:  false,
        });
        points = new THREE.Points(geo, mat);
        scene.add(points);
        setOpacity(1); // fade in once geometry is ready
      })
      .catch(err => console.error('[OriginLogoBackground]', err));

    /* ── resize ──────────────────────────────────────────── */
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      // z-index 1 — above the static page bg-background (z-auto non-positioned)
      // but BELOW the video wrapper (z-2) so the video initially covers the logo.
      // Content sections are z-10, so they layer above both.
      style={{ zIndex: 1, opacity, transition: 'opacity 1.5s ease' }}
    />
  );
}
