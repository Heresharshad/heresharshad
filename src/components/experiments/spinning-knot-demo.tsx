"use client";

import dynamic from "next/dynamic";

/** Browser-only: three.js is loaded lazily and never rendered on the server. */
const SpinningKnot = dynamic(() => import("./spinning-knot"), {
  ssr: false,
  loading: () => <p className="grid h-full place-items-center text-sm text-muted-foreground">Loading scene&hellip;</p>,
});

export function SpinningKnotDemo() {
  return <SpinningKnot />;
}
