"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { detectTier } from "@/components/world/device";
import { useWorld, world } from "@/components/world/store";
import type { Tier } from "@/components/world/types";
import { useDeclareEnvironment } from "@/components/world/use-environment";
import type { StudioState } from "./studio-state";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const noopSubscribe = () => () => {};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Client half of the homepage. Declares the studio as this page's room in the
 * shared world (src/components/world) and owns everything that talks to it:
 * scroll position (as a scene index), the pointer, the pull chain and the
 * custom cursor. The page content itself is server-rendered markup.
 */
export function HomeExperience() {
  const stateRef = useRef<StudioState>(world.get().studio);
  const tier = useSyncExternalStore(noopSubscribe, detectTier, () => "none" as Tier);
  // no WebGL, or the world could not start: the still studio, lit
  const flat = useWorld((s) => s.failed) || tier === "none";
  useDeclareEnvironment("studio");
  const reduceMotion = usePrefersReducedMotion();
  const chainRef = useRef<HTMLButtonElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stateRef.current.reduceMotion = reduceMotion;
    stateRef.current.wake();
  }, [reduceMotion]);

  /* ---- lights ---- */
  useEffect(() => {
    const state = stateRef.current;
    const root = document.documentElement;
    const chain = chainRef.current;
    state.els.chain = chain;
    state.els.heroName = document.querySelector<HTMLElement>("[data-hero-name]");
    state.els.coords = document.querySelector<HTMLElement>("[data-coords]");
    if (flat) root.classList.add("studio-on", "studio-flat");
    return () => {
      root.classList.remove("studio-on", "studio-flat");
      state.els = { chain: null, heroName: null, coords: null };
    };
  }, [flat]);

  useEffect(() => {
    const state = stateRef.current;
    const chain = chainRef.current;
    if (!chain || flat) return;
    const root = document.documentElement;
    const ac = new AbortController();
    const { signal } = ac;
    let touched = false;

    const setOn = (on: boolean) => {
      if (state.on === on) return;
      state.on = on;
      state.switchedAt = performance.now();
      root.classList.toggle("studio-on", on);
      chain.setAttribute("aria-pressed", String(on));
      chain.setAttribute("aria-label", on ? "Pull the chain to switch the light off" : "Pull the chain to switch the light on");
      state.wake();
    };
    const pullOnce = () => {
      touched = true;
      chain.classList.add("is-used");
      state.tugAt = performance.now();
      setOn(!state.on);
      navigator.vibrate?.(8);
    };

    /* the chain: drag it down and let go, or click it */
    let start: { x: number; y: number } | null = null;
    let pointerUsed = false;
    // relative to the canvas, which is sized to the large viewport on mobile
    const viewH = () => document.querySelector(".world-canvas")?.clientHeight || window.innerHeight;
    const toNdc = (e: PointerEvent) => ({ x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / viewH()) * 2 + 1 });
    chain.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        start = { x: e.clientX, y: e.clientY };
        pointerUsed = true;
        chain.setPointerCapture(e.pointerId);
        chain.classList.add("is-dragging");
        state.drag = toNdc(e);
        e.preventDefault();
      },
      { signal },
    );
    chain.addEventListener(
      "pointermove",
      (e) => {
        if (!start) return;
        state.drag = toNdc(e);
        state.wake();
      },
      { signal },
    );
    const release = (e: PointerEvent) => {
      if (!start) return;
      const pulled = e.clientY - start.y;
      const moved = Math.hypot(e.clientX - start.x, pulled);
      start = null;
      state.drag = null;
      chain.classList.remove("is-dragging");
      if (moved < 6 || pulled > 36) pullOnce();
    };
    const hover = (on: boolean) => () => {
      state.chainHover = on;
      state.wake();
    };
    chain.addEventListener("pointerenter", hover(true), { signal });
    chain.addEventListener("pointerleave", hover(false), { signal });
    chain.addEventListener("focus", hover(true), { signal });
    chain.addEventListener("blur", hover(false), { signal });
    chain.addEventListener("pointerup", release, { signal });
    chain.addEventListener("pointercancel", release, { signal });
    chain.addEventListener(
      "click",
      () => {
        // keyboard activation arrives as a click with no pointer before it
        if (pointerUsed) pointerUsed = false;
        else pullOnce();
      },
      { signal },
    );

    /* the pointer, for parallax, the cursor lamp and the bulb's proximity */
    const p = state.pointer;
    const onMove = (e: PointerEvent) => {
      const n = toNdc(e);
      p.x = n.x;
      p.y = n.y;
      p.mouse = e.pointerType === "mouse";
      p.active = p.mouse || e.buttons > 0;
      state.wake();
    };
    // the cursor lamp steps back over type, and further over controls with their own hover
    document.addEventListener(
      "pointerover",
      (e) => {
        const el = e.target as Element;
        p.light = el.closest?.("a, button, [data-cursor]") ? 0.3 : el.closest?.("h1, h2, h3, p, li, dl, blockquote, .plate") ? 0.5 : 1;
      },
      { passive: true, signal },
    );
    window.addEventListener("pointermove", onMove, { passive: true, signal });
    window.addEventListener("pointerdown", onMove, { passive: true, signal });
    window.addEventListener("pointerup", (e) => e.pointerType !== "mouse" && (p.active = false), { passive: true, signal });
    document.documentElement.addEventListener("pointerleave", () => (p.active = false), { signal });

    /* scroll -> a continuous scene index, plus the active nav item */
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
    const navItems = Array.from(document.querySelectorAll<HTMLElement>("[data-nav]"));
    let active = "";
    const onScroll = () => {
      const vh = window.innerHeight;
      const hero = sections[0];
      let s = clamp01(window.scrollY / Math.max(1, hero.offsetHeight - vh));
      let current = "";
      for (let i = 1; i < sections.length; i++) {
        const r = sections[i].getBoundingClientRect();
        s += clamp01((vh - r.top) / (vh * 0.75));
        if (r.top < vh * 0.5 && r.bottom > vh * 0.5) current = sections[i].id;
      }
      state.scene = s;
      // scrolling on without pulling the chain: the light comes on by itself
      if (!touched && !state.on && s > 0.3) setOn(true);
      if (current !== active) {
        active = current;
        for (const item of navItems) {
          const on = item.dataset.nav === current;
          item.toggleAttribute("data-active", on);
          if (on) item.setAttribute("aria-current", "true");
          else item.removeAttribute("aria-current");
        }
      }
      state.wake();
    };
    window.addEventListener("scroll", onScroll, { passive: true, signal });
    window.addEventListener("resize", onScroll, { passive: true, signal });
    onScroll();

    return () => {
      ac.abort();
      state.drag = null;
      state.on = false;
      state.scene = 0;
      root.classList.remove("studio-on");
    };
  }, [flat]);

  /* ---- a minimal cursor: a dot, and a ring that lags and reacts to what is under it ---- */
  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring || reduceMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const root = document.documentElement;
    root.classList.add("has-cursor");
    const ringX = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3.out" });
    const ac = new AbortController();
    window.addEventListener(
      "pointermove",
      (e) => {
        gsap.set(dot, { x: e.clientX, y: e.clientY });
        ringX(e.clientX);
        ringY(e.clientY);
        root.classList.add("cursor-visible");
      },
      { passive: true, signal: ac.signal },
    );
    document.addEventListener(
      "pointerover",
      (e) => {
        const el = (e.target as Element).closest?.("a, button, [data-cursor]");
        ring.dataset.mode = el?.closest("[data-cursor='pull']") ? "pull" : el ? "link" : "";
      },
      { signal: ac.signal },
    );
    root.addEventListener("pointerleave", () => root.classList.remove("cursor-visible"), { signal: ac.signal });
    return () => {
      ac.abort();
      root.classList.remove("has-cursor", "cursor-visible");
    };
  }, [reduceMotion]);

  /* ---- scroll choreography for the DOM layer ---- */
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const hero = document.querySelector<HTMLElement>("[data-scene='hero']");
      const shift = document.querySelector<HTMLElement>("[data-hero-shift]");
      const name = document.querySelector<HTMLElement>("[data-hero-name]");
      const dim = document.querySelector<HTMLElement>("[data-dim-width]");
      const measure = () => name && dim && (dim.textContent = String(Math.round(name.getBoundingClientRect().width)));

      // the hero type steps back as the camera pulls out of the close-up
      if (hero && shift) {
        gsap
          .timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom bottom", scrub: 0.6, onUpdate: measure } })
          .to(shift, { yPercent: -14, scale: 0.86, transformOrigin: "0% 100%", ease: "none" }, 0)
          .to("[data-hero-fade]", { y: -24, autoAlpha: 0, ease: "power1.in", duration: 0.6 }, 0);
      }
      // headings are lit, not faded in: a soft edge of light sweeps across them
      gsap.utils.toArray<HTMLElement>("[data-sweep]").forEach((el) => {
        gsap.fromTo(el, { "--p": 0 }, { "--p": 1, ease: "none", scrollTrigger: { trigger: el, start: "top 95%", end: "top 62%", scrub: true } });
      });
      // dimension rules draw themselves out
      gsap.utils.toArray<HTMLElement>("[data-measure]").forEach((el) => {
        gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 95%", end: "top 60%", scrub: true } });
      });
      // plates sit at a slightly different depth to the type
      gsap.utils.toArray<HTMLElement>("[data-depth]").forEach((el) => {
        gsap.fromTo(el, { y: 50 }, { y: -50, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });
      measure();
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    });
    return () => mm.revert();
  });

  return (
    <>
      {flat && <div className="studio-fallback" aria-hidden="true" />}
      <div className="studio-grain" aria-hidden="true" />
      <div className="frame-marks" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      {!flat && (
        <button
          ref={chainRef}
          type="button"
          className="studio-chain"
          data-cursor="pull"
          aria-pressed="false"
          aria-label="Pull the chain to switch the light on"
        >
          <span className="studio-chain-hint" aria-hidden="true">
            Pull
          </span>
        </button>
      )}
      <div ref={ringRef} className="cursor-ring" aria-hidden="true">
        <span>Pull</span>
      </div>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
