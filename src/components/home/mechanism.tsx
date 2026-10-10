"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BUILDS, GRIP, OperatorFigure, stagehandMaterial } from "./operator-figure";
import { LiveTube } from "./pendant-physics";
import type { BulbOut, Rig } from "./pendant";
import type { StudioState } from "./studio-state";
import { braidTexture, noiseTexture, rulerTexture, tagTexture } from "./studio-textures";

/*
 * The rig that moves the bulb: two stagehands working one cross-rigged bridle,
 * built like an old drum-and-shaft fly system.
 *
 *   beam ════════════════════════════════════════════════════
 *      (D·)━━━━━━━━━━━━ left line ━━━━━━━━━━━━━━━━━━━┓
 *       │  ┏━━━━━━━━━━ right line ━━━━━━━━━━━━━━━━━━━╋━━(·D)
 *       │  ◯ S                                     S ◯   │
 *       │    ╲ right line               left line ╱      │
 *       │      ╲                                ╱        │
 *      left        ╲──────── ring ─────────╱           right
 *      stagehand              │                        stagehand
 *                            bulb
 *
 * Each stagehand hauls a hand line off the small hub of a drum D; the drum's
 * big barrel winds that stagehand's load line, which runs the length of the
 * beam to a loft sheave S in the far corner and down to the bridle ring. So
 * the left stagehand hauling draws the bulb to the RIGHT, while the right
 * stagehand's line pays out through their hands (and vice versa). The hub is
 * a sixth of the drum, so a short haul moves the bulb a long way.
 *
 * Everything is a consequence of where the ring is: line lengths turn the
 * drums and sheaves, slide the rope weave, and drive the stagehands' hands,
 * lean and grip. The bulb's light picks out whoever it is nearest.
 */

/** Screen-space layout written by the camera rig every frame (world units at z = 0). */
export type Mech = {
  /** Where the left and right hand lines drop from their hubs. */
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  beamY: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  narrow: boolean;
  /** Smoothed scene index, for the cue lights. */
  scene: number;
};

const R_DRUM = 0.19;
const R_HUB = 0.032;
const R_SHEAVE = 0.075;
/** Hand line travel per unit of load line travel. */
const RATIO = R_HUB / R_DRUM;
const ROPE_R = 0.0135;
const SAG_SAMPLES = 12;
const SHEAVE_WRAP = 6;
const RUN_POINTS = 3;
const DRUM_WRAP = 3;
const LOAD_POINTS = 1 + SAG_SAMPLES + 1 + SHEAVE_WRAP + RUN_POINTS + 1 + DRUM_WRAP;
const TAIL = 4;
const HUB_WRAP = 3;
const HAND_POINTS = TAIL + 1 + 1 + 1 + HUB_WRAP;
/** Texture repeats per world unit of rope. */
const WEAVE = 40;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const bump = (x: number, at: number) => Math.max(0, 1 - Math.abs(x - at));

/** A damped spring value: target -> velocity -> position. */
type Spring = { x: number; v: number };
const spring = (s: Spring, target: number, w: number, zeta: number, dt: number) => {
  s.v += (w * w * (target - s.x) - 2 * zeta * w * s.v) * dt;
  s.x += s.v * dt;
  return s.x;
};

/**
 * One stagehand's line. `side` is where they stand: -1 left, +1 right. Their
 * drum is on their own side; their sheave in the opposite corner.
 */
function createLine(side: -1 | 1) {
  const build = BUILDS[side < 0 ? "left" : "right"];
  return {
    side,
    build,
    drum: new THREE.Vector3(),
    sheave: new THREE.Vector3(),
    load: Array.from({ length: LOAD_POINTS }, () => new THREE.Vector3()),
    hand: Array.from({ length: HAND_POINTS }, () => new THREE.Vector3()),
    prevL: -1,
    sag: { x: 0, v: 0 },
    lean: { x: build.lean, v: 0 },
    phase: build.restPhase,
    cue: 0,
  };
}
type Line = ReturnType<typeof createLine>;

function createLive() {
  return {
    lines: [createLine(-1), createLine(1)] as const,
    view: new THREE.Vector3(),
    chest: new THREE.Vector3(),
    time: 0,
  };
}

/**
 * Writes the load line from the ring up to the sheave, over it, along the beam
 * and onto the top of the drum. Returns the length that changes as the ring
 * moves (the span to the sheave plus the wrap on it).
 */
