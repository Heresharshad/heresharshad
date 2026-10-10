"use client";

import { useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { Mechanism, type Mech } from "./mechanism";
import { Pendant, type BulbOut, type Rig } from "./pendant";
import type { StudioState } from "./studio-state";
import { StudioRoom, WALL_Z } from "./studio-room";
import { CursorLight } from "./cursor-light";

type V3 = [number, number, number];
/**
 * One composition per scene: camera, where it looks, and where the bridle ring
 * the bulb hangs from should be (NDC). The bulb sits on the side the content is not on.
 */
type Key = { cam: V3; look: V3; ring: [number, number] };

// 0 hero, 1 room revealed, 2 work (text left), 3 experiments (text right), 4 about (left), 5 contact (right)
const WIDE: Key[] = [
  { cam: [0, 0.3, 8], look: [0, 0.1, 0], ring: [0.8, 0.62] },
  { cam: [0, 1.1, 12.5], look: [0, -1.0, 0], ring: [0.35, 0.66] },
  { cam: [0.35, 0.7, 11], look: [0.3, -0.6, 0], ring: [0.5, 0.45] },
  { cam: [-0.35, 0.7, 11], look: [-0.3, -0.6, 0], ring: [-0.5, 0.45] },
  { cam: [0.35, 0.5, 10.8], look: [0.3, -0.7, 0], ring: [0.5, 0.45] },
  { cam: [-0.3, -0.2, 11], look: [-0.3, -1.2, 0], ring: [-0.5, 0.45] },
];
// phones: the rig stays in the top band; sections start below it (see .scene in home.css)
const NARROW: Key[] = [
  { cam: [0, 0.3, 9], look: [0, 0, 0], ring: [0.05, 0.66] },
  { cam: [0, 1, 12.5], look: [0, -1.2, 0], ring: [-0.2, 0.64] },
  { cam: [0.2, 0.6, 11.5], look: [0.15, -0.8, 0], ring: [0.38, 0.62] },
  { cam: [-0.2, 0.6, 11.5], look: [-0.15, -0.8, 0], ring: [-0.38, 0.62] },
  { cam: [0.2, 0.4, 11.5], look: [0.15, -0.9, 0], ring: [0.38, 0.62] },
  { cam: [-0.2, 0.2, 11.5], look: [-0.15, -1.2, 0], ring: [-0.38, 0.62] },
];
// large portrait tablets keep the two-column layout, with the phone camera
const TALL_TWO_COLUMN: Key[] = WIDE.map((k, i) => ({ ...k, cam: NARROW[i].cam, look: NARROW[i].look }));

/**
 * Where the stagehands' hand lines drop, just below the header: inside the
 * page margin on wide screens (allowing for the push-in when the light comes
 * on), so the figures never sit under the text column. [x, y] NDC
 */
const PULLEYS = { wide: [0.885, 0.74], narrow: [0.84, 0.76] } as const;
/** The short fabric cord between the bridle ring and the socket. */
const DROP = 0.4;

const ease = (t: number) => t * t * (3 - 2 * t);
const mix3 = (out: THREE.Vector3, a: V3, b: V3, t: number) =>
  out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
/** Frame-rate independent exponential approach. */
const damp = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

function createRigState() {
  return {
    base: new THREE.PerspectiveCamera(),
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    c: new THREE.Vector3(),
    ray: new THREE.Ray(),
    wall: new THREE.Plane(new THREE.Vector3(0, 0, 1), -WALL_Z),
    bulbPlane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    scene: 0,
    push: 0,
    intro: 1,
    px: 0,
    py: 0,
    vel: new THREE.Vector3(),
    target: new THREE.Vector3(),
    started: false,
    frame: 0,
    dom: { li: -1, gx: 0, gy: 0, sx: 0, sy: 0 },
  };
}

export type Shared = { rig: Rig; out: BulbOut; mech: Mech };

function CameraRig({ stateRef, sharedRef }: { stateRef: RefObject<StudioState>; sharedRef: RefObject<Shared> }) {
  const tRef = useRef<ReturnType<typeof createRigState>>(null);

  useFrame((three, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const camera = three.camera as THREE.PerspectiveCamera;
    const { size } = three;
    const state = stateRef.current;
    const { rig, out, mech } = sharedRef.current;
    tRef.current ??= createRigState();
    const t = tRef.current;
    const rm = state.reduceMotion;
    const tall = size.width / size.height < 0.85;
    const narrow = tall && size.width < 900;
    const keys = tall ? (narrow ? NARROW : TALL_TWO_COLUMN) : WIDE;
    const fov = tall ? 40 : 30;

    /* where in the story we are */
    t.scene = rm ? Math.round(state.scene) : damp(t.scene, state.scene, 6, dt);
    const s = Math.min(Math.max(t.scene, 0), keys.length - 1);
    const i = Math.min(Math.floor(s), keys.length - 2);
    const f = ease(s - i);
    const k0 = keys[i];
    const k1 = keys[i + 1];

    /* the "dolly track" camera, before any hand-held movement */
    const base = t.base;
    base.fov = fov;
    base.aspect = size.width / size.height;
    base.updateProjectionMatrix();
    mix3(t.pos, k0.cam, k1.cam, f);
    mix3(t.look, k0.look, k1.look, f);
    base.position.copy(t.pos);
    base.lookAt(t.look);
    base.updateMatrixWorld();

    /* the mechanism is laid out in screen terms, so it frames every viewport the same way */
    const unproject = (x: number, y: number, out3: THREE.Vector3) => {
      t.a.set(x, y, 0.5).unproject(base);
      t.ray.set(base.position, t.a.sub(base.position).normalize());
      return t.ray.intersectPlane(t.bulbPlane, out3) ?? out3;
    };
    const [px, py] = narrow ? PULLEYS.narrow : PULLEYS.wide;
    unproject(-px, py, mech.p1);
    unproject(px, py, mech.p2);
    mech.beamY = unproject(0, 0.95, t.c).y;
    mech.top = unproject(0, 1, t.c).y;
    mech.bottom = unproject(0, -1, t.c).y;
    mech.left = unproject(-1, 0, t.c).x;
    mech.right = unproject(1, 0, t.c).x;
    mech.narrow = narrow;

    const rx = k0.ring[0] + (k1.ring[0] - k0.ring[0]) * f;
    const ry = k0.ring[1] + (k1.ring[1] - k0.ring[1]) * f;
    unproject(rx, ry, t.target);
    rig.cordLength = DROP;
    if (!t.started || rm) {
      rig.anchor.copy(t.target);
      t.vel.set(0, 0, 0);
      t.started = true;
    } else {
      // the ring is hauled by the lines: a slightly under-damped spring, so it carries
      // momentum, overshoots a touch and settles, and the bulb swings beneath it
      const w = 2.1;
      const zeta = 0.72;
      for (const c of ["x", "y"] as const) {
        t.vel[c] += (w * w * (t.target[c] - rig.anchor[c]) - 2 * zeta * w * t.vel[c]) * dt;
        rig.anchor[c] += t.vel[c] * dt;
      }
    }
    mech.scene = t.scene;

    /* hand-held camera: tiny parallax, an opening drift, a push-in when the light comes on */
    // parallax fades out near the bulb and stops on the chain, so the target never slides away
    const p = state.pointer;
    t.c.copy(out.filament).project(camera);
    const aspect = size.width / size.height;
    const near = Math.exp(-(((p.x - t.c.x) * aspect) ** 2 + (p.y - t.c.y + 0.25) ** 2) / 0.18);
    const hand = p.active && !state.chainHover && !state.drag ? 1 - near : 0;
    t.px = rm ? 0 : damp(t.px, p.x * hand, 1.6, dt);
    t.py = rm ? 0 : damp(t.py, p.y * hand, 1.6, dt);
    t.intro = rm ? 0 : damp(t.intro, 0, 0.9, dt);
    t.push = rm ? 0 : damp(t.push, state.on ? 1 : 0, 1.4, dt);
    camera.fov = fov;
    camera.aspect = base.aspect;
    camera.updateProjectionMatrix();
    t.a.subVectors(t.look, t.pos).normalize();
    camera.position
      .copy(t.pos)
      .addScaledVector(t.a, t.push * 0.45 - t.intro * 1.4)
      .add(t.b.set(t.px * 0.16, t.py * 0.09 + t.intro * 0.25, 0));
    camera.lookAt(t.look.x + t.px * 0.04, t.look.y + t.py * 0.025, t.look.z);
    // projections below (cursor, chain, type lighting) must use this frame's camera, not the last render's
    camera.updateMatrixWorld();

    /* the cursor's position on the wall, for the coordinate readout */
    t.a.set(p.x, p.y, 0.5).unproject(camera);
    t.ray.set(camera.position, t.a.sub(camera.position).normalize());
    const hit = t.ray.intersectPlane(t.wall, t.b);
    if (state.els.coords && hit && t.frame++ % 5 === 0) {
      const fmt = (v: number) => `${v < 0 ? "−" : "+"}${String(Math.abs(Math.round(v * 1000))).padStart(4, "0")}`;
      state.els.coords.textContent = `X ${fmt(hit.x)}  Y ${fmt(hit.y)}`;
    }

    /* light on the DOM type: a falloff centred on the bulb, and a shadow cast away from it */
    const name = state.els.heroName;
    if (name) {
      t.a.copy(out.filament).project(camera);
      const lx = ((t.a.x + 1) / 2) * size.width;
      const ly = ((1 - t.a.y) / 2) * size.height;
      const r = name.getBoundingClientRect();
      const gx = lx - r.left;
      const gy = ly - r.top;
      const dx = r.left + r.width / 2 - lx;
      const dy = r.top + r.height / 2 - ly;
      const len = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, out.level);
      const sx = (dx / len) * 18 * reach;
      const sy = (dy / len) * 18 * reach;
      const d = t.dom;
      if (Math.abs(d.li - reach) > 0.004 || Math.abs(d.gx - gx) > 0.5 || Math.abs(d.gy - gy) > 0.5) {
        d.li = reach;
        d.gx = gx;
        d.gy = gy;
        d.sx = sx;
        d.sy = sy;
        name.style.setProperty("--li", reach.toFixed(3));
        name.style.setProperty("--gx", `${gx.toFixed(0)}px`);
        name.style.setProperty("--gy", `${gy.toFixed(0)}px`);
        name.style.setProperty("--sx", `${sx.toFixed(1)}px`);
        name.style.setProperty("--sy", `${sy.toFixed(1)}px`);
      }
    }
  });

  return null;
}

