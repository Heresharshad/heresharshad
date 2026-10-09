"use client";

import { usePageReveal } from "@/lib/animations/use-page-reveal";

/** Wraps page content; children marked `data-reveal` animate in on navigation. */
export function PageReveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = usePageReveal<HTMLElement>();
  return (
    <main ref={ref} className={className}>
      {children}
    </main>
  );
}
