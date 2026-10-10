import type { Tier } from "./types";

let cached: Tier | null = null;

/**
 * WebGL support and a rough device class: low-power devices get a simpler
 * scene. Probed once: every probe is a WebGL context, and a browser only
 * allows a handful before it drops the oldest, which would be the world.
 */
export function detectTier(): Tier {
  if (cached) return cached;
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("webgl2") || c.getContext("webgl");
    webgl = !!ctx;
    // hand the probe's context back straight away
    (ctx as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl = false;
  }
  if (!webgl) return (cached = "none");
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.screen.width, window.screen.height) < 700;
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) < 4;
  return (cached = coarse || small || weak ? "low" : "high");
}

/** Whether WebGL is available at all, from the same single probe. */
export const hasWebGL = () => detectTier() !== "none";
