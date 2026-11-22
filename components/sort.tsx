"use client";

// The first-day sort: one pass through the list, rating each word, so the
// coach starts with the words that need work.

import Link from "next/link";
import { useState } from "react";
import { saveSort } from "@/app/(app)/sort/actions";

type Item = { id: string; word: string; pos: string; definition: string };
type Rating = "know" | "shaky" | "new";

const BUTTONS: { rating: Rating; label: string; hint: string }[] = [
  { rating: "know", label: "Know it", hint: "Could use it precisely" },
  { rating: "shaky", label: "Shaky", hint: "Rough idea only" },
  { rating: "new", label: "No idea", hint: "" },
];

export function Sort({ words, preview }: { words: Item[]; preview: boolean }) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "failed">("idle");

  const done = stopped || ratings.length >= words.length;

  function finish(final: Rating[]) {
    setStopped(true);
    if (preview) return;
    setSaved("saving");
    saveSort(final.map((rating, i) => ({ id: words[i].id, rating })))
      .then((r) => setSaved(r.ok ? "ok" : "failed"))
      .catch(() => setSaved("failed"));
  }

  function rate(rating: Rating) {
    const next = [...ratings, rating];
    setRatings(next);
    setRevealed(false);
    if (next.length >= words.length) finish(next);
  }

  if (words.length === 0) {
    return (
      <div className="card mx-auto max-w-md space-y-3 p-6 text-center">
        <p className="font-display text-xl font-semibold text-navy">Nothing left to sort</p>
        <p className="text-ink-2">Every word already has a practice record.</p>
        <Link href="/home" className="btn btn-primary w-full">
          Home
        </Link>
      </div>
    );
  }

  if (done) {
    const tally = (r: Rating) => ratings.filter((x) => x === r).length;
    return (
      <div className="card mx-auto max-w-md space-y-4 p-6">
        <p className="font-display text-2xl font-semibold text-navy">Sorted {ratings.length} words</p>
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          {BUTTONS.map((b) => (
            <div key={b.rating} className="rounded-xl bg-canvas p-3">
              <dd className="text-2xl font-semibold tabular-nums">{tally(b.rating)}</dd>
              <dt className="text-ink-2">{b.label}</dt>
            </div>
          ))}
        </dl>
        <p className="text-sm text-ink-2">
          &ldquo;Know it&rdquo; is a claim until you prove it: those words go to the drills first. Shaky and unknown words go to your coach, most
          frequently reported first.
        </p>
        <p className="text-sm text-muted" aria-live="polite">
          {preview
            ? "Preview: nothing was saved."
            : saved === "saving"
              ? "Saving…"
              : saved === "failed"
                ? "Couldn't save. Check the connection and try again."
                : "Saved."}
        </p>
        {saved === "failed" ? (
          <button className="btn btn-primary w-full" onClick={() => finish(ratings)}>
            Try again
          </button>
        ) : (
          <Link href="/home" className={`btn btn-primary w-full ${saved === "saving" ? "pointer-events-none opacity-50" : ""}`}>
            Continue
          </Link>
        )}
      </div>
    );
  }

  const item = words[ratings.length];
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Sort the list</h1>
        <p className="text-sm text-ink-2">
          One pass, about eight minutes. Be honest: rating a word &ldquo;know it&rdquo; when you only recognize it costs you a review you need.
        </p>
      </div>
      <div className="flex items-center gap-3 text-sm text-ink-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stage-new">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(ratings.length / words.length) * 100}%` }} />
        </div>
        <span className="tabular-nums">
          {ratings.length + 1} / {words.length}
        </span>
      </div>

      <div className="card flex min-h-44 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-display text-4xl font-semibold tracking-tight text-navy">{item.word}</p>
        <p className="text-sm text-muted">{item.pos}</p>
        {revealed ? (
          <p className="mt-1 text-lg">{item.definition}</p>
        ) : (
          <button className="mt-1 text-sm font-medium text-accent underline" onClick={() => setRevealed(true)}>
            Check the meaning
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {BUTTONS.map((b) => (
          <button key={b.rating} className="btn h-auto flex-col gap-0 rounded-2xl py-3" onClick={() => rate(b.rating)}>
            <span>{b.label}</span>
            {b.hint && <span className="text-xs font-normal text-muted">{b.hint}</span>}
          </button>
        ))}
      </div>

      {ratings.length > 0 && (
        <button className="self-center text-sm text-ink-2 underline" onClick={() => finish(ratings)}>
          Stop here and save
        </button>
      )}
    </div>
  );
}
