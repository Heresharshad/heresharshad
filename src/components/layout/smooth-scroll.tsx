"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { world } from "@/components/world/store";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scrolling, driven by the GSAP ticker and kept in sync with
 * ScrollTrigger. In-page anchor links scroll smoothly too. Disabled for reduced
 * motion, and held still while a journey through the world runs or the
 * first visit's loader is up.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ autoRaf: false, anchors: true });
    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    const hold = () => (world.get().transition || world.get().curtain ? lenis.stop() : lenis.start());
    hold();
    const unsubscribe = world.subscribe(hold);

    return () => {
      unsubscribe();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return null;
}