function layLoadLine(line: Line, ring: THREE.Vector3, z: number, sag: number, g: number) {
  const { load: out, sheave: S, drum: D, side } = line;
  const rS = R_SHEAVE * g;
  const rD = R_DRUM * g;
  // the line wraps the far side of the sheave: clockwise over the right-hand one
  const wrap = -side;
  const phi = Math.atan2(ring.y - S.y, ring.x - S.x);
  const dist = Math.max(Math.hypot(ring.x - S.x, ring.y - S.y), rS * 1.05);
  let aT = phi + wrap * Math.acos(rS / dist);
  const top = Math.PI / 2;
  if (wrap > 0) {
    while (aT > top) aT -= Math.PI * 2;
    while (aT <= top - Math.PI * 2) aT += Math.PI * 2;
  } else {
    while (aT < top) aT += Math.PI * 2;
    while (aT >= top + Math.PI * 2) aT -= Math.PI * 2;
  }
  const tx = S.x + Math.cos(aT) * rS;
  const ty = S.y + Math.sin(aT) * rS;
  // a gentle catenary between ring and sheave
  const cx = (ring.x + tx) / 2;
  const cy = (ring.y + ty) / 2 - sag * 2;
  let k = 0;
  out[k++].copy(ring);
  for (let i = 1; i <= SAG_SAMPLES; i++) {
    const t = i / (SAG_SAMPLES + 1);
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    out[k++].set(a * ring.x + b * cx + c * tx, a * ring.y + b * cy + c * ty, ring.z + (z - ring.z) * Math.min(1, t * 3));
  }
  out[k++].set(tx, ty, z);
  for (let i = 1; i <= SHEAVE_WRAP; i++) {
    const a = aT + ((top - aT) * i) / SHEAVE_WRAP;
    out[k++].set(S.x + Math.cos(a) * rS, S.y + Math.sin(a) * rS, z);
  }
  // the long run along the beam, hauled nearly straight
  const y0 = S.y + rS;
  const y1 = D.y + rD;
  const runSag = 0.012 * g + sag * 0.08;
  for (let i = 1; i <= RUN_POINTS; i++) {
    const t = i / (RUN_POINTS + 1);
    out[k++].set(S.x + (D.x - S.x) * t, y0 + (y1 - y0) * t - runSag * 4 * t * (1 - t), z);
  }
  out[k++].set(D.x, y1, z);
  // and onto the barrel, wound towards the stagehand's side
  for (let i = 1; i <= DRUM_WRAP; i++) {
    const a = top - side * i * 0.45;
    out[k++].set(D.x + Math.cos(a) * rD, D.y + Math.sin(a) * rD, z);
  }
  return dist + rS * Math.abs(top - aT);
}

/** Writes the hand line from its free tail up through the fists to the hub. */
function layHandLine(line: Line, z: number, handTop: number, handLow: number, s: number, sway: number, g: number) {
  const { hand: out, drum: D, side } = line;
  const rH = R_HUB * g;
  const x = D.x + side * rH;
  let k = 0;
  // the free tail falls in front of the stagehand's boots, curling back towards them
  for (let i = TAIL; i >= 1; i--) {
    const t = i / TAIL;
    out[k++].set(x + side * 0.06 * s * t * t + sway * t, handLow - 0.6 * s * t, z);
  }
  out[k++].set(x, handLow, z);
  out[k++].set(x, handTop + 0.06 * s, z);
  out[k++].set(x, D.y, z);
  const base = side < 0 ? Math.PI : 0;
  for (let i = 1; i <= HUB_WRAP; i++) {
    const a = base + side * i * 0.5;
    out[k++].set(D.x + Math.cos(a) * rH, D.y + Math.sin(a) * rH, z);
  }
  return x;
}

