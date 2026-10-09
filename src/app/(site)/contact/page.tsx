import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/page-heading";
import { Placeholder } from "@/components/layout/placeholder";
import { SocialLinks } from "@/components/social-links";
import { site, socials } from "@/config/site";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  const missing = socials.filter((s) => !s.url);
  return (
    <div className="flex min-h-[55vh] flex-col justify-between gap-16">
      <div>
        <PageHeading eyebrow="Contact" title="Say hello">
          Projects, collaborations or just a good idea. Email is the quickest way.
        </PageHeading>
        <a
          href={`mailto:${site.email}`}
          className="text-[clamp(20px,3.4vw,40px)] font-semibold underline underline-offset-8 [overflow-wrap:anywhere] hover:text-accent"
          data-reveal
        >
          {site.email}
        </a>
      </div>

      <div className="flex flex-col items-end gap-3 self-end text-right" data-reveal>
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Elsewhere</span>
        <SocialLinks className="items-end" />
        {missing.map((s) => (
          <p key={s.id} className="text-sm">
            <Placeholder>{s.label}: set the URL in src/config/site.ts</Placeholder>
          </p>
        ))}
      </div>
    </div>
  );
}
