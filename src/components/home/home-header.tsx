import { navLinks, site } from "@/config/site";

/** Homepage header: nav items jump to the sections below; the active one is marked on scroll. */
export function HomeHeader() {
  return (
    <header className="home-header">
      <a href="#top" className="home-wordmark" aria-label={`${site.brand}, back to top`}>
        Here&apos;s Harshad
      </a>
      <nav aria-label="Primary">
        <ol className="home-nav">
          {navLinks.map(({ label, href }, i) => {
            const id = href.replace("/", "");
            return (
              <li key={href}>
                <a href={`#${id}`} data-nav={id}>
                  <span className="home-nav-index" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {label}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </header>
  );
}
