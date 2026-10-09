import type { Project } from "@/types/project";

/**
 * Add projects here; /work and /work/[slug] pick them up automatically.
 * Real entries need only `slug`, `title`, `description` and `technologies`.
 */
export const projects: Project[] = [
  // Example:
  // {
  //   slug: "my-project",
  //   title: "My project",
  //   description: "One-line summary.",
  //   technologies: ["Next.js", "TypeScript"],
  //   caseStudy: true,
  // },
];

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
