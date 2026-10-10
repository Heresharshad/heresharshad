"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { labelTexture, noiseTexture } from "./studio-textures";
import { tileMaterial, type TileUniforms } from "./studio-tiles";
import type { BulbOut } from "./pendant";

export const WALL_Z = -3.6;
export const FLOOR_Y = -4.2;

/** Shallow pilasters: large planes that catch raking light. [centre x, width, depth] */
export const PILASTERS: [number, number, number][] = [
  [-7.4, 1.5, 0.7],
  [7.6, 1.5, 0.7],
];

/** Drafting annotations on the wall: [text, x, y, height, dimension width]. */
const NOTES: [string, number, number, number, number?][] = [
  ["AXIS C / 07", 3.4, 2.25, 0.09],
  ["2 400", -2.2, 1.25, 0, 1.6],
  ["EL. +3.200", 4.4, 0.75, 0.09],
  ["SECTION A—A", -4.2, -0.1, 0.09],
  ["PANEL 4800", 1.05, -0.62, 0.08],
  ["SHEET 01 / 05", -2.4, -1.9, 0.09],
  ["1 : 20", 4.7, -1.45, 0.09],
  ["1 200", 2.6, -2.75, 0, 1.25],
];

type Note = { tex: THREE.Texture; w: number; h: number; x: number; y: number };

function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  useEffect(() => {
    let made: Note[] = [];
    let cancelled = false;
    const family =
      getComputedStyle(document.documentElement).getPropertyValue("--font-plex-mono").trim() || "ui-monospace, monospace";
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      made = NOTES.map(([text, x, y, h, dim]) => {
        const { tex, aspect } = labelTexture(text, family, { dimension: !!dim });
        return dim ? { tex, w: dim, h: dim / aspect, x, y } : { tex, w: h * aspect, h, x, y };
      });
      setNotes(made);
    });
    return () => {
      cancelled = true;
      made.forEach((n) => n.tex.dispose());
    };
  }, []);
  return notes;
}

type StudioRoomProps = {
  high: boolean;
  /** The reflective floor (it draws the scene again): high tier only. */
  reflections: boolean;
  sharedRef: RefObject<{ out: BulbOut }>;
  /** The cladding, when something else (the concealed doorway) shares it. */
  wallMaterial?: THREE.Material;
};

export function StudioRoom({ high, reflections, sharedRef, wallMaterial }: StudioRoomProps) {
  const ownWall = useMemo(() => wallMaterial ?? tileMaterial("wall", { wallZ: WALL_Z, floorY: FLOOR_Y }), [wallMaterial]);
  const wall = ownWall;
  const floorTiles = useMemo(() => tileMaterial("floor", { wallZ: WALL_Z, floorY: FLOOR_Y }), []);
  const floorNoise = useMemo(() => noiseTexture(256, 6), []);
  const notes = useNotes();
  const floorLayer = useRef<THREE.Mesh>(null);

  // the floor takes a little of the bulb's light back off the wall
  useFrame(() => {
    const mat = floorLayer.current?.material as THREE.Material | undefined;
    if (!mat) return;
    const { out } = sharedRef.current;
    const u = mat.userData.uniforms as TileUniforms;
    u.uBulb.value.copy(out.filament);
    u.uBulbLevel.value = out.level;
  });

  useEffect(
    () => () => {
      if (!wallMaterial) wall.dispose();
      floorTiles.dispose();
      floorNoise.dispose();
    },
    [wall, wallMaterial, floorTiles, floorNoise],
  );

  return (
    <group>
      {/* back wall, tall enough for every camera position */}
      <mesh position={[0, FLOOR_Y + 20, WALL_Z]} material={wall} receiveShadow>
        <planeGeometry args={[90, 40]} />
      </mesh>
      {PILASTERS.map(([x, w, d]) => (
        <mesh key={x} position={[x, FLOOR_Y + 20, WALL_Z + d / 2]} material={wall} receiveShadow castShadow={high}>
          <boxGeometry args={[w, 40, d]} />
        </mesh>
      ))}

      {/* polished concrete floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, WALL_Z + 20]} receiveShadow>
        <planeGeometry args={[90, 40]} />
        {reflections ? (
          <MeshReflectorMaterial
            resolution={512}
            blur={[420, 140]}
            mixBlur={1}
            mixStrength={1.6}
            mixContrast={1}
            depthScale={1.2}
            minDepthThreshold={0.3}
            maxDepthThreshold={1.4}
            roughness={0.9}
            roughnessMap={floorNoise}
            metalness={0.4}
            color="#0d0d0d"
            envMapIntensity={0.05}
            mirror={0}
          />
        ) : (
          <meshStandardMaterial color="#0e0e0e" roughness={0.55} roughnessMap={floorNoise} envMapIntensity={0.05} />
        )}
      </mesh>
      <mesh ref={floorLayer} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.002, WALL_Z + 20]} material={floorTiles} receiveShadow>
        <planeGeometry args={[90, 40]} />
      </mesh>

      {notes.map((n, i) => (
        <mesh key={i} position={[n.x, n.y, WALL_Z + 0.004]}>
          <planeGeometry args={[n.w, n.h]} />
          <meshStandardMaterial map={n.tex} color="#a89a86" transparent depthWrite={false} roughness={1} envMapIntensity={0} />
        </mesh>
      ))}
    </group>
  );
}
