/** Visibly marks content that still needs real information. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm border border-dashed border-accent/50 px-1.5 py-0.5 text-accent">
      {children}
    </span>
  );
}
