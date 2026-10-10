import * as THREE from "three";

/*
 * A stagehand: a matte, faceless figure in profile (work jacket, boots, a cap),
 * working a vertical hand line hand over hand. Model units are metres for a
 * ~1.75 m figure standing at the origin and facing +x; the mechanism scales,
 * places and (for the right-hand stagehand) turns it round.
 *
 * The fists are solved onto the rope: arms use a 3D two-bone IK whose end
 * effector is the centre of the fist, and the rope runs along x = GRIP.x, z = 0,
 * so the line passes straight through both hands.
 */

/** Where the hands grip the vertical line in front of the figure (model units). */
export const GRIP = { x: 0.34, top: 1.74, stroke: 0.52 };

const UPPER_ARM = 0.3;
const FOREARM = 0.25;
/** Wrist to the centre of the fist. */
const HAND = 0.055;
const X = new THREE.Vector3(1, 0, 0);

type P = [number, number];

export type StagehandBuild = {
  /** Hip height. */
  hip: number;
  /** [hip, knee, ankle] for the front and the rear leg. */
  front: [P, P, P];
  rear: [P, P, P];
  /** Where the jacket ends below the hips. */
  hem: number;
  /** Jacket depth, front to back. */
  bulk: number;
  hat: "cap" | "beanie";
  /** Lean back held against the line's weight at rest (radians). */
  lean: number;
  /** Hand-over-hand phase the grip settles into at rest. */
  restPhase: number;
};

/** Left: braced, compact, a flat cap. Right: lower and wider, a longer coat, a knit cap. */
export const BUILDS: Record<"left" | "right", StagehandBuild> = {
  left: {
    hip: 0.93,
    front: [[0.04, 0.93], [0.17, 0.52], [0.24, 0.1]],
    rear: [[-0.03, 0.93], [-0.08, 0.5], [-0.26, 0.1]],
    hem: -0.22,
    bulk: 1,
    hat: "cap",
    lean: 0.07,
    restPhase: 0.14,
  },
  right: {
    hip: 0.9,
    front: [[0.05, 0.9], [0.24, 0.52], [0.32, 0.1]],
    rear: [[-0.04, 0.9], [-0.12, 0.48], [-0.3, 0.1]],
    hem: -0.32,
    bulk: 1.06,
    hat: "beanie",
    lean: 0.09,
    restPhase: 0.6,
  },
};

type Arm = { upper: THREE.Mesh; fore: THREE.Group; hand: THREE.Group; shoulder: THREE.Vector3; pole: THREE.Vector3 };

export type OperatorPose = {
  /** Lean back from the hips (radians, + = away from the rope). */
  lean: number;
  /** Lean velocity, for the jacket's secondary movement. */
  leanVel: number;
  /** Hand-over-hand phase: advances by 1 for every `GRIP.stroke` of rope pulled. */
  phase: number;
  /** Seconds, for breathing. */
  time: number;
  dt: number;
};

/**
 * Dark cloth that picks up a warm edge from the bulb: a fresnel rim, biased to
 * the side facing the light. `bulb` is the bulb in view space, `rim` 0..1.
 */
