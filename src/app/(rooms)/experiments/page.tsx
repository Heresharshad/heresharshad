import type { Metadata } from "next";
import { UnderConstruction } from "@/components/layout/under-construction";
import { experiments } from "@/components/experiments/registry";
import { Badge } from "@/components/ui/badge";
import { RoomPage } from "@/components/world/room-page";

export const metadata: Metadata = { title: "Experiments" };

/** The lab: an atmospheric void behind the studio wall (haze, glows, a floor grid, drifting motes). The scene is src/components/world/environments/experiments. */
export default function ExperimentsPage() {
  return (
    <RoomPage id="experiments" className="flex-1 px-(--pad-x) pt-16">
      <div className="mb-14 max-w-3xl" data-reveal>
        <p className="room-eyebrow mb-4 text-xs uppercase tracking-[0.14em]">02 Experiments</p>
        <h1 className="room-title page-wordmark text-[clamp(26px,8.2vw,112px)] [overflow-wrap:anywhere] uppercase" data-room-light>
          Experiments
        </h1>
        <p className="room-lede mt-6 max-w-[52ch] text-lg">
          Creative coding, GSAP animations, Three.js scenes and interactive prototypes.
        </p>
      </div>
      <div className="grid gap-x-10 gap-y-16 md:grid-cols-2">
        {experiments.map(({ slug, title, description, tags, Demo }) => (
          <article key={slug} className="room-card flex flex-col gap-4 rounded-sm p-5 sm:p-6" data-reveal>
            <div className="room-card-cover aspect-[16/10] overflow-hidden rounded-sm">
              <Demo />
            </div>
            <h2 className="text-2xl font-semibold">{title}</h2>
            <p className="max-w-[55ch] text-muted-foreground">{description}</p>
            <ul className="flex flex-wrap gap-2" aria-label="Tags">
              {tags.map((t) => (
                <li key={t}>
                  <Badge variant="secondary">{t}</Badge>
                </li>
              ))}
            </ul>
          </article>
        ))}
        <div className="flex items-center" data-reveal>
          <UnderConstruction title="More experiments loading...">
            The lab is mid-experiment. Something may explode, but it will be the good kind of explosion. Probably.
          </UnderConstruction>
        </div>
      </div>
    </RoomPage>
  );
}
