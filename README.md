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
│   │   ├── about/ work/ work/[slug]/ experiments/ contact/
│   │   └── layout.tsx, loading.tsx
│   ├── not-found.tsx, error.tsx            404 and error states
├── components/
│   ├── home/        homepage: WebGL studio, pendant, sections
│   ├── layout/      header, footer, nav, page heading
│   ├── experiments/ Three.js demos + registry
│   ├── work/        project card
│   └── ui/          shadcn/ui components
├── config/site.ts   site info, nav, social links
├── data/projects.ts project data
├── hooks/, lib/, types/
public/              static assets
```

## Where things live

- **New page:** add `src/app/(site)/<name>/page.tsx` (gets the header/footer), and a link in `navLinks` in `src/config/site.ts`.
- **Projects:** `src/data/projects.ts`. Set `caseStudy: true` to get a `/work/[slug]` page. Unknown slugs return a 404. While the list is empty, `/work` shows an "under construction" message.
- **Social links and email:** `src/config/site.ts`. Unset (`null`) links are hidden and flagged on the contact page.
- **Homepage content:** `src/components/home/home-sections.tsx` (server-rendered; each `[data-scene]` is one camera stop) and `home-header.tsx`.
- **Homepage 3D:** `studio-canvas.tsx` (camera rig, scroll keyframes per scene, lights, quality tier), `studio-room.tsx` (wall, floor, annotations), `studio-tiles.ts` (procedural stone-panel cladding: setting-out, joints, bevels, grain), `cursor-light.tsx` (the cursor as a raking torch, cast into the room), `pendant.tsx` + `pendant-physics.ts` (verlet cord, bulb and pull chain).
- **The mechanism:** `mechanism.tsx` is the fly system that moves the bulb: ceiling beam, two pulleys, two hemp lines to the bridle ring, a sandbag counterweight on the right and the operator's gallery on the left. Rope lengths drive pulley rotation, rope weave, sandbag height and the operator's hands, so it always agrees with where the ring is. `operator-figure.ts` is the mannequin (two-bone IK arms, hand-over-hand pull).
- **Homepage glue:** `home-experience.tsx` maps scroll to a scene index, owns the pull chain button, cursor and GSAP scroll choreography. `studio-state.ts` is the shared state between DOM and WebGL.
- **Homepage styles:** `src/app/home.css`; colour variables in `src/app/globals.css`. The hero type is lit by CSS variables the scene writes each frame (`--gx`, `--gy`, `--li`, `--sx`, `--sy`).
- **Tuning the composition:** the bridle ring and camera per scene are the `WIDE` / `NARROW` keyframes at the top of `studio-canvas.tsx`, and the pulley positions are `PULLEYS`. Both are in screen (NDC) coordinates so the rig frames every viewport the same way. Content alternates sides (work left, experiments right, about left, contact right) and the ring sits opposite.
- **GSAP:** page reveal in `src/lib/animations/use-page-reveal.ts`; mark elements with `data-reveal`.
- **Three.js:** experiments in `src/components/experiments/`; register new ones in `registry.tsx`. Scenes load client-side only and respect reduced motion.