function Sheave({ wheelRef, segments }: { wheelRef: (g: THREE.Group | null) => void; segments: number }) {
  return (
    <group ref={wheelRef}>
      <mesh>
        <torusGeometry args={[R_SHEAVE, 0.014, 8, segments]} />
        <meshStandardMaterial color="#2a2724" metalness={0.85} roughness={0.5} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.06, 12]} />
        <meshStandardMaterial color="#3a352f" metalness={0.9} roughness={0.4} />
      </mesh>
      {/* spokes, so the rotation reads */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} rotation={[0, 0, (i / 5) * Math.PI * 2]}>
          <boxGeometry args={[R_SHEAVE * 2 - 0.02, 0.008, 0.008]} />
          <meshStandardMaterial color="#25221f" metalness={0.8} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Drum({
  wheelRef,
  segments,
  wound,
  tag,
}: {
  wheelRef: (g: THREE.Group | null) => void;
  segments: number;
  wound: THREE.Texture;
  tag: THREE.Texture;
}) {
  return (
    <>
      {/* yoke plate and axle */}
      <mesh position={[0, 0, -0.075]}>
        <circleGeometry args={[R_DRUM + 0.05, segments]} />
        <meshStandardMaterial color="#181715" metalness={0.75} roughness={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 12]} />
        <meshStandardMaterial color="#3a352f" metalness={0.9} roughness={0.4} />
      </mesh>
      {/* the load rating tag, wired to the yoke */}
      <mesh position={[0, -R_DRUM - 0.075, -0.068]} rotation={[0, 0, 0.04]}>
        <planeGeometry args={[0.1, 0.05]} />
        <meshStandardMaterial map={tag} roughness={0.8} metalness={0.2} envMapIntensity={0.2} />
      </mesh>
      <group ref={wheelRef}>
        {/* barrel, with the load line wound on it */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R_DRUM - 0.006, R_DRUM - 0.006, 0.08, segments, 1, true]} />
          <meshStandardMaterial color="#6f624f" roughness={0.95} map={wound} bumpMap={wound} bumpScale={0.5} envMapIntensity={0.3} />
        </mesh>
        {/* flanges: iron rims on spokes, so the wound rope shows through */}
        {[-0.045, 0.045].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <torusGeometry args={[R_DRUM + 0.012, 0.013, 8, segments]} />
            <meshStandardMaterial color="#26231f" metalness={0.85} roughness={0.5} />
          </mesh>
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} position={[0, 0, 0.045]} rotation={[0, 0, (i / 6) * Math.PI * 2]}>
            <boxGeometry args={[R_DRUM * 2, 0.014, 0.01]} />
            <meshStandardMaterial color="#22201d" metalness={0.8} roughness={0.55} />
          </mesh>
        ))}
        {/* bolts where the spokes meet the rim */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh
            key={i}
            position={[Math.cos((i / 6) * Math.PI * 2) * R_DRUM * 0.9, Math.sin((i / 6) * Math.PI * 2) * R_DRUM * 0.9, 0.054]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.009, 0.009, 0.012, 6]} />
            <meshStandardMaterial color="#4a443c" metalness={0.9} roughness={0.35} />
          </mesh>
        ))}
        {/* the hub the hand line winds on, proud of the front flange */}
        <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R_HUB - 0.012, R_HUB - 0.012, 0.05, 16]} />
          <meshStandardMaterial color="#2e2a25" metalness={0.85} roughness={0.45} />
        </mesh>
        {[0.052, 0.108].map((z) => (
          <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[R_HUB + 0.02, R_HUB + 0.02, 0.007, 16]} />
            <meshStandardMaterial color="#25221f" metalness={0.85} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0.024, 0, 0.113]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.008, 6]} />
          <meshStandardMaterial color="#5a5248" metalness={0.9} roughness={0.35} />
        </mesh>
      </group>
    </>
  );
}

