import Link from "next/link";
import { socialIcons } from "@/components/icons";
import { navLinks, site, socials } from "@/config/site";

type CompositionProps = { variant: "lit" | "unlit" };

/**
 * The homepage composition. Rendered twice: `lit` (interactive, revealed by the
 * light mask) and `unlit` (an inert, dimmed copy beneath it) so both share the
 * exact same layout.
 */
export function Composition({ variant }: CompositionProps) {
  const lit = variant === "lit";
  const idFor = (id: string) => (lit ? id : undefined);

  return (
    <>
      <div className="top">
        {lit ? (
          <Link href="/" className="brand" aria-label={`${site.brand}, home`}>
            <i className="brand-dot" aria-hidden="true" />
            {site.handle}
          </Link>
        ) : (
          <a className="brand" tabIndex={-1}>
            <i className="brand-dot" aria-hidden="true" />
            {site.handle}
          </a>
        )}
        <nav aria-label={lit ? "Primary" : undefined}>
          {navLinks.map((link) =>
            lit ? (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ) : (
              <a key={link.href} tabIndex={-1}>
                {link.label}
              </a>
            ),
          )}
        </nav>
      </div>

      <h1 className="name" id={idFor("name")}>
        <span>HERE&apos;S</span>
        <span>HARSHAD</span>
      </h1>

      <div className="bottom">
        <p>
          <strong>Coming soon.</strong>{" "}
          <span className="when-dark">
            The site is still in the dark. Bring your own light, or pull the chain.
          </span>
          <span className="when-light">Lights on. Still at the drawing stage.</span>
          <span className="small">
            Portfolio, projects and experiments are being built here.
          </span>
        </p>
        <div className="meter" aria-label="Build status: lights on, pages next">
          <div>
            <span>lights on</span>
            <span>pages next</span>
          </div>
          <b />
        </div>
        <div className="contact">
          <span className="label">Contact</span>
          {lit ? (
            <a className="mail" href={`mailto:${site.email}`}>
              {site.email}
            </a>
          ) : (
            <a className="mail" tabIndex={-1}>
              {site.email}
            </a>
          )}
          <div className="socials">
          {socials.map(({ id, label, url }) => {
            if (!url) return null;
            const Icon = socialIcons[id];
            const content = (
              <>
                <Icon className="glyph" />
                {label}
              </>
            );
            return lit ? (
              <a key={id} href={url} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            ) : (
              <a key={id} tabIndex={-1}>
                {content}
              </a>
            );
          })}
          </div>
        </div>
      </div>

      {lit && (
        <>
          <div className="coords" id="coords" aria-hidden="true">
            x 0 &nbsp; y 0
          </div>
        </>
      )}
    </>
  );
}
