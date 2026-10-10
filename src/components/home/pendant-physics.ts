import * as THREE from "three";

/*
 * Verlet simulation of the pendant: a fabric cord hanging from a ceiling rail,
 * the rigid bulb (socket top S -> glass bottom B) on its end, and a bead pull
 * chain hanging from an eyelet on the socket. Everything is in world units.
 */

export const CORD_SEGMENTS = 18;
export const CHAIN_SEGMENTS = 24;
/** Socket top to the bottom of the glass. */
export const BULB_LENGTH = 1.02;
/** Eyelet on the socket the chain hangs from, in the bulb's frame (down, side). */
const EYELET = { down: 0.36, side: 0.11 };
export const CHAIN_LENGTH = 0.95;
const GRAVITY = 30;
const SUBSTEP = 1 / 120;
const ITERATIONS = 10;

const S = CORD_SEGMENTS; // index of the socket top
const B = S + 1; // index of the glass bottom
const C0 = B + 1; // first chain point (pinned to the eyelet)
export const POINTS = C0 + CHAIN_SEGMENTS + 1;
export const KNOB = POINTS - 1;

type Constraint = { a: number; b: number; len: number };

export class PendantSim {
  pos = new Float32Array(POINTS * 3);
  prev = new Float32Array(POINTS * 3);
  inv = new Float32Array(POINTS);
  private cons: Constraint[] = [];
  private acc = 0;
  /** Where the chain is being pulled to (world), or null. */
  pull: THREE.Vector3 | null = null;
  private tmp = new THREE.Vector3();
  private axis = new THREE.Vector3();
  private eyelet = new THREE.Vector3();

  constructor(anchor: THREE.Vector3, cordLength: number) {
    for (let i = 0; i < POINTS; i++) this.inv[i] = 1;
    for (let i = 1; i < S; i++) this.inv[i] = 1 / 0.08;
    this.inv[0] = 0;
    this.inv[S] = 1;
    this.inv[B] = 1 / 2.5;
    this.inv[C0] = 0;
    for (let i = C0 + 1; i < KNOB; i++) this.inv[i] = 1 / 0.03;
    this.inv[KNOB] = 1 / 0.2;

    for (let i = 0; i < S; i++) this.cons.push({ a: i, b: i + 1, len: cordLength / S });
    this.cons.push({ a: S, b: B, len: BULB_LENGTH });
    for (let i = C0; i < KNOB; i++) this.cons.push({ a: i, b: i + 1, len: CHAIN_LENGTH / CHAIN_SEGMENTS });
    this.hangStraight(anchor, cordLength);
  }

  get(i: number, out: THREE.Vector3) {
    return out.fromArray(this.pos, i * 3);
  }

  /** Puts every point at rest, straight down from the anchor. */
  hangStraight(anchor: THREE.Vector3, cordLength: number) {
    const set = (i: number, y: number, x = anchor.x) => {
      this.pos.set([x, y, anchor.z], i * 3);
      this.prev.set([x, y, anchor.z], i * 3);
    };
    for (let i = 0; i <= S; i++) set(i, anchor.y - (cordLength * i) / S);
    const sy = anchor.y - cordLength;
    set(B, sy - BULB_LENGTH);
    for (let i = C0; i <= KNOB; i++) {
      set(i, sy - EYELET.down - ((i - C0) * CHAIN_LENGTH) / CHAIN_SEGMENTS, anchor.x + EYELET.side);
    }
  }

  setCordLength(len: number) {
    for (let i = 0; i < S; i++) this.cons[i].len = len / S;
  }

  /** Unit axis of the bulb (S -> B) and the eyelet position. */
  frame(axis: THREE.Vector3, eyelet: THREE.Vector3) {
    const p = this.pos;
    axis.set(p[B * 3] - p[S * 3], p[B * 3 + 1] - p[S * 3 + 1], p[B * 3 + 2] - p[S * 3 + 2]).normalize();
    // side vector: perpendicular to the axis in the picture plane
    eyelet
      .set(p[S * 3], p[S * 3 + 1], p[S * 3 + 2])
      .addScaledVector(axis, EYELET.down)
      .add(this.tmp.set(-axis.y, axis.x, 0).normalize().multiplyScalar(EYELET.side));
  }

  private pin(i: number, v: THREE.Vector3) {
    this.pos[i * 3] = v.x;
    this.pos[i * 3 + 1] = v.y;
    this.pos[i * 3 + 2] = v.z;
  }

  /** Pushes a point (world units per second), e.g. a gust from the cursor. */
  nudge(i: number, v: THREE.Vector3, dt: number) {
    this.prev[i * 3] -= v.x * dt;
    this.prev[i * 3 + 1] -= v.y * dt;
    this.prev[i * 3 + 2] -= v.z * dt;
  }