export function Mechanism({
  stateRef,
  sharedRef,
  high,
}: {
  stateRef: RefObject<StudioState>;
  sharedRef: RefObject<{ rig: Rig; mech: Mech; out: BulbOut }>;
  high: boolean;
}) {
  const liveRef = useRef<ReturnType<typeof createLive>>(null);
  const beam = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  // per line, [left stagehand's, right stagehand's]
  const drumMounts = useRef<(THREE.Group | null)[]>([]);
  const drumStraps = useRef<(THREE.Mesh | null)[]>([]);
  const drums = useRef<(THREE.Group | null)[]>([]);
  const sheaveMounts = useRef<(THREE.Group | null)[]>([]);
  const sheaveStraps = useRef<(THREE.Mesh | null)[]>([]);
  const sheaves = useRef<(THREE.Group | null)[]>([]);
  const stations = useRef<(THREE.Group | null)[]>([]);
  const cueLights = useRef<(THREE.PointLight | null)[]>([]);
  const cueLamps = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const res = useMemo(() => {
    const hemp = (offset: number) => {
      const t = braidTexture();
      t.offset.x = offset;
      return t;
    };
    const wound = braidTexture();
    wound.repeat.set(30, 5);
    const ruler = rulerTexture();
    ruler.repeat.set(10, 1);
    const looks = [stagehandMaterial(), stagehandMaterial()];
    return {
      lines: [0, 1].map((i) => ({
        load: new LiveTube(LOAD_POINTS, 1, 6, ROPE_R),
        hand: new LiveTube(HAND_POINTS, 1, 6, ROPE_R),
        loadWeave: hemp(i * 0.5),
        handWeave: hemp(0.25 + i * 0.5),
      })),
      wound,
      ruler,
      tag: tagTexture(),
      noise: noiseTexture(64, 1),
      looks,
      figures: [
        new OperatorFigure(looks[0].material, BUILDS.left, high ? 8 : 5, high),
        new OperatorFigure(looks[1].material, BUILDS.right, high ? 8 : 5, high),
      ],
    };
  }, [high]);

  useEffect(
    () => () => {
      for (const l of res.lines) {
        l.load.dispose();
        l.hand.dispose();
        l.loadWeave.dispose();
        l.handWeave.dispose();
      }
      res.wound.dispose();
      res.ruler.dispose();
      res.tag.dispose();
      res.noise.dispose();
      res.looks.forEach((l) => l.material.dispose());
      res.figures.forEach((f) => f.dispose());
    },
    [res],
  );

  useFrame(({ camera }, rawDt) => {
    const dt = Math.max(1e-4, Math.min(rawDt, 1 / 20));
    const state = stateRef.current;
    const { rig, mech, out } = sharedRef.current;
    liveRef.current ??= createLive();
    const live = liveRef.current;
    const rm = state.reduceMotion;
    const J = rig.anchor;
    const vh = mech.top - mech.bottom;
    const W = mech.right - mech.left;
    const g = mech.narrow ? 0.7 : 1;
    live.time += dt;

    if (beam.current) beam.current.position.set((mech.left + mech.right) / 2, mech.beamY, -0.12);
    if (ring.current) ring.current.position.copy(J);

    // the stagehands fit the margins outside the text column
    const s = mech.narrow ? vh * 0.05 : Math.min(vh * 0.115, W * 0.075);
    // the cue light finds whoever just hauled: the side the content is on
    const sc = mech.scene;
    const lit = smooth(0.3, 1.1, sc);
    const cueFor = [Math.max(bump(sc, 2), bump(sc, 4)) * lit, Math.max(bump(sc, 3), bump(sc, 5)) * lit];

    live.lines.forEach((line, i) => {
      const { side } = line;
      const near = side < 0 ? mech.p1 : mech.p2;
      const far = side < 0 ? mech.p2 : mech.p1;
      // the two lines run along the beam at different heights, so they never foul
      const z = side < 0 ? 0.05 : -0.05;
      // the hub sits over the hand line; the loft sheave is just inboard of the other stagehand's drum
      line.drum.set(near.x - side * R_HUB * g, near.y + (side < 0 ? 0.1 : -0.135) * g, z);
      line.sheave.set(far.x + side * (R_DRUM + R_SHEAVE + 0.1) * g, far.y + (side < 0 ? 0.215 : -0.02) * g, z);

      for (const [mount, strap, p] of [
        [drumMounts.current[i], drumStraps.current[i], line.drum],
        [sheaveMounts.current[i], sheaveStraps.current[i], line.sheave],
      ] as const) {
        if (!mount || !strap) continue;
        mount.position.copy(p);
        mount.scale.setScalar(g);
        const h = Math.max(0.05, (mech.beamY - p.y) / g);
        strap.scale.y = h;
        strap.position.y = h / 2;
      }

      /* ---- the line length drives everything ---- */
      const L = layLoadLine(line, J, z, 0, g);
      const dL = line.prevL < 0 || rm ? 0 : L - line.prevL;
      line.prevL = L;
      // hauling winds the barrel: the left drum turns anticlockwise, the right clockwise
      const drum = drums.current[i];
      if (drum) drum.rotation.z += (side * dL) / (R_DRUM * g);
      const sheave = sheaves.current[i];
      if (sheave) sheave.rotation.z += (side * dL) / (R_SHEAVE * g);
      const tube = res.lines[i];
      tube.loadWeave.offset.x += dL * WEAVE;
      // a line being hauled in runs taut; a line paying out goes slack, then settles
      const v = dL / dt;
      if (!rm) spring(line.sag, L * clamp(0.025 + v * 0.012, 0.006, 0.07), 7, 0.32, dt);
      layLoadLine(line, J, z, rm ? L * 0.025 : Math.max(0, line.sag.x), g);
      tube.load.update(line.load);
      tube.loadWeave.repeat.x = tube.load.length * WEAVE;

      /* ---- the stagehand ---- */
      const haul = -dL * RATIO; // hand line drawn down through the fists this frame
      const handZ = z + 0.08 * g;
      const feetY = mech.narrow ? near.y - (side < 0 ? 0.2 : 0.19) * vh : mech.top - (side < 0 ? 0.68 : 0.655) * vh;
      const handTop = feetY + GRIP.top * s;
      const handLow = handTop - GRIP.stroke * s;
      const sway = rm ? 0 : Math.sin(live.time * (side < 0 ? 1.7 : 1.4) + i) * 0.012 * s;
      const ropeX = layHandLine(line, handZ, handTop, handLow, s, sway, g);
      tube.hand.update(line.hand);
      tube.handWeave.offset.x += haul * WEAVE;
      tube.handWeave.repeat.x = tube.hand.length * WEAVE;

      // hand over hand: one stroke of rope per half cycle of each hand
      line.phase += haul / (GRIP.stroke * s);
      const speed = haul / dt / s; // metres a second, in the stagehand's own units
      if (Math.abs(speed) < 0.1 && !rm) {
        // at rest the hands settle into their two-handed grip
        const f = line.phase - Math.floor(line.phase);
        const d = line.build.restPhase - f;
        line.phase += (Math.abs(d) < 0.5 ? d : d - Math.sign(d)) * Math.min(1, dt * 1.5);
      }
      // hauling leans the body back a few degrees; paying out, the line tugs them forward
      const rest = line.build.lean;
      const lean = rm ? rest : spring(line.lean, rest + clamp(speed * 0.1, -0.06, 0.08), 5, 0.55, dt);
      const fig = res.figures[i];
      fig.update({
        lean,
        leanVel: rm ? 0 : line.lean.v,
        phase: rm ? line.build.restPhase : line.phase,
        time: rm ? 0 : live.time,
        dt,
      });
      const station = stations.current[i];
      if (station) {
        // the right-hand stagehand faces left: mirrored, so the near arm stays near
        station.position.set(ropeX + side * GRIP.x * s, feetY, handZ);
        station.scale.set(-side * s, s, s);
      }

      /* ---- light: a warm edge from the bulb when it comes their way, a cool cue from behind ---- */
      live.chest.set(ropeX + side * GRIP.x * s, feetY + 1.3 * s, handZ);
      const reach = 0.32 * W;
      const prox = 1 / (1 + (live.chest.distanceTo(out.filament) / reach) ** 4);
      const look = res.looks[i];
      look.uniforms.uRim.value = 0.16 * Math.min(1, out.level) * prox;
      look.uniforms.uBulb.value.copy(out.filament).applyMatrix4(camera.matrixWorldInverse);

      line.cue = rm ? cueFor[i] : line.cue + (cueFor[i] - line.cue) * Math.min(1, dt * 2);
      const cue = cueLights.current[i];
      if (cue) {
        // between the stagehand and the wall: a cool pool on the wall, the figure in silhouette against it
        cue.intensity = line.cue * (mech.narrow ? 1.2 : 3.2);
        cue.position.set(ropeX + side * (GRIP.x + 0.05) * s, feetY + 1.5 * s, -2.5);
      }
      const lamp = cueLamps.current[i];
      if (lamp) lamp.emissiveIntensity = 0.15 + line.cue * 1.2;
    });
  });

  const segments = high ? 40 : 24;

  return (
    <>
      {/* ceiling: a dark steel I-beam, with a ruler strip along its underside */}
      <group ref={beam}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[40, 0.025, 0.22]} />
          <meshStandardMaterial color="#1a1918" metalness={0.7} roughness={0.6} roughnessMap={res.noise} />
        </mesh>
        <mesh>
          <boxGeometry args={[40, 0.14, 0.03]} />
          <meshStandardMaterial color="#151413" metalness={0.7} roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.07, 0]}>
          <boxGeometry args={[40, 0.025, 0.22]} />
          <meshStandardMaterial color="#1c1a19" metalness={0.7} roughness={0.55} roughnessMap={res.noise} />
        </mesh>
        <mesh position={[0, -0.0, 0.0155]}>
          <planeGeometry args={[40, 0.03]} />
          <meshStandardMaterial color="#5a5045" transparent alphaMap={res.ruler} depthWrite={false} roughness={1} envMapIntensity={0} />
        </mesh>
      </group>

      {[0, 1].map((i) => (
        <group key={i}>
          {/* the stagehand's drum: strap up to the beam, barrel and hub on one shaft */}
          <group ref={(el) => void (drumMounts.current[i] = el)}>
            <mesh ref={(el) => void (drumStraps.current[i] = el)} position={[0, 0, -0.08]}>
              <boxGeometry args={[0.045, 1, 0.014]} />
              <meshStandardMaterial color="#201e1c" metalness={0.8} roughness={0.5} />
            </mesh>
            <Drum wheelRef={(el) => void (drums.current[i] = el)} segments={segments} wound={res.wound} tag={res.tag} />
          </group>

          {/* the loft sheave in the far corner */}
          <group ref={(el) => void (sheaveMounts.current[i] = el)}>
            <mesh ref={(el) => void (sheaveStraps.current[i] = el)} position={[0, 0, -0.035]}>
              <boxGeometry args={[0.035, 1, 0.012]} />
              <meshStandardMaterial color="#201e1c" metalness={0.8} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0, -0.03]}>
              <circleGeometry args={[R_SHEAVE + 0.025, 24]} />
              <meshStandardMaterial color="#1b1a18" metalness={0.75} roughness={0.55} />
            </mesh>
            <Sheave wheelRef={(el) => void (sheaves.current[i] = el)} segments={segments} />
          </group>

          <mesh geometry={res.lines[i].load.geometry} frustumCulled={false} castShadow={high}>
            <meshStandardMaterial color="#8a7a63" roughness={0.95} map={res.lines[i].loadWeave} bumpMap={res.lines[i].loadWeave} bumpScale={0.4} envMapIntensity={0.3} />
          </mesh>
          <mesh geometry={res.lines[i].hand.geometry} frustumCulled={false} castShadow={high}>
            <meshStandardMaterial color="#8a7a63" roughness={0.95} map={res.lines[i].handWeave} bumpMap={res.lines[i].handWeave} bumpScale={0.4} envMapIntensity={0.3} />
          </mesh>

          {/* the stagehand's station, in figure units: the figure, a gallery ledge, the cue lamp */}
          <group ref={(el) => void (stations.current[i] = el)}>
            <primitive object={res.figures[i].group} />
            {/* the gallery ledge the stagehand braces on */}
            <mesh position={[-0.85, -0.035, -0.1]} receiveShadow>
              <boxGeometry args={[2.7, 0.07, 0.8]} />
              <meshStandardMaterial color="#151413" metalness={0.55} roughness={0.65} />
            </mesh>
            {/* a cleat on the ledge edge, for tying off */}
            <mesh position={[0.42, 0.01, 0.25]}>
              <boxGeometry args={[0.12, 0.025, 0.03]} />
              <meshStandardMaterial color="#2a2724" metalness={0.8} roughness={0.45} />
            </mesh>
            <mesh position={[-0.42, 1.08, -0.3]}>
              <cylinderGeometry args={[0.012, 0.012, 2.16, 6]} />
              <meshStandardMaterial color="#1a1918" metalness={0.7} roughness={0.5} />
            </mesh>
            {/* cue lamp: a small hooded lamp on a post behind the stagehand */}
            <mesh position={[-0.4, 2.2, -0.3]} rotation={[0, 0, -0.5]}>
              <cylinderGeometry args={[0.02, 0.045, 0.06, 12, 1, true]} />
              <meshStandardMaterial color="#141312" metalness={0.6} roughness={0.5} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[-0.39, 2.185, -0.3]}>
              <sphereGeometry args={[0.016, 8, 6]} />
              <meshStandardMaterial ref={(el) => void (cueLamps.current[i] = el)} color="#0c1220" emissive="#5d86ff" emissiveIntensity={0.3} />
            </mesh>
          </group>
          <pointLight ref={(el) => void (cueLights.current[i] = el)} color="#7e9de0" intensity={0} decay={2} distance={0} />
        </group>
      ))}

      {/* bridle ring where both load lines meet the bulb's cord */}
      <mesh ref={ring}>
        <torusGeometry args={[0.03, 0.007, 8, 20]} />
        <meshStandardMaterial color="#3a342d" metalness={0.9} roughness={0.4} />
      </mesh>
    </>
  );
}
