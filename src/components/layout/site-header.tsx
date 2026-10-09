import Link from "next/link";
import { site } from "@/config/site";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-10 gap-y-2 px-(--pad-x) pt-8">
      <Link href="/" className="page-wordmark inline-flex items-center gap-2.5 py-2 text-lg" aria-label={`${site.brand}, home`}>
        <i className="size-2.5 rounded-full bg-accent shadow-[0_0_12px_rgba(var(--accent-rgb),0.7)]" aria-hidden="true" />
        {site.handle}
      </Link>
      <NavLinks />
    </header>
  );
}
