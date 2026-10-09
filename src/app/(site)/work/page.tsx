import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/page-heading";
import { UnderConstruction } from "@/components/layout/under-construction";
import { ProjectCard } from "@/components/work/project-card";
import { projects } from "@/data/projects";

export const metadata: Metadata = { title: "Work" };

export default function WorkPage() {
  return (
    <>
      <PageHeading eyebrow="01 Work" title="Work">
        Shipped products and case studies.
      </PageHeading>
      {projects.length === 0 ? (
        <UnderConstruction title="This page is in QA. It works on my machine.">
          The projects are real, the page is not. Last bug count: 99. Fixed
          one, now there are 117. Check back soon, and please don&apos;t
          refresh the hamster.
        </UnderConstruction>
      ) : (
        <div className="grid gap-x-10 gap-y-16 md:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      )}
    </>
  );
}
