/**
 * The day's goal as a ring that closes as its parts are done. The count is
 * printed in the middle, so the ring is never the only cue.
 */
export function GoalRing({ done, total }: { done: number; total: number }) {
  const r = 26;
  const length = 2 * Math.PI * r;
  const complete = done >= total;
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${done} of ${total} done today`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-stage-new" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className={`ring-fill ${complete ? "stroke-good" : "stroke-accent"}`}
          strokeDasharray={length}
          // The ring draws itself from empty to this offset when it appears.
          style={{ strokeDashoffset: length * (1 - Math.min(1, done / total)), ["--ring-length" as string]: length }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-display text-lg font-semibold tabular-nums ${complete ? "text-good" : "text-navy"}`}>
        {complete ? (
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : (
          `${done}/${total}`
        )}
      </span>
    </div>
  );
}
