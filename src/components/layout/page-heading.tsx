export function PageHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-14 max-w-3xl" data-reveal>
      {eyebrow && (
        <p className="mb-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
      )}
      <h1 className="page-wordmark text-[clamp(26px,8.2vw,112px)] [overflow-wrap:anywhere] uppercase">{title}</h1>
      {children && <p className="mt-6 max-w-[52ch] text-lg text-muted-foreground">{children}</p>}
    </div>
  );
}
