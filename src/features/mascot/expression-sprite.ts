/**
 * expression-sprite.ts — maps Ori's 2D expressions out of `Moscot-main.jpeg`.
 *
 * The sheet (1135×1280) is used directly as a CSS sprite (no image processing): each
 * expression is shown by scaling the sheet up inside a square, circular-clipped box and
 * positioning it so the chosen face centres in the box. `cx`/`cy` are the face centre as
 * fractions of the sheet; `zoom` is how many times the sheet is scaled vs the box width.
 *
 * Coordinates are eyeballed from the "Expressions" grid + signature row and are meant to be
 * tweaked live against /dev/moscot — adjust cx/cy/zoom here until each face is centred.
 */
import type { CSSProperties } from 'react';
import type { MascotState } from './mascot-state';

export const SHEET_SRC = '/3d/moscot/Moscot-main.jpeg';
/** sheet height / width = 1280 / 1135 */
export const SHEET_ASPECT = 1280 / 1135;

export interface Tile {
  cx: number;
  cy: number;
  zoom: number;
}

export type ExpressionName =
  | 'happy'
  | 'excited'
  | 'curious'
  | 'thinking'
  | 'surprised'
  | 'proud'
  | 'success';

/** Face centres (fraction of sheet) for each expression tile. */
export const EXPRESSIONS: Record<ExpressionName, Tile> = {
  happy: { cx: 0.645, cy: 0.665, zoom: 6.4 },
  excited: { cx: 0.775, cy: 0.665, zoom: 6.4 },
  curious: { cx: 0.905, cy: 0.665, zoom: 6.4 },
  thinking: { cx: 0.645, cy: 0.775, zoom: 6.4 },
  surprised: { cx: 0.775, cy: 0.775, zoom: 6.4 },
  proud: { cx: 0.905, cy: 0.775, zoom: 6.4 },
  success: { cx: 0.875, cy: 0.905, zoom: 6.8 },
};

/**
 * Clear, recognizable Ori bust for static avatars (the big hero character on the sheet,
 * not a tiny expression tile). Tuned by eye against Moscot-main.jpeg — nudge if off.
 */
export const AVATAR_TILE: Tile = { cx: 0.305, cy: 0.255, zoom: 3.9 };

/** Which expression pops for each chat state (null = no pop). */
export const STATE_EXPRESSION: Record<MascotState, ExpressionName | null> = {
  idle: null,
  curious: 'curious',
  thinking: 'thinking',
  answering: 'excited',
  success: 'success',
  error: 'surprised',
};

/** Inline style that frames a tile inside a square, position-relative box. */
export function tileImgStyle(t: Tile): CSSProperties {
  return {
    position: 'absolute',
    width: `${t.zoom * 100}%`,
    height: 'auto',
    left: `${100 * (0.5 - t.cx * t.zoom)}%`,
    top: `${100 * (0.5 - t.cy * t.zoom * SHEET_ASPECT)}%`,
    maxWidth: 'none',
  };
}
