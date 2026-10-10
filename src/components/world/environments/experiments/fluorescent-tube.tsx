"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { glowTexture, noiseTexture } from "@/components/home/studio-textures";
import { ROOM, TUBE } from "./config";

/*
 * The batten on the far wall: a slim blackened-steel channel held off the
 * concrete on two standoffs (a line of shadow behind it), the tube between
 * two lampholders, a conduit dropping to a small box at the plinth. Its light
 * is a rect area light the size of the tube, one soft point light in front to
 * carry falloff onto floor and ceiling, and a stretched glow in place of bloom.
 * The room decides the level; this only shows it.
 */

/** A blue tube: the glass a pale ice blue where it is brightest, the light it throws a deeper cobalt. */
const TUBE_COLOR = "#7fb6ff";
const HALO_COLOR = "#3f86ff";

/** Full-level intensities. */
const RECT_INTENSITY = 150;
/** Two small sources along the tube, close to the wall: the pool the lamp itself throws around the fitting. */
const POINT_INTENSITY = 16;
const GLASS_EMISSIVE = 6;
const HALO_OPACITY = 0.16;
const CORE_OPACITY = 0.4;

const WALL = ROOM.z[1];
/** Tube radius (a T8 at the room's scale) and the glass between the ferrules. */
const R = 0.031;
const FERRULE = 0.06;
const GLASS_LENGTH = TUBE.length - FERRULE * 2;
/** The housing stands this far off the wall. */
const STANDOFF = 0.06;
const CHANNEL_D = 0.05;

/**
 * The starter's strike, in fractions of the tube's share of the lights ramp.
 * Darkness; a first strike that dies at once; a longer sputter that shows the
 * wall and goes; a catch that sags; then it holds. Scripted, so it plays the
 * same way every time and never flashes for long.
 */
const STARTER: [number, number][] = [
  [0, 0],
  [0.1, 0],
  [0.13, 0.55],
  [0.2, 0.04],
  [0.3, 0.0],
  [0.33, 0.75],
  [0.38, 0.3],
  [0.42, 0.06],
  [0.52, 0.04],
  [0.55, 0.96],
  [0.62, 0.78],
  [0.72, 0.95],
  [1, 1],
];

/** The tube's level (0..1) for the room's lights value: it is the first thing that happens. */
export function tubeLevel(lights: number, reduceMotion: boolean) {
  const u = Math.min(1, Math.max(0, (lights - 0.05) / 0.7));
  if (reduceMotion) return u * u * (3 - 2 * u);
  for (let i = 1; i < STARTER.length; i++) {
    if (u <= STARTER[i][0]) {
      const [t0, v0] = STARTER[i - 1];
      const [t1, v1] = STARTER[i];
      return v0 + (v1 - v0) * ((u - t0) / (t1 - t0));
    }
  }
  return 1;
}

/** The ballast's hum once steady: about ±1%, slow, never a flicker. */
export function tubeHum(now: number) {
  return 1 + Math.sin(now / 530) * 0.007 + Math.sin(now / 131 + 1.3) * 0.003;
}

export type TubeHandle = { apply: (level: number) => void };

