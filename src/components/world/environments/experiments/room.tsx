"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { noiseTexture } from "@/components/home/studio-textures";
import { tileMaterial, type TileUniforms } from "@/components/home/studio-tiles";
import { world } from "@/components/world/store";
import type { EnvironmentProps } from "@/components/world/types";
import { DOOR, FLOOR_Y, ROOM, STEP, TUBE, WALL_Z } from "./config";
import { FluorescentTube, tubeHum, tubeLevel, type TubeHandle } from "./fluorescent-tube";
import { Workbench, type WorkbenchHandle } from "./workbench";

/*
 * The Experiments room: the same building, another room, now a workshop. The
 * walls are the studio's cladding system (studio-tiles.ts), painted a cool
 * blue-grey, so the courses carry on through the wall and the ambient is held
 * back the same way: nothing reads until a light finds it. The envelope is
 * designed, not boxed: the walls float on a shadow gap over a dark plinth,
 * the far wall steps back behind a full-height reveal to the right, a garage
 * workbench runs along it under a blue fluorescent batten on standoffs. You
 * arrive in the dark. The tube sputters twice, showing the wall and losing it,
 * then holds, and the room is what its blue reaches; the laptop on the bench
 * wakes with it, a cyan line at the base of the left wall comes up last to
 * give the depth, and the clamp lamp's warm pool is the one warm thing.
 */

RectAreaLightUniformsLib.init();

const [X0, X1] = ROOM.x;
const [Y0, Y1] = ROOM.y;
const [ZF, ZB] = ROOM.z;
/** Wall thickness, the shadow gap the walls float on, and the plinth's setback. */
const T = 0.2;
const GAP = 0.16;
const SETBACK = 0.1;
const FRONT_T = 0.12;
const OPEN = { x0: DOOR.x - DOOR.width / 2, x1: DOOR.x + DOOR.width / 2, top: FLOOR_Y + DOOR.height };
/** The recessed slot at the base of the left wall that houses the warm strip. */
const SLOT = { top: Y0 + 0.3, back: X0 - 0.16 };
const STRIP = { z0: ZF - 0.4, z1: ZB + 0.2 };
const STRIP_LEN = STRIP.z0 - STRIP.z1;
const STRIP_Z = (STRIP.z0 + STRIP.z1) / 2;
/** The floor runs from the studio's floor edge (under the jambs) to the far wall. */
const FLOOR = { x0: SLOT.back, x1: X1, z0: WALL_Z, z1: ZB - STEP.depth };
/** The line in the floor slot: a cooler, greener blue than the batten, so the two blues layer. */
const STRIP_COLOR = "#3fc4ff";
/** Full-level intensities for the strip: a line that gives depth, not a second room light. */
const STRIP_RECT = 16;
const STRIP_POINT = 2.2;
const STRIP_BAR = 2.6;
/** The walls: painted block, a cool blue-grey, so the batten's blue reads on them. */
const WALL_PAINT = "#4f5a66";
/** The room's own lights ramp when it is entered directly (seconds). */
const RAMP = 2.4;

const TUBE_CENTRE = new THREE.Vector3(TUBE.x, TUBE.y, TUBE.z);
/** The bounce the floor takes from the lit far wall: the tube's cold white. */
const BOUNCE: [number, number, number] = [0.3, 0.5, 0.9];

type Box = { x: [number, number]; y: [number, number]; z: [number, number] };
const box = (x: Box["x"], y: Box["y"], z: Box["z"]): Box => ({ x, y, z });

/** The cast envelope: every face is clad by world position, so one merged mesh. */
const SHELL: Box[] = [
  // left wall, floating above the slot
  box([X0 - T, X0], [SLOT.top, Y1 + T], [ZB - T, ZF]),
  // back of the slot
  box([SLOT.back - T, SLOT.back], [Y0 - 0.05, SLOT.top + 0.03], [ZB - T, ZF]),
  // right wall, and a shallow pilaster that marks the far corner
  box([X1, X1 + T], [Y0 + GAP, Y1 + T], [ZB - STEP.depth - T, ZF]),
  box([X1 - 0.26, X1], [Y0 + GAP, Y1], [-15.0, -14.2]),
  // far wall: the main plane to the left of the reveal, the stepped plane to the right, the return between them
  box([SLOT.back - T, STEP.x], [Y0 + GAP, Y1 + T], [ZB - T, ZB]),
  box([STEP.x, X1 + T], [Y0 + GAP, Y1 + T], [ZB - STEP.depth - T, ZB - STEP.depth]),
  box([STEP.x - 0.02, STEP.x], [Y0 + GAP, Y1 + T], [ZB - STEP.depth, ZB]),
  // ceiling
  box([SLOT.back - T, X1 + T], [Y1, Y1 + T], [ZB - STEP.depth - T, ZF]),
  // front wall: either side of the opening and the head above it
  box([SLOT.back - T, OPEN.x0], [Y0 + GAP, Y1], [ZF - FRONT_T, ZF]),
  box([OPEN.x1, X1 + T], [Y0 + GAP, Y1], [ZF - FRONT_T, ZF]),
  box([OPEN.x0, OPEN.x1], [OPEN.top, Y1], [ZF - FRONT_T, ZF]),
];

