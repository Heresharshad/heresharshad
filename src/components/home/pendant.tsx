"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  CHAIN_LENGTH,
  CHAIN_SEGMENTS,
  CORD_SEGMENTS,
  KNOB,
  LiveTube,
  PendantSim,
} from "./pendant-physics";
import type { StudioState } from "./studio-state";
import { braidTexture, glowTexture, noiseTexture } from "./studio-textures";

/** Where the ceiling rail holds the cord, and how much cord is let out. Written by the camera rig. */
export type Rig = { anchor: THREE.Vector3; cordLength: number };
/** What the rest of the page needs to know about the bulb, written every frame. */
export type BulbOut = { filament: THREE.Vector3; level: number };

const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
/** Distance from the socket top to the middle of the filament. */
const FILAMENT_AT = 0.77;
/** A switched-off filament still holds a faint ember, so the bulb reads in the dark. */
const EMBER = 0.035;
/** Warm-up: the filament catches, stutters, then settles. [ms, level] */
const WARM: [number, number][] = [[0, 0], [90, 0.5], [170, 0.18], [300, 0.85], [390, 0.62], [640, 1]];

function warm(ms: number) {
  for (let i = 1; i < WARM.length; i++) {
    if (ms <= WARM[i][0]) {
      const [t0, v0] = WARM[i - 1];
      const [t1, v1] = WARM[i];
      return v0 + (v1 - v0) * ((ms - t0) / (t1 - t0));
    }
  }
  return 1;
}

/* ---- geometry, built once ---- */

function lathe(profile: [number, number][], segments: number, smooth = 0) {
  let pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  if (smooth) pts = new THREE.SplineCurve(pts).getPoints(smooth).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(pts, segments);
}

function socketGeometry() {
  const p: [number, number][] = [[0.0, -0.07], [0.05, -0.075], [0.074, -0.095], [0.085, -0.12]];
  // knurled rings on the shell
  for (let y = -0.14; y > -0.37; y -= 0.032) p.push([0.086, y], [0.08, y - 0.012], [0.086, y - 0.022]);
  p.push([0.088, -0.385], [0.097, -0.4], [0.097, -0.44], [0.072, -0.448], [0.06, -0.452], [0, -0.452]);
  return lathe(p, 56);
}

function glassGeometry(segments: number) {
  return lathe(
    [
      [0.062, -0.44], [0.064, -0.5], [0.077, -0.565], [0.112, -0.632], [0.16, -0.71], [0.195, -0.8],
      [0.205, -0.862], [0.195, -0.93], [0.158, -0.986], [0.098, -1.012], [0.03, -1.02], [0.001, -1.021],
    ],
    segments,
    72,
  );
}

