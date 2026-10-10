import { useSyncExternalStore } from "react";
import type * as THREE from "three";
import type { StudioState } from "@/components/home/studio-state";
import { createStudioState } from "@/components/home/studio-state";
import type { EnvironmentId, Tier, TransitionProgress, RoomDefinition } from "./types";

/*
 * The single source of truth for the shared 3D world: which room the current
 * page asked for, which rooms are mounted in the canvas, who owns the camera,
 * and the transition in flight. A plain external store; the scenes read it
 * every frame without React, pages subscribe through `useWorld`.
 */

export type ActiveTransition = {
  from: RoomDefinition;
  to: RoomDefinition;
  /** Mutable, tweened by GSAP and read per frame by the scenes. */
  progress: TransitionProgress;
  /** The camera pose at the moment the transition began (continuity from wherever scroll left it). */
  start: { pos: [number, number, number]; look: [number, number, number]; fov: number };
  /** The route has been pushed: the page on screen should now be the destination's. */
  navigated: boolean;
  /** The destination's content may reveal (set at `contentAt`). */
  contentReady: boolean;
};

export type WorldState = {
  tier: Tier;
  reduceMotion: boolean;
  /** The room the page currently on screen asked for; null on pages outside the world. */
  declared: EnvironmentId | null;
  /** A room has been declared at least once: the canvas exists from then on. */
  booted: boolean;
  /** Rooms that must be mounted in the canvas right now (source and destination during a transition). */
  mounted: EnvironmentId[];
  /** Rooms whose scene has mounted and compiled. */
  ready: EnvironmentId[];
  /** The room that drives the camera and lighting when no transition is running. */
  active: EnvironmentId | null;
  transition: ActiveTransition | null;
  /** True while the transition controller owns the camera; rooms must not write it. */
  cameraLocked: boolean;
  /** A ready room has been drawn: the first complete frame is on screen. Set once and kept. */
  firstFrame: boolean;
  /** The first visit's loader still covers the page (home/intro-curtain.tsx): rooms hold their opening moves. */
  curtain: boolean;
  /** The world could not start (a chunk failed to load, no WebGL context): pages show their still fallback. */
  failed: boolean;
  /** Pointer in NDC, for the rooms' gentle parallax. */
  pointer: { x: number; y: number; active: boolean };
  /** The homepage's DOM <-> WebGL state. Lives here so the studio scene outlives the page during a transition. */
  studio: StudioState;
  /** The one camera, once the canvas exists. */
  camera: THREE.PerspectiveCamera | null;
  /** Render one frame (the canvas runs on demand with reduced motion). */
  invalidate: () => void;
  /** Client-side navigation and route prefetch, bound by the world layer. */
  navigate: (href: string) => void;
  prefetch: (href: string) => void;
};

// kept on globalThis so a Fast Refresh of this module in development does not lose the world mid-session
const g = globalThis as unknown as { __worldState?: WorldState; __worldListeners?: Set<() => void> };
const listeners = (g.__worldListeners ??= new Set<() => void>());
let state: WorldState = g.__worldState ?? {
  tier: "none",
  reduceMotion: false,
  declared: null,
  booted: false,
  mounted: [],
  ready: [],
  active: null,
  transition: null,
  cameraLocked: false,
  firstFrame: false,
  curtain: false,
  failed: false,
  pointer: { x: 0, y: 0, active: false },
  studio: createStudioState(),
  camera: null,
  invalidate: () => {},
  navigate: () => {},
  prefetch: () => {},
};
g.__worldState = state;

export const world = {
  get: () => state,
  set(patch: Partial<WorldState> | ((s: WorldState) => Partial<WorldState>)) {
    const next = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...next };
    g.__worldState = state;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /** Resolves when `pred` holds, or rejects after `ms`. */
  waitFor(pred: (s: WorldState) => boolean, ms: number) {
    return new Promise<void>((resolve, reject) => {
      if (pred(state)) return resolve();
      const timer = setTimeout(() => {
        off();
        reject(new Error("world: timed out"));
      }, ms);
      const off = world.subscribe(() => {
        if (!pred(state)) return;
        clearTimeout(timer);
        off();
        resolve();
      });
    });
  },
};

export function useWorld<T>(select: (s: WorldState) => T): T {
  return useSyncExternalStore(world.subscribe, () => select(state), () => select(state));
}