/** The dark plinth the walls float on, set back into shadow. */
const PLINTH: Box[] = [
  box([X1 - SETBACK, X1 + T], [Y0 - 0.02, Y0 + GAP + 0.01], [ZB - STEP.depth - T, ZF]),
  box([SLOT.back - T, STEP.x], [Y0 - 0.02, Y0 + GAP + 0.01], [ZB - T, ZB + SETBACK]),
  box([STEP.x, X1 + T], [Y0 - 0.02, Y0 + GAP + 0.01], [ZB - STEP.depth - T, ZB - STEP.depth + SETBACK]),
  box([SLOT.back - T, OPEN.x0], [Y0 - 0.02, Y0 + GAP + 0.01], [ZF - FRONT_T - SETBACK, ZF - SETBACK]),
  box([OPEN.x1, X1 + T], [Y0 - 0.02, Y0 + GAP + 0.01], [ZF - FRONT_T - SETBACK, ZF - SETBACK]),
];

function boxesGeometry(boxes: Box[]) {
  const parts = boxes.map(({ x, y, z }) => {
    const g = new THREE.BoxGeometry(x[1] - x[0], y[1] - y[0], z[1] - z[0]);
    g.translate((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2);
    return g;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Per-frame working state, created on the first frame. */
function createLive() {
  return {
    lights: 0,
    latched: false,
    frame: 0,
    el: null as HTMLElement | null,
    v: new THREE.Vector3(),
    dom: { lx: NaN, ly: NaN, li: NaN },
  };
}

export default function ExperimentsRoom({ high, reflections, onReady }: EnvironmentProps) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);

  const group = useRef<THREE.Group>(null);
  const tube = useRef<TubeHandle>(null);
  const bench = useRef<WorkbenchHandle>(null);
  const warmBar = useRef<THREE.MeshStandardMaterial>(null);
  const warmRect = useRef<THREE.RectAreaLight>(null);
  const warmPoint = useRef<THREE.PointLight>(null);
  const floorLayer = useRef<THREE.Mesh>(null);
  const liveRef = useRef<ReturnType<typeof createLive>>(null);
  const onReadyRef = useRef(onReady);
  const readyRef = useRef(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  });

  const res = useMemo(() => {
    const origin = { wallZ: ZB, floorY: FLOOR_Y };
    return {
      shell: boxesGeometry(SHELL),
      plinth: boxesGeometry(PLINTH),
      // the studio's cladding, painted: a cool blue-grey, matte
      concrete: tileMaterial("wall", origin, { color: WALL_PAINT, roughness: 0.82 }),
      floorTiles: tileMaterial("floor", origin, { bounce: BOUNCE }),
      floorNoise: noiseTexture(256, 6),
      dark: new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.92, metalness: 0, envMapIntensity: 0 }),
      steel: new THREE.MeshStandardMaterial({ color: "#121314", roughness: 0.5, metalness: 0.55, envMapIntensity: 0 }),
    };
  }, []);

  useEffect(
    () => () => {
      res.shell.dispose();
      res.plinth.dispose();
      res.concrete.dispose();
      res.floorTiles.dispose();
      res.floorNoise.dispose();
      res.dark.dispose();
      res.steel.dispose();
    },
    [res],
  );

  // compile before reporting ready, so the transition never waits on a shader mid-move. The whole
  // scene, not just this group: the room's lights change the light count, so the studio's
  // materials need new programs too, and they should compile here rather than on the next frame.
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

  useFrame(({ size }, rawDt) => {
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
    // leaving: the room dims as its own door mechanism begins
    const dim = tr && tr.from.id === "experiments" && tr.to.id !== "experiments" ? 1 - 0.85 * tr.progress.recess : 1;

    /* ---- the tube first: it sputters, shows the wall, loses it, then holds ---- */
    const base = tubeLevel(lights, s.reduceMotion) * dim;
    const level = base >= 1 && !s.reduceMotion ? base * tubeHum(performance.now()) : base;
    tube.current?.apply(level);
    // the floor takes a little of the lit far wall back
    const fu = (floorLayer.current?.material as THREE.Material | undefined)?.userData.uniforms as TileUniforms | undefined;
    if (fu) {
      fu.uBulb.value.copy(TUBE_CENTRE);
      fu.uBulbLevel.value = level * 0.6;
    }

    /* ---- the floor line and the bench lamp come up last, slowly, once the tube is steady ---- */
    const warm = smoothstep(0.74, 1, lights) * dim;
    if (warmBar.current) warmBar.current.emissiveIntensity = warm * STRIP_BAR;
    if (warmRect.current) warmRect.current.intensity = warm * STRIP_RECT;
    if (warmPoint.current) warmPoint.current.intensity = warm * STRIP_POINT;
    // the laptop wakes with the tube; the clamp lamp is the last thing on
    bench.current?.apply(smoothstep(0.82, 1, lights) * dim, Math.min(1, base * 1.2));

    /* ---- the page's heading takes its light from the tube ---- */
    if (live.frame++ % 60 === 0 || (live.el && !live.el.isConnected)) {
      const el = document.querySelector<HTMLElement>("[data-room-light]");
      if (el !== live.el) {
        live.el = el;
        live.dom.lx = live.dom.ly = live.dom.li = NaN;
      }
    }
    const el = live.el;
    if (el) {
      const p = live.v.copy(TUBE_CENTRE).project(camera);
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
      {/* the cast envelope and the bench, one cladding */}
      <mesh geometry={res.shell} material={res.concrete} castShadow={high} receiveShadow />
      {/* the shadow gap the walls float on */}
      <mesh geometry={res.plinth} material={res.dark} receiveShadow />
      {/* a blackened steel flat edging the reveal, the one line that catches the light */}
      <mesh position={[STEP.x + 0.02, (Y0 + GAP + Y1) / 2, ZB - STEP.depth + 0.02]} material={res.steel} castShadow={high}>
        <boxGeometry args={[0.04, Y1 - Y0 - GAP, 0.04]} />
      </mesh>

      {/* polished concrete floor, with the cladding's joints and the shadow by the far wall drawn over it */}
      <mesh rotation-x={-Math.PI / 2} position={[(FLOOR.x0 + FLOOR.x1) / 2, FLOOR_Y, (FLOOR.z0 + FLOOR.z1) / 2]} receiveShadow>
        <planeGeometry args={[FLOOR.x1 - FLOOR.x0, FLOOR.z0 - FLOOR.z1]} />
        {reflections ? (
          <MeshReflectorMaterial
            resolution={512}
            blur={[420, 140]}
            mixBlur={1}
            mixStrength={1.5}
            mixContrast={1}
            depthScale={1.2}
            minDepthThreshold={0.3}
            maxDepthThreshold={1.4}
            roughness={0.88}
            roughnessMap={res.floorNoise}
            metalness={0.35}
            color="#0d0d0d"
            envMapIntensity={0}
            mirror={0}
          />
        ) : (
          <meshStandardMaterial color="#0e0e0e" roughness={0.55} roughnessMap={res.floorNoise} metalness={0.1} envMapIntensity={0} />
        )}
      </mesh>
      <mesh
        ref={floorLayer}
        rotation-x={-Math.PI / 2}
        position={[(FLOOR.x0 + FLOOR.x1) / 2, FLOOR_Y + 0.002, (FLOOR.z0 + FLOOR.z1) / 2]}
        material={res.floorTiles}
        receiveShadow
      >
        <planeGeometry args={[FLOOR.x1 - FLOOR.x0, FLOOR.z0 - FLOOR.z1]} />
      </mesh>

      {/* the floor line: a diffused bar at the back of the slot */}
      <mesh position={[SLOT.back + 0.0125, Y0 + 0.1, STRIP_Z]}>
        <boxGeometry args={[0.025, 0.05, STRIP_LEN]} />
        <meshStandardMaterial ref={warmBar} color="#1c1612" roughness={0.6} emissive={STRIP_COLOR} emissiveIntensity={0} envMapIntensity={0} />
      </mesh>
      {/* its light: a long rect facing up that washes the lower wall in a band, and a point near the far end that pools on the floor */}
      <rectAreaLight ref={warmRect} position={[X0 + 0.17, Y0 + 0.03, STRIP_Z]} rotation-x={Math.PI / 2} width={0.26} height={STRIP_LEN} color={STRIP_COLOR} intensity={0} />
      <pointLight ref={warmPoint} position={[X0 + 0.45, Y0 + 0.5, ZB + 1.6]} color={STRIP_COLOR} intensity={0} decay={2} distance={7} />

      <Workbench ref={bench} high={high} />
      <FluorescentTube ref={tube} high={high} />
    </group>
  );
}
