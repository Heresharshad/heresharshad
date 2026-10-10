/**
 * Shared, mutable state between the homepage DOM (scroll, pointer, the pull
 * chain button) and the WebGL studio. Plain object, no React state: both sides
 * read and write it every frame.
 */
export type StudioState = {
  /** Continuous scene index from scroll: 0 hero, 1 room revealed, 2 work, 3 experiments, 4 about, 5 contact. */
  scene: number;
  /**
   * Pointer in normalised device coordinates (-1..1, y up). `mouse`: the last
   * input was a mouse. `light`: how strongly the cursor lamp may show here,
   * lowered over text and controls so they stay readable and keep their own hover.
   */
  pointer: { x: number; y: number; active: boolean; mouse: boolean; light: number };
  /** The light is on (set at the moment the chain is pulled). */
  on: boolean;
  /** performance.now() of the last switch, drives the warm-up flicker. */
  switchedAt: number;
  /** While the chain is dragged: pointer position in NDC. */
  drag: { x: number; y: number } | null;
  /** The pointer (or focus) is on the chain: hold the pendant and camera still so it is easy to grab. */
  chainHover: boolean;
  /** performance.now() of the last click or keyboard tug. */
  tugAt: number;
  reduceMotion: boolean;
  /** Render one frame (the loop is on demand with reduced motion). */
  wake: () => void;
  /** Elements the scene writes to directly every frame. */
  els: {
    chain: HTMLElement | null;
    heroName: HTMLElement | null;
    coords: HTMLElement | null;
  };
};

export const createStudioState = (): StudioState => ({
  scene: 0,
  pointer: { x: 0.3, y: 0.2, active: false, mouse: false, light: 1 },
  on: false,
  switchedAt: 0,
  drag: null,
  chainHover: false,
  tugAt: 0,
  reduceMotion: false,
  wake: () => {},
  els: { chain: null, heroName: null, coords: null },
});