export type StudioCanvasProps = { stateRef: RefObject<StudioState>; high: boolean; reduceMotion: boolean };

export default function StudioCanvas({ stateRef, high, reduceMotion }: StudioCanvasProps) {
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1.4));
  const sharedRef = useRef<Shared>({
    rig: { anchor: new THREE.Vector3(2, 4, 0), cordLength: 3 },
    out: { filament: new THREE.Vector3(2, 0, 0), level: 0 },
    mech: {
      p1: new THREE.Vector3(-3, 2, 0),
      p2: new THREE.Vector3(3, 2, 0),
      beamY: 2.4,
      top: 2.5,
      bottom: -2.5,
      left: -4,
      right: 4,
      narrow: false,
      scene: 0,
    },
  });

  return (
    <Canvas
      className="studio-canvas"
      aria-hidden="true"
      dpr={dpr}
      shadows={high ? "percentage" : false}
      frameloop={reduceMotion ? "demand" : "always"}
      gl={{ antialias: high, powerPreference: "high-performance" }}
      camera={{ fov: 30, near: 0.1, far: 80, position: [0, 0.3, 8] }}
      onCreated={({ gl, invalidate }) => {
        gl.toneMappingExposure = 1.05;
        stateRef.current.wake = () => invalidate();
      }}
    >
      <color attach="background" args={["#060606"]} />
      <fog attach="fog" args={["#060606", 14, 34]} />
      <PerformanceMonitor onDecline={() => setDpr(1)} />

      {/* reflections only: a soft window top-left and a warm card on the right, rendered once */}
      <Environment frames={1} resolution={64}>
        <Lightformer form="rect" intensity={1.2} position={[-5, 4, 5]} scale={[4, 6, 1]} />
        <Lightformer form="rect" intensity={0.4} position={[5, 0, 4]} scale={[1.5, 6, 1]} color="#ffd29e" />
      </Environment>
      {/* a cool, almost-nothing fill so the darkness has form */}
      <hemisphereLight args={["#27303f", "#000000", 0.22]} />
      {/* rim light from behind-left picks out the edges of brass and glass */}
      <directionalLight position={[-6, 3, -3]} intensity={0.3} color="#a9bad4" />

      <CameraRig stateRef={stateRef} sharedRef={sharedRef} />
      <CursorLight stateRef={stateRef} sharedRef={sharedRef} />
      <StudioRoom high={high} sharedRef={sharedRef} />
      <Mechanism stateRef={stateRef} sharedRef={sharedRef} high={high} />
      <Pendant stateRef={stateRef} sharedRef={sharedRef} high={high} />
    </Canvas>
  );
}
