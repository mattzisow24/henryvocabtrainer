"use client";

// Self-graded flashcards. A missed card comes round again until he has it;
// the first answer for each card is the one that is saved.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveCards } from "@/app/(app)/cards/actions";

export type FlashCard = {
  id: string;
  word: string;
  pos: string;
  definition: string;
  example: string;
  hook: string;
  senses: { meaning: string; example: string }[];
  confusedWith: string[];
};

export function Flashcards({ cards, deck, preview }: { cards: FlashCard[]; deck: string; preview: boolean }) {
  /** Indexes into `cards` still to show; misses are pushed to the back. */
  const [queue, setQueue] = useState<number[]>(() => cards.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  /** First answer per card: true = missed. */
  const [first, setFirst] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "failed">("idle");
  const savedOnce = useRef(false);
  const done = queue.length === 0;

  useEffect(() => {
    if (!done || savedOnce.current || preview) return;
    savedOnce.current = true;
    // Deferred so the state change happens after this render pass, not during it.
    const timer = setTimeout(() => setSaved("saving"), 0);
    saveCards(Object.entries(first).map(([id, missed]) => ({ id, missed })))
      .then((r) => setSaved(r.ok ? "ok" : "failed"))
      .catch(() => setSaved("failed"));
    return () => clearTimeout(timer);
  }, [done, first, preview]);

  function answer(missed: boolean) {
    const [current, ...rest] = queue;
    const id = cards[current].id;
    if (!(id in first)) setFirst({ ...first, [id]: missed });
    setQueue(missed ? [...rest, current] : rest);
    setFlipped(false);
  }

  if (done) {
    const missed = cards.filter((c) => first[c.id]);
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="card animate-rise space-y-2 p-6">
          <p className="font-display text-2xl font-semibold text-navy">
            {cards.length - missed.length} of {cards.length} on the first pass
          </p>
          {missed.length > 0 && (
            <p className="text-ink-2">
              <span className="font-medium text-ink">Back to your coach:</span> {missed.map((c) => c.word).join(", ")}
            </p>
          )}
          <p className="text-sm text-muted" aria-live="polite">
            {preview ? "Preview: this round was not saved." : saved === "failed" ? "Couldn't save this round." : saved === "ok" ? "Saved." : "Saving…"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/cards?deck=${deck}`} className="btn">
            Another round
          </Link>
          <Link href="/home" className="btn btn-primary">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const card = cards[queue[0]];
  const cleared = cards.length - new Set(queue).size;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex items-center gap-3 text-sm text-ink-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stage-new">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(cleared / cards.length) * 100}%` }} />
        </div>
        <span className="tabular-nums">
          {cleared} / {cards.length}
        </span>
      </div>

      <button
        type="button"
        key={`${card.id}-${queue.length}`}
        className="card flex min-h-72 w-full flex-col justify-center gap-2 p-6 text-left"
        aria-label={flipped ? `${card.word}: ${card.definition}` : `${card.word}. Flip the card`}
        onClick={() => setFlipped(true)}
        disabled={flipped}
      >
        <span className="block text-center">
          <span className="block font-display text-4xl font-semibold tracking-tight text-navy">{card.word}</span>
          <span className="text-sm text-muted">{card.pos}</span>
        </span>
        {flipped ? (
          <span className="mt-2 block animate-rise space-y-2 text-sm">
            <span className="block text-lg">{card.definition}</span>
            <span className="block italic text-ink-2">&ldquo;{card.example}&rdquo;</span>
            {card.senses.map((s) => (
              <span key={s.meaning} className="block text-ink-2">
                <span className="font-medium text-ink">Also:</span> {s.meaning}
              </span>
            ))}
            <span className="block text-ink-2">
              <span className="font-medium text-ink">Hook:</span> {card.hook}
            </span>
            {card.confusedWith.length > 0 && (
              <span className="block text-ink-2">
                <span className="font-medium text-ink">Not:</span> {card.confusedWith.join("; ")}
              </span>
            )}
          </span>
        ) : (
          <span className="mt-2 block text-center text-sm text-muted">Say the meaning, then tap to flip</span>
        )}
      </button>

      {flipped ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => answer(true)}>
            Missed it
          </button>
          <button className="btn btn-primary" onClick={() => answer(false)}>
            Had it
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={() => setFlipped(true)}>
          Flip
        </button>
      )}
    </div>
  );
}
