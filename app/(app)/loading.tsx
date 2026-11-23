/** Shown while a screen's data loads, so a tab change responds at once. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-28 rounded-2xl bg-stage-new/60" />
      <div className="h-20 rounded-2xl bg-stage-new/50" />
      <div className="h-40 rounded-2xl bg-stage-new/40" />
    </div>
  );
}
