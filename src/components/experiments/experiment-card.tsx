import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";
import { UnderConstruction } from "@/components/layout/under-construction";
import { SOURCE_REPO, type Experiment } from "./registry";

const pad = (n: number) => String(n).padStart(2, "0");

/** The live demo in a viewfinder: corner marks, the experiment's number, its medium and how to handle it. */
export function ExperimentStage({ experiment, index, className = "" }: { experiment: Experiment; index: number; className?: string }) {
  const { Demo, medium, hint } = experiment;
  return (
    <div className={`exp-stage relative overflow-hidden ${className}`}>
      <Demo />
      <span className="exp-corner exp-corner-tl" aria-hidden="true" />
      <span className="exp-corner exp-corner-tr" aria-hidden="true" />
      <span className="exp-corner exp-corner-bl" aria-hidden="true" />
      <span className="exp-corner exp-corner-br" aria-hidden="true" />
      <p className="exp-label left-9 top-[18px]">Exp {pad(index + 1)}</p>
      <p className="exp-label right-9 top-[18px]">{medium}</p>
      <p className="exp-label bottom-[18px] left-9">{hint}</p>
    </div>
  );
}

/** Stack, type and status as a ruled list. */
export function ExperimentSpecs({ experiment }: { experiment: Experiment }) {
  const rows = [
    ["Stack", experiment.stack.join(", ")],
    ["Type", experiment.type],
    ["Status", experiment.status],
  ];
  return (
    <dl className="text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="flex items-baseline justify-between gap-6 border-b border-white/10 py-3 first:border-t">
          <dt className="exp-meta">{term}</dt>
          <dd className="text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SourceLink({ experiment }: { experiment: Experiment }) {
  return (
    <a
      href={SOURCE_REPO + experiment.source}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 border-b border-accent/40 py-1 text-sm text-accent transition-colors hover:border-accent"
    >
      View source <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </a>
  );
}

/** One experiment, the live demo on the left and its card on the right. */
export function ExperimentCard({ experiment, index }: { experiment: Experiment; index: number }) {
  const { slug, title, description } = experiment;
  return (
    <article className="exp-card room-card grid overflow-hidden rounded-sm lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" data-reveal>
      <ExperimentStage experiment={experiment} index={index} className="aspect-[4/3] border-b border-white/10 sm:aspect-auto sm:h-[clamp(240px,42svh,420px)] lg:h-auto lg:border-r lg:border-b-0" />
      <div className="flex flex-col p-6 sm:p-8">
        <p className="mb-3 text-xs uppercase tracking-[0.14em] text-accent">Experiment {pad(index + 1)}</p>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        <p className="mt-3 mb-6 text-muted-foreground">{description}</p>
        <ExperimentSpecs experiment={experiment} />
        <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-4 pt-8">
          <Link
            href={`/experiments/${slug}`}
            className="inline-flex h-11 items-center gap-2 rounded-sm bg-accent px-5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/85"
          >
            Open experiment <span aria-hidden="true">&rarr;</span>
          </Link>
          <SourceLink experiment={experiment} />
        </div>
      </div>
    </article>
  );
}

/** What comes next: the work in progress and an empty, numbered slot for each experiment still to come. */
export function NextUp({ from, slots }: { from: number; slots: number }) {
  return (
    <section className="mt-16" aria-labelledby="next-up">
      <h2 id="next-up" data-reveal className="exp-meta mb-6 flex items-center gap-4 after:h-px after:flex-1 after:bg-white/10">
        Next up
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <UnderConstruction title="More experiments loading..." className="room-card col-span-2 lg:col-span-1">
          The lab is mid-experiment. Something may explode, but it will be the good kind of explosion. Probably.
        </UnderConstruction>
        {Array.from({ length: slots }, (_, i) => (
          <div key={i} data-reveal className="exp-slot flex min-h-40 flex-col justify-between gap-6 rounded-sm p-5 sm:min-h-48 sm:p-6">
            <span className="exp-slot-num" aria-hidden="true">{pad(from + i)}</span>
            <p className="exp-meta">Slot open</p>
          </div>
        ))}
      </div>
    </section>
  );
}
