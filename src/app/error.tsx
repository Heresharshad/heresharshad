"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative grid min-h-dvh place-items-center px-(--pad-x)">
      <div className="blueprint-grid" aria-hidden="true" />
      <div className="relative z-10 text-center">
        <p className="page-wordmark text-[clamp(40px,8vw,96px)] uppercase">Short circuit</p>
        <p className="mt-4 text-lg text-muted-foreground">Something went wrong. Try again, or head back home.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="h-11 px-5 text-base" onClick={reset}>Try again</Button>
          <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5 text-base")}>
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
