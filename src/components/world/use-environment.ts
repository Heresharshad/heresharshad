"use client";

import { useLayoutEffect } from "react";
import { world } from "./store";
import type { EnvironmentId } from "./types";

/**
 * A page tells the world which room it is. The world mounts that room's
 * scene (or cuts to it from the one before); pages never touch the canvas.
 */
export function useDeclareEnvironment(id: EnvironmentId) {
  useLayoutEffect(() => {
    world.set({ declared: id, booted: true });
    return () => {
      if (world.get().declared === id) world.set({ declared: null });
    };
  }, [id]);
}
