import type { Tier } from "./types";

let cached: Tier | null = null;

/**
 * WebGL support and a rough device class. A phone or tablet is "mid" (the full
 * materials at up to 2x, without shadows or reflections) unless it reports
 * little memory or few cores; a desktop is "high" unless it is weak. The
 * canvas then steps its resolution down if frames are slow (world-canvas.tsx). Probed once: every probe is a WebGL context, and a browser only
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
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const handheld = window.matchMedia("(pointer: coarse)").matches || Math.min(window.screen.width, window.screen.height) < 700;
  // phones: memory is the honest signal (Chrome reports it; Safari reports neither, and every iPhone in use draws this scene well)
  if (handheld) return (cached = memory < 4 || cores < 4 ? "low" : "mid");
  return (cached = cores <= 4 || memory < 4 ? "low" : "high");
}

/** Whether WebGL is available at all, from the same single probe. */
export const hasWebGL = () => detectTier() !== "none";
