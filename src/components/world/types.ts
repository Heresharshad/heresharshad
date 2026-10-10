import type { ComponentType } from "react";

/*
 * Types for the shared world: rooms (environments), how you get into them,
 * and what a transition tweens. Add a room by adding a RoomDefinition to the
 * registry; the engine never needs to change.
 */

export type EnvironmentId = "studio" | "experiments" | "about" | "work" | "contact";
/** none: no WebGL. low: a weak device. mid: a capable phone or tablet (full materials, no shadows or reflections). high: a desktop. */
export type Tier = "none" | "low" | "mid" | "high";
export type V3 = [number, number, number];

export type CameraPose = { pos: V3; look: V3; fov: number };
export type Viewport = { aspect: number; narrow: boolean };

/** Props every room scene receives from the world canvas. */
export type EnvironmentProps = {
  id: EnvironmentId;
  /** Full materials and geometry (the transmissive bulb glass, finer meshes): mid and high tiers. */
  high: boolean;
  /** Reflective floors, which draw the scene a second time: high tier only. */
  reflections: boolean;
  /** Call once the scene has mounted and compiled; the controller waits for it before a transition starts. */
  onReady: () => void;
};

/** What a transition tweens, 0..1 each. Read by the scenes every frame, never by React. */
export type TransitionProgress = {
  /** The source dims and the destination's door mechanism begins: the slab unlocks and recesses. */
  recess: number;
  /** The slab slides into its pocket, opening the doorway. */
  slide: number;
  /** The camera along the entry path. */
  travel: number;
  /** The destination's lighting activates. */
  lights: number;
};

/** A camera keyframe on an entry path; `at` is the fraction of the travel. */
export type PathKey = { at: number; pos: V3; look: V3; fov?: number };

/**
 * A concealed slab in the studio wall. x is the centre, the sill sits on the
 * floor; the slab recesses into the wall then slides into a pocket.
 */
export type WallDoor = { x: number; width: number; height: number; slide: "left" | "right"; depth: number; recess: number };

/** Timing of a transition, in fractions of `duration`. */
export type Timing = {
  duration: number;
  /** Route push: the camera should be through the opening by now. */
  navigateAt: number;
  /** Destination lighting begins to come on. */
  lightsAt: number;
  /** Destination HTML content may reveal. */
  contentAt: number;
};

/** How to get into a room from the studio. Only `wall-opening` exists today; a switch or sliding panels would be new kinds. */
export type EntryTransition = {
  kind: "wall-opening";
  door: WallDoor;
  /** Camera keyframes after the captured start pose, in world space. */
  path: PathKey[];
  timing: Timing;
  /** Phones: a shorter, recomposed version of the same move. */
  narrow?: { path: PathKey[]; timing: Timing };
};

export type RoomDefinition = {
  id: EnvironmentId;
  route: string;
  /** Lazy scene module; nothing room-specific loads until it is needed. */
  load: () => Promise<{ default: ComponentType<EnvironmentProps> }>;
  /** "self": the scene drives the camera itself (the scroll-driven studio). Otherwise the world holds the rest pose. */
  camera: "self" | { rest: (vp: Viewport) => CameraPose };
  entry?: EntryTransition;
};
