export default function Loading() {
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status" aria-live="polite">
      <span className="size-3 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
