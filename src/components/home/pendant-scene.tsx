"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import type { LampState } from "./lamp-state";

/*
 * 3D pendant. The scene uses the same pixel units as the page: x = 0 is the
 * lamp's centre line (x = 50 in lamp CSS px), y = 0 is the top of the lamp box
 * and goes negative downward. The canvas is larger than the lamp box so the
 * glow can spill out; the camera maps it 1:1 onto the page.
 */
const VIEW = { left: -150, right: 150, top: 20, bottom: -300 };
const BRASS = "#c9a45a";
const MAX_BEADS = 90;
const BEAD_GAP = 3.4;
const PIVOT_Y = -10;
/** y(page px, downward) -> y inside the pendulum group */
const py = (y: number) => -y - PIVOT_Y;

/** Warm-up flicker, matching the original "bulb catching" feel. */
const WARM: [number, number][] = [[0, 0], [150, 0.7], [230, 0.35], [380, 1], [510, 0.85], [820, 1]];
function warmLevel(ms: number) {
  for (let i = 1; i < WARM.length; i++) {
    if (ms <= WARM[i][0]) {
      const [t0, v0] = WARM[i - 1];
      const [t1, v1] = WARM[i];
      return v0 + (v1 - v0) * ((ms - t0) / (t1 - t0));
    }
  }
  return 1;
}

function useHaloTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,217,160,0.55)");
    grad.addColorStop(0.3, "rgba(255,201,120,0.2)");
    grad.addColorStop(0.65, "rgba(255,192,112,0.05)");
    grad.addColorStop(1, "rgba(255,192,112,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function bulbGeometry() {
  // Profile traced from the original SVG bulb (r, y in page px).
  const pts = [
    [0, 190], [12, 189], [22, 184], [28, 174], [30, 160], [29, 142],
    [24, 132], [14, 124], [8, 118], [6, 110], [6, 100],
  ].map(([r, y]) => new THREE.Vector2(r, -y));
  const smooth = new THREE.SplineCurve(pts).getPoints(70).map((p) => new THREE.Vector2(Math.max(p.x, 0), p.y));
  return new THREE.LatheGeometry(smooth, 72);
}

function filamentGeometry() {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const x = -10 + 20 * t;
    // sag toward the middle with a fine coil on top
    const y = -(151.3 + 5 * Math.sin(Math.PI * t)) + (i % 2 ? 0.7 : -0.7);
    pts.push(new THREE.Vector3(x, y, 0));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.5, 6, false);
}

type SceneProps = {
  stateRef: RefObject<LampState>;
  swingRef: RefObject<HTMLDivElement | null>;
  cordRef: RefObject<HTMLButtonElement | null>;
  reduceMotion: boolean;
};

