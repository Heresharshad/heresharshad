import * as THREE from "three";
import type { CameraPose, PathKey, V3 } from "./types";

/*
 * A camera move through keyframes: position and look-at each run along a
 * centripetal Catmull-Rom spline so the path bends smoothly through the
 * doorway, while each key's `at` sets the pacing along it.
 */
export class CameraPath {
  private pos: THREE.CatmullRomCurve3;
  private look: THREE.CatmullRomCurve3;
  private at: number[];
  private fov: number[];
  private a = new THREE.Vector3();

  constructor(start: CameraPose, keys: PathKey[]) {
    const all = [{ at: 0, ...start }, ...keys];
    const v = (p: V3) => new THREE.Vector3(...p);
    this.pos = new THREE.CatmullRomCurve3(all.map((k) => v(k.pos)), false, "centripetal");
    this.look = new THREE.CatmullRomCurve3(all.map((k) => v(k.look)), false, "centripetal");
    this.at = all.map((k) => k.at);
    this.fov = all.map((k) => k.fov ?? start.fov);
  }

  /** Writes the pose at travel t (0..1) into the camera. */
  apply(t: number, camera: THREE.PerspectiveCamera) {
    const n = this.at.length;
    let i = 0;
    while (i < n - 2 && t > this.at[i + 1]) i++;
    const span = Math.max(1e-5, this.at[i + 1] - this.at[i]);
    const f = Math.min(1, Math.max(0, (t - this.at[i]) / span));
    // the spline is parameterised by segment: u = (i + f) / (n - 1)
    const u = (i + f) / (n - 1);
    this.pos.getPoint(u, camera.position);
    this.look.getPoint(u, this.a);
    camera.lookAt(this.a);
    camera.fov = this.fov[i] + (this.fov[i + 1] - this.fov[i]) * f;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
}
