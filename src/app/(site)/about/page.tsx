import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge } from "@/components/ui/badge";
import { socials } from "@/config/site";

export const metadata: Metadata = { title: "About" };

const roles = ["Product Engineer at Classavo", "Customer Success", "QA Engineering", "Frontend Development"];
const stack = [
  "React.js", "Next.js", "JavaScript", "Tailwind CSS", "MUI", "Bootstrap",
  "GSAP", "Framer Motion", "Cypress", "Playwright",
];
const linkedin = socials.find((s) => s.id === "linkedin")?.url;

export default function AboutPage() {
  return (
    <>
      <PageHeading eyebrow="04 About" title="About">
        Harshad Bhoir, based in Mumbai, India.
      </PageHeading>

      <blockquote className="mb-14 max-w-3xl border-l-2 border-accent pl-6" data-reveal>
        <p className="page-wordmark text-[clamp(26px,4.5vw,52px)]">
          The difference between good and great is only 2&deg;.
        </p>
      </blockquote>

      <div className="grid max-w-5xl gap-12 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6 text-lg leading-relaxed" data-reveal>
          <p className="text-xl">
            I&apos;m a Product Engineer at Classavo, and I wear a few hats
            there: customer success, QA and frontend development.
          </p>
          <p>
            Talking to customers keeps me close to what actually frustrates
            people. Testing keeps me honest about what I ship. Building the
            interface is where I get to turn both into something that feels
            simple to use.
          </p>
          <p>
            Day to day that means React and Next.js, a lot of Tailwind, and
            end-to-end tests with Cypress and Playwright. On the side I like adding motion
            with GSAP and Framer Motion, because small details are what make a
            product feel cared for.
          </p>
          <p>
            Heresharshad is my corner of the internet: shipped products, case
            studies, and animation and 3D experiments built just to see what
            happens. It&apos;s still being built, so thanks for stopping by
            early.
          </p>
          {linkedin && (
            <p>
              <a href={linkedin} target="_blank" rel="noopener noreferrer" className="underline underline-offset-8 hover:text-accent">
                More on LinkedIn
              </a>
            </p>
          )}
        </div>

        <aside className="space-y-8 text-sm" data-reveal>
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Focus</h2>
            <ul className="space-y-1">
              {roles.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </section>
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Tools</h2>
            <ul className="flex flex-wrap gap-2">
              {stack.map((t) => <li key={t}><Badge variant="secondary">{t}</Badge></li>)}
            </ul>
          </section>
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Education</h2>
            <p>Tilak Maharashtra Vidyapeeth, Pune</p>
          </section>
        </aside>
      </div>
    </>
  );
}
