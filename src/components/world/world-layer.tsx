"use client";

import { useEffect, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { cutTo, pageChanged } from "./controller";
import { detectTier } from "./device";
import { useWorld, world } from "./store";
import type { Tier } from "./types";

const WorldCanvas = dynamic(() => import("./world-canvas"), { ssr: false });
const noopSubscribe = () => () => {};

/**
 * Lives in the root layout, so the one WebGL renderer survives every route
 * change. The canvas is created the first time a page declares a room and
 * kept afterwards; pages outside the world leave it hidden and idle.
 */
export function WorldLayer() {
  const tier = useSyncExternalStore(noopSubscribe, detectTier, () => "none" as Tier);
  const reduceMotion = usePrefersReducedMotion();
  const router = useRouter();
  const declared = useWorld((s) => s.declared);
  const active = useWorld((s) => s.active);
  const booted = useWorld((s) => s.booted);

  useEffect(() => {
    world.set({ tier, reduceMotion, navigate: (href) => router.push(href), prefetch: (href) => router.prefetch(href) });
    world.get().studio.reduceMotion = reduceMotion;
  }, [tier, reduceMotion, router]);

  useEffect(() => {
    pageChanged(declared);
    const t = world.get().transition;
    // mid-journey the page changes under us by design: the source until the route is pushed, the destination after
    if (t && declared === (t.navigated ? t.to.id : t.from.id)) return;
    cutTo(declared);
  }, [declared]);

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.setAttribute("data-world", active);
    else root.removeAttribute("data-world");
    return () => root.removeAttribute("data-world");
  }, [active]);

  useEffect(() => {
    const p = world.get().pointer;
    const ac = new AbortController();
    const move = (e: PointerEvent) => {
      p.x = (e.clientX / window.innerWidth) * 2 - 1;
      p.y = -(e.clientY / window.innerHeight) * 2 + 1;
      p.active = e.pointerType === "mouse";
    };
    window.addEventListener("pointermove", move, { passive: true, signal: ac.signal });
    document.documentElement.addEventListener("pointerleave", () => (p.active = false), { signal: ac.signal });
    return () => ac.abort();
  }, []);

  return (
    <>
      {booted && tier !== "none" && <WorldCanvas high={tier === "high"} reduceMotion={reduceMotion} />}
      <div className="world-veil" aria-hidden="true" />
    </>
  );
}
