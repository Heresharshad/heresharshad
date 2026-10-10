import type { EnvironmentId, RoomDefinition } from "./types";
import { entry as experimentsEntry, restPose as experimentsRest } from "./environments/experiments/config";

/*
 * Every room in the building. To add one: write its scene (an R3F component
 * taking EnvironmentProps), a small config with its rest pose and, if it can
 * be entered from the studio, an EntryTransition; then list it here and have
 * its page call useDeclareEnvironment(id). The engine stays as it is.
 */
export const rooms: Partial<Record<EnvironmentId, RoomDefinition>> = {
  studio: {
    id: "studio",
    route: "/",
    load: () => import("@/components/home/studio-scene"),
    camera: "self",
  },
  experiments: {
    id: "experiments",
    route: "/experiments",
    load: () => import("./environments/experiments/room"),
    camera: { rest: experimentsRest },
    entry: experimentsEntry,
  },
};

export const roomForRoute = (href: string) => Object.values(rooms).find((r) => r?.route === href);