export function stagehandMaterial() {
  const uniforms = {
    uBulb: { value: new THREE.Vector3() },
    uRim: { value: 0 },
    uRimColor: { value: new THREE.Color("#ff9c52") },
  };
  const material = new THREE.MeshStandardMaterial({ color: "#040303", roughness: 0.95, metalness: 0.02, envMapIntensity: 0.05 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uBulb;\nuniform float uRim;\nuniform vec3 uRimColor;")
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        {
          vec3 toEye = normalize(vViewPosition);
          vec3 toBulb = normalize(uBulb + vViewPosition);
          float edge = pow(1.0 - clamp(dot(normal, toEye), 0.0, 1.0), 3.5);
          float facing = pow(clamp(dot(normal, toBulb), 0.0, 1.0), 1.4);
          totalEmissiveRadiance += uRimColor * uRim * edge * facing;
        }`,
      );
  };
  return { material, uniforms };
}

export class OperatorFigure {
  group = new THREE.Group();
  private upper = new THREE.Group();
  private head = new THREE.Group();
  private hem = new THREE.Group();
  private arms: Arm[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private hemSwing = { x: 0, v: 0 };
  private v = { s: new THREE.Vector3(), t: new THREE.Vector3(), d: new THREE.Vector3(), p: new THREE.Vector3(), e: new THREE.Vector3() };
  private build: StagehandBuild;

  constructor(
    material: THREE.Material,
    build: StagehandBuild,
    segments: number,
    shadows: boolean,
  ) {
    this.build = build;
    const keep = <G extends THREE.BufferGeometry>(g: G) => {
      this.geometries.push(g);
      return g;
    };
    /** A capsule running along +x from 0 to `len`. */
    const bone = (len: number, r: number) => {
      const g = keep(new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 3, segments));
      g.rotateZ(-Math.PI / 2);
      g.translate(len / 2, 0, 0);
      return g;
    };
    const mesh = (g: THREE.BufferGeometry, parent: THREE.Object3D) => {
      const m = new THREE.Mesh(g, material);
      m.castShadow = shadows;
      parent.add(m);
      return m;
    };
    /** A static limb between two points. */
    const limb = (a: P, b: P, r: number, z: number) => {
      const m = mesh(bone(Math.hypot(b[0] - a[0], b[1] - a[1]), r), this.group);
      m.position.set(a[0], a[1], z);
      m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
    };
    const lathe = (profile: P[], parent: THREE.Object3D) =>
      mesh(keep(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments * 2)), parent);

    // legs: work trousers, feet planted in a pulling stance, heavy boots
    for (const [[hip, knee, ankle], z] of [[build.front, 0.09], [build.rear, -0.09]] as const) {
      limb(hip, knee, 0.074, z);
      limb(knee, ankle, 0.06, z);
      const shaft = mesh(keep(new THREE.CylinderGeometry(0.058, 0.064, 0.15, segments * 2)), this.group);
      shaft.position.set(ankle[0], ankle[1] - 0.015, z);
      const boot = mesh(bone(0.29, 0.052), this.group);
      boot.position.set(ankle[0] - 0.08, 0.052, z);
    }

    // upper body pivots at the hips
    this.upper.position.set(0, build.hip, 0);
    this.group.add(this.upper);
    const torso = new THREE.Group();
    torso.scale.set(build.bulk, 1, 1.42);
    this.upper.add(torso);
    // a slightly oversized work jacket: boxy chest, dropped shoulders, collar
    lathe(
      [[0, -0.08], [0.16, -0.075], [0.152, 0.06], [0.156, 0.2], [0.16, 0.33], [0.148, 0.42], [0.11, 0.49], [0.065, 0.52], [0, 0.52]],
      torso,
    );
    // the hem hangs from the waist, so it can swing a touch as the body moves
    this.hem.position.y = -0.06;
    torso.add(this.hem);
    lathe([[0, build.hem + 0.06], [0.172, build.hem + 0.06], [0.168, build.hem + 0.1], [0.16, 0], [0, 0]], this.hem);
    const collar = mesh(keep(new THREE.TorusGeometry(0.058, 0.026, segments, segments * 3)), torso);
    collar.position.set(0.01, 0.51, 0);
    collar.rotation.x = Math.PI / 2;
    const neck = mesh(bone(0.1, 0.042), this.upper);
    neck.position.set(0.03, 0.5, 0);
    neck.rotation.z = Math.PI / 2 - 0.2;

    this.head.position.set(0.05, 0.66, 0);
    this.upper.add(this.head);
    const skull = mesh(keep(new THREE.SphereGeometry(0.08, segments * 2, segments + 2)), this.head);
    skull.scale.set(1.12, 1.24, 0.92);
    if (build.hat === "cap") {
      // a flat cap: a low crown pulled forward, a short peak
      const crown = mesh(keep(new THREE.SphereGeometry(0.096, segments * 2, segments, 0, Math.PI * 2, 0, Math.PI * 0.5)), this.head);
      crown.position.set(0.006, 0.045, 0);
      crown.scale.set(1.1, 0.46, 0.98);
      crown.rotation.z = -0.1;
      const peak = mesh(keep(new THREE.CylinderGeometry(0.07, 0.07, 0.008, segments * 3, 1, false, 0, Math.PI)), this.head);
      peak.position.set(0.07, 0.05, 0);
      peak.rotation.set(0, -Math.PI / 2, -0.18);
      peak.scale.set(1, 1, 0.7);
    } else {
      const knit = mesh(keep(new THREE.SphereGeometry(0.097, segments * 2, segments, 0, Math.PI * 2, 0, Math.PI * 0.56)), this.head);
      knit.position.set(-0.012, 0.018, 0);
      knit.scale.set(1.06, 1.08, 0.97);
      const fold = mesh(keep(new THREE.TorusGeometry(0.094, 0.014, segments, segments * 3)), this.head);
      fold.position.set(-0.008, 0.012, 0);
      fold.rotation.set(Math.PI / 2, 0.16, 0);
      fold.scale.set(1.05, 0.95, 1);
    }

    // arms are posed by IK in figure space every frame: sleeve, cuff, gloved fist
    for (const z of [0.17, -0.17]) {
      const upper = mesh(bone(UPPER_ARM, 0.054), this.group);
      const fore = new THREE.Group();
      mesh(bone(FOREARM, 0.046), fore);
      const cuff = mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, 0.05, segments * 2)), fore);
      cuff.position.x = FOREARM - 0.03;
      cuff.rotation.z = Math.PI / 2;
      this.group.add(fore);
      // the fist closes round the line: centred on it, taller than it is deep
      const hand = new THREE.Group();
      const fist = mesh(keep(new THREE.SphereGeometry(0.05, segments * 2, segments + 2)), hand);
      fist.scale.set(1.0, 1.08, 0.86);
      // knuckles closed over the far side of the line
      const knuckles = mesh(bone(0.07, 0.024), hand);
      knuckles.position.set(0.03, 0, 0);
      knuckles.rotation.set(0, 0, -Math.PI / 2 - 0.15);
      knuckles.position.y = 0.035;
      this.group.add(hand);
      this.arms.push({
        upper,
        fore,
        hand,
        shoulder: new THREE.Vector3(0.02, 0.45, z),
        // elbows hang down, a little back and out from the body
        pole: new THREE.Vector3(-0.35, -1, 0.7 * Math.sign(z)),
      });
    }
    this.update({ lean: build.lean, leanVel: 0, phase: build.restPhase, time: 0, dt: 0 });
  }

  /** Fist target for one hand, model space. The gripping hand travels down with the rope; the free hand slides back up it. */
  private handTarget(phase: number, out: THREE.Vector3) {
    const f = phase - Math.floor(phase);
    const pull = 0.78;
    if (f < pull) return out.set(GRIP.x, GRIP.top - GRIP.stroke * (f / pull), 0);
    const u = (f - pull) / (1 - pull);
    const e = u * u * (3 - 2 * u);
    // an open hand, kept close to the line, not swung away from it
    return out.set(GRIP.x - 0.045 * Math.sin(Math.PI * u), GRIP.top - GRIP.stroke * (1 - e), 0);
  }

  update({ lean, leanVel, phase, time, dt }: OperatorPose) {
    this.upper.rotation.z = lean;
    // the body counterbalances: hips forward a touch as the shoulders go back
    this.upper.position.x = lean * 0.08;
    this.upper.scale.y = 1 + Math.sin(time * 1.3) * 0.005;
    this.upper.updateMatrix();
    // the jacket hem trails the movement of the body
    const h = this.hemSwing;
    h.v += (-90 * (h.x + leanVel * 0.06) - 6 * h.v) * dt;
    h.x = Math.max(-0.08, Math.min(0.08, h.x + h.v * dt));
    this.hem.rotation.z = h.x;

    const { s, t, d, p, e } = this.v;
    let topY = 0;
    this.arms.forEach((arm, k) => {
      this.handTarget(phase + k * 0.5, t);
      topY = Math.max(topY, t.y);
      s.copy(arm.shoulder).applyMatrix4(this.upper.matrix);
      // two-bone IK, the chain ending at the centre of the fist
      const a = UPPER_ARM;
      const b = FOREARM + HAND;
      d.subVectors(t, s);
      const dist = THREE.MathUtils.clamp(d.length(), Math.abs(a - b) + 1e-3, (a + b) * 0.999);
      d.normalize();
      const cosA = (a * a + dist * dist - b * b) / (2 * a * dist);
      p.copy(arm.pole).addScaledVector(d, -arm.pole.dot(d)).normalize();
      e.copy(s)
        .addScaledVector(d, a * cosA)
        .addScaledVector(p, a * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
      arm.upper.position.copy(s);
      arm.upper.quaternion.setFromUnitVectors(X, p.subVectors(e, s).normalize());
      arm.fore.position.copy(e);
      arm.fore.quaternion.setFromUnitVectors(X, p.subVectors(t, e).normalize());
      arm.hand.position.copy(t);
      arm.hand.quaternion.copy(arm.fore.quaternion);
    });
    // eyes on the work: the head follows the upper hand, and goes back with the lean
    this.head.rotation.z = 0.12 + lean * 0.5 + (topY - 1.45) * 0.45;
  }

  dispose() {
    this.geometries.forEach((g) => g.dispose());
  }
}
