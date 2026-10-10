import type { CameraPose, EntryTransition, Viewport } from "@/components/world/types";

/*
 * The Experiments room: where it sits behind the studio wall, how the camera
 * gets in, and where it rests once inside. Numbers only; the scene itself is
 * in room.tsx and loads lazily.
 *
 * World units follow the studio: the wall is at z = -3.6 and the floor at
 * y = -4.2. The door is cut under the bulb, left of centre, and spans the
 * three lowest cladding courses up to the joint at y = +1.5.
 */

export const WALL_Z = -3.6;
export const FLOOR_Y = -4.2;

/** The concealed slab in the studio wall. */
export const DOOR = {
  x: -2.4,
  width: 2.0,
  height: 5.7,
  slide: "left" as const,
  /** Thickness of the studio wall around the opening: how much jamb you pass. */
  depth: 0.7,
  /** How far the slab sinks before it slides. */
  recess: 0.32,
};

/**
 * The void behind the wall: no envelope, just the extent the backdrop, the
 * floor grid and the motes fill. It starts at the back of the studio wall, so
 * nothing of it shows in the studio except through the opening.
 */
export const VOID = {
  x: [-30, 30] as const,
  y: [FLOOR_Y - 20, 22] as const,
  z: [WALL_Z - DOOR.depth - 0.05, -55] as const,
};

/**
 * The two glows the haze gathers around. The key, in the accent, hangs up and
 * left behind the heading (which takes its light from it); the counter, cold
 * and fainter, sits low and right to give the dark some depth.
 */
export const GLOW = { x: -2.7, y: 1.45, z: -17 };
export const COUNTER = { x: 7.5, y: -3.2, z: -24 };

export function restPose({ narrow }: Viewport): CameraPose {
  // low and looking slightly down: the grid runs off to its horizon under the key glow
  return narrow
    ? { pos: [-2.3, -0.8, -5.4], look: [-2.1, -1.4, -17], fov: 50 }
    : { pos: [-2.0, -0.9, -6.2], look: [-1.3, -1.5, -17], fov: 42 };
}

const rest = restPose({ aspect: 1.7, narrow: false });
const restNarrow = restPose({ aspect: 0.5, narrow: true });

export const entry: EntryTransition = {
  kind: "wall-opening",
  door: DOOR,
  path: [
    // approach, descending to door height; the slab is still recessing
    { at: 0.36, pos: [-1.7, 0.05, 5.2], look: [-2.3, -1.1, WALL_Z], fov: 30 },
    // just short of the threshold, the jambs about to pass either side
    { at: 0.6, pos: [-2.32, -0.7, -2.1], look: [-2.3, -1.0, -10], fov: 33 },
    // through: inside the wall's thickness
    { at: 0.72, pos: [-2.3, -0.8, -4.6], look: [-1.9, -1.1, -14], fov: 38 },
    { at: 1, ...rest },
  ],
  timing: { duration: 4.6, navigateAt: 0.7, lightsAt: 0.56, contentAt: 0.86 },
  narrow: {
    path: [
      { at: 0.38, pos: [-2.0, -0.1, 4.6], look: [-2.35, -1.1, WALL_Z], fov: 40 },
      { at: 0.62, pos: [-2.35, -0.7, -2.2], look: [-2.3, -0.9, -10], fov: 42 },
      { at: 0.74, pos: [-2.3, -0.75, -4.6], look: [-2.2, -0.8, -14], fov: 46 },
      { at: 1, ...restNarrow },
    ],
    timing: { duration: 3.8, navigateAt: 0.72, lightsAt: 0.58, contentAt: 0.86 },
  },
};
