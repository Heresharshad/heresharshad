"use client";

import { useEffect, useRef } from "react";
import { detectTier } from "@/components/world/device";
import { world, type WorldState } from "@/components/world/store";
import { site } from "@/config/site";

/**
 * The first visit's loader: the studio in the dark, a cord and a warming
 * filament where the pendant will hang, and a line of real status, until the
 * world has drawn its first complete frame of the studio. Then the dark lifts
 * outward from the bulb and the camera's opening drift begins.
 *
 * Only on a full page load: the inline script that switches it on runs while
 * the HTML is parsed, and never on a client-side navigation, so returning to
 * the homepage from another page uses the world's own cut. Without JavaScript
 * it never shows, and if the app's JavaScript never arrives a CSS failsafe
 * lifts it (home.css, .intro).
 *
 * The steps are the world's real ones (store.ts): the app hydrating, the
 * renderer starting, the studio being fetched, built and compiled, and its
 * first frame. No percentages: none of them reports measurable progress.
 */

const STEPS = ["Opening the studio", "Starting the renderer", "Building the studio", "First light"] as const;
/** Visible time before the loader admits it is slow and offers a way in. */
const SLOW_MS = 9000;
/** Longest the reveal may take before the overlay is removed regardless (transitionend can be skipped in a hidden tab). */
const REVEAL_MS = 2200;

const ON = `(function(){var e=document.getElementById("intro");if(e)e.setAttribute("data-on","")})()`;

/** Rendered as a script on the server only; on the client it is inert text, so React does not warn (see Next's "preventing flash" guide). */
function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function stepFor(s: WorldState) {
  if (s.ready.includes("studio")) return 3;
  if (s.camera) return 2;
  if (s.booted) return 1;
  return 0;
}

export function IntroCurtain() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    // a client-side navigation, no script, or already lifted: nothing to do
    if (!el?.hasAttribute("data-on")) return;
    el.setAttribute("data-js", "");
    const label = el.querySelector<HTMLElement>("[data-intro-label]");
    const count = el.querySelector<HTMLElement>("[data-intro-count]");
    const slow = el.querySelector<HTMLElement>("[data-intro-slow]");
    const enter = el.querySelector<HTMLButtonElement>("[data-intro-enter]");

    world.set({ curtain: true });
    const ac = new AbortController();
    const { signal } = ac;
    let step = -1;
    let lifted = false;
    let slowTimer = 0;
    let removeTimer = 0;

    const remove = () => {
      el.removeAttribute("data-on");
      el.classList.remove("is-revealing");
    };
    const lift = () => {
      if (lifted) return;
      lifted = true;
      off();
      window.clearTimeout(slowTimer);
      world.set({ curtain: false });
      el.classList.add("is-revealing");
      el.addEventListener("transitionend", (e) => e.target === el && e.propertyName === "opacity" && remove(), { signal });
      removeTimer = window.setTimeout(remove, REVEAL_MS);
    };

    const update = () => {
      const s = world.get();
      // no WebGL, or it failed to start: the page has its still version, so straight in
      if (detectTier() === "none" || s.failed || s.firstFrame) return lift();
      const next = stepFor(s);
      if (next === step) return;
      step = next;
      if (label) label.textContent = STEPS[step];
      if (count) count.textContent = `0${step + 1} / 0${STEPS.length}`;
    };

    // slowness is counted in visible time: a tab opened in the background does not render, and that is not slow
    const armSlow = () => {
      window.clearTimeout(slowTimer);
      if (!lifted && document.visibilityState === "visible") slowTimer = window.setTimeout(() => slow?.removeAttribute("hidden"), SLOW_MS);
    };

    const off = world.subscribe(update);
    update();
    armSlow();
    document.addEventListener("visibilitychange", armSlow, { signal });
    enter?.addEventListener("click", lift, { signal });

    // leaving the page mid-load takes the overlay with it; only the world's flag needs resetting
    return () => {
      ac.abort();
      off();
      window.clearTimeout(slowTimer);
      window.clearTimeout(removeTimer);
      world.set({ curtain: false });
    };
  }, []);

  return (
    <>
      <div ref={ref} id="intro" className="intro" suppressHydrationWarning>
        <span className="intro-cord" aria-hidden="true" />
        <span className="intro-bulb" aria-hidden="true" />
        <div className="intro-panel">
          <p className="intro-brand">{site.handle}</p>
          <p className="intro-status" role="status">
            <span data-intro-count>01 / 0{STEPS.length}</span>
            <span data-intro-label>{STEPS[0]}</span>
          </p>
          <span className="intro-line" aria-hidden="true" />
          <div className="intro-slow" data-intro-slow hidden>
            <p>Still setting up the 3D studio on this device.</p>
            <button type="button" data-intro-enter>
              Enter without waiting
            </button>
          </div>
        </div>
      </div>
      <InlineScript html={ON} />
    </>
  );
}
