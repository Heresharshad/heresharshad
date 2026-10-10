"use client";

import { Component, useEffect, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { cutTo, pageChanged } from "./controller";
import { detectTier } from "./device";
import { rooms } from "./registry";
import { useWorld, world } from "./store";
import type { Tier } from "./types";

const loadCanvas = () => import("./world-canvas");
const WorldCanvas = dynamic(loadCanvas, { ssr: false });
const noopSubscribe = () => () => {};

/**
 * If the world cannot start (its chunk fails to load, or the browser will not
 * give it a WebGL context), the page carries on without it: the world is
 * marked failed, pages show their still fallback, and nothing is retried.
 */
class WorldBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("world: could not start", error);
    world.set({ failed: true });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

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

  // fetch the canvas and the declared room's scene side by side, rather than the room only once the canvas has mounted
  useEffect(() => {
    if (!declared || tier === "none") return;
    void loadCanvas().catch(() => {});
    void rooms[declared]?.load().catch(() => {});
  }, [declared, tier]);

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
      {booted && tier !== "none" && (
        <WorldBoundary>
          <WorldCanvas tier={tier} reduceMotion={reduceMotion} />
        </WorldBoundary>
      )}
      <div className="world-veil" aria-hidden="true" />
    </>
  );
}
