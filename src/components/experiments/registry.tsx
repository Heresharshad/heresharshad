import type { ComponentType } from "react";
import { SpinningKnotDemo } from "./spinning-knot-demo";

export type Experiment = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  Demo: ComponentType;
};

/** Add new creative-coding experiments here; /experiments renders them in order. */
export const experiments: Experiment[] = [
  {
    slug: "spinning-knot",
    title: "Spinning knot",
    description: "A wireframe torus knot you can drag. A starting point for Three.js scenes.",
    tags: ["Three.js", "React Three Fiber"],
    Demo: SpinningKnotDemo,
  },
];
