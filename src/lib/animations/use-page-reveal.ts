"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Fades and lifts every `[data-reveal]` element inside the returned ref's scope
 * on mount and on each route change. Skipped for reduced-motion users.
 */
export function usePageReveal<T extends HTMLElement>() {
  const scope = useRef<T>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-reveal]", {
          autoAlpha: 0,
          y: 16,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.08,
          clearProps: "all",
        });
      });
      return () => mm.revert();
    },
    { scope, dependencies: [pathname], revertOnUpdate: true },
  );

  return scope;
}
