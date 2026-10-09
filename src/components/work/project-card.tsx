import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, GithubIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/types/project";

export function ProjectCover({ project }: { project: Project }) {
  return (
    <div className="blueprint-cover relative aspect-[16/10] overflow-hidden rounded-sm border bg-card">
      {project.coverImage ? (
        <Image
          src={project.coverImage}
          alt={`${project.title} cover`}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-xs uppercase tracking-[0.14em] text-muted-foreground">
          No cover image
        </span>
      )}
    </div>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  const { slug, title, description, technologies, url, github, caseStudy, placeholder } = project;
  return (
    <article className="flex flex-col gap-4" data-reveal>
      {caseStudy ? (
        <Link href={`/work/${slug}`} aria-label={`${title} case study`}>
          <ProjectCover project={project} />
        </Link>
      ) : (
        <ProjectCover project={project} />
      )}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">
          {caseStudy ? (
            <Link href={`/work/${slug}`} className="underline-offset-8 hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
          {placeholder && <Badge variant="outline" className="ml-3 align-middle text-accent">Placeholder</Badge>}
        </h2>
        <p className="max-w-[55ch] text-muted-foreground">{description}</p>
        <ul className="flex flex-wrap gap-2" aria-label="Technologies">
          {technologies.map((t) => (
            <li key={t}>
              <Badge variant="secondary">{t}</Badge>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-x-5 text-sm">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 py-1.5 underline-offset-8 hover:underline">
              Visit <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          )}
          {github && (
            <a href={github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 py-1.5 underline-offset-8 hover:underline">
              <GithubIcon className="size-4" /> Source
            </a>
          )}
          {caseStudy && (
            <Link href={`/work/${slug}`} className="inline-flex items-center gap-1.5 py-1.5 underline-offset-8 hover:underline">
              Case study <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
