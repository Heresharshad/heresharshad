"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { world } from "@/components/world/store";
import type { EnvironmentProps } from "@/components/world/types";
import { COUNTER, FLOOR_Y, GLOW, VOID } from "./config";

/*
 * The Experiments room: not a room at all. Through the opening in the studio
 * wall there is a deep void, a dark gradient lifted a touch at the horizon,
 * with a slow haze gathered round two glows (the accent up and left behind the
 * heading, a cold one low and right), a faint lab grid running off to the
 * horizon, and motes drifting up through it. Everything is a shader on cheap
 * geometry and nothing is lit, so it costs the same on any device; it is kept
 * dim so the page in front, and the demos in their cards, carry the contrast.
 * You arrive in the dark and the haze comes up; with reduced motion it is a
 * still, and phones get fewer motes and a cheaper haze.
 */

const [X0, X1] = VOID.x;
const [Y0, Y1] = VOID.y;
const [Z0, Z1] = VOID.z;

/** The palette, in sRGB: a cool near-black, the site's accent for the key, a slate blue for the counter. */
const ZENITH = "#06070c";
const HORIZON = "#0f141f";
const NADIR = "#040405";
const ACCENT = "#ffd9a0";
const COLD = "#6f8fc4";
const MOTE = "#e9e3d8";

/** How strongly each glow shows at full level (linear, added to the gradient). */
const KEY_INTENSITY = 0.032;
const COUNTER_INTENSITY = 0.035;
/** The grid: cell size (twice the cladding's 600 mm module) and opacity at full level. */
const CELL = 1.2;
const GRID_OPACITY = 0.2;
/** Motes, and the space they drift through. */
const MOTES = { high: 1400, low: 520 };
const MOTE_BOX = { x: [-14, 12], y: [FLOOR_Y, 5.5], z: [-7.5, -32] } as const;
const MOTE_OPACITY = 0.9;
/** The room's own fade-in when it is entered directly (seconds). */
const RAMP = 2.4;
/** A still frame's clock, for reduced motion: the haze settled somewhere pleasant. */
const STILL_TIME = 40;

const KEY = new THREE.Vector3(GLOW.x, GLOW.y, GLOW.z);
const color = (hex: string) => new THREE.Color(hex);

const NOISE = /* glsl */ `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < OCTAVES; i++) {
    s += a * noise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
`;

const WORLD_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/**
 * The backdrop: coloured by view direction, not by where the surface is, so
 * it reads as depth without end. A box only because something has to carry
 * the pixels; it starts behind the studio wall, so the studio never sees it.
 */
function backdropMaterial(high: boolean) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    defines: { OCTAVES: high ? 4 : 3 },
    uniforms: {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uKey: { value: KEY.clone() },
      uCounter: { value: new THREE.Vector3(COUNTER.x, COUNTER.y, COUNTER.z) },
      uZenith: { value: color(ZENITH) },
      uHorizon: { value: color(HORIZON) },
      uNadir: { value: color(NADIR) },
      uKeyColor: { value: color(ACCENT).multiplyScalar(KEY_INTENSITY) },
      uCounterColor: { value: color(COLD).multiplyScalar(COUNTER_INTENSITY) },
    },
    vertexShader: WORLD_VERTEX,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform vec3 uKey;
