import type { ComponentType } from "react";
import { SpinningKnotDemo } from "./spinning-knot-demo";

export type Experiment = {
  slug: string;
  title: string;
  description: string;
  /** Top right of the preview, e.g. the rendering technology. */
  medium: string;
  /** Bottom left of the preview: how to interact with it. */
  hint: string;
  stack: string[];
  type: string;
  status: "Live" | "In progress";
  /** Path of the experiment's source in the repository, for "View source". */
  source: string;
  Demo: ComponentType;
};

/** The repository the "View source" links point into. */
export const SOURCE_REPO = "https://github.com/Heresharshad/heresharshad/blob/main/";

/** Add new creative-coding experiments here; /experiments renders them in order. */
export const experiments: Experiment[] = [
  {
    slug: "torus-knot",
    title: "Torus Knot",
    description: "A wireframe knot you can grab and spin. One Three.js scene, drawn with React Three Fiber.",
    medium: "Three.js / WebGL",
    hint: "Drag to rotate",
    stack: ["Three.js", "React Three Fiber"],
    type: "Interactive 3D",
    status: "Live",
    source: "src/components/experiments/spinning-knot.tsx",
    Demo: SpinningKnotDemo,
  },
];

/** Empty places held for the experiments still to come. */
export const OPEN_SLOTS = 2;

export function getExperiment(slug: string) {
  return experiments.find((e) => e.slug === slug);
}
