// A coach session's summary, kept short enough to scan. It is stored as plain
// text in one column: a headline on the first line, then "Label: value" lines.
// Summaries written before this format were single paragraphs; those are
// shown as their first sentence, with the rest available on request.

export type SummaryFields = {
  /** The session in one short sentence. */
  headline: string;
  went_well: string;
  /** The words or habits that need work, as a short list. */
  needs_work: string;
  next_focus: string;
};

const LABELS = [
  ["went_well", "Went well"],
  ["needs_work", "Needs work"],
  ["next_focus", "Next"],
] as const;

export function formatSummary(f: SummaryFields): string {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  return [clean(f.headline), ...LABELS.filter(([key]) => clean(f[key])).map(([key, label]) => `${label}: ${clean(f[key])}`)].join("\n");
}

export type ParsedSummary = {
  headline: string;
  rows: { label: string; value: string }[];
  /** For old paragraph summaries: everything after the first sentence. */
  more: string;
};

export function parseSummary(text: string): ParsedSummary {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const rows = lines.slice(1).map((line) => {
      const cut = line.indexOf(": ");
      return cut > 0 ? { label: line.slice(0, cut), value: line.slice(cut + 2) } : { label: "", value: line };
    });
    return { headline: lines[0], rows, more: "" };
  }
  const paragraph = lines[0] ?? "";
  const end = /[.!?](\s|$)/.exec(paragraph);
  if (!end || end.index + 1 >= paragraph.length) return { headline: paragraph, rows: [], more: "" };
  return { headline: paragraph.slice(0, end.index + 1), rows: [], more: paragraph.slice(end.index + 1).trim() };
}
