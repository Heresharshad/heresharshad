"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { canEnter, enter, warm } from "./controller";
import { world } from "./store";

/**
 * A link into another room. A plain click on a registered destination becomes
 * a journey through the wall; everything else (modifier keys, middle click,
 * reduced motion, no WebGL, a transition already running) is an ordinary
 * navigation. Keyboard activation arrives as a click, so it works the same.
 */
export function TransitionLink({ href, onClick, onPointerEnter, onFocus, children, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const prime = () => warm(href);
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!canEnter(href)) return;
    e.preventDefault();
    void enter(href).then((started) => {
      if (!started) world.get().navigate(href);
    });
  };
  return (
    <Link
      href={href}
      onClick={handle}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        prime();
      }}
      onFocus={(e) => {
        onFocus?.(e);
        prime();
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
