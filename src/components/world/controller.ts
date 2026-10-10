import gsap from "gsap";
import * as THREE from "three";
import { rooms } from "./registry";
import { world } from "./store";
import type { EnvironmentId, TransitionProgress } from "./types";

/*
 * The transition engine. One GSAP timeline per journey drives a progress
 * object the scenes read each frame; the route changes once the camera is
 * through the opening; the room you left is disposed once you have settled.
 * Rooms define what moves (their entry config and scene); this only
 * sequences it.
 */

const root = () => document.documentElement;
let timeline: gsap.core.Timeline | null = null;
let cutting: Promise<void> | null = null;

const freshProgress = (): TransitionProgress => ({ recess: 0, slide: 0, travel: 0, lights: 0 });

/** Can the click on `href` be a journey rather than a plain navigation right now? */
export function canEnter(href: string) {
  const s = world.get();
  const to = Object.values(rooms).find((r) => r?.route === href);
  return !!to?.entry && s.tier !== "none" && !s.reduceMotion && !s.transition && s.active === "studio" && to.id !== s.active && !!s.camera;
}

/** The page that was faded out for the journey; its fade lifts once that page has gone (or we are back on it). */
let leaving: EnvironmentId | null = null;

function finish(toId: EnvironmentId) {
  timeline?.kill();
  timeline = null;
  world.set({ transition: null, cameraLocked: false, active: toId, mounted: [toId] });
  root().removeAttribute("data-world-transition");
  pageChanged(world.get().declared);
}

/** Called by the world layer whenever the page on screen declares a (different) room. */
export function pageChanged(declared: EnvironmentId | null) {
  if (leaving && declared !== leaving) {
    leaving = null;
    root().removeAttribute("data-world-leaving");
  }
}

/** Start loading a destination's scene module and route before the click, so the wall does not wait on the network. */
export function warm(href: string) {
  const to = Object.values(rooms).find((r) => r?.route === href);
  if (!to) return;
  void to.load().catch(() => {});
  world.get().prefetch(to.route);
}

/** Leave the studio for `href` through the wall. Resolves to false if the journey could not start (caller navigates normally). */
export async function enter(href: string): Promise<boolean> {
  if (!canEnter(href)) return false;
  const s = world.get();
  const from = rooms[s.active!]!;
  const to = Object.values(rooms).find((r) => r?.route === href)!;
  const entry = to.entry!;
  const camera = s.camera!;
  const narrow = window.innerWidth / window.innerHeight < 0.85 && window.innerWidth < 900;
  const { timing } = narrow && entry.narrow ? entry.narrow : entry;

  const a = new THREE.Vector3();
  camera.getWorldDirection(a).multiplyScalar(8).add(camera.position);
  const progress = freshProgress();
  world.set({
    transition: {
      from,
      to,
      progress,
      start: { pos: camera.position.toArray() as [number, number, number], look: a.toArray() as [number, number, number], fov: camera.fov },
      navigated: false,
      contentReady: false,
    },
    mounted: [from.id, to.id],
  });
  root().setAttribute("data-world-transition", "");

  // the room must exist and have compiled before the wall opens on it
  try {
    await world.waitFor((w) => w.ready.includes(to.id), 8000);
  } catch {
    world.set({ transition: null, mounted: [from.id] });
    root().removeAttribute("data-world-transition");
    return false;
  }
  if (!world.get().transition) return false; // aborted while loading

  world.set({ cameraLocked: true });
  leaving = from.id;
  root().setAttribute("data-world-leaving", "");
  const D = timing.duration;
  let navigated = false;
  const navigate = () => {
    if (navigated) return;
    navigated = true;
    world.set((w) => (w.transition ? { transition: { ...w.transition, navigated: true } } : {}));
    world.get().navigate(to.route);
  };

  timeline = gsap
    .timeline({
      onUpdate: () => world.get().invalidate(),
      onComplete: () => {
        navigate();
        finish(to.id);
      },
    })
    // the slab unlocks: a slow, heavy sink into the wall
    .to(progress, { recess: 1, duration: D * 0.26, ease: "power2.inOut" }, D * 0.04)
    // then it runs into its pocket on a rail: eases out of rest, steady, eases to a stop
    .to(progress, { slide: 1, duration: D * 0.4, ease: "power2.inOut" }, D * 0.24)
    // the camera: a slow lean in, through the opening, settling in the room
    .to(progress, { travel: 1, duration: D * 0.86, ease: "sine.inOut" }, D * 0.14)
    // the room's lights, fed as a ramp; the scene shapes the flicker itself
    .to(progress, { lights: 1, duration: D * 0.3, ease: "none" }, D * timing.lightsAt)
    .call(navigate, [], D * timing.navigateAt)
    .call(() => world.set((w) => (w.transition ? { transition: { ...w.transition, contentReady: true } } : {})), [], D * timing.contentAt);
  return true;
}

/** A back/forward or header navigation landed somewhere else mid-journey: drop the timeline and cut to the room the page wants. */
export function abort() {
  const t = world.get().transition;
  if (!t) return;
  timeline?.kill();
  timeline = null;
  leaving = null;
  world.set({ transition: null, cameraLocked: false });
  root().removeAttribute("data-world-transition");
  root().removeAttribute("data-world-leaving");
}

/**
 * Switch rooms without a journey (direct loads, back/forward, header links):
 * a short dip to dark, swap, come back. The graceful alternative to a reverse
 * transition until rooms define one.
 */
export function cutTo(id: EnvironmentId | null) {
  const s = world.get();
  if (s.active === id && !s.transition) return;
  if (s.transition) abort();
  const first = s.active === null;
  const swap = () => world.set({ active: id, mounted: id ? [id] : [], ready: [] });
  if (first || s.reduceMotion) {
    swap();
    return;
  }
  if (cutting) return;
  root().setAttribute("data-world-veil", "");
  cutting = new Promise<void>((resolve) => {
    setTimeout(() => {
      swap();
      cutting = null;
      // the new room renders a frame or two before the veil lifts
      setTimeout(() => {
        root().removeAttribute("data-world-veil");
        resolve();
      }, 120);
    }, 380);
  });
}