/** Edison-style "squirrel cage" filament. */
function filamentGeometry() {
  const pts: THREE.Vector3[] = [];
  const loops = 16;
  for (let k = 0; k < loops; k++) {
    const a = (k / loops) * Math.PI * 2;
    const bottom = k % 2 === 1;
    const r = bottom ? 0.068 : 0.046;
    pts.push(new THREE.Vector3(Math.cos(a) * r, bottom ? -0.875 : -0.665, Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, "centripetal", 0.2), 220, 0.0042, 5, true);
}

type PendantProps = {
  stateRef: RefObject<StudioState>;
  sharedRef: RefObject<{ rig: Rig; out: BulbOut }>;
  high: boolean;
};

/** Per-frame working state: the simulation, scratch vectors and the light's thermal state. */
function createLive(rig: Rig) {
  return {
    sim: new PendantSim(rig.anchor, rig.cordLength),
    cordPts: Array.from({ length: CORD_SEGMENTS + 1 }, () => new THREE.Vector3()),
    v: { s: new THREE.Vector3(), b: new THREE.Vector3(), axis: new THREE.Vector3(), eyelet: new THREE.Vector3(), a: new THREE.Vector3(), c: new THREE.Vector3() },
    m: new THREE.Matrix4(),
    ray: new THREE.Raycaster(),
    plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    ndc: new THREE.Vector2(),
    level: 0,
    heat: 0,
    fresh: true,
  };
}

export function Pendant({ stateRef, sharedRef, high }: PendantProps) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const bulb = useRef<THREE.Group>(null);
  const beads = useRef<THREE.InstancedMesh>(null);
  const knob = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const glare = useRef<THREE.Sprite>(null);
  const haze = useRef<THREE.Sprite>(null);
  const glass = useRef<THREE.MeshPhysicalMaterial>(null);
  const filament = useRef<THREE.MeshBasicMaterial>(null);
  const liveRef = useRef<ReturnType<typeof createLive>>(null);

  const res = useMemo(() => {
    const braid = braidTexture();
    braid.repeat.set(90, 1);
    return {
      cord: new LiveTube(CORD_SEGMENTS + 1, 2, 7, 0.019),
      socket: socketGeometry(),
      glass: glassGeometry(high ? 72 : 40),
      filament: filamentGeometry(),
      braid,
      noise: noiseTexture(128, 2),
      glow: glowTexture(),
    };
  }, [high]);

  useEffect(
    () => () => {
      res.cord.dispose();
      res.socket.dispose();
      res.glass.dispose();
      res.filament.dispose();
      res.braid.dispose();
      res.noise.dispose();
      res.glow.dispose();
    },
    [res],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const state = stateRef.current;
    const { rig, out } = sharedRef.current;
    liveRef.current ??= createLive(rig);
    const live = liveRef.current;
    const { sim, v } = live;
    const now = performance.now();

    /* ---- physics ---- */
    sim.setCordLength(rig.cordLength);
    if (state.reduceMotion || live.fresh) {
      live.fresh = false;
      sim.hangStraight(rig.anchor, rig.cordLength);
    } else {
      sim.frame(v.axis, v.eyelet);
      live.plane.constant = -rig.anchor.z;
      if (state.drag) {
        live.ray.setFromCamera(live.ndc.set(state.drag.x, state.drag.y), camera);
        const hit = live.ray.ray.intersectPlane(live.plane, v.a);
        if (hit) {
          // the chain only gives so much before it pulls the bulb with it
          const d = v.c.copy(hit).sub(v.eyelet);
          const max = CHAIN_LENGTH + 0.42;
          if (d.length() > max) d.setLength(max);
          sim.pull = (sim.pull ?? new THREE.Vector3()).copy(v.eyelet).add(d);
        }
      } else if (now - state.tugAt < 150) {
        sim.pull = (sim.pull ?? new THREE.Vector3()).copy(v.eyelet).add(v.c.set(0.02, -(CHAIN_LENGTH + 0.24), 0));
      } else {
        sim.pull = null;
      }

      // reaching for the chain calms the pendant, so the knob stays under the hand
      sim.step(dt, rig.anchor, state.chainHover || !!state.drag);
    }

    /* ---- pose ---- */
    sim.get(CORD_SEGMENTS, v.s);
    sim.get(CORD_SEGMENTS + 1, v.b);
    v.axis.subVectors(v.b, v.s).normalize();
    if (bulb.current) {
      bulb.current.position.copy(v.s);
      bulb.current.quaternion.setFromUnitVectors(DOWN, v.axis);
    }
    for (let i = 0; i <= CORD_SEGMENTS; i++) sim.get(i, live.cordPts[i]);
    // tuck the end of the cord into the socket grip
    live.cordPts[CORD_SEGMENTS].addScaledVector(v.axis, 0.03);
    res.cord.update(live.cordPts);

    const inst = beads.current;
    if (inst) {
      const first = KNOB - CHAIN_SEGMENTS;
      for (let i = first; i < KNOB; i++) {
        sim.get(i, v.a);
        live.m.makeTranslation(v.a.x, v.a.y, v.a.z);
        inst.setMatrixAt(i - first, live.m);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
    // the knob hangs just below the last bead, along the chain
    sim.get(KNOB, v.a);
    sim.get(KNOB - 1, v.c);
    v.c.sub(v.a).normalize();
    v.a.addScaledVector(v.c, -0.05);
    if (knob.current) {
      knob.current.position.copy(v.a);
      knob.current.quaternion.setFromUnitVectors(UP, v.c);
    }

    // the DOM button that is the real (accessible, draggable) chain follows the knob
    const chainEl = state.els.chain;
    if (chainEl) {
      v.c.copy(v.a).project(camera);
      const x = ((v.c.x + 1) / 2) * size.width;
      const y = ((1 - v.c.y) / 2) * size.height;
      chainEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (!chainEl.hasAttribute("data-ready")) chainEl.setAttribute("data-ready", "");
    }

    /* ---- light ---- */
    out.filament.copy(v.s).addScaledVector(v.axis, FILAMENT_AT);
    const p = state.pointer;
    out.filament.project(camera);
    const aspect = size.width / size.height;
    const prox = p.active ? Math.exp(-(((p.x - out.filament.x) * aspect) ** 2 + (p.y - out.filament.y) ** 2) / 0.12) : 0;
    out.filament.copy(v.s).addScaledVector(v.axis, FILAMENT_AT);

    const since = now - state.switchedAt;
    let level: number;
    if (state.on) {
      const base = state.reduceMotion ? 1 : warm(since);
      const hum = state.reduceMotion ? 1 : 1 + Math.sin(now / 410) * 0.012 + Math.sin(now / 97) * 0.006;
      level = (base + prox * 0.06) * hum;
    } else {
      const target = EMBER + prox * 0.09;
      level = state.reduceMotion ? target : Math.max(target, live.level - dt / 0.16);
    }
    live.level = level;
    // tungsten cools far slower than the current drops
    const tau = level > live.heat ? 0.05 : 0.45;
    live.heat += (level - live.heat) * (state.reduceMotion ? 1 : 1 - Math.exp(-dt / tau));
    out.level = level;
    const h = live.heat;

    if (light.current) {
      light.current.position.copy(out.filament);
      light.current.intensity = level * 22;
    }
    if (filament.current) {
      filament.current.color.setRGB(1, 0.38 + 0.42 * h, 0.1 + 0.38 * h * h).multiplyScalar(0.06 + 11 * h * h);
    }
    if (glass.current) glass.current.emissiveIntensity = h * 0.1;
    if (glare.current) {
      glare.current.position.copy(out.filament);
      glare.current.material.opacity = Math.min(1, h * 0.85);
      glare.current.scale.setScalar(0.75 + h * 0.35);
    }
    if (haze.current) {
      haze.current.position.copy(out.filament);
      haze.current.material.opacity = h * 0.32;
    }
  });

  return (
    <>
      <pointLight
        ref={light}
        color="#ffb36b"
        intensity={0}
        decay={2}
        distance={0}
        castShadow={high}
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.002}
        shadow-normalBias={0.02}
        shadow-camera-near={0.04}
        shadow-camera-far={40}
      />

      <mesh geometry={res.cord.geometry} frustumCulled={false} castShadow={high}>
        <meshStandardMaterial color="#3a3530" roughness={0.93} map={res.braid} bumpMap={res.braid} bumpScale={0.5} />
      </mesh>

      <group ref={bulb}>
        {/* bakelite cord grip */}
        <mesh position={[0, -0.04, 0]} castShadow={high}>
          <cylinderGeometry args={[0.032, 0.036, 0.08, 24]} />
          <meshStandardMaterial color="#141210" roughness={0.42} />
        </mesh>
        {/* aged brass socket */}
        <mesh geometry={res.socket} castShadow={high}>
          <meshStandardMaterial color="#a8854f" metalness={1} roughness={0.34} roughnessMap={res.noise} envMapIntensity={1.15} />
        </mesh>
        {/* eyelet the chain hangs from */}
        <mesh position={[0.1, -0.36, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.014, 0.0045, 6, 16]} />
          <meshStandardMaterial color="#a8854f" metalness={1} roughness={0.35} />
        </mesh>

        {/* glass */}
        <mesh geometry={res.glass} renderOrder={2}>
          {high ? (
            <meshPhysicalMaterial
              ref={glass}
              transmission={1}
              thickness={0.04}
              roughness={0.06}
              ior={1.5}
              attenuationColor="#fff0dc"
              attenuationDistance={0.8}
              envMapIntensity={1.3}
              emissive="#ffae57"
              emissiveIntensity={0}
              roughnessMap={res.noise}
            />
          ) : (
            <meshPhysicalMaterial
              ref={glass}
              transparent
              opacity={0.2}
              roughness={0.05}
              clearcoat={1}
              envMapIntensity={1.6}
              emissive="#ffae57"
              emissiveIntensity={0}
              depthWrite={false}
            />
          )}
        </mesh>

        {/* glass stem, support rod and filament */}
        <mesh position={[0, -0.545, 0]}>
          <cylinderGeometry args={[0.009, 0.014, 0.19, 10]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.22} roughness={0.1} depthWrite={false} />
        </mesh>
        <mesh position={[0, -0.77, 0]}>
          <cylinderGeometry args={[0.0022, 0.0022, 0.24, 5]} />
          <meshStandardMaterial color="#6a625a" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh geometry={res.filament}>
          <meshBasicMaterial ref={filament} color="#000" />
        </mesh>
      </group>

      {/* pull chain */}
      <instancedMesh ref={beads} args={[undefined, undefined, CHAIN_SEGMENTS]} frustumCulled={false} castShadow={high}>
        <sphereGeometry args={[0.0135, 10, 8]} />
        <meshStandardMaterial color="#b18f5a" metalness={1} roughness={0.28} envMapIntensity={1.3} />
      </instancedMesh>
      <mesh ref={knob} castShadow={high}>
        <capsuleGeometry args={[0.024, 0.07, 6, 16]} />
        <meshStandardMaterial color="#b18f5a" metalness={1} roughness={0.24} roughnessMap={res.noise} envMapIntensity={1.4} />
      </mesh>

      {/* glare and haze around the filament: cheaper and more controllable than a bloom pass */}
      <sprite ref={haze} scale={[6.5, 6.5, 1]} renderOrder={3}>
        <spriteMaterial map={res.glow} color="#ff9f4a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite ref={glare} renderOrder={4}>
        <spriteMaterial map={res.glow} color="#ffd29a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </>
  );
}
