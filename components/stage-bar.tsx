import type { Progress } from "@/lib/progress";

const STAGES = [
  { key: "mastered", label: "Mastered", color: "bg-stage-mastered", hint: "Recalled correctly several times, days apart" },
  { key: "learning", label: "Learning", color: "bg-stage-learning", hint: "Met, still being reviewed" },
  { key: "notStarted", label: "Not started", color: "bg-stage-new", hint: "Not practiced yet" },
] as const;

/** Where every word on the list stands. Counts are printed, so color is never the only cue. */
export function StageBar({ progress }: { progress: Progress }) {
  return (
    <div className="space-y-2">
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-md" role="img" aria-label={STAGES.map((s) => `${s.label}: ${progress[s.key]}`).join(", ")}>
        {STAGES.map((s) =>
          progress[s.key] > 0 ? (
            <div key={s.key} className={s.color} style={{ flexGrow: progress[s.key] }} title={`${s.label}: ${progress[s.key]} of ${progress.total}. ${s.hint}.`} />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        {STAGES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-sm ${s.color}`} />
            {s.label} <span className="font-semibold tabular-nums text-ink">{progress[s.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}
