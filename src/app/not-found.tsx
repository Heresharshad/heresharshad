import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "404" };

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center px-(--pad-x)">
      <div className="blueprint-grid" aria-hidden="true" />
      <div className="relative z-10 text-center">
        <p className="page-wordmark text-[clamp(88px,22vw,280px)]">404</p>
        <p className="mt-4 text-xl">Wrong dimension. Let&apos;s get you back.</p>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-10 h-11 px-5 text-base")}>
          Back to the homepage
        </Link>
      </div>
    </main>
  );
}
