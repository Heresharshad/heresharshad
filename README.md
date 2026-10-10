# heresharshad.com

Personal portfolio for Harshad, built with Next.js. The homepage is a scroll-driven 3D studio: a hanging bulb on a pull chain (Three.js) lights an architectural wall and the DOM typography in front of it. About, Work, Experiments and Contact pages sit alongside it.

> **The current theme and global styling are temporary. The website will receive a future visual redesign, so avoid introducing a large design system or treating the current CSS as permanent architecture.**

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · shadcn/ui · GSAP + `@gsap/react` · Three.js + React Three Fiber + Drei · Remix Icon (`@remixicon/react`, re-exported from `src/components/icons.tsx`)

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:3000
npm run lint       # ESLint
npx tsc --noEmit   # type check
npm run build      # production build
npm run start      # serve the production build
```

## Structure

```text
src/
├── app/
│   ├── layout.tsx, globals.css, home.css   root layout, global + homepage styles
│   ├── page.tsx                            homepage
│   ├── (site)/                             pages that share header/footer
│   │   ├── about/ work/ work/[slug]/ contact/
│   │   └── layout.tsx, loading.tsx
│   ├── (rooms)/                            pages that are rooms of the 3D world
│   │   ├── experiments/
│   │   └── layout.tsx
│   ├── not-found.tsx, error.tsx            404 and error states
├── components/
│   ├── world/       the shared 3D world: persistent canvas, room registry, transitions
│   ├── home/        homepage: the studio scene, pendant, sections
│   ├── layout/      header, footer, nav, page heading
│   ├── experiments/ Three.js demos + registry
│   ├── work/        project card
│   └── ui/          shadcn/ui components
├── config/site.ts   site info, nav, social links
├── data/projects.ts project data
├── hooks/, lib/, types/
public/              static assets
```

## The world: one building, many rooms

The portfolio is one continuous 3D space. The root layout mounts `WorldLayer` (`src/components/world/world-layer.tsx`): a single React Three Fiber canvas that is created the first time a page declares a room and then survives every route change. Pages never touch the canvas; they only say which room they are:

- the homepage (`HomeExperience`) calls `useDeclareEnvironment("studio")`;
- `/experiments` wraps its content in `<RoomPage id="experiments">`.

`src/components/world/store.ts` is the single source of truth (declared room, mounted rooms, the active room, the transition in flight, who owns the camera). `registry.ts` lists every room: its route, a lazy scene module, its rest camera pose and, optionally, an `EntryTransition` describing how you get in from the studio. `controller.ts` sequences a journey with one GSAP timeline that tweens a `TransitionProgress` object the scenes read each frame; the route is pushed once the camera is through the opening, the room you left is disposed once you have settled. Pages outside the world (`(site)`) leave the canvas hidden and idle; direct loads, refreshes and back/forward cut between rooms through a short dip to dark.

### Loading

On a fresh load of the homepage, `src/components/home/intro-curtain.tsx` covers the page with a small HTML/CSS loader (a cord and a warming filament where the pendant hangs, and a status line) until the world has drawn its first complete frame of the studio, then lifts it outward from the bulb. Its steps are the world's real ones: hydration (`booted`), the renderer (`camera`), the studio fetched, built and compiled (`ready`), and the first frame (`firstFrame`). An inline script switches it on while the HTML is parsed, so it never appears on a client-side navigation and never without JavaScript; a CSS failsafe lifts it if the app's JavaScript never arrives, and after 9 s of visible waiting it offers a way in. No WebGL, or a world that fails to start (`failed`, caught by the boundary in `world-layer.tsx`), lifts it at once onto the still fallback.

The world draws nothing until the active room is ready (`Present` in `world-canvas.tsx`), and rooms compile with `gl.compileAsync` before calling `onReady()`, so shaders compile in parallel off the main thread instead of on the first draw. Keep three.js out of anything the root layout imports at runtime (type imports are fine): it would ship in every page's first load.

### Adding a room

1. **Scene:** an R3F component taking `EnvironmentProps` (`src/components/world/types.ts`), e.g. `src/components/world/environments/about/room.tsx`. Build its geometry and lights, call `onReady()` once `gl.compileAsync(scene, camera)` resolves (the world will not draw the room before then), dispose what you create. Read `world.get().transition?.progress` for choreography.
2. **Config:** a small `config.ts` next to it with `restPose(viewport)` and, if it is entered through the studio wall, an `EntryTransition` (`kind: "wall-opening"`, the `door` cut in the wall, camera `path` keyframes, `timing`; a `narrow` variant for phones). `environments/experiments/config.ts` is the worked example.
3. **Register:** add it to `rooms` in `registry.ts`:

   ```ts
   about: { id: "about", route: "/about", load: () => import("./environments/about/room"), camera: { rest: aboutRest }, entry: aboutEntry },
   ```

4. **Page:** move it under `src/app/(rooms)/about/page.tsx` and wrap its content in `<RoomPage id="about">`. Links from the homepage use `TransitionLink`, which turns a plain click on a registered route into the journey and falls back to ordinary navigation (modifier keys, reduced motion, no WebGL, a transition already running).

A new transition *kind* (a light switch, panels sliding apart) is a new `EntryTransition["kind"]`, a studio-side mechanism next to `environments/studio-door.tsx`, and a case in the controller's timeline; rooms and pages stay as they are.

## Where things live

- **New page:** add `src/app/(site)/<name>/page.tsx` (gets the header/footer), and a link in `navLinks` in `src/config/site.ts`.
- **Projects:** `src/data/projects.ts`. Set `caseStudy: true` to get a `/work/[slug]` page. Unknown slugs return a 404. While the list is empty, `/work` shows an "under construction" message.
- **Social links and email:** `src/config/site.ts`. Unset (`null`) links are hidden and flagged on the contact page.
- **Homepage content:** `src/components/home/home-sections.tsx` (server-rendered; each `[data-scene]` is one camera stop) and `home-header.tsx`.
- **Homepage 3D:** `studio-scene.tsx` (the studio as a room of the world: camera rig, scroll keyframes per scene; the canvas, base lights and quality tier are the world's), `studio-room.tsx` (wall, floor, annotations), `studio-tiles.ts` (procedural stone-panel cladding: setting-out, joints, bevels, grain), `cursor-light.tsx` (the cursor as a raking torch, cast into the room), `pendant.tsx` + `pendant-physics.ts` (verlet cord, bulb and pull chain).
- **The mechanism:** `mechanism.tsx` is the fly system that moves the bulb: ceiling beam, two pulleys, two hemp lines to the bridle ring, a sandbag counterweight on the right and the operator's gallery on the left. Rope lengths drive pulley rotation, rope weave, sandbag height and the operator's hands, so it always agrees with where the ring is. `operator-figure.ts` is the mannequin (two-bone IK arms, hand-over-hand pull).
- **Homepage glue:** `home-experience.tsx` maps scroll to a scene index, owns the pull chain button, cursor and GSAP scroll choreography. `studio-state.ts` is the shared state between DOM and WebGL.
- **Homepage styles:** `src/app/home.css`; colour variables in `src/app/globals.css`. The hero type is lit by CSS variables the scene writes each frame (`--gx`, `--gy`, `--li`, `--sx`, `--sy`).
- **Tuning the composition:** the bridle ring and camera per scene are the `WIDE` / `NARROW` keyframes at the top of `studio-scene.tsx`, and the pulley positions are `PULLEYS`. Both are in screen (NDC) coordinates so the rig frames every viewport the same way. Content alternates sides (work left, experiments right, about left, contact right) and the ring sits opposite.
- **GSAP:** page reveal in `src/lib/animations/use-page-reveal.ts`; mark elements with `data-reveal`.
- **Three.js:** experiments in `src/components/experiments/`; register new ones in `registry.tsx`. Scenes load client-side only and respect reduced motion.
- **The Experiments room:** `src/components/world/environments/experiments/` (`config.ts` door, camera path and rest pose; `room.tsx` the void: a direction-based haze and glow backdrop, the floor grid and the motes, all shaders, no lights). The concealed slab in the studio wall is `src/components/world/environments/studio-door.tsx`; the cladding shader's `uDoor` cuts the wall and `uTileOffset` lets the slab keep its own panels as it moves.
