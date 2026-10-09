export function UnderConstruction({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-2xl overflow-hidden rounded-sm border bg-card" data-reveal>
      <div className="construction-tape h-3" aria-hidden="true" />
      <div className="space-y-3 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.14em] text-accent">Under construction</p>
        <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
        <p className="text-muted-foreground">{children}</p>
      </div>
      <div className="construction-tape h-3" aria-hidden="true" />
    </section>
  );
}
