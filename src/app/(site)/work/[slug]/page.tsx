import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, GithubIcon } from "@/components/icons";
import { PageHeading } from "@/components/layout/page-heading";
import { Placeholder } from "@/components/layout/placeholder";
import { ProjectCover } from "@/components/work/project-card";
import { Badge } from "@/components/ui/badge";
import { getProject, projects } from "@/data/projects";

/** Unknown slugs return a real HTTP 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return projects.filter((p) => p.caseStudy).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  return project ? { title: project.title, description: project.description } : {};
}

export default async function ProjectPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project || !project.caseStudy) notFound();

  const { title, description, technologies, intro, details, screenshots, url, github, placeholder } = project;

  return (
    <>
      <Link href="/work" className="mb-8 inline-flex items-center gap-2 py-2 text-sm underline-offset-8 hover:underline" data-reveal>
        <ArrowLeft className="size-4" aria-hidden="true" /> All work
      </Link>
      <PageHeading eyebrow="Case study" title={title}>
        {description}
      </PageHeading>

      {placeholder && (
        <p className="mb-10 text-sm" data-reveal>
          <Placeholder>Placeholder project. Replace it in src/data/projects.ts.</Placeholder>
        </p>
      )}

      <div className="mb-14 max-w-4xl" data-reveal>
        <ProjectCover project={project} />
      </div>

      <div className="grid max-w-5xl gap-12 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6 text-lg leading-relaxed" data-reveal>
          {intro && <p className="text-xl">{intro}</p>}
          {details?.map((d) => <p key={d}>{d}</p>)}
        </div>
        <aside className="space-y-8 text-sm" data-reveal>
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Stack</h2>
            <ul className="flex flex-wrap gap-2">
              {technologies.map((t) => (
                <li key={t}><Badge variant="secondary">{t}</Badge></li>
              ))}
            </ul>
          </section>
          {(url || github) && (
            <section>
              <h2 className="mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Links</h2>
              <div className="flex flex-col gap-1">
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 py-1.5 underline-offset-8 hover:underline">
                    Live site <ArrowUpRight className="size-3" aria-hidden="true" />
                  </a>
                )}
                {github && (
                  <a href={github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 py-1.5 underline-offset-8 hover:underline">
                    <GithubIcon className="size-4" /> Repository
                  </a>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      {screenshots && screenshots.length > 0 && (
        <section className="mt-16 grid gap-6 md:grid-cols-2" aria-label="Screenshots" data-reveal>
          {screenshots.map((s) => (
            <div key={s.src} className="relative aspect-[16/10] overflow-hidden rounded-sm border">
              <Image src={s.src} alt={s.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
          ))}
        </section>
      )}
    </>
  );
}
