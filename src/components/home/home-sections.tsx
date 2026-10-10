import Link from "next/link";
import { ArrowUpRight, socialIcons } from "@/components/icons";
import { TransitionLink } from "@/components/world/transition-link";
import { experiments } from "@/components/experiments/registry";
import { site, socials } from "@/config/site";
import { projects } from "@/data/projects";

/*
 * The homepage content, server-rendered. Each [data-scene] is one stop for the
 * camera and the bulb (see studio-scene.tsx); content sits on the side of the
 * frame the bulb is not on: work left, experiments right, about left, contact right.
 * Links into other rooms of the world (TransitionLink) leave through the wall.
 */

function SceneHead({ index, label }: { index: string; label: string }) {
  return (
    <div className="scene-head">
      <span>{index}</span>
      <span className="scene-rule" data-measure />
      <span>{label}</span>
    </div>
  );
}

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <TransitionLink href={href} className="more-link">
      {children}
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </TransitionLink>
  );
}

export function HeroScene() {
  return (
    <section id="top" data-scene="hero" className="hero" aria-label="Introduction">
      <div className="hero-stage">
        <div className="hero-meta" data-hero-fade>
          <span>Portfolio / 2026</span>
          <span className="max-sm:hidden">{site.coordinates}</span>
          <span className="hero-coords max-md:hidden" data-coords aria-hidden="true">
            X +0000 Y +0000
          </span>
        </div>

        <div className="hero-body" data-hero-shift>
          <h1 className="hero-name" data-hero-name>
            <span className="hero-shade" aria-hidden="true">
              <span>Here&apos;s</span>
              <span>Harshad</span>
            </span>
            <span className="hero-fill">
              <span>Here&apos;s</span> <span>Harshad</span>
            </span>
          </h1>
          <div className="hero-dim" aria-hidden="true">
            <i />
            <span data-dim-width>—</span>
            <i />
          </div>
        </div>

        <div className="hero-foot" data-hero-fade>
          <p className="hero-intro">
            <strong>Product engineer &amp; creative developer</strong> in {site.location.split(",")[0]}.{" "}
            <span className="when-dark">The portfolio is still in the dark. Pull the chain, or scroll.</span>
            <span className="when-lit">Lights on. Still at the drawing stage.</span>
          </p>
          <div className="hero-status" aria-label="Build status: lights on, pages next">
            <div>
              <span>Lights on</span>
              <span>Pages next</span>
            </div>
            <b />
          </div>
          <a href="#work" className="hero-scroll">
            Scroll
            <i aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

export function WorkScene() {
  return (
    <section id="work" data-scene className="scene scene-left" aria-labelledby="work-title">
      <SceneHead index="01" label="Work" />
      <h2 id="work-title" className="scene-title" data-sweep>
        Selected work
      </h2>
      <p className="scene-lede">Shipped products and the case studies behind them.</p>

      {projects.length > 0 ? (
        <ol className="index-list">
          {projects.map((p, i) => (
            <li key={p.slug}>
              <Link href={p.caseStudy ? `/work/${p.slug}` : "/work"}>
                <span className="index-num">W.{String(i + 1).padStart(2, "0")}</span>
                <span className="index-title">{p.title}</span>
                <span className="index-tags">{p.technologies.slice(0, 3).join(" · ")}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="plate" data-depth>
          <div className="plate-meta">
            <span>Sheet 01</span>
            <span>Status: drafting</span>
          </div>
          <p className="plate-title">Case studies are on the drawing board.</p>
          <p className="plate-body">
            Right now I&apos;m a {site.role}: customer success, QA and frontend in one seat. The first write-ups
            land here soon.
          </p>
        </div>
      )}
      <MoreLink href="/work">All work</MoreLink>
    </section>
  );
}

export function ExperimentsScene() {
  return (
    <section id="experiments" data-scene className="scene scene-right" aria-labelledby="experiments-title">
      <SceneHead index="02" label="Experiments" />
      <h2 id="experiments-title" className="scene-title" data-sweep>
        The lab
      </h2>
      <p className="scene-lede">Creative coding, GSAP motion and Three.js scenes, built to see what happens.</p>
      <ol className="index-list">
        {experiments.map((e, i) => (
          <li key={e.slug}>
            <TransitionLink href="/experiments">
              <span className="index-num">E.{String(i + 1).padStart(2, "0")}</span>
              <span className="index-title">{e.title}</span>
              <span className="index-tags">{e.tags.join(" · ")}</span>
            </TransitionLink>
            <p className="index-desc">{e.description}</p>
          </li>
        ))}
        <li className="index-pending" aria-label="More experiments in progress">
          <span className="index-num">E.{String(experiments.length + 1).padStart(2, "0")}</span>
          <span className="index-title">Mid-experiment</span>
        </li>
      </ol>
      <MoreLink href="/experiments">Open the lab</MoreLink>
    </section>
  );
}

export function AboutScene() {
  return (
    <section id="about" data-scene className="scene scene-left" aria-labelledby="about-title">
      <SceneHead index="03" label="About" />
      <h2 id="about-title" className="sr-only">
        About
      </h2>
      <figure className="about-quote">
        <blockquote data-sweep>
          <p>{site.quote}</p>
        </blockquote>
        {/* the 2°, drawn like an angle callout */}
        <svg className="about-angle" viewBox="0 0 120 40" aria-hidden="true">
          <path d="M2 38 H118" />
          <path d="M2 38 L118 33.95" />
          <path d="M96 38 A94 94 0 0 0 95.9 34.7" />
          <text x="100" y="30">
            2°
          </text>
        </svg>
      </figure>
      <div className="about-body">
        <p>
          I&apos;m Harshad, a {site.role}. Talking to customers keeps me close to what frustrates people, testing keeps me
          honest about what I ship, and building the interface is where both turn into something that feels simple.
        </p>
        <dl className="about-facts">
          <div>
            <dt>Based</dt>
            <dd>{site.location}</dd>
          </div>
          <div>
            <dt>Focus</dt>
            <dd>Frontend, QA, motion</dd>
          </div>
          <div>
            <dt>Tools</dt>
            <dd>Next.js, GSAP, Three.js, Playwright</dd>
          </div>
        </dl>
      </div>
      <MoreLink href="/about">More about me</MoreLink>
    </section>
  );
}

export function ContactScene() {
  const year = 2026;
  return (
    <section id="contact" data-scene className="scene scene-contact" aria-labelledby="contact-title">
      <div className="contact-inner">
        <SceneHead index="04" label="Contact" />
        <h2 id="contact-title" className="scene-title" data-sweep>
          Say hello
        </h2>
        <a href={`mailto:${site.email}`} className="contact-mail">
          {site.email.split("@")[0]}@<wbr />
          {site.email.split("@")[1]}
        </a>
        <ul className="contact-socials">
          {socials.map(({ id, label, url }) => {
            if (!url) return null;
            const Icon = socialIcons[id];
            const handle = new URL(url).pathname.replace(/\/$/, "");
            return (
              <li key={id}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{label}</span>
                  <span className="contact-handle" aria-hidden="true">
                    {handle}
                  </span>
                  <ArrowUpRight className="size-3.5 opacity-70" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      <footer className="contact-foot">
        <span>
          &copy; {year} {site.brand}
        </span>
        <span>{site.coordinates}</span>
        <span>Built with Next.js, Three.js &amp; GSAP</span>
      </footer>
    </section>
  );
}
