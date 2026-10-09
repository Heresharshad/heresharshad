# heresharshad.com

Personal portfolio for Harshad, built with Next.js. The homepage is the original "dark room with a pull-chain lamp" page, migrated into React; About, Work, Experiments and Contact pages sit alongside it.

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
│   ├── home/        homepage scene, composition, pendant lamp
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
- **Homepage styles:** `src/app/home.css` (migrated unchanged from the original `index.html`); colour variables in `src/app/globals.css`.
- **Homepage behaviour** (light, runners, pendant): `src/components/home/home-scene.tsx`, a vanilla port of the original script with cleanup.
- **GSAP:** page reveal in `src/lib/animations/use-page-reveal.ts`; mark elements with `data-reveal`.
- **Three.js:** experiments in `src/components/experiments/`; register new ones in `registry.tsx`. Scenes load client-side only and respect reduced motion.
