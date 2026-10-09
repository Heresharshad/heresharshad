import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/page-heading";
import { UnderConstruction } from "@/components/layout/under-construction";
import { experiments } from "@/components/experiments/registry";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Experiments" };

export default function ExperimentsPage() {
  return (
    <>
      <PageHeading eyebrow="02 Experiments" title="Experiments">
        Creative coding, GSAP animations, Three.js scenes and interactive prototypes.
      </PageHeading>
      <div className="grid gap-x-10 gap-y-16 md:grid-cols-2">
        {experiments.map(({ slug, title, description, tags, Demo }) => (
          <article key={slug} className="flex flex-col gap-4" data-reveal>
            <div className="blueprint-cover aspect-[16/10] overflow-hidden rounded-sm border bg-card">
              <Demo />
            </div>
            <h2 className="text-2xl font-semibold">{title}</h2>
            <p className="max-w-[55ch] text-muted-foreground">{description}</p>
            <ul className="flex flex-wrap gap-2" aria-label="Tags">
              {tags.map((t) => (
                <li key={t}><Badge variant="secondary">{t}</Badge></li>
              ))}
            </ul>
          </article>
        ))}
        <div className="flex items-center">
          <UnderConstruction title="More experiments loading...">
            The lab is mid-experiment. Something may explode, but it will be
            the good kind of explosion. Probably.
          </UnderConstruction>
        </div>
      </div>
    </>
  );
}
