"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Composition } from "./composition";
import { createLampState } from "./lamp-state";
import { Pendant } from "./pendant";

type Pt = { x: number; y: number };
type Runner = {
  x: number;
  y: number;
  vertical: boolean;
  dir: 1 | -1;
  speed: number;
  len: number;
  trail: Pt[];
};

const CELL = 40;
const OFF = 20;
const FLICKER: [number, number][] = [
  [0, 0], [260, 0.55], [330, 0], [420, 0.75], [470, 0.2], [560, 0.9], [640, 0.65], [1300, 1],
];

/** Applies a CSS declaration block to an element (dynamic, effect-scoped layout). */
function css(el: HTMLElement, rules: Record<string, string>) {
  for (const [prop, value] of Object.entries(rules)) el.style.setProperty(prop, value);
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
const noopSubscribe = () => () => {};
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

/**
 * The homepage: a dark room lit by a cursor "light" and a pull-chain pendant.
 * Ported from the original vanilla-JS page; the imperative effect below is the
 * original logic, now with cleanup so it is safe under React Strict Mode.
 */
export function HomeScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lampRef = useRef<HTMLDivElement>(null);
  const swingRef = useRef<HTMLDivElement>(null);
  const cordRef = useRef<HTMLButtonElement>(null);
  const lampState = useRef(createLampState());
  const three = useSyncExternalStore(noopSubscribe, hasWebGL, () => false);
  const reduceMotionPref = useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(reducedMotionQuery);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );

  useEffect(() => {
    const home = rootRef.current;
    const lamp = lampRef.current;
    const swing = swingRef.current;
    const cord = cordRef.current;
    if (!home || !lamp || !swing || !cord) return;

    const ls = lampState.current;
    const $ = <T extends HTMLElement>(id: string) => home.querySelector<T>(`#${id}`)!;
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    const ac = new AbortController();
    const { signal } = ac;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };

    /* Dimension lines measured from the real name element */
    const lit = $("lit");
    const name = $("name");
    const draft = $("draft");
    const dimTop = $("dimTop");
    const dimRight = $("dimRight");
    const crossH = $("crossH");
    const crossV = $("crossV");
    const coords = $("coords");
    const flash = $("flash");
    let nameCenter: Pt = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    function measure() {
      const r = name.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      nameCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const gap = 26;
      const t = Array.from(dimTop.children) as HTMLElement[];
      css(dimTop, { left: `${r.left}px`, top: `${r.top - gap}px`, width: `${w}px`, height: "1px" });
      css(t[0], { left: "0", top: "0", width: "100%", height: "1px" });
      css(t[1], { left: "0", top: "-6px", width: "1px", height: "13px" });
      css(t[2], { right: "0", top: "-6px", width: "1px", height: "13px" });
      css(t[3], { left: "50%", top: "-8px", transform: "translateX(-50%)" });
      t[3].textContent = String(w);
      const s = Array.from(dimRight.children) as HTMLElement[];
      css(dimRight, { left: `${r.right + gap}px`, top: `${r.top}px`, width: "1px", height: `${h}px` });
      css(s[0], { left: "0", top: "0", width: "1px", height: "100%" });
      css(s[1], { left: "-6px", top: "0", width: "13px", height: "1px" });
      css(s[2], { left: "-6px", bottom: "0", width: "13px", height: "1px" });
      css(s[3], { left: "10px", top: "50%", transform: "translateY(-50%)" });
      s[3].textContent = String(h);
      dimRight.style.display = r.right + gap + 40 < window.innerWidth ? "block" : "none";
      css(crossH, { left: "20px", right: "20px", top: `${Math.round(nameCenter.y)}px`, height: "1px" });
      css(crossV, { top: "20px", bottom: "20px", left: `${Math.round(nameCenter.x)}px`, width: "1px" });
      draft.classList.add("ready");
    }

    /* Runners: short lines that travel the grid when the lights are on */
    const canvas = $<HTMLCanvasElement>("runners");
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let runners: Runner[] = [];
    let lightsOn = false;

    function sizeCanvas() {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const snap = (v: number) => OFF + Math.round((v - OFF) / CELL) * CELL;
    function spawn(): Runner {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const vertical = Math.random() < 0.5;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const r: Runner = {
        x: snap(Math.random() * W),
        y: snap(Math.random() * H),
        vertical,
        dir,
        speed: 1.6 + Math.random() * 2.2,
        len: 50 + Math.random() * 110,
        trail: [],
      };
      if (vertical) r.y = dir > 0 ? -r.len : H + r.len;
      else r.x = dir > 0 ? -r.len : W + r.len;
      return r;
    }
    function initRunners() {
      const n = window.innerWidth < 760 ? 7 : 14;
      runners = Array.from({ length: n }, spawn);
    }
    function stepRunners() {
      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      for (let i = 0; i < runners.length; i++) {
        const r = runners[i];
        if (r.vertical) r.y += r.speed * r.dir;
        else r.x += r.speed * r.dir;
        r.trail.push({ x: r.x, y: r.y });
        const maxPts = Math.ceil(r.len / r.speed);
        while (r.trail.length > maxPts) r.trail.shift();
        const along = r.vertical ? r.y : r.x;
        const onLine = Math.abs((((along - OFF) % CELL) + CELL) % CELL) < r.speed;
        if (onLine && Math.random() < 0.18) {
          if (r.vertical) r.y = snap(r.y);
          else r.x = snap(r.x);
          r.vertical = !r.vertical;
          r.dir = Math.random() < 0.5 ? 1 : -1;
        }
        if (r.x < -r.len - CELL || r.x > W + r.len + CELL || r.y < -r.len - CELL || r.y > H + r.len + CELL) {
          runners[i] = spawn();
          continue;
        }
        const pts = r.trail;
        const L = pts.length;
        for (let k = 1; k < L; k++) {
          ctx.strokeStyle = `rgba(34,56,214,${((k / L) * 0.85).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(pts[k - 1].x, pts[k - 1].y);
          ctx.lineTo(pts[k].x, pts[k].y);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(34,56,214,1)";
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* The light */
    const radiusFor = () => Math.max(300, Math.min(480, window.innerWidth * 0.32));
    let fullR = radiusFor();
    let tx = nameCenter.x;
    let ty = nameCenter.y;
    let x = tx;
    let y = ty;
    let radius = reduceMotion ? fullR : 0;
    let angle = 0;
    let manual = false;
    let lastTouch = 0;
    let start: number | null = null;
    let frameNo = 0;
    let lastX = -1;
    let lastY = -1;
    let lastR = -1;
    let raf = 0;

    function entranceR(ms: number) {
      for (let i = 1; i < FLICKER.length; i++) {
        if (ms <= FLICKER[i][0]) {
          const a = FLICKER[i - 1];
          const b = FLICKER[i];
          let p = (ms - a[0]) / (b[0] - a[0]);
          p = p * p * (3 - 2 * p);
          return (a[1] + (b[1] - a[1]) * p) * fullR;
        }
      }
      return fullR;
    }
    function setVars() {
      if (Math.abs(x - lastX) < 0.2 && Math.abs(y - lastY) < 0.2 && Math.abs(radius - lastR) < 0.2) return;
      lastX = x;
      lastY = y;
      lastR = radius;
      root.style.setProperty("--lx", `${x.toFixed(1)}px`);
      root.style.setProperty("--ly", `${y.toFixed(1)}px`);
      root.style.setProperty("--r", `${radius.toFixed(1)}px`);
    }

    function frame(now: number) {
      if (start === null) start = now;
      const t = now - start;
      frameNo++;
      if (!reduceMotion) {
        if (t < 1300) radius = entranceR(t);
        else radius += (fullR - radius) * 0.08;
        const drifting = !manual || (coarse && now - lastTouch > 4000);
        if (drifting && t > 1300 && !lightsOn) {
          const k = (t - 1300) / 1000;
          tx = nameCenter.x + Math.sin(k * 0.23) * window.innerWidth * 0.22;
          ty = nameCenter.y + Math.cos(k * 0.17) * window.innerHeight * 0.16;
        }
        angle = (angle + 0.35) % 360;
        root.style.setProperty("--a", `${angle.toFixed(2)}deg`);
        if (lightsOn) stepRunners();
      }
      if (!lightsOn) {
        x += (tx - x) * 0.085;
        y += (ty - y) * 0.085;
        setVars();
        if (frameNo % 6 === 0) coords.textContent = `x ${Math.round(x)}   y ${Math.round(y)}`;
      }
      raf = requestAnimationFrame(frame);
    }

    /* Lights: a bulb flash covers the swap, so nothing heavy animates */
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const originalTheme = themeMeta?.getAttribute("content") ?? null;
    function startSwing(fromDeg: number) {
      if (ls.three) {
        ls.dragDeg = null;
        ls.kickDeg = fromDeg;
        ls.wake?.();
        return;
      }
      if (reduceMotion) {
        swing!.style.transform = "";
        return;
      }
      swing!.style.setProperty("--tilt", `${fromDeg.toFixed(2)}deg`);
      swing!.style.transform = "";
      swing!.classList.remove("settling");
      void swing!.offsetWidth;
      swing!.classList.add("settling");
    }
    swing.addEventListener("animationend", () => swing.classList.remove("settling"), { signal });

    function setLights(on: boolean) {
      lightsOn = on;
      cord!.setAttribute("aria-pressed", String(on));
      cord!.setAttribute(
        "aria-label",
        on ? "Pull the chain to turn the lights off" : "Pull the chain to turn the lights on",
      );
      themeMeta?.setAttribute("content", on ? "#F1F2F0" : "#060606");
      flash.classList.toggle("off", !on);
      if (!reduceMotion) {
        flash.classList.remove("go");
        void flash.offsetWidth;
        flash.classList.add("go");
      }
      const swap = () => {
        root.classList.toggle("lights-on", on);
        ls.on = on;
        ls.onAt = performance.now();
        ls.wake?.();
        lamp!.classList.toggle("on", on);
        lamp!.classList.remove("warming");
        if (on && !reduceMotion) {
          void lamp!.offsetWidth;
          lamp!.classList.add("warming");
          later(() => lamp!.classList.remove("warming"), 840);
        }
        if (on) initRunners();
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      };
      if (reduceMotion) swap();
      else later(swap, 150);
    }

    /* The cord: drag it down and let go, or just click it */
    let dragging = false;
    let startY = 0;
    let pull = 0;
    let pointerUsed = false;
    const baseCord = () => parseFloat(getComputedStyle(root).getPropertyValue("--cord")) || 150;
    const setCord = (h: number) => {
      cord.style.height = `${h}px`;
    };
    const springBack = () => {
      cord.style.height = "";
    };
    function tugAnimation() {
      cord!.classList.remove("dragging");
      setCord(baseCord() + 56);
      later(springBack, 170);
    }
    function fire() {
      cord!.classList.add("used");
      setLights(!lightsOn);
    }

    cord.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        dragging = true;
        pointerUsed = true;
        startY = e.clientY;
        pull = 0;
        cord.classList.add("dragging");
        try {
          cord.setPointerCapture(e.pointerId);
        } catch {}
        e.preventDefault();
        e.stopPropagation();
      },
      { signal },
    );
    cord.addEventListener(
      "pointermove",
      (e) => {
        if (!dragging) return;
        pull = Math.max(0, Math.min(96, e.clientY - startY));
        setCord(baseCord() + pull);
        if (ls.three) {
          ls.dragDeg = (pull / 96) * 2.4;
          ls.wake?.();
        } else if (!reduceMotion) {
          swing.classList.remove("settling");
          swing.style.transform = `rotate(${((pull / 96) * 2.4).toFixed(2)}deg)`;
        }
        e.stopPropagation();
      },
      { signal },
    );
    const release = (e: Event) => {
      if (!dragging) return;
      dragging = false;
      cord.classList.remove("dragging");
      if (pull < 6) {
        tugAnimation();
        fire();
        startSwing(1.4);
      } else {
        springBack();
        startSwing((pull / 96) * 2.4);
        if (pull >= 34) fire();
      }
      pull = 0;
      e.stopPropagation();
    };
    cord.addEventListener("pointerup", release, { signal });
    cord.addEventListener("pointercancel", release, { signal });
    cord.addEventListener(
      "click",
      () => {
        /* keyboard activation arrives as a click with no pointer first */
        if (pointerUsed) {
          pointerUsed = false;
          return;
        }
        tugAnimation();
        fire();
        startSwing(1.4);
      },
      { signal },
    );

    /* Moving the light */
    window.addEventListener(
      "pointerdown",
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        manual = true;
        lastTouch = performance.now();
      },
      { passive: true, signal },
    );
    window.addEventListener(
      "pointermove",
      (e) => {
        if (dragging) return;
        tx = e.clientX;
        ty = e.clientY;
        manual = true;
        if (e.pointerType !== "mouse") lastTouch = performance.now();
      },
      { passive: true, signal },
    );
    lit.addEventListener(
      "focusin",
      (e) => {
        const b = (e.target as HTMLElement).getBoundingClientRect();
        tx = b.left + b.width / 2;
        ty = b.top + b.height / 2;
        manual = true;
      },
      { signal },
    );

    window.addEventListener(
      "resize",
      () => {
        later(() => {
          measure();
          sizeCanvas();
          fullR = radiusFor();
          if (!manual) {
            tx = nameCenter.x;
            ty = nameCenter.y;
          }
          if (lightsOn) initRunners();
        }, 120);
      },
      { signal },
    );

    document.fonts?.ready.then(() => !signal.aborted && measure());
    measure();
    sizeCanvas();
    tx = nameCenter.x;
    ty = nameCenter.y;
    x = tx;
    y = ty;
    setVars();
    raf = requestAnimationFrame(frame);

    return () => {
      ac.abort();
      ls.on = false;
      ls.dragDeg = null;
      cancelAnimationFrame(raf);
      timers.forEach((id) => clearTimeout(id));
      root.classList.remove("lights-on");
      ["--lx", "--ly", "--r", "--a"].forEach((v) => root.style.removeProperty(v));
      if (themeMeta && originalTheme) themeMeta.setAttribute("content", originalTheme);
    };
  }, []);

  return (
    <div className="home" ref={rootRef}>
      <div className="gloss" aria-hidden="true" />
      <div className="blueprint-grid" aria-hidden="true" />
      <canvas id="runners" aria-hidden="true" />
      <div className="frame" aria-hidden="true">
        <i /><i /><i /><i />
      </div>

      <div className="draft" id="draft" aria-hidden="true">
        <div className="cross-h" id="crossH" />
        <div className="cross-v" id="crossV" />
        <div className="dim" id="dimTop">
          <span className="ln" /><span className="tk" /><span className="tk" /><span className="lb" />
        </div>
        <div className="dim" id="dimRight">
          <span className="ln" /><span className="tk" /><span className="tk" /><span className="lb" />
        </div>
      </div>

      <div className="stage">
        <div className="layer unlit" aria-hidden="true" inert>
          <Composition variant="unlit" />
        </div>
        <div className="layer lit" id="lit">
          <Composition variant="lit" />
        </div>
        <div className="glow" aria-hidden="true" />
        <div className="core" aria-hidden="true" />
      </div>

      <div className="flash" id="flash" aria-hidden="true" />
      <Pendant lampRef={lampRef} swingRef={swingRef} cordRef={cordRef} three={three} lampState={lampState} reduceMotion={reduceMotionPref} />
    </div>
  );
}