function housingGeometry() {
  // a shallow channel, open to the room, drawn in (z off the wall, y) and extruded along x
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.075);
  shape.lineTo(CHANNEL_D, -0.075);
  shape.lineTo(CHANNEL_D, -0.06);
  shape.lineTo(0.012, -0.06);
  shape.lineTo(0.012, 0.06);
  shape.lineTo(CHANNEL_D, 0.06);
  shape.lineTo(CHANNEL_D, 0.075);
  shape.lineTo(0, 0.075);
  shape.closePath();
  const length = TUBE.length + 0.16;
  const channel = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  channel.rotateY(-Math.PI / 2);
  channel.translate(length / 2, 0, STANDOFF);
  const parts: THREE.BufferGeometry[] = [channel];
  // two standoffs to the wall, and the lampholders at the ends of the channel
  for (const x of [-TUBE.length * 0.33, TUBE.length * 0.33]) {
    const post = new THREE.BoxGeometry(0.09, 0.09, STANDOFF + 0.002).toNonIndexed();
    post.translate(x, 0, STANDOFF / 2);
    parts.push(post);
  }
  for (const side of [-1, 1]) {
    const holder = new THREE.BoxGeometry(0.06, 0.09, 0.09).toNonIndexed();
    holder.translate(side * (TUBE.length / 2 + 0.03), 0, STANDOFF + CHANNEL_D + 0.03);
    parts.push(holder);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function ferruleGeometry() {
  const parts = [-1, 1].map((side) => {
    const g = new THREE.CylinderGeometry(R * 1.04, R * 1.04, FERRULE, 20);
    g.rotateZ(Math.PI / 2);
    g.translate(side * (GLASS_LENGTH / 2 + FERRULE / 2), 0, 0);
    return g;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** The supply: a conduit from the right lampholder down the wall to a box above the plinth. */
function conduitGeometry() {
  const x = TUBE.length / 2 + 0.03;
  const drop = TUBE.y - (ROOM.y[0] + 0.62);
  const pipe = new THREE.CylinderGeometry(0.018, 0.018, drop, 12);
  pipe.translate(x, -drop / 2 - 0.05, 0.03);
  const box = new THREE.BoxGeometry(0.14, 0.18, 0.07);
  box.translate(x, -drop - 0.1, 0.035);
  const merged = mergeGeometries([pipe, box], false);
  pipe.dispose();
  box.dispose();
  return merged;
}

export function FluorescentTube({ ref, high }: { ref?: Ref<TubeHandle>; high: boolean }) {
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  const rect = useRef<THREE.RectAreaLight>(null);
  const point = useRef<THREE.PointLight>(null);
  const point2 = useRef<THREE.PointLight>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const core = useRef<THREE.SpriteMaterial>(null);

  const res = useMemo(() => {
    const glow = glowTexture();
    const noise = noiseTexture(128, 3);
    return {
      housing: housingGeometry(),
      ferrules: ferruleGeometry(),
      conduit: conduitGeometry(),
      glass: new THREE.CylinderGeometry(R, R, GLASS_LENGTH, high ? 24 : 14, 1, true).rotateZ(Math.PI / 2),
      glow,
      noise,
    };
  }, [high]);

  useEffect(
    () => () => {
      res.housing.dispose();
      res.ferrules.dispose();
      res.conduit.dispose();
      res.glass.dispose();
      res.glow.dispose();
      res.noise.dispose();
    },
    [res],
  );

  useImperativeHandle(
    ref,
    () => ({
      apply(level: number) {
        if (glass.current) glass.current.emissiveIntensity = level * GLASS_EMISSIVE;
        if (rect.current) rect.current.intensity = level * RECT_INTENSITY;
        if (point.current) point.current.intensity = level * POINT_INTENSITY;
        if (point2.current) point2.current.intensity = level * POINT_INTENSITY;
        if (halo.current) halo.current.opacity = level * HALO_OPACITY;
        if (core.current) core.current.opacity = Math.min(1, level * CORE_OPACITY);
      },
    }),
    [],
  );

  const front = TUBE.z - WALL;

  return (
    <group position={[TUBE.x, TUBE.y, WALL]}>
      {/* blackened steel: channel, standoffs, lampholders */}
      <mesh geometry={res.housing} castShadow={high} receiveShadow>
        <meshStandardMaterial color="#141516" metalness={0.5} roughness={0.52} roughnessMap={res.noise} envMapIntensity={0} />
      </mesh>
      {/* the conduit and its box, painted the same */}
      <mesh geometry={res.conduit} castShadow={high} receiveShadow>
        <meshStandardMaterial color="#1a1b1c" metalness={0.45} roughness={0.56} roughnessMap={res.noise} envMapIntensity={0} />
      </mesh>
      {/* aluminium end caps */}
      <mesh geometry={res.ferrules} position={[0, 0, front]}>
        <meshStandardMaterial color="#7d8083" metalness={0.8} roughness={0.4} envMapIntensity={0} />
      </mesh>
      {/* the tube: phosphor-coated glass, pale and matte when off */}
      <mesh geometry={res.glass} position={[0, 0, front]}>
        <meshStandardMaterial ref={glass} color="#b9bfc3" roughness={0.34} metalness={0} emissive={TUBE_COLOR} emissiveIntensity={0} envMapIntensity={0} />
      </mesh>

      {/* the tube's light, facing into the room */}
      <rectAreaLight ref={rect} position={[0, 0, front + R + 0.004]} rotation={[0, Math.PI, 0]} width={GLASS_LENGTH} height={0.12} color={TUBE_COLOR} intensity={0} />
      {/* the pool around the fitting: on the wall above and below it, the floor, the ceiling; cut off well before the studio */}
      <pointLight ref={point} position={[-1.0, -0.1, front + 0.45]} color={HALO_COLOR} intensity={0} decay={2} distance={11} />
      <pointLight ref={point2} position={[1.0, -0.1, front + 0.45]} color={HALO_COLOR} intensity={0} decay={2} distance={11} />

      {/* halo and core glow, stretched along the tube */}
      <sprite position={[0, 0, front + 0.5]} scale={[8, 2.4, 1]} renderOrder={3}>
        <spriteMaterial ref={halo} map={res.glow} color={HALO_COLOR} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite position={[0, 0, front + 0.2]} scale={[4.3, 0.4, 1]} renderOrder={4}>
        <spriteMaterial ref={core} map={res.glow} color={TUBE_COLOR} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}
