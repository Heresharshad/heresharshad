@AGENTS.md

# Conventions

- Next.js App Router in `src/app`. This Next version differs from older releases; check `node_modules/next/dist/docs/` before using framework APIs.
- Preserve the current homepage design unless explicitly asked to redesign it.
- Follow existing component and folder conventions; Server Components by default, Client Components only for animation, events or Three.js.
- Use Tailwind and shadcn/ui where appropriate. Use GSAP for animation and Three.js (React Three Fiber) for 3D.
- No inline `style` for ordinary styling. Respect `prefers-reduced-motion`; clean up GSAP/Three effects.
- Keep new pages consistent with the existing theme for now. Do not build an elaborate design system; keep styling easy to replace for the future redesign.
- Personal info and links live in `src/config/site.ts`; projects in `src/data/projects.ts`.
- Before finishing: `npm run lint`, `npx tsc --noEmit`, `npm run build`.