function Pendant({ stateRef, swingRef, cordRef, reduceMotion }: SceneProps) {
  const invalidate = useThree((s) => s.invalidate);
  const pendulum = useRef<THREE.Group>(null);
  const beads = useRef<THREE.InstancedMesh>(null);
  const knob = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const halo = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const glass = useRef<THREE.MeshPhysicalMaterial>(null);
  const filament = useRef<THREE.MeshBasicMaterial>(null);
  const sim = useRef({ theta: 0, omega: 0, level: 0 });
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const haloTex = useHaloTexture();
  const bulb = useMemo(() => bulbGeometry(), []);
  const fil = useMemo(() => filamentGeometry(), []);
  const cold = useMemo(() => new THREE.Color("#4a4440"), []);
  const hot = useMemo(() => new THREE.Color("#fff3d6"), []);

  useEffect(() => {
    const state = stateRef.current;
    const swingEl = swingRef.current;
    state.three = true;
    state.wake = () => invalidate();
    invalidate();
    return () => {
      state.three = false;
      state.wake = null;
      if (swingEl) swingEl.style.transform = "";
    };
  }, [stateRef, invalidate, swingRef]);

  useLayoutEffect(() => {
    const g = beads.current;
    if (g) g.count = MAX_BEADS;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = sim.current;
    const state = stateRef.current;
    const now = performance.now();

    /* pendulum: damped spring, driven by drag or kicked by a pull */
    if (reduceMotion) {
      s.theta = 0;
      s.omega = 0;
    } else {
      if (state.kickDeg !== null) {
        s.theta = (state.kickDeg * Math.PI) / 180;
        s.omega = 0;
        state.kickDeg = null;
      }
      if (state.dragDeg !== null) {
        const target = (state.dragDeg * Math.PI) / 180;
        s.theta += (target - s.theta) * Math.min(1, dt * 18);
        s.omega = 0;
      } else {
        const w0 = 4.6;
        const zeta = 0.1;
        s.omega += (-w0 * w0 * s.theta - 2 * zeta * w0 * s.omega) * dt;
        s.theta += s.omega * dt;
        if (Math.abs(s.theta) < 1e-5 && Math.abs(s.omega) < 1e-4) {
          s.theta = 0;
          s.omega = 0;
        }
      }
    }
    if (pendulum.current) pendulum.current.rotation.z = -s.theta;
    const swing = swingRef.current;
    if (swing) {
      swing.style.transform = s.theta === 0 ? "" : `rotate(${((s.theta * 180) / Math.PI).toFixed(3)}deg)`;
    }

    /* light level: warm-up flicker on, quick fade off */
    if (reduceMotion) {
      s.level = state.on ? 1 : 0;
    } else if (state.on) {
      s.level = warmLevel(now - state.onAt);
    } else {
      s.level = Math.max(0, s.level - dt / 0.25);
    }
    const hum = state.on && !reduceMotion ? 1 + Math.sin(now / 640) * 0.03 : 1;
    const L = s.level * hum;
    if (light.current) light.current.intensity = L * 3.2;
    if (halo.current) (halo.current.material as THREE.MeshBasicMaterial).opacity = Math.min(1, L);
    if (glow.current) (glow.current.material as THREE.MeshBasicMaterial).opacity = Math.min(1, L) * 0.75;
    if (glass.current) glass.current.emissiveIntensity = L * 0.7;
    if (filament.current) filament.current.color.copy(cold).lerp(hot, Math.min(1, L));

    /* bead chain follows the real (CSS-animated) length of the DOM pull cord */
    const cordLen = cordRef.current?.offsetHeight ?? 150;
    const chainTop = 98;
    const knobH = 18;
    const chainLen = Math.max(0, cordLen - knobH);
    const n = Math.min(MAX_BEADS, Math.floor(chainLen / BEAD_GAP));
    const inst = beads.current;
    if (inst) {
      for (let i = 0; i < MAX_BEADS; i++) {
        dummy.position.set(12.5, py(chainTop + 2 + i * BEAD_GAP), 0);
        dummy.scale.setScalar(i < n ? 1 : 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
    if (knob.current) knob.current.position.set(12.5, py(chainTop + cordLen - knobH / 2), 0);

    /* keep animating while anything is moving, otherwise idle (on-demand loop) */
    if (reduceMotion && (s.level !== (state.on ? 1 : 0))) invalidate();
  });

  return (
    <>
      <OrthographicCamera makeDefault manual left={VIEW.left} right={VIEW.right} top={VIEW.top} bottom={VIEW.bottom} near={0.1} far={400} position={[0, 0, 100]} />
      <ambientLight intensity={0.12} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.4} position={[-6, 3, 6]} scale={[5, 8, 1]} />
        <Lightformer form="rect" intensity={0.5} position={[6, 0, 5]} scale={[2, 8, 1]} color="#ffd9a0" />
      </Environment>

      {/* soft halo behind everything */}
      <mesh ref={halo} position={[0, -156, -20]}>
        <planeGeometry args={[250, 250]} />
        <meshBasicMaterial map={haloTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      {/* the bulb's light: warms the brass, cord and chain */}
      <pointLight ref={light} position={[0, py(160), 45]} color="#ffb85a" intensity={0} distance={0} decay={0} />

      {/* canopy sits on the ceiling and does not swing */}
      <mesh position={[0, -5, 0]}>
        <cylinderGeometry args={[10, 14, 10, 48]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.45} />
      </mesh>

      <group ref={pendulum} position={[0, PIVOT_Y, 0]}>
        {/* fabric cord */}
        <mesh position={[0, py(36), 0]}>
          <cylinderGeometry args={[1.7, 1.7, 48, 16]} />
          <meshStandardMaterial color="#2c2a28" roughness={0.95} metalness={0} />
        </mesh>
        {/* strain relief + socket */}
        <mesh position={[0, py(62), 0]}>
          <cylinderGeometry args={[3.6, 3.6, 6, 24]} />
          <meshStandardMaterial color="#8a6730" metalness={1} roughness={0.35} />
        </mesh>
        <mesh position={[0, py(67.5), 0]}>
          <cylinderGeometry args={[8, 8, 5, 48]} />
          <meshStandardMaterial color={BRASS} metalness={1} roughness={0.25} />
        </mesh>
        <mesh position={[0, py(83), 0]}>
          <cylinderGeometry args={[9, 9, 26, 64]} />
          <meshStandardMaterial color={BRASS} metalness={1} roughness={0.28} envMapIntensity={1.3} />
        </mesh>
        {[74, 79, 84, 89].map((y) => (
          <mesh key={y} position={[0, py(y), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[9, 0.55, 8, 64]} />
            <meshStandardMaterial color="#7e5c2c" metalness={1} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, py(98), 0]}>
          <cylinderGeometry args={[10, 10, 4, 64]} />
          <meshStandardMaterial color={BRASS} metalness={1} roughness={0.22} />
        </mesh>
        <mesh position={[0, py(101), 0]}>
          <cylinderGeometry args={[10, 9, 2, 64]} />
          <meshStandardMaterial color="#1e1508" metalness={0.8} roughness={0.5} />
        </mesh>
        {/* eyelet the pull chain hangs from */}
        <mesh position={[12.5, py(97.5), 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.7, 0.6, 8, 20]} />
          <meshStandardMaterial color={BRASS} metalness={1} roughness={0.3} />
        </mesh>

        {/* glass bulb: faint body, warm emissive when lit */}
        <mesh geometry={bulb} position={[0, -PIVOT_Y, 0]} renderOrder={2}>
          <meshPhysicalMaterial
            ref={glass}
            color="#ffffff"
            transparent
            opacity={0.2}
            roughness={0.04}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.05}
            envMapIntensity={1.6}
            emissive="#ffc46e"
            emissiveIntensity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={glow} position={[0, py(160), 0]} renderOrder={1}>
          <sphereGeometry args={[24, 32, 24]} />
          <meshBasicMaterial color="#ffe0a8" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        {/* glass stem, supports and filament */}
        <mesh position={[0, py(117), 0]}>
          <cylinderGeometry args={[1.1, 1.1, 30, 12]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.16} roughness={0.2} />
        </mesh>
        {[-1, 1].map((d) => (
          <mesh key={d} position={[d * 6.25, py(141), 0]} rotation={[0, 0, d * 0.46]}>
            <cylinderGeometry args={[0.35, 0.35, 22, 6]} />
            <meshStandardMaterial color="#5a5248" metalness={0.6} roughness={0.5} />
          </mesh>
        ))}
        <mesh geometry={fil} position={[0, -PIVOT_Y, 0]}>
          <meshBasicMaterial ref={filament} color="#4a4440" toneMapped={false} />
        </mesh>

        {/* pull chain: beads + knob */}
        <instancedMesh ref={beads} args={[undefined, undefined, MAX_BEADS]}>
          <sphereGeometry args={[1.5, 10, 8]} />
          <meshStandardMaterial color={BRASS} metalness={1} roughness={0.3} />
        </instancedMesh>
        <mesh ref={knob}>
          <capsuleGeometry args={[3.6, 11, 8, 16]} />
          <meshStandardMaterial color={BRASS} metalness={1} roughness={0.22} envMapIntensity={1.4} />
        </mesh>
      </group>
    </>
  );
}

export default function PendantScene(props: SceneProps) {
  return (
    <Canvas
      className="lamp-canvas"
      aria-hidden="true"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      frameloop={props.reduceMotion ? "demand" : "always"}
    >
      <Pendant {...props} />
    </Canvas>
  );
}
