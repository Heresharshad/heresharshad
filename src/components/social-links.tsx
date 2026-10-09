import { ArrowUpRight, socialIcons } from "@/components/icons";
import { socials } from "@/config/site";
import { cn } from "@/lib/utils";

/** Renders every social link that has a URL configured in src/config/site.ts. */
export function SocialLinks({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {socials
        .filter((s) => s.url)
        .map(({ id, label, url }) => {
          const Icon = socialIcons[id];
          return (
            <li key={id}>
              <a
                href={url!}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 py-1.5 underline-offset-8 hover:underline focus-visible:underline"
              >
                <Icon className="size-4" />
                {label}
                <ArrowUpRight className="size-3 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </a>
            </li>
          );
        })}
    </ul>
  );
}
