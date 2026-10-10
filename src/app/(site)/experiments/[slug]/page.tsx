import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { PageHeading } from "@/components/layout/page-heading";
import { ExperimentSpecs, ExperimentStage, SourceLink } from "@/components/experiments/experiment-card";
import { experiments, getExperiment } from "@/components/experiments/registry";

/** Unknown slugs return a real HTTP 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return experiments.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/experiments/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const experiment = getExperiment(slug);
  return experiment ? { title: experiment.title, description: experiment.description } : {};
}

/** One experiment on its own, the demo at full width. */
export default async function ExperimentPage({ params }: PageProps<"/experiments/[slug]">) {
  const { slug } = await params;
  const experiment = getExperiment(slug);
  if (!experiment) notFound();
  const index = experiments.indexOf(experiment);

  return (
    <>
      <Link href="/experiments" className="mb-8 inline-flex items-center gap-2 py-2 text-sm underline-offset-8 hover:underline" data-reveal>
        <ArrowLeft className="size-4" aria-hidden="true" /> All experiments
      </Link>
      <PageHeading eyebrow={`Experiment ${String(index + 1).padStart(2, "0")}`} title={experiment.title}>
        {experiment.description}
      </PageHeading>
      <div className="grid gap-10 pb-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-sm border" data-reveal>
          <ExperimentStage experiment={experiment} index={index} className="aspect-[16/10] min-h-80" />
        </div>
        <aside className="flex flex-col gap-8" data-reveal>
          <ExperimentSpecs experiment={experiment} />
          <div>
            <SourceLink experiment={experiment} />
          </div>
        </aside>
      </div>
    </>
  );
}
