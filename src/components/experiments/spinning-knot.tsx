"use client";

import { useRef, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { hasWebGL } from "@/components/world/device";

const ACCENT = "#FFD9A0";

const noopSubscribe = () => () => {};

function Knot({ animate }: { animate: boolean }) {
  const mesh = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (!animate || !mesh.current) return;
    mesh.current.rotation.x += dt * 0.25;
    mesh.current.rotation.y += dt * 0.4;
  });
  return (
    <mesh ref={mesh}>
      <torusKnotGeometry args={[1, 0.32, 160, 20]} />
      <meshBasicMaterial color={ACCENT} wireframe />
    </mesh>
  );
}

/** First sample experiment: a wireframe torus knot (Three.js via React Three Fiber). */
export default function SpinningKnot() {
  const reduceMotion = usePrefersReducedMotion();
  const webgl = useSyncExternalStore(noopSubscribe, hasWebGL, () => true);

  if (!webgl) {
    return <p className="grid h-full place-items-center p-6 text-sm text-muted-foreground">WebGL is not available in this browser.</p>;
  }
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 4.2], fov: 50 }}
      frameloop={reduceMotion ? "demand" : "always"}
      aria-label="Rotating wireframe torus knot"
    >
      <Knot animate={!reduceMotion} />
      <OrbitControls enableZoom={false} enablePan={false} />
    </Canvas>
  );
}
