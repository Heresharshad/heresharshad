"use client";

import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { CameraPath } from "./camera-path";
import { rooms } from "./registry";
import { useWorld, world, type ActiveTransition } from "./store";
import type { EnvironmentId, EnvironmentProps } from "./types";

const damp = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

/** Every room's scene as a lazy component, created once; nothing loads until a room is mounted. */
const scenes: Partial<Record<EnvironmentId, ComponentType<EnvironmentProps>>> = Object.fromEntries(
  Object.values(rooms).map((r) => [r.id, lazy(r.load)]),
);

/** Mounts one room's scene and reports when it is ready; forgets it on unmount. */
function RoomMount({ id, high }: { id: EnvironmentId; high: boolean }) {
  const Scene = scenes[id];
  useEffect(
    () => () => {
      world.set((w) => ({ ready: w.ready.filter((r) => r !== id) }));
    },
    [id],
  );
  if (!Scene) return null;
  return <Scene id={id} high={high} onReady={() => world.set((w) => (w.ready.includes(id) ? {} : { ready: [...w.ready, id] }))} />;
}

/**
 * The camera has one owner at a time: the transition path while a journey
 * runs, the active room's rest pose (with a little hand-held drift) otherwise,
 * or the room itself when it drives its own camera (the scroll-led studio).
 */
function WorldCamera() {
  const ref = useRef<{ path: CameraPath | null; for: ActiveTransition | null; px: number; py: number; intro: number; a: THREE.Vector3; b: THREE.Vector3; last: EnvironmentId | null }>(null);
  useFrame(({ camera, size }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = world.get();
    const cam = camera as THREE.PerspectiveCamera;
    ref.current ??= { path: null, for: null, px: 0, py: 0, intro: 1, a: new THREE.Vector3(), b: new THREE.Vector3(), last: null };
    const r = ref.current;

    if (s.transition && s.cameraLocked) {
      if (r.for !== s.transition) {
        r.for = s.transition;
        const { path, narrow: nPath } = s.transition.to.entry!;
        const narrow = size.width / size.height < 0.85 && size.width < 900;
        r.path = new CameraPath(s.transition.start, narrow && nPath ? nPath.path : path);
      }
      r.path!.apply(s.transition.progress.travel, cam);
      // arrive settled: no intro drift and no parallax offset to jump to when the path hands over
      r.intro = 0;
      r.px = 0;
      r.py = 0;
      r.last = s.transition.to.id;
      return;
    }
    const room = s.active && rooms[s.active];
    if (!room || room.camera === "self") return;

    const narrow = size.width / size.height < 0.85 && size.width < 900;
    const rest = room.camera.rest({ aspect: size.width / size.height, narrow });
    if (r.last !== room.id) {
      // arriving directly: start a touch further back and drift in
      r.last = room.id;
      r.intro = s.reduceMotion ? 0 : 1;
    }
    const p = s.pointer;
    const rm = s.reduceMotion;
    r.px = rm ? 0 : damp(r.px, p.active ? p.x : 0, 1.4, dt);
    r.py = rm ? 0 : damp(r.py, p.active ? p.y : 0, 1.4, dt);
    r.intro = damp(r.intro, 0, 0.8, dt);
    r.a.set(...rest.look).sub(r.b.set(...rest.pos)).normalize();
    cam.position.set(...rest.pos).addScaledVector(r.a, -r.intro * 1.2).add(r.b.set(r.px * 0.14, r.py * 0.08 + r.intro * 0.1, 0));
    cam.lookAt(rest.look[0] + r.px * 0.05, rest.look[1] + r.py * 0.03, rest.look[2]);
    if (cam.fov !== rest.fov) {
      cam.fov = rest.fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
  });
  return null;
}

/** Keeps the demand loop awake while a room is still settling in. */
function Wake({ reduceMotion }: { reduceMotion: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const mounted = useWorld((s) => s.mounted.length);
  const ready = useWorld((s) => s.ready.length);
  useEffect(() => {
    if (reduceMotion && mounted) invalidate();
  }, [reduceMotion, mounted, ready, invalidate]);
  return null;
}

/**
 * Draws the frame, but only once the room on screen has compiled: a room
 * still compiling would otherwise compile on its first draw, synchronously,
 * freezing the main thread for a second or more. Until then the canvas keeps
 * whatever it last showed (nothing, on a first visit). Journeys are left
 * alone: the source room is drawn while the destination compiles. The first
 * complete frame is reported once, for the first visit's loader.
 */
function Present() {
  useFrame(({ gl, scene, camera }) => {
    const s = world.get();
    const ready = !s.active || s.ready.includes(s.active);
    if (!ready && !s.transition) return;
    gl.render(scene, camera);
    if (ready && s.active && !s.firstFrame) world.set({ firstFrame: true });
  }, 1);
  return null;
}

export default function WorldCanvas({ high, reduceMotion }: { high: boolean; reduceMotion: boolean }) {
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1.4));
  const mounted = useWorld((s) => s.mounted);
  const idle = mounted.length === 0;
  const gl = useMemo(() => ({ antialias: high, powerPreference: "high-performance" as const }), [high]);

  return (
    <Canvas
      className="world-canvas"
      aria-hidden="true"
      dpr={dpr}
      shadows={high ? "percentage" : false}
      frameloop={reduceMotion || idle ? "demand" : "always"}
      gl={gl}
      camera={{ fov: 30, near: 0.1, far: 80, position: [0, 0.3, 8] }}
      onCreated={({ gl: renderer, invalidate, camera }) => {
        renderer.toneMappingExposure = 1.05;
        world.set({ camera: camera as THREE.PerspectiveCamera, invalidate });
        world.get().studio.wake = invalidate;
      }}
    >
      <color attach="background" args={["#060606"]} />
      <fog attach="fog" args={["#060606", 14, 34]} />
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      {/* the building's base light, shared by every room so nothing pops when a room is disposed:
          reflections only (a soft window top-left, a warm card right), a cool almost-nothing fill, a rim from behind-left */}
      <Environment frames={1} resolution={64}>
        <Lightformer form="rect" intensity={1.2} position={[-5, 4, 5]} scale={[4, 6, 1]} />
        <Lightformer form="rect" intensity={0.4} position={[5, 0, 4]} scale={[1.5, 6, 1]} color="#ffd29e" />
      </Environment>
      <hemisphereLight args={["#27303f", "#000000", 0.22]} />
      <directionalLight position={[-6, 3, -3]} intensity={0.3} color="#a9bad4" />
      <Wake reduceMotion={reduceMotion} />
      <Present />
      {/* one boundary per room: a room loading must never unmount the one you are standing in */}
      {mounted.map((id) => (
        <Suspense key={id} fallback={null}>
          <RoomMount id={id} high={high} />
        </Suspense>
      ))}
      <WorldCamera />
    </Canvas>
  );
}
