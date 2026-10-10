/** Shared, mutable state between the homepage DOM logic and the 3D pendant. */
export type LampState = {
  /** Lights are on (set at the moment of the bulb flash swap). */
  on: boolean;
  /** performance.now() when the lights last turned on (drives the warm-up flicker). */
  onAt: number;
  /** One-shot request to start swinging from this angle (degrees, CSS clockwise). */
  kickDeg: number | null;
  /** While the chain is dragged, the swing angle follows this (degrees). */
  dragDeg: number | null;
  /** True while the WebGL pendant is mounted (the SVG fallback is not in use). */
  three: boolean;
  /** Ask the scene to render a frame (used with reduced motion, where the loop is on demand). */
  wake: (() => void) | null;
};

export const createLampState = (): LampState => ({
  on: false,
  onAt: 0,
  kickDeg: null,
  dragDeg: null,
  three: false,
  wake: null,
});
