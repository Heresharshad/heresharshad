import { site } from "@/config/site";
import { SocialLinks } from "@/components/social-links";

export function SiteFooter() {
  return (
    <footer className="mt-24 flex flex-wrap items-end justify-between gap-8 border-t px-(--pad-x) py-10 text-sm">
      <div className="space-y-1">
        <p className="text-muted-foreground">&copy; {site.brand}</p>
        <a href={`mailto:${site.email}`} className="underline-offset-8 hover:underline">
          {site.email}
        </a>
      </div>
      <SocialLinks className="items-end" />
    </footer>
  );
}