  /** `hold` adds heavy damping, e.g. while someone is reaching for the chain. */
  step(dt: number, anchor: THREE.Vector3, hold = false) {
    this.acc = Math.min(this.acc + dt, SUBSTEP * 6);
    const { axis, eyelet } = this;
    const p = this.pos;
    const q = this.prev;
    const g = -GRAVITY * SUBSTEP * SUBSTEP;
    while (this.acc >= SUBSTEP) {
      this.acc -= SUBSTEP;
      for (let i = 0; i < POINTS; i++) {
        if (this.inv[i] === 0) continue;
        const k = i * 3;
        // the chain is light and lossy, the bulb swings for a long time
        const damp = (i > B ? 0.982 : 0.9935) * (hold ? 0.97 : 1);
        for (let c = 0; c < 3; c++) {
          const v = (p[k + c] - q[k + c]) * damp;
          q[k + c] = p[k + c];
          p[k + c] += v + (c === 1 ? g : 0);
        }
        // keep the swing mostly in the picture plane
        p[k + 2] += (anchor.z - p[k + 2]) * 0.02;
      }
      // a pulled chain drags the bulb towards the hand
      if (this.pull) {
        this.frame(axis, eyelet);
        const d = this.tmp.copy(this.pull).sub(eyelet);
        const stretch = d.length() - CHAIN_LENGTH;
        if (stretch > 0) {
          d.normalize().multiplyScalar(stretch * 0.08);
          p[B * 3] += d.x;
          p[B * 3 + 1] += d.y;
        }
      }
      for (let it = 0; it < ITERATIONS; it++) {
        this.pin(0, anchor);
        this.frame(axis, eyelet);
        this.pin(C0, eyelet);
        if (this.pull) this.pin(KNOB, this.pull);
        for (const { a, b, len } of this.cons) {
          const ia = this.inv[a];
          const ib = this.inv[b];
          const w = ia + ib;
          if (w === 0) continue;
          const ka = a * 3;
          const kb = b * 3;
          const dx = p[kb] - p[ka];
          const dy = p[kb + 1] - p[ka + 1];
          const dz = p[kb + 2] - p[ka + 2];
          const dist = Math.hypot(dx, dy, dz) || 1e-6;
          const f = (dist - len) / (dist * w);
          p[ka] += dx * f * ia;
          p[ka + 1] += dy * f * ia;
          p[ka + 2] += dz * f * ia;
          p[kb] -= dx * f * ib;
          p[kb + 1] -= dy * f * ib;
          p[kb + 2] -= dz * f * ib;
        }
      }
    }
  }
}

/**
 * A tube whose centre line is rewritten every frame (fixed topology, no
 * allocation). Catmull-Rom smooths the polyline; parallel transport keeps the
 * rings from twisting.
 */
export class LiveTube {
  geometry = new THREE.BufferGeometry();
  /** Length of the centre line after the last update. */
  length = 0;
  private samples: THREE.Vector3[];
  private radial: number;
  private radius: number;

  constructor(controlPoints: number, subdiv: number, radial: number, radius: number) {
    const n = (controlPoints - 1) * subdiv + 1;
    this.samples = Array.from({ length: n }, () => new THREE.Vector3());
    this.radial = radial;
    this.radius = radius;
    const ring = radial + 1;
    const position = new Float32Array(n * ring * 3);
    const normal = new Float32Array(n * ring * 3);
    const uv = new Float32Array(n * ring * 2);
    const index: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < ring; j++) {
        uv.set([i / (n - 1), j / radial], (i * ring + j) * 2);
        if (i < n - 1 && j < radial) {
          const a = i * ring + j;
          const b = a + ring;
          index.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    this.geometry.setAttribute("position", new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setIndex(index);
  }

  /** `pts` are the control points, in order. */
  update(pts: THREE.Vector3[]) {
    const s = this.samples;
    const sub = (s.length - 1) / (pts.length - 1);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < sub; k++) {
        const t = k / sub;
        const t2 = t * t;
        const t3 = t2 * t;
        const out = s[i * sub + k];
        for (const c of ["x", "y", "z"] as const) {
          out[c] =
            0.5 *
            (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
        }
      }
    }
    s[s.length - 1].copy(pts[pts.length - 1]);

    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const nor = this.geometry.attributes.normal as THREE.BufferAttribute;
    const uv = this.geometry.attributes.uv as THREE.BufferAttribute;
    // u follows arc length, so a texture keeps its scale on short wraps and long runs alike
    let total = 0;
    for (let i = 1; i < s.length; i++) total += s[i].distanceTo(s[i - 1]);
    this.length = total;
    let run = 0;
    const T = new THREE.Vector3();
    const N = new THREE.Vector3(1, 0, 0);
    const Bn = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const ring = this.radial + 1;
    for (let i = 0; i < s.length; i++) {
      T.subVectors(s[Math.min(i + 1, s.length - 1)], s[Math.max(i - 1, 0)]).normalize();
      N.addScaledVector(T, -N.dot(T));
      if (N.lengthSq() < 1e-6) N.set(0, 0, 1).addScaledVector(T, -T.z);
      N.normalize();
      Bn.crossVectors(T, N);
      if (i > 0) run += s[i].distanceTo(s[i - 1]);
      for (let j = 0; j < ring; j++) {
        uv.setX(i * ring + j, total > 0 ? run / total : 0);
        const a = (j / this.radial) * Math.PI * 2;
        dir.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(Bn, Math.sin(a));
        const k = i * ring + j;
        nor.setXYZ(k, dir.x, dir.y, dir.z);
        pos.setXYZ(k, s[i].x + dir.x * this.radius, s[i].y + dir.y * this.radius, s[i].z + dir.z * this.radius);
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    uv.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  dispose() {
    this.geometry.dispose();
  }
}
