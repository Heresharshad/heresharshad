"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FLOOR_Y, ROOM, WORKBENCH } from "./config";

/*
 * A garage workbench against the far wall: a butcher-block top on a painted
 * steel frame, a red drawer chest under the right end and a slatted shelf
 * with bins and paint tins under the left, a vise on the front corner, a
 * pegboard of hand tools above, and the things a creative coder leaves out:
 * an open laptop with code on the screen, a toolbox, a mug. A clamp lamp on
 * the back edge throws the one warm pool in the room. Everything is merged
 * by material, so the bench is a handful of draw calls.
 */

const F = FLOOR_Y;
/** The face of the far wall. */
const W = ROOM.z[1];
const { x0: X0, x1: X1, top: TOP, depth: D } = WORKBENCH;
const [PEG0, PEG1] = WORKBENCH.peg;
/** Worktop thickness, leg section, and the worktop's surface height in world y. */
const SLAB = 0.06;
const LEG = 0.05;
const Y_TOP = F + TOP;
const Z_FRONT = W + D;

/** The lamp's warm light at full level. */
const LAMP_COLOR = "#ffb36b";
const LAMP_INTENSITY = 2.4;
const SCREEN_INTENSITY = 1.3;

type Rot = [number, number, number];
const box = (w: number, h: number, d: number, x: number, y: number, z: number, rot?: Rot) => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rot) g.rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]);
  return g.translate(x, y, z);
};
/** A cylinder along an axis. */
const cyl = (r: number, len: number, x: number, y: number, z: number, axis: "x" | "y" | "z" = "y", seg = 12) => {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (axis === "x") g.rotateZ(Math.PI / 2);
  if (axis === "z") g.rotateX(Math.PI / 2);
  return g.translate(x, y, z);
};
function merge(parts: THREE.BufferGeometry[]) {
  const flat = parts.map((p) => {
    const n = p.index ? p.toNonIndexed() : p;
    if (n !== p) p.dispose();
    return n;
  });
  const merged = mergeGeometries(flat, false);
  flat.forEach((p) => p.dispose());
  return merged;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

/** Butcher block: staves of slightly different timber running the length of the top. */
function woodTexture() {
  const [c, g] = canvas(512, 64);
  let y = 0;
  while (y < 64) {
    const h = 5 + Math.random() * 5;
    const l = 30 + Math.random() * 14;
    g.fillStyle = `hsl(${26 + Math.random() * 8}, ${38 + Math.random() * 10}%, ${l}%)`;
    g.fillRect(0, y, 512, h);
    // grain
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(40, 22, 10, ${0.05 + Math.random() * 0.08})`;
      g.fillRect(0, y + Math.random() * h, 512, 0.6);
    }
    g.fillStyle = "rgba(20, 10, 4, 0.5)";
    g.fillRect(0, y + h - 0.6, 512, 0.6);
    y += h;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** One cell of pegboard: painted hardboard and a hole; repeated across the board. */
function pegTexture() {
  const [c, g] = canvas(32, 32);
  g.fillStyle = "#d7d5cf";
  g.fillRect(0, 0, 32, 32);
  const r = g.createRadialGradient(16, 16, 2, 16, 16, 6);
  r.addColorStop(0, "#0b0b0b");
  r.addColorStop(0.75, "#1c1c1c");
  r.addColorStop(1, "rgba(28, 28, 28, 0)");
  g.fillStyle = r;
  g.beginPath();
  g.arc(16, 16, 6, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** The laptop's screen: an editor, dark theme, a few lines of code in the site's colours. */
function screenTexture() {
  const [c, g] = canvas(256, 160);
  g.fillStyle = "#0b1020";
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#141b30";
  g.fillRect(0, 0, 34, 160);
  const hues = ["#7fb4ff", "#c6a0ff", "#9fe3b0", "#ffd9a0", "#e8edf5"];
  for (let line = 0; line < 13; line++) {
    const y = 10 + line * 11;
    g.fillStyle = "#3a4466";
    g.fillRect(10, y, 12, 4);
    let x = 44 + (line % 4 === 0 ? 0 : 12 * ((line % 3) + 1));
    const words = 1 + Math.floor(Math.random() * 4);
    for (let w = 0; w < words && x < 240; w++) {
      const len = 12 + Math.random() * 40;
      g.fillStyle = hues[Math.floor(Math.random() * hues.length)];
      g.fillRect(x, y, len, 4);
      x += len + 6;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The frame, the worktop, the chest, the shelf and its contents, the vise, the pegboard and tools, the things on top. */
function buildBench() {
  const steel: THREE.BufferGeometry[] = [];
  const wood: THREE.BufferGeometry[] = [];
  const red: THREE.BufferGeometry[] = [];
  const chrome: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const vise: THREE.BufferGeometry[] = [];
  const grip: THREE.BufferGeometry[] = [];
  const bins: THREE.BufferGeometry[] = [];

  const cx = (X0 + X1) / 2;
  const len = X1 - X0;
  const legH = TOP - SLAB;

  /* ---- worktop and frame ---- */
  wood.push(box(len, SLAB, D, cx, Y_TOP - SLAB / 2, W + D / 2));
  for (const x of [X0 + 0.08, X1 - 0.08])
    for (const z of [W + 0.08, Z_FRONT - 0.08]) steel.push(box(LEG, legH, LEG, x, F + legH / 2, z));
  // aprons under the top, and the stretchers the lower shelf sits on
  steel.push(box(len - 0.1, 0.07, 0.025, cx, Y_TOP - SLAB - 0.035, Z_FRONT - 0.07));
  steel.push(box(len - 0.1, 0.07, 0.025, cx, Y_TOP - SLAB - 0.035, W + 0.07));
  steel.push(box(len - 0.1, 0.035, 0.035, cx, F + 0.15, Z_FRONT - 0.08));
  steel.push(box(len - 0.1, 0.035, 0.035, cx, F + 0.15, W + 0.08));
  for (const x of [X0 + 0.08, X1 - 0.08]) steel.push(box(0.035, 0.035, D - 0.16, x, F + 0.15, W + D / 2));
  // levelling feet
  for (const x of [X0 + 0.08, X1 - 0.08]) for (const z of [W + 0.08, Z_FRONT - 0.08]) dark.push(cyl(0.035, 0.02, x, F + 0.01, z));

  /* ---- the lower shelf, slatted, on the left: two bins and three tins ---- */
  const shelf = { x0: X0 + 0.12, x1: X1 - 1.15 };
  for (let i = 0; i < 6; i++) {
    wood.push(box(shelf.x1 - shelf.x0, 0.025, 0.1, (shelf.x0 + shelf.x1) / 2, F + 0.18, W + 0.15 + i * 0.105));
  }
  bins.push(box(0.5, 0.26, 0.42, X0 + 0.45, F + 0.32, W + 0.38));
  bins.push(box(0.5, 0.2, 0.42, X0 + 1.0, F + 0.29, W + 0.4));
  for (const [x, r, h] of [
    [X0 + 1.55, 0.09, 0.2],
    [X0 + 1.78, 0.09, 0.2],
    [X0 + 2.02, 0.07, 0.15],
  ] as const) {
    red.push(cyl(r, h, x, F + 0.19 + h / 2, W + 0.42, "y", 16));
    chrome.push(cyl(r * 0.9, 0.012, x, F + 0.19 + h + 0.006, W + 0.42, "y", 16));
  }

  /* ---- the drawer chest under the right end ---- */
  const chest = { x0: X1 - 1.05, x1: X1 - 0.13, y0: F + 0.04, y1: Y_TOP - SLAB - 0.08 };
  const cw = chest.x1 - chest.x0;
  const ccx = (chest.x0 + chest.x1) / 2;
  red.push(box(cw, chest.y1 - chest.y0, D - 0.16, ccx, (chest.y0 + chest.y1) / 2, W + D / 2 - 0.01));
  const drawers = [0.12, 0.12, 0.16, 0.24];
  let dy = chest.y1 - 0.02;
  for (const h of drawers) {
    // a recessed shadow line between drawers, and a pull bar on each
    dark.push(box(cw - 0.04, 0.008, 0.01, ccx, dy - h, Z_FRONT - 0.085));
    chrome.push(box(cw * 0.55, 0.014, 0.018, ccx, dy - 0.035, Z_FRONT - 0.07));
    dy -= h + 0.008;
  }
  dark.push(box(cw - 0.04, 0.03, 0.01, ccx, chest.y0 + 0.02, Z_FRONT - 0.085));

  /* ---- the vise on the front left corner ---- */
  const vx = X0 + 0.32;
  const vz = Z_FRONT - 0.09;
  vise.push(box(0.16, 0.035, 0.2, vx, Y_TOP + 0.018, vz - 0.04));
  vise.push(box(0.11, 0.09, 0.15, vx, Y_TOP + 0.08, vz - 0.05));
  vise.push(box(0.17, 0.08, 0.035, vx, Y_TOP + 0.13, vz + 0.005));
  vise.push(box(0.17, 0.08, 0.035, vx, Y_TOP + 0.13, vz + 0.06));
  chrome.push(cyl(0.012, 0.2, vx, Y_TOP + 0.1, vz + 0.12, "z"));
  chrome.push(cyl(0.007, 0.24, vx, Y_TOP + 0.1, vz + 0.22, "x"));
  for (const s of [-1, 1]) chrome.push(cyl(0.014, 0.02, vx + s * 0.12, Y_TOP + 0.1, vz + 0.22, "x"));

  /* ---- on the top: a toolbox, a mug ---- */
  const tbx = X1 - 0.55;
  red.push(box(0.44, 0.17, 0.2, tbx, Y_TOP + 0.085, W + 0.25));
  dark.push(box(0.44, 0.008, 0.205, tbx, Y_TOP + 0.13, W + 0.25));
  chrome.push(box(0.24, 0.016, 0.02, tbx, Y_TOP + 0.21, W + 0.25));
  for (const s of [-1, 1]) chrome.push(box(0.016, 0.04, 0.02, tbx + s * 0.12, Y_TOP + 0.19, W + 0.25));
  bins.push(cyl(0.04, 0.1, X1 - 1.15, Y_TOP + 0.05, Z_FRONT - 0.2, "y", 16));

  /* ---- the pegboard and its tools ---- */
  const pz = W + 0.03;
  const px0 = X0 + 0.15;
  const px1 = X1 - 0.15;
  const pegFrame = [
    box(px1 - px0 + 0.06, 0.03, 0.03, (px0 + px1) / 2, F + PEG1 + 0.015, pz),
    box(px1 - px0 + 0.06, 0.03, 0.03, (px0 + px1) / 2, F + PEG0 - 0.015, pz),
    box(0.03, PEG1 - PEG0, 0.03, px0 - 0.015, F + (PEG0 + PEG1) / 2, pz),
    box(0.03, PEG1 - PEG0, 0.03, px1 + 0.015, F + (PEG0 + PEG1) / 2, pz),
  ];
  wood.push(...pegFrame);
  const tz = pz + 0.035;
  const hook = (x: number, y: number) => chrome.push(cyl(0.004, 0.05, x, y, pz + 0.025, "z", 6));
  // hammer, hung by its head
  let x = px0 + 0.25;
  grip.push(cyl(0.017, 0.34, x, F + 1.9, tz, "y"));
  dark.push(box(0.15, 0.045, 0.04, x, F + 2.08, tz));
  hook(x - 0.04, F + 2.12);
  hook(x + 0.04, F + 2.12);
  // a run of spanners, longest to shortest
  x += 0.25;
  for (let i = 0; i < 6; i++) {
    const l = 0.3 - i * 0.03;
    const sx = x + i * 0.065;
    chrome.push(box(0.022, l, 0.008, sx, F + 2.22 - l / 2, tz));
    chrome.push(cyl(0.022, 0.008, sx, F + 2.22, tz, "z", 10));
    chrome.push(cyl(0.018, 0.008, sx, F + 2.22 - l, tz, "z", 10));
    hook(sx, F + 2.27);
  }
  // screwdrivers, handles up
  x += 0.55;
  for (let i = 0; i < 5; i++) {
    const sx = x + i * 0.06;
    grip.push(cyl(0.016, 0.1, sx, F + 2.1, tz, "y", 10));
    chrome.push(cyl(0.004, 0.13 + (i % 2) * 0.04, sx, F + 1.98 - (i % 2) * 0.02, tz, "y", 6));
  }
  dark.push(box(0.34, 0.02, 0.05, x + 0.12, F + 2.04, pz + 0.03));
  // a hand saw
  x += 0.55;
  const saw = new THREE.Shape();
  saw.moveTo(0, 0);
  saw.lineTo(0.5, 0.03);
  saw.lineTo(0.5, 0.085);
  saw.lineTo(0, 0.13);
  saw.closePath();
  const blade = new THREE.ExtrudeGeometry(saw, { depth: 0.003, bevelEnabled: false });
  blade.rotateZ(-Math.PI / 2).translate(x, F + 2.3, tz);
  chrome.push(blade);
  grip.push(box(0.15, 0.1, 0.03, x + 0.06, F + 2.34, tz));
  hook(x + 0.06, F + 2.37);
  // pliers, jaws down
  x += 0.35;
  for (const s of [-1, 1]) {
    grip.push(box(0.022, 0.15, 0.012, x + s * 0.025, F + 2.14, tz, [0, 0, s * 0.18]));
    dark.push(box(0.016, 0.07, 0.012, x + s * 0.008, F + 2.02, tz, [0, 0, -s * 0.12]));
  }
  hook(x, F + 2.23);
  // a coiled extension lead
  x += 0.33;
  const coil = new THREE.TorusGeometry(0.13, 0.016, 8, 32).translate(x, F + 1.95, tz + 0.01);
  const coil2 = new THREE.TorusGeometry(0.115, 0.016, 8, 32).translate(x + 0.01, F + 1.94, tz + 0.03);
  hook(x, F + 2.09);

  /* ---- the laptop: open, a little to the right of centre ---- */
  const lx = cx + 0.25;
  const lz = W + 0.45;
  const base = box(0.36, 0.018, 0.25, lx, Y_TOP + 0.009, lz);
  const lid = new THREE.BoxGeometry(0.36, 0.24, 0.01).translate(0, 0.12, 0).rotateX(-0.28).translate(lx, Y_TOP + 0.018, lz - 0.125);
  const screen = new THREE.PlaneGeometry(0.33, 0.21).translate(0, 0.125, 0.0055).rotateX(-0.28).translate(lx, Y_TOP + 0.018, lz - 0.125);

  /* ---- the clamp lamp on the back edge: post, arm, shade over the vise end ---- */
  const lampBase = { x: X0 + 0.95, z: W + 0.12 };
  const lamp = [
    box(0.06, 0.05, 0.06, lampBase.x, Y_TOP + 0.025, lampBase.z),
    cyl(0.01, 0.55, lampBase.x, Y_TOP + 0.3, lampBase.z),
    cyl(0.009, 0.42, lampBase.x, Y_TOP + 0.6, lampBase.z + 0.2, "z"),
  ];
  const shade = new THREE.ConeGeometry(0.075, 0.11, 18, 1, true).translate(lampBase.x, Y_TOP + 0.54, lampBase.z + 0.42);

  return {
    steel: merge(steel),
    wood: merge(wood),
    red: merge(red),
    chrome: merge(chrome),
    dark: merge([...dark, base, lid, ...lamp]),
    vise: merge(vise),
    grip: merge(grip),
    bins: merge(bins),
    lead: merge([coil, coil2]),
    pegboard: new THREE.PlaneGeometry(px1 - px0, PEG1 - PEG0).translate((px0 + px1) / 2, F + (PEG0 + PEG1) / 2, pz + 0.0155),
    pegSize: [px1 - px0, PEG1 - PEG0] as const,
    screen,
    shade,
    bulb: new THREE.Vector3(lampBase.x, Y_TOP + 0.5, lampBase.z + 0.42),
  };
}

export type WorkbenchHandle = { apply: (lamp: number, screen: number) => void };

export function Workbench({ ref, high }: { ref?: Ref<WorkbenchHandle>; high: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  const screen = useRef<THREE.MeshStandardMaterial>(null);

  const res = useMemo(() => {
    const geo = buildBench();
    const peg = pegTexture();
    // a hole every 50 mm
    peg.repeat.set(geo.pegSize[0] / 0.05, geo.pegSize[1] / 0.05);
    const metal = (color: string, roughness: number, metalness: number) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.4 });
    return {
      geo,
      wood: woodTexture(),
      peg,
      code: screenTexture(),
      mats: {
        steel: metal("#232a33", 0.55, 0.6),
        red: metal("#a3241b", 0.42, 0.25),
        chrome: metal("#a9b2ba", 0.3, 0.9),
        dark: metal("#15171a", 0.6, 0.4),
        vise: metal("#2f5566", 0.45, 0.5),
        grip: metal("#c9952a", 0.6, 0.05),
        bins: metal("#2b3a4a", 0.7, 0.05),
        lead: metal("#d9761c", 0.55, 0.05),
      },
    };
  }, []);

  useEffect(
    () => () => {
      Object.values(res.geo).forEach((g) => g instanceof THREE.BufferGeometry && g.dispose());
      Object.values(res.mats).forEach((m) => m.dispose());
      res.wood.dispose();
      res.peg.dispose();
      res.code.dispose();
    },
    [res],
  );

  useImperativeHandle(
    ref,
    () => ({
      apply(lamp: number, on: number) {
        if (light.current) light.current.intensity = lamp * LAMP_INTENSITY;
        if (bulb.current) bulb.current.emissiveIntensity = lamp * 3;
        if (screen.current) screen.current.emissiveIntensity = on * SCREEN_INTENSITY;
      },
    }),
    [],
  );

  const { geo, mats } = res;
  return (
    <group>
      <mesh geometry={geo.steel} material={mats.steel} castShadow={high} receiveShadow />
      <mesh geometry={geo.wood} castShadow={high} receiveShadow>
        <meshStandardMaterial map={res.wood} roughness={0.72} metalness={0} envMapIntensity={0.3} />
      </mesh>
      <mesh geometry={geo.red} material={mats.red} castShadow={high} receiveShadow />
      <mesh geometry={geo.chrome} material={mats.chrome} castShadow={high} />
      <mesh geometry={geo.dark} material={mats.dark} castShadow={high} receiveShadow />
      <mesh geometry={geo.vise} material={mats.vise} castShadow={high} receiveShadow />
      <mesh geometry={geo.grip} material={mats.grip} castShadow={high} />
      <mesh geometry={geo.bins} material={mats.bins} castShadow={high} receiveShadow />
      <mesh geometry={geo.lead} material={mats.lead} castShadow={high} />
      <mesh geometry={geo.pegboard} receiveShadow>
        <meshStandardMaterial map={res.peg} color="#8f8a80" roughness={0.9} metalness={0} envMapIntensity={0.2} />
      </mesh>

      {/* the laptop's screen: code, lit from inside */}
      <mesh geometry={geo.screen}>
        <meshStandardMaterial ref={screen} color="#05070c" emissive="#ffffff" emissiveMap={res.code} emissiveIntensity={0} roughness={0.25} />
      </mesh>

      {/* the clamp lamp: its shade, the bulb inside it, and the warm pool it throws on the worktop */}
      <mesh geometry={geo.shade} material={mats.dark} />
      <mesh position={geo.bulb}>
        <sphereGeometry args={[0.022, 12, 8]} />
        <meshStandardMaterial ref={bulb} color="#3a2a1a" emissive={LAMP_COLOR} emissiveIntensity={0} />
      </mesh>
      <pointLight ref={light} position={geo.bulb} color={LAMP_COLOR} intensity={0} decay={2} distance={2.6} />
    </group>
  );
}
