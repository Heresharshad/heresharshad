export type ProjectImage = { src: string; alt: string };

export type Project = {
  slug: string;
  title: string;
  description: string;
  technologies: string[];
  /** Path under /public, e.g. "/projects/my-app/cover.png". */
  coverImage?: string;
  url?: string;
  github?: string;
  /** Set to true to link the listing card to /work/[slug]. */
  caseStudy?: boolean;
  /** Longer write-up for the case-study page. */
  intro?: string;
  details?: string[];
  screenshots?: ProjectImage[];
  /** Marks sample content. Remove once the project is real. */
  placeholder?: boolean;
};
