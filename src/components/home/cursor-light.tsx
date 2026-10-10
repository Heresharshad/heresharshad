"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BulbOut } from "./pendant";
import type { StudioState } from "./studio-state";
import { FLOOR_Y, PILASTERS, WALL_Z } from "./studio-room";

/*
 * The cursor is a small, soft torch held low against the cladding, not a glow
 * on the screen. The pointer is cast into the room, onto the nearest real
 * surface, and the torch is aimed at that point from a little way off along
 * the surface, at a shallow angle. Raking light like that leaves the flat
 * faces dim and finds what stands proud of them: the eased arrises, the grain,
 * the crown of each panel. Moving, the torch trails the pointer and drops
 * lower, so a passing hand sweeps across the joints; at rest it lifts a little,
 * settles and almost disappears.
 */

/** Irradiance on a flat face at the cursor: an explorer's torch in the dark, a faint fill once the bulb is on. */
const REACH = { dark: 1.0, lit: 0.42 };
/**
 * Distance from the cursor to the torch, along the surface (metres). Far enough
 * back that the patch it throws is even, not brightest beside the torch.
 */
const SPAN = 3;
/** Height of the torch off the surface, over SPAN: about 37° at rest, 29° while sweeping. */
const RAKE = { rest: 0.75, moving: 0.55 };

const damp = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));
const dampV = (v: THREE.Vector3, to: THREE.Vector3, rate: number, dt: number) => v.lerp(to, 1 - Math.exp(-rate * dt));

function createLampState() {
  const boxes = PILASTERS.map(([x, w, d]) => new THREE.Box3(new THREE.Vector3(x - w / 2, FLOOR_Y, WALL_Z), new THREE.Vector3(x + w / 2, FLOOR_Y + 40, WALL_Z + d)));
  return {
    boxes,
    wall: new THREE.Plane(new THREE.Vector3(0, 0, 1), -WALL_Z),
    floor: new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y),
    ray: new THREE.Ray(),
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    hit: new THREE.Vector3(),
    best: new THREE.Vector3(),
    bestNormal: new THREE.Vector3(),
    last: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    dir: new THREE.Vector3(0, 1, 0),
    target: new THREE.Vector3(),
    aim: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    started: false,
    motion: 0,
    show: 0,
  };
}

/** Nearest room surface under the pointer, with its outward normal. */
function castIntoRoom(s: ReturnType<typeof createLampState>) {
  let bestD = Infinity;
  const take = (hit: THREE.Vector3 | null, nx: number, ny: number, nz: number) => {
    if (!hit) return;
    const d = hit.distanceToSquared(s.ray.origin);
    if (d < bestD) {
      bestD = d;
      s.best.copy(hit);
      s.bestNormal.set(nx, ny, nz);
    }
  };
  take(s.ray.intersectPlane(s.wall, s.hit), 0, 0, 1);
  take(s.ray.intersectPlane(s.floor, s.hit), 0, 1, 0);
  for (const box of s.boxes) {
    const hit = s.ray.intersectBox(box, s.hit);
    if (!hit) continue;
    const e = 1e-3;
    if (Math.abs(hit.z - box.max.z) < e) take(hit, 0, 0, 1);
    else if (Math.abs(hit.x - box.min.x) < e) take(hit, -1, 0, 0);
    else if (Math.abs(hit.x - box.max.x) < e) take(hit, 1, 0, 0);
  }
  return bestD < Infinity;
}

export function CursorLight({ stateRef, sharedRef }: { stateRef: RefObject<StudioState>; sharedRef: RefObject<{ out: BulbOut }> }) {
  const light = useRef<THREE.SpotLight>(null);
  const sRef = useRef<ReturnType<typeof createLampState>>(null);
  // the torch is aimed by hand every frame; its target lives outside the scene graph
  const aim = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    if (light.current) light.current.target = aim;
  }, [aim]);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.max(1e-4, Math.min(rawDt, 1 / 20));
    const state = stateRef.current;
    const p = state.pointer;
    sRef.current ??= createLampState();
    const s = sRef.current;
    const lamp = light.current;
    if (!lamp) return;

    // mouse only: on touch there is nothing to hold the torch, and the bulb carries the room
    const want = p.active && p.mouse && !state.reduceMotion ? p.light : 0;
    s.show = damp(s.show, want, want > s.show ? 5 : 2.5, dt);

    s.a.set(p.x, p.y, 0.5).unproject(camera);
    s.ray.set(camera.position, s.a.sub(camera.position).normalize());
    if (!castIntoRoom(s)) {
      lamp.intensity = 0;
      return;
    }
    const n = s.bestNormal;

    // how fast, and which way, the point under the cursor travels across the surface
    if (!s.started) s.last.copy(s.best);
    s.a.subVectors(s.best, s.last).divideScalar(dt);
    s.last.copy(s.best);
    const speed = s.a.length();
    dampV(s.vel, s.a, speed > 0.05 ? 8 : 2, dt);
    s.motion = damp(s.motion, 1 - Math.exp(-speed / 2.5), speed > 0.05 ? 6 : 1.8, dt);

    // held from above at rest (from the room side on the floor); while sweeping, from where the hand came
    s.b.set(0, 1, 0).addScaledVector(n, -n.y);
    if (s.b.lengthSq() < 0.01) s.b.set(0, 0, 1);
    s.b.normalize();
    s.a.copy(s.vel).addScaledVector(n, -s.vel.dot(n));
    const trail = Math.min(1, s.a.length() / 1.5) * s.motion;
    if (trail > 1e-3) s.b.multiplyScalar(1 - trail).addScaledVector(s.a.normalize(), -trail * 1.4);
    if (s.b.lengthSq() < 1e-4) s.b.set(0, 1, 0);
    dampV(s.dir, s.b.normalize(), 5, dt).normalize();

    const rake = RAKE.rest + (RAKE.moving - RAKE.rest) * s.motion;
    s.target.copy(s.best).addScaledVector(s.dir, SPAN).addScaledVector(n, SPAN * rake);
    if (!s.started) {
      s.pos.copy(s.target);
      s.aim.copy(s.best);
    }
    s.started = true;
    // a touch of weight: close behind the pointer, never far
    dampV(s.pos, s.target, 14, dt);
    dampV(s.aim, s.best, 16, dt);
    lamp.position.copy(s.pos);
    aim.position.copy(s.aim);
    aim.updateMatrixWorld();

    // the same irradiance on the face under the cursor whatever the angle (E = I·cosθ / d²),
    // a little more of it in motion
    s.a.subVectors(s.pos, s.aim);
    const d2 = s.a.lengthSq();
    const cos = Math.max(0.2, s.a.normalize().dot(n));
    const lit = Math.min(1, sharedRef.current.out.level);
    const reach = REACH.dark + (REACH.lit - REACH.dark) * lit;
    lamp.intensity = ((reach * d2) / cos) * (0.45 + 0.55 * s.motion) * s.show;
  });

  // a soft-edged beam: an elongated, feathered patch where it rakes, never a disc of light
  return <spotLight ref={light} color="#f2e6d6" intensity={0} decay={2} distance={9} angle={0.4} penumbra={1} />;
}
