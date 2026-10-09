"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/config/site";
import { cn } from "@/lib/utils";

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-wrap gap-x-6 text-[15px] font-medium">
      {navLinks.map(({ label, href }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "py-2.5 underline-offset-8 hover:underline focus-visible:underline",
              active && "text-accent underline",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
