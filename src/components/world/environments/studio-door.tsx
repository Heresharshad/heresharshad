"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FLOOR_Y, WALL_Z } from "@/components/home/studio-room";
import { tileMaterial, type TileUniforms } from "@/components/home/studio-tiles";
import { useWorld, world } from "@/components/world/store";
import type { WallDoor } from "@/components/world/types";

/*
 * The studio's way of letting you into another room: a concealed slab of the
 * same cladding, cut out of the wall. Closed, it is the wall: the shader sets
 * out the stone from world position, so the slab's face continues the panels
 * and joints of the wall around it, with no seam. Unlocked, it sinks into the
 * wall (the reveal appears, with jambs of real depth), then runs sideways into
 * a pocket behind the wall, and the opening is simply there.
 *
 * Mounted only while a journey through a wall-opening entry is running; the
 * wall is cut (uDoor) for exactly that time, and the slab fills the cut.
 */

const SLAB = 0.3;

function DoorGeometry({ door, high, wallMaterial }: { door: WallDoor; high: boolean; wallMaterial: THREE.Material }) {
  const slabRef = useRef<THREE.Mesh>(null);
  // the slab carries its own cut of stone (uTileOffset); the jambs are fixed and share nothing with the cut
  const slabMat = useMemo(() => tileMaterial("wall", { wallZ: WALL_Z, floorY: FLOOR_Y }), []);
  const jambMat = useMemo(() => tileMaterial("wall", { wallZ: WALL_Z, floorY: FLOOR_Y }), []);
  useEffect(
    () => () => {
      slabMat.dispose();
      jambMat.dispose();
    },
    [slabMat, jambMat],
  );

  // cut the wall for as long as the door exists
  useEffect(() => {
    const u = wallMaterial.userData.uniforms as TileUniforms;
    u.uDoor.value.set(door.x, FLOOR_Y, door.width, door.height);
    world.get().invalidate();
    return () => {
      u.uDoor.value.set(0, 0, 0, 0);
    };
  }, [wallMaterial, door]);

  useFrame(() => {
    const t = world.get().transition;
    const slab = slabRef.current;
    if (!slab) return;
    const recess = t ? t.progress.recess : 0;
    const slide = t ? t.progress.slide : 0;
    const dir = door.slide === "left" ? -1 : 1;
    const dx = dir * slide * (door.width + 0.3);
    const dz = -door.recess * recess;
    slab.position.set(door.x + dx, FLOOR_Y + door.height / 2, WALL_Z - SLAB / 2 + dz);
    (slabMat.userData.uniforms as TileUniforms).uTileOffset.value.set(dx, 0, dz);
  });

  const halfW = door.width / 2;
  const cy = FLOOR_Y + door.height / 2;
  const jamb = 0.9; // how far the fixed reveal extends into the wall either side (hidden behind the cladding)
  const pocketSide = door.slide === "left" ? -1 : 1;
  // the jamb on the pocket side is shallow: the slab passes behind it
  const shallow = SLAB - 0.02;
  const left = pocketSide === -1;

  return (
    <group>
      {/* the slab */}
      <mesh ref={slabRef} material={slabMat} castShadow={high} receiveShadow>
        <boxGeometry args={[door.width, door.height, SLAB]} />
      </mesh>
      {/* reveal: jambs either side, head above, a threshold below, all of real depth */}
      <mesh
        position={[door.x - halfW - jamb / 2, cy, WALL_Z - (left ? shallow : door.depth) / 2]}
        material={jambMat}
        castShadow={high}
        receiveShadow
      >
        <boxGeometry args={[jamb, door.height, left ? shallow : door.depth]} />
      </mesh>
      <mesh
        position={[door.x + halfW + jamb / 2, cy, WALL_Z - (left ? door.depth : shallow) / 2]}
        material={jambMat}
        castShadow={high}
        receiveShadow
      >
        <boxGeometry args={[jamb, door.height, left ? door.depth : shallow]} />
      </mesh>
      <mesh position={[door.x, FLOOR_Y + door.height + 0.6, WALL_Z - door.depth / 2]} material={jambMat} castShadow={high} receiveShadow>
        <boxGeometry args={[door.width + jamb * 2, 1.2, door.depth]} />
      </mesh>
      <mesh position={[door.x, FLOOR_Y - 0.3 + 0.004, WALL_Z - door.depth / 2]} material={jambMat} receiveShadow>
        <boxGeometry args={[door.width + jamb * 2, 0.6, door.depth]} />
      </mesh>
    </group>
  );
}

export function StudioDoor({ high, wallMaterial }: { high: boolean; wallMaterial: THREE.Material }) {
  const door = useWorld((s) => (s.transition?.to.entry?.kind === "wall-opening" ? s.transition.to.entry.door : null));
  if (!door) return null;
  return <DoorGeometry door={door} high={high} wallMaterial={wallMaterial} />;
}
