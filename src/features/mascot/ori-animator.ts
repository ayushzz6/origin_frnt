/**
 * ori-animator.ts — per-state animation targets for the Origin mascot.
 *
 * Pure data + math (no three.js). `ori-scene.ts` eases its live parameters toward
 * `STATE_TARGETS[state]` each frame with `damp()`, so transitions between states are
 * always smooth regardless of how abruptly the chat surface flips the state.
 */
import type { MascotState } from './mascot-state';

export interface OriParams {
  /** vertical float amplitude */
  bob: number;
  /** horizontal sway amplitude (root yaw) */
  sway: number;
  /** electron orbit speed multiplier */
  orbitSpeed: number;
  /** head tilt (z, "curious/thinking" cock) */
  headTilt: number;
  /** lean toward camera (head pitch) */
  lean: number;
  /** vertical squash (1 = neutral, <1 = squashed) */
  squashY: number;
  /** body glow intensity */
  glow: number;
  /** body surface wobble */
  wobble: number;
  /** colour saturation (1 = full, 0 = grey) — drops on error */
  sat: number;
  /** mouth openness (0 = gentle smile) */
  mouth: number;
  /** talk modulation (mouth open/close while "speaking") */
  talk: number;
  /** eye/face pitch (look up while thinking, down while curious) */
  lookY: number;
  /** floating "?" visibility */
  qmark: number;
  /** sparkle burst intensity */
  sparkle: number;
  /** red-tint amount (error state turns Ori red) */
  red: number;
}

export const STATE_TARGETS: Record<MascotState, OriParams> = {
  idle:      { bob: 0.045, sway: 0.12, orbitSpeed: 1.0, headTilt: 0.0,  lean: 0.0,  squashY: 1.0,  glow: 1.0,  wobble: 1.0, sat: 1.0,  mouth: 0.0,  talk: 0, lookY: 0.0,  qmark: 0, sparkle: 0, red: 0 },
  curious:   { bob: 0.03,  sway: 0.05, orbitSpeed: 1.15, headTilt: 0.16, lean: 0.18, squashY: 1.0,  glow: 1.06, wobble: 1.0, sat: 1.0,  mouth: 0.12, talk: 0, lookY: -0.06, qmark: 0, sparkle: 0, red: 0 },
  thinking:  { bob: 0.02,  sway: 0.02, orbitSpeed: 2.3, headTilt: 0.22, lean: 0.06, squashY: 1.0,  glow: 1.12, wobble: 1.3, sat: 1.0,  mouth: 0.0,  talk: 0, lookY: 0.09,  qmark: 1, sparkle: 0, red: 0 },
  answering: { bob: 0.05,  sway: 0.06, orbitSpeed: 1.35, headTilt: 0.04, lean: 0.04, squashY: 1.0,  glow: 1.06, wobble: 1.0, sat: 1.0,  mouth: 0.16, talk: 1, lookY: 0.0,  qmark: 0, sparkle: 0, red: 0 },
  success:   { bob: 0.06,  sway: 0.08, orbitSpeed: 1.7, headTilt: 0.0,  lean: 0.0,  squashY: 1.0,  glow: 1.28, wobble: 1.0, sat: 1.0,  mouth: 0.36, talk: 0, lookY: 0.0,  qmark: 0, sparkle: 1, red: 0 },
  error:     { bob: 0.02,  sway: 0.0,  orbitSpeed: 0.6, headTilt: -0.1, lean: 0.0,  squashY: 0.88, glow: 1.05, wobble: 0.7, sat: 0.9,  mouth: 0.05, talk: 0, lookY: -0.1,  qmark: 0, sparkle: 0, red: 0.92 },
};

/** A calm pose used when the user prefers reduced motion. */
export const REDUCED_PARAMS: OriParams = {
  ...STATE_TARGETS.idle,
  bob: 0,
  sway: 0,
  orbitSpeed: 0,
  wobble: 0,
  red: 0,
};

/**
 * Candidate morph-target names per state, in priority order. Matched
 * case-insensitively (and by substring) against the GLB's morph targets, so a model
 * exporting `Happy`, `mouth_smile`, `expr.thinking`, etc. still resolves. The first
 * candidate that matches a real morph wins.
 */
export const EXPRESSION_MORPHS: Record<MascotState, string[]> = {
  idle: ['neutral', 'idle'],
  curious: ['curious', 'question', 'interested', 'wonder'],
  thinking: ['thinking', 'think', 'ponder', 'hmm'],
  answering: ['talk', 'talking', 'speak', 'happy'],
  success: ['success', 'celebrate', 'proud', 'excited', 'happy', 'smile'],
  error: ['surprised', 'sad', 'confused', 'error', 'shock'],
};

/** Candidate animation-clip names per state (same matching rules as morphs). */
export const EXPRESSION_CLIPS: Record<MascotState, string[]> = {
  idle: ['idle', 'breathe', 'rest'],
  curious: ['curious', 'look', 'interested'],
  thinking: ['thinking', 'think', 'ponder'],
  answering: ['talk', 'talking', 'answer', 'speak'],
  success: ['success', 'celebrate', 'happy', 'cheer', 'jump'],
  error: ['error', 'surprised', 'sad', 'shake'],
};

/** Frame-rate-independent exponential smoothing toward `target`. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function makeParams(): OriParams {
  return { ...STATE_TARGETS.idle };
}
