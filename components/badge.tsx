/**
 * A milestone's badge: a ring with a short mark inside. Locked badges are
 * gray. Decorative: the milestone's name is always printed beside it.
 */
export function Badge({ mark, locked = false, className = "h-12 w-12 text-sm" }: { mark: string; locked?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`${className} inline-flex shrink-0 items-center justify-center rounded-full border-2 font-display font-semibold tabular-nums ${
        locked ? "border-line bg-canvas text-muted" : "border-brand bg-brand text-white"
      }`}
    >
      {mark}
    </span>
  );
}
