import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { loadStates } from "@/lib/data";
import { stageOf, type Stage } from "@/lib/srs";
import { WORDS, type Word } from "@/lib/words";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "work", label: "Needs work" },
  { key: "learning", label: "Learning" },
  { key: "mastered", label: "Mastered" },
  { key: "new", label: "Not started" },
  { key: "senses", label: "Second meanings" },
  { key: "core", label: "Tier 1" },
] as const;

const STAGE: Record<Stage, { label: string; className: string }> = {
  new: { label: "Not started", className: "bg-canvas text-muted" },
  learning: { label: "Learning", className: "bg-accent-soft text-accent" },
  mastered: { label: "Mastered", className: "bg-navy text-white" },
};

/** Small heading above each part of a word's details. */
function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted">{children}</p>;
}

/** The example sentence, with the word itself in bold so the eye lands on it. */
function Example({ word }: { word: Word }) {
  // Match the word and its endings ("adhere", "adhered", "adhering").
  const stem = word.word.slice(0, Math.max(4, word.word.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`\\b${stem}\\w*`, "i").exec(word.example);
  if (!match) return <>{word.example}</>;
  return (
    <>
      {word.example.slice(0, match.index)}
      <strong className="font-semibold not-italic text-navy">{match[0]}</strong>
      {word.example.slice(match.index + match[0].length)}
    </>
  );
}

export default async function WordsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const member = await requireMember();
  const show = (await searchParams).show ?? "all";
  const states = await loadStates(member.supabase);

  const words = [...WORDS]
    .filter((w) => {
      const s = states.get(w.id);
      const stage = stageOf(s);
      if (show === "work") return !!s && (s.last_grade === "missed" || s.lapses > 0 || !!s.confused_with) && stage !== "mastered";
      if (show === "senses") return w.senses.length > 0;
      if (show === "core") return w.tier === 1;
      if (show === "learning" || show === "mastered" || show === "new") return stage === show;
      return true;
    });

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-navy">Word list</h1>
          {(member.role === "learner" || member.preview) && (
            <Link href="/cards" className="btn shrink-0">
              Flashcards
            </Link>
          )}
        </div>
        <p className="text-ink-2">
          {WORDS.length} words in study order: the ones students most often report meeting on the SAT come first. Open a word for an example, its
          other senses, and what it gets confused with.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/words" : `/words?show=${f.key}`}
            aria-current={show === f.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm ${show === f.key ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-2"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted">
        {words.length} word{words.length === 1 ? "" : "s"}
      </p>
      <div className="space-y-2">
        {words.map((w) => {
          const s = states.get(w.id);
          const stage = STAGE[stageOf(s)];
          return (
            <details key={w.id} className="card group p-4">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="font-display text-xl font-semibold text-navy">{w.word}</span>
                    <span className="text-sm italic text-muted">{w.pos}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${stage.className}`}>{stage.label}</span>
                    <svg viewBox="0 0 16 16" className="h-4 w-4 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </span>
                </span>
                <span className="mt-1 block text-[1.05rem] leading-snug">{w.definition}</span>
              </summary>

              <div className="mt-4 space-y-4">
                <blockquote className="border-l-4 border-accent pl-3 italic text-ink-2">
                  <Example word={w} />
                </blockquote>

                {w.senses.length > 0 && (
                  <div>
                    <Label>Also means</Label>
                    <ul className="space-y-1.5">
                      {w.senses.map((x) => (
                        <li key={x.meaning}>
                          {x.meaning} <span className="italic text-ink-2">&ldquo;{x.example}&rdquo;</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {w.hook && (
                  <div className="rounded-xl bg-accent-soft p-3">
                    <Label>Hook</Label>
                    <p>{w.hook}</p>
                  </div>
                )}

                <div>
                  <Label>Near-synonyms</Label>
                  <ul className="flex flex-wrap gap-1.5">
                    {w.synonyms.map((x) => (
                      <li key={x} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-medium text-navy">
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>

                {w.confusedWith.length > 0 && (
                  <div>
                    <Label>Don&apos;t mix up with</Label>
                    <ul className="space-y-1">
                      {w.confusedWith.map((x) => (
                        <li key={x} className="text-sm text-ink-2">
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(w.listCheck === "imprecise" || w.listCheck === "wrong") && (
                  <div className="rounded-xl bg-bad-soft p-3">
                    <Label>Your tutor&apos;s list said</Label>
                    <p>
                      <span className="font-semibold">&ldquo;{w.listGloss}&rdquo;</span>
                      <span className="ml-2 text-sm text-bad">{w.listCheck === "wrong" ? "Wrong" : "Incomplete"}</span>
                    </p>
                    <p className="mt-1 text-sm text-ink-2">{w.listNote}</p>
                  </div>
                )}

                <p className="text-xs text-muted">
                  #{w.priority} in study order · {w.reports} student reports across {w.testDates} test date{w.testDates === 1 ? "" : "s"}
                </p>

                {(s?.confused_with || s?.note) && (
                  <div className="rounded-xl border border-line p-3">
                    <Label>From your coach</Label>
                    {s.confused_with && <p className="text-sm">Mixed up with: {s.confused_with}</p>}
                    {s.note && <p className="text-sm">{s.note}</p>}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