uniform vec3 uCounter;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uNadir;
uniform vec3 uKeyColor;
uniform vec3 uCounterColor;
varying vec3 vWorld;
${NOISE}
void main() {
  vec3 d = normalize(vWorld - cameraPosition);

  // the gradient: lifted at the horizon, darker overhead and darker still underfoot
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, d.y));
  col = mix(col, uNadir, smoothstep(0.0, -0.3, d.y));

  // the haze: slow, folded noise on the view direction, drifting sideways and back
  vec3 q = d * 2.4 + vec3(uTime * 0.011, 0.0, -uTime * 0.007);
  float n = fbm(q + 0.6 * fbm(q * 1.3 + vec3(0.0, uTime * 0.005, 4.0)));
  n = smoothstep(0.3, 0.8, n);

  // the glows: a broad body and a tight core round the key, a wide low wash round the counter
  float k = 1.0 - max(dot(d, normalize(uKey - cameraPosition)), 0.0);
  float c = 1.0 - max(dot(d, normalize(uCounter - cameraPosition)), 0.0);
  float key = exp(-k * 22.0) * (0.35 + 1.1 * n) + exp(-k * 140.0) * 0.45;
  float counter = exp(-c * 9.0) * (0.25 + 1.2 * n);
  // and a little of both everywhere the haze is thick, so the dark has some weather in it
  float drift = n * n * 0.35 * smoothstep(-0.15, 0.25, d.y);

  col += (uKeyColor * (key + drift) + uCounterColor * (counter + drift)) * uLevel;
  col *= 0.4 + 0.6 * uLevel;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>

  // fine grain, moving at film rate (still for reduced motion): it also breaks up banding in the dark gradient
  vec2 g = gl_FragCoord.xy + floor(uTime * 24.0) * vec2(17.0, 31.0);
  gl_FragColor.rgb += (fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (3.0 / 255.0);
}
`,
  });
}

/**
 * The lab floor: a faint grid in the accent, fading with distance and where
 * its cells get too small to draw cleanly, a little brighter in the pool under
 * the key glow, and every so often a soft scan line running away from the door.
 */
function gridMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uScan: { value: 1 },
      uKey: { value: KEY.clone() },
      uColor: { value: color(ACCENT) },
    },
    vertexShader: WORLD_VERTEX,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform float uScan;
uniform vec3 uKey;
uniform vec3 uColor;
varying vec3 vWorld;

float grid(vec2 p, float cell, float width) {
  vec2 g = p / cell;
  vec2 fw = fwidth(g);
  vec2 a = abs(fract(g - 0.5) - 0.5) / max(fw, 1e-4);
  float line = 1.0 - min(min(a.x, a.y) / width, 1.0);
  // cells down to a few pixels shimmer: let them go before they do
  return line * (1.0 - smoothstep(0.12, 0.45, max(fw.x, fw.y)));
}

void main() {
  vec2 p = vWorld.xz;
  float lines = grid(p, ${CELL.toFixed(2)}, 1.0) * 0.4 + grid(p, ${(CELL * 5).toFixed(2)}, 1.3) * 0.6;

  float far = exp(-distance(vWorld, cameraPosition) * 0.07);
  float fromWall = smoothstep(${Z0.toFixed(2)}, ${(Z0 - 2).toFixed(2)}, vWorld.z);
  vec2 k = p - uKey.xz;
  float pool = exp(-dot(k, k) / 70.0);
  float run = mod(uTime * 2.4, 70.0);
  float scan = exp(-pow(${Z0.toFixed(2)} - vWorld.z - run, 2.0) / 2.0) * uScan;

  float a = lines * far * fromWall * (0.5 + 1.3 * pool + 1.8 * scan);
  gl_FragColor = vec4(uColor, a * ${GRID_OPACITY.toFixed(2)} * uLevel);
  #include <colorspace_fragment>
}
`,
  });
}

/** Motes: points rising slowly through the void, swaying, twinkling, a few in the accent. */
function motes(count: number) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const { x, y, z } = MOTE_BOX;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = x[0] + Math.random() * (x[1] - x[0]);
    pos[i * 3 + 1] = y[0] + Math.random() * (y[1] - y[0]);
    // denser towards the back, so the near field stays clear
    pos[i * 3 + 2] = z[0] + Math.sqrt(Math.random()) * (z[1] - z[0]);
    seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uPixel: { value: 1 },
      uColor: { value: color(MOTE) },
      uAccent: { value: color(ACCENT) },
    },
    vertexShader: /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform float uPixel;
