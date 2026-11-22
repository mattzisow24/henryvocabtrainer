import { parseSummary } from "@/lib/summary";

/** A coach session summary: a bold headline, then short labeled lines. */
export function SessionSummary({ text }: { text: string }) {
  const s = parseSummary(text);
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-ink">{s.headline}</p>
      {s.rows.length > 0 && (
        <dl className="space-y-0.5">
          {s.rows.map((row, i) => (
            <div key={i} className="flex gap-2">
              {row.label && <dt className="w-20 shrink-0 text-muted">{row.label}</dt>}
              <dd className="min-w-0 text-ink-2">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {s.more && (
        <details>
          <summary className="cursor-pointer text-accent underline">More</summary>
          <p className="mt-1 text-ink-2">{s.more}</p>
        </details>
      )}
    </div>
  );
}
