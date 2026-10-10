import type { Metadata } from "next";
import { ExperimentCard, NextUp } from "@/components/experiments/experiment-card";
import { experiments, OPEN_SLOTS } from "@/components/experiments/registry";
import { RoomPage } from "@/components/world/room-page";

export const metadata: Metadata = { title: "Experiments" };

/** The lab: a concrete room behind the studio wall, lit by a fluorescent batten. The scene is src/components/world/environments/experiments. */
export default function ExperimentsPage() {
  return (
    <RoomPage id="experiments" className="flex-1 px-(--pad-x) pt-10">
      <div className="mb-10" data-reveal>
        <p className="room-eyebrow mb-4 text-xs uppercase tracking-[0.14em]">02 / Experiments</p>
        <h1 className="room-title page-wordmark room-wordmark uppercase" data-room-light>
          Experiments
        </h1>
        <p className="room-lede mt-4 max-w-[52ch] text-lg">
          Creative coding, GSAP animations, Three.js scenes and interactive prototypes.
        </p>
      </div>
      <div className="flex flex-col gap-10">
        {experiments.map((e, i) => (
          <ExperimentCard key={e.slug} experiment={e} index={i} />
        ))}
      </div>
      <NextUp from={experiments.length + 1} slots={OPEN_SLOTS} />
    </RoomPage>
  );
}