attribute vec4 aSeed;
varying float vAlpha;
varying float vTint;
const float BOTTOM = ${y[0].toFixed(2)};
const float HEIGHT = ${(y[1] - y[0]).toFixed(2)};
void main() {
  vec3 p = position;
  float phase = aSeed.y * 6.2832;
  p.y = BOTTOM + mod(p.y - BOTTOM + uTime * (0.04 + aSeed.x * 0.1), HEIGHT);
  p.x += sin(uTime * 0.13 + phase) * 0.35;
  p.z += cos(uTime * 0.11 + phase) * 0.35;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  gl_PointSize = clamp((0.6 + aSeed.z * 1.7) * 14.0 * uPixel / depth, 1.2 * uPixel, 7.0 * uPixel);
  float twinkle = 0.6 + 0.4 * sin(uTime * (0.5 + aSeed.w * 1.5) + aSeed.y * 40.0);
  float edge = smoothstep(0.0, 1.2, p.y - BOTTOM) * smoothstep(0.0, 1.2, BOTTOM + HEIGHT - p.y);
  vAlpha = twinkle * edge * smoothstep(34.0, 10.0, depth) * smoothstep(1.0, 3.0, depth) * uLevel;
  vTint = step(0.86, aSeed.w);
}
`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor;
uniform vec3 uAccent;
varying float vAlpha;
varying float vTint;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(mix(uColor, uAccent, vTint), a * a * vAlpha * ${MOTE_OPACITY.toFixed(2)});
  #include <colorspace_fragment>
}
`,
  });
  return { geometry, material };
}

/** The live uniforms of one of the room's shader meshes, reached through its ref rather than the memo. */
const uniformsOf = (obj: THREE.Mesh | THREE.Points) => (obj.material as THREE.ShaderMaterial).uniforms as Record<string, THREE.IUniform | undefined> & Record<"uTime" | "uLevel", THREE.IUniform>;

/** Per-frame working state, created on the first frame. */
function createLive() {
  return {
    lights: 0,
    latched: false,
    time: 0,
    frame: 0,
    el: null as HTMLElement | null,
    v: new THREE.Vector3(),
    dom: { lx: NaN, ly: NaN, li: NaN },
  };
}

