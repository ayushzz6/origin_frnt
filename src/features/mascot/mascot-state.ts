/**
 * Shared state vocabulary for the Origin mascot ("Ori").
 *
 * The same state drives the 3D scene animator (see `ori-scene.ts` / Phase 2's
 * `ori-animator.ts`) and is derived from the chat surfaces by `useMentorMascotState`.
 *
 *  idle      – resting: gentle float + slow O³ orbit
 *  curious   – user is typing / voice listening: leans in, eyes to input
 *  thinking  – request in flight: head tilt, faster orbit, bobbing "?"
 *  answering – reply streaming / voice speaking: talk-bob, mouth moves
 *  success   – a fresh assistant reply landed: pop + sparkle burst, settles to idle
 *  error     – something failed: surprised squash, glow desaturates
 */
export type MascotState =
  | 'idle'
  | 'curious'
  | 'thinking'
  | 'answering'
  | 'success'
  | 'error';

export const MASCOT_STATES: readonly MascotState[] = [
  'idle',
  'curious',
  'thinking',
  'answering',
  'success',
  'error',
] as const;
