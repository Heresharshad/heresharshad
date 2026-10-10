"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { world } from "./store";
import type { EnvironmentId } from "./types";
import { useDeclareEnvironment } from "./use-environment";

/**
 * The HTML content layer of a room. Declares the room to the world and reveals
 * its `[data-reveal]` children in step with the journey in (once the camera has
 * settled), or straight away on a direct visit. Skips the motion for reduced motion.
 */
export function RoomPage({ id, children, className }: { id: EnvironmentId; children: React.ReactNode; className?: string }) {
  useDeclareEnvironment(id);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const shell = el.closest<HTMLElement>(".room-shell");
    let ctx: gsap.Context | undefined;
    let timer = 0;
    const reveal = () => {
      shell?.classList.add("is-revealed");
      if (world.get().reduceMotion) return;
      ctx = gsap.context(() => {
        gsap.from("[data-reveal]", { autoAlpha: 0, y: 18, duration: 0.9, ease: "power3.out", stagger: 0.09, clearProps: "all" });
      }, el);
    };
    const t = world.get().transition;
    let off: (() => void) | undefined;
    if (t?.to.id === id && !t.contentReady) {
      // mid-journey: wait for the camera to settle
      off = world.subscribe(() => {
        const now = world.get().transition;
        if (!now || now.contentReady) {
          off?.();
          off = undefined;
          reveal();
        }
      });
    } else {
      // direct visit: the lights come up first
      timer = window.setTimeout(reveal, world.get().reduceMotion ? 0 : 350);
    }
    return () => {
      off?.();
      window.clearTimeout(timer);
      ctx?.revert();
      shell?.classList.remove("is-revealed");
    };
  }, [id]);

  return (
    <main ref={ref} className={`room-content ${className ?? ""}`}>
      {children}
    </main>
  );
}
