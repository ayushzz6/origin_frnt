'use client';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface ParticleBackgroundProps {
  visible: boolean;
}

export default function ParticleBackground({ visible }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 6;

    const COUNT = 8000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3 + Math.random() * 7;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Origin blue palette: #0066FF → #00CCFF
      const t = Math.random();
      colors[i * 3] = 0.0;
      colors[i * 3 + 1] = 0.3 + t * 0.5;
      colors[i * 3 + 2] = 0.8 + t * 0.2;

      sizes[i] = Math.random() * 2 + 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const vertexShader = /* glsl */ `
      attribute float size;
      varying vec3 vColor;
      uniform float uTime;
      void main() {
        vColor = color;
        vec3 pos = position;
        float wave = sin(uTime * 0.4 + pos.x * 0.3 + pos.y * 0.2) * 0.15;
        pos.z += wave;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (300.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `;

    const fragmentShader = /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = (1.0 - d * 2.0);
        alpha = pow(alpha, 1.5);
        gl_FragColor = vec4(vColor, alpha * 0.85);
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader,
      fragmentShader,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      material.uniforms.uTime.value = t;
      particles.rotation.y = t * 0.04;
      particles.rotation.x = Math.sin(t * 0.025) * 0.15;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none transition-opacity duration-1000"
      style={{ zIndex: 0, opacity: visible ? 1 : 0 }}
    />
  );
}