export default function ExperimentsRoom({ high, onReady }: EnvironmentProps) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);

  const group = useRef<THREE.Group>(null);
  const backdrop = useRef<THREE.Mesh>(null);
  const floor = useRef<THREE.Mesh>(null);
  const dust = useRef<THREE.Points>(null);
  const liveRef = useRef<ReturnType<typeof createLive>>(null);
  const onReadyRef = useRef(onReady);
  const readyRef = useRef(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  });

  const res = useMemo(() => {
    const backdrop = backdropMaterial(high);
    const grid = gridMaterial();
    const dust = motes(high ? MOTES.high : MOTES.low);
    return {
      shell: new THREE.BoxGeometry(X1 - X0, Y1 - Y0, Z0 - Z1).translate((X0 + X1) / 2, (Y0 + Y1) / 2, (Z0 + Z1) / 2),
      floor: new THREE.PlaneGeometry(X1 - X0, Z0 - Z1).rotateX(-Math.PI / 2).translate((X0 + X1) / 2, FLOOR_Y, (Z0 + Z1) / 2),
      backdrop,
      grid,
      dust,
    };
  }, [high]);

  useEffect(
    () => () => {
      res.shell.dispose();
      res.floor.dispose();
      res.backdrop.dispose();
      res.grid.dispose();
      res.dust.geometry.dispose();
      res.dust.material.dispose();
    },
    [res],
  );

  // compile before reporting ready, so the transition never waits on a shader mid-move
  useEffect(() => {
    let alive = true;
    const done = () => {
      if (!alive || readyRef.current) return;
      readyRef.current = true;
      onReadyRef.current();
    };
    if (!group.current) {
      done();
      return;
    }
    try {
      gl.compileAsync(scene, camera).then(done, done);
    } catch {
      done();
    }
    return () => {
      alive = false;
    };
  }, [gl, camera, scene]);

  // the page's light hook is left clean when the room goes
  useEffect(
    () => () => {
      const el = liveRef.current?.el;
      if (!el) return;
      el.style.removeProperty("--lx");
      el.style.removeProperty("--ly");
      el.style.removeProperty("--li");
    },
    [],
  );

  useFrame(({ size, viewport }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    liveRef.current ??= createLive();
    const live = liveRef.current;
    const s = world.get();
    const tr = s.transition;

    /* ---- the lights value: the transition's ramp, or our own; once on, it stays on ---- */
    let lights = live.lights;
    if (live.latched) lights = 1;
    else if (tr && tr.to.id === "experiments") lights = tr.progress.lights;
    else if (s.active === "experiments") lights = s.reduceMotion ? 1 : Math.min(1, lights + dt / RAMP);
    if (lights >= 0.999) {
      lights = 1;
      live.latched = true;
    }
    live.lights = lights;
    // leaving: the void dims as the studio's door mechanism begins
    const dim = tr && tr.from.id === "experiments" && tr.to.id !== "experiments" ? 1 - 0.85 * tr.progress.recess : 1;

    /* ---- the haze comes up, then everything drifts on its own clock ---- */
    const u = Math.min(1, Math.max(0, (lights - 0.05) / 0.8));
    const base = u * u * (3 - 2 * u);
    const level = base * dim;
    live.time = s.reduceMotion ? STILL_TIME : live.time + dt;
    for (const obj of [backdrop.current, floor.current, dust.current]) {
      const uni = obj && uniformsOf(obj);
      if (!uni) continue;
      uni.uTime.value = live.time;
      uni.uLevel.value = level;
      if (uni.uScan) uni.uScan.value = s.reduceMotion ? 0 : 1;
      if (uni.uPixel) uni.uPixel.value = viewport.dpr;
    }

    /* ---- the page's heading takes its light from the key glow ---- */
    if (live.frame++ % 60 === 0 || (live.el && !live.el.isConnected)) {
      const el = document.querySelector<HTMLElement>("[data-room-light]");
      if (el !== live.el) {
        live.el = el;
        live.dom.lx = live.dom.ly = live.dom.li = NaN;
      }
    }
    const el = live.el;
    if (el) {
      const p = live.v.copy(KEY).project(camera);
      if (p.z < 1) {
        const r = el.getBoundingClientRect();
        const lx = size.left + ((p.x + 1) / 2) * size.width - r.left;
        const ly = size.top + ((1 - p.y) / 2) * size.height - r.top;
        const li = Math.min(1, Math.max(0, base));
        const d = live.dom;
        const settled = li !== d.li && (li === 0 || li === 1);
        if (settled || !(Math.abs(li - d.li) <= 0.004) || !(Math.abs(lx - d.lx) <= 0.5) || !(Math.abs(ly - d.ly) <= 0.5)) {
          d.lx = lx;
          d.ly = ly;
          d.li = li;
          el.style.setProperty("--lx", `${lx.toFixed(0)}px`);
          el.style.setProperty("--ly", `${ly.toFixed(0)}px`);
          el.style.setProperty("--li", li.toFixed(3));
        }
      }
    }
  });

  return (
    <group ref={group}>
      <mesh ref={backdrop} geometry={res.shell} material={res.backdrop} renderOrder={-1} frustumCulled={false} />
      <mesh ref={floor} geometry={res.floor} material={res.grid} renderOrder={1} />
      {/* the motes move in the vertex shader, so their bounds are never where three thinks */}
      <points ref={dust} geometry={res.dust.geometry} material={res.dust.material} renderOrder={2} frustumCulled={false} />
    </group>
  );
}
