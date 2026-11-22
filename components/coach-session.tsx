"use client";

// The coach session: a typed chat. The learner starts it, the coach asks, he
// types, and the two take turns until the coach ends the session.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { POINTS } from "@/lib/rewards";

type Card = { word: string; pos: string; definition: string; example: string; hook: string; senses: { meaning: string; example: string }[] };

type Phase = "idle" | "coach" | "ready" | "ended";

type ServerEvent =
  | { t: "session"; sessionId: string; wordIds: string[]; graded: number }
  | { t: "text"; d: string }
  | { t: "card"; wordId: string; reveal: boolean }
  | { t: "progress"; graded: number; total: number }
  | { t: "result"; wordId: string; grade: "knew" | "partial" | "missed"; points: number; mastered: boolean }
  | { t: "ended" }
  | { t: "done" }
  | { t: "error"; message: string };

type Line = { who: "coach" | "learner"; text: string };

/** The note shown after each graded word. */
const RESULT_LINE = { knew: "Knew it", partial: "Partly", missed: "Back in the queue" } as const;

type Tally = { knew: number; partial: number; missed: number; points: number; mastered: string[] };

export function CoachSession({ cards, preview }: { cards: Record<string, Card>; preview: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [card, setCard] = useState<{ wordId: string; reveal: boolean } | null>(null);
  const [progress, setProgress] = useState<{ graded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [tally, setTally] = useState<Tally>({ knew: 0, partial: 0, missed: 0, points: 0, mastered: [] });
  const sessionId = useRef<string | null>(null);
  const ended = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [lines, phase]);
  useEffect(() => {
    if (phase === "ready") input.current?.focus();
  }, [phase]);

  /** Sends one turn and shows the reply as it streams in. */
  const send = useCallback(
    async (body: { start: true } | { text: string }) => {
      setPhase("coach");
      setError(null);
      setLines((l) => [...l, ...("text" in body ? [{ who: "learner" as const, text: body.text }] : []), { who: "coach", text: "" }]);
      const append = (d: string) =>
        setLines((l) => {
          const last = l[l.length - 1];
          return [...l.slice(0, -1), { ...last, text: last.text + d }];
        });
      try {
        const res = await fetch("/api/coach/turn", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify("start" in body ? body : { sessionId: sessionId.current, text: body.text }),
        });
        if (!res.ok || !res.body) throw new Error(res.status === 409 ? "This session has already ended." : "The coach didn't answer. Try again.");
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let pending = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += value;
          const chunks = pending.split("\n");
          pending = chunks.pop() ?? "";
          for (const chunk of chunks) {
            if (!chunk.trim()) continue;
            const ev = JSON.parse(chunk) as ServerEvent;
            if (ev.t === "session") {
              sessionId.current = ev.sessionId;
              setProgress({ graded: ev.graded, total: ev.wordIds.length });
            } else if (ev.t === "text") append(ev.d);
            else if (ev.t === "card") setCard({ wordId: ev.wordId, reveal: ev.reveal });
            else if (ev.t === "progress") setProgress({ graded: ev.graded, total: ev.total });
            else if (ev.t === "result") {
              const word = cards[ev.wordId]?.word ?? ev.wordId;
              setTally((t) => ({
                ...t,
                [ev.grade]: t[ev.grade] + 1,
                points: t.points + ev.points,
                mastered: ev.mastered ? [...t.mastered, word] : t.mastered,
              }));
              setNote({ text: `${word}: ${ev.mastered ? "mastered" : RESULT_LINE[ev.grade]}  +${ev.points}`, good: ev.grade === "knew" });
            } else if (ev.t === "ended") ended.current = true;
            else if (ev.t === "error") setError(ev.message);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      }
      // Drop the placeholder if the coach said nothing this turn.
      setLines((l) => (l.length > 0 && l[l.length - 1].who === "coach" && !l[l.length - 1].text.trim() ? l.slice(0, -1) : l));
      if (!sessionId.current) {
        // The session never opened; go back to the start button so he can retry.
        setPhase("idle");
        return;
      }
      setPhase(ended.current ? "ended" : "ready");
    },
    [cards],
  );

  function submit(text: string) {
    const clean = text.trim();
    if (!clean || phase !== "ready") return;
    setTyped("");
    setNote(null);
    void send({ text: clean });
  }

  if (preview) {
    return (
      <div className="card mx-auto max-w-md space-y-3 p-6 text-center">
        <p className="font-display text-xl font-semibold text-navy">Coach sessions are off in preview</p>
        <p className="text-ink-2">A session here would change the review schedule, so it only runs when the learner is signed in.</p>
        <Link href="/home" className="btn btn-primary w-full">
          Back to home
        </Link>
      </div>
    );
  }

  if (phase === "idle") {
    return (
      <div className="card mx-auto max-w-md space-y-4 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-navy">Coach</h1>
          <p className="text-ink-2">
            About ten minutes, typed. Your coach tests the words that are due and teaches new ones, mostly through sentences with a blank, the way
            the SAT asks.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" onClick={() => void send({ start: true })}>
          Start
        </button>
        <p className="text-xs text-muted">Your parents can read these sessions and see your results.</p>
      </div>
    );
  }

  const shown = card ? cards[card.wordId] : null;
  const total = tally.knew + tally.partial + tally.missed;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      {progress && progress.total > 0 && (
        <div className="flex items-center gap-3 text-sm text-ink-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stage-new">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(progress.graded / progress.total) * 100}%` }} />
          </div>
          <span className="tabular-nums">
            {progress.graded} / {progress.total}
          </span>
        </div>
      )}

      <div className="space-y-3" aria-live="polite">
        {lines.map((line, i) =>
          line.who === "coach" ? (
            <p key={i} className="whitespace-pre-wrap text-[17px] leading-relaxed">
              {line.text || "…"}
            </p>
          ) : (
            <p key={i} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2 text-navy">
              {line.text}
            </p>
          ),
        )}
      </div>

      {shown && phase !== "ended" && (
        <div className="card animate-rise space-y-2 p-4">
          <p>
            <span className="font-display text-2xl font-semibold tracking-tight text-navy">{shown.word}</span>
            <span className="ml-2 text-sm text-muted">{shown.pos}</span>
          </p>
          {card?.reveal && (
            <div className="space-y-1.5 text-sm">
              <p className="text-base">{shown.definition}</p>
              <p className="text-ink-2">&ldquo;{shown.example}&rdquo;</p>
              {shown.senses.map((s) => (
                <p key={s.meaning} className="text-ink-2">
                  <span className="font-medium text-ink">Also:</span> {s.meaning}. &ldquo;{s.example}&rdquo;
                </p>
              ))}
              {shown.hook && (
                <p className="text-ink-2">
                  <span className="font-medium text-ink">Hook:</span> {shown.hook}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {note && phase !== "ended" && (
        <p className={`text-sm font-semibold tabular-nums ${note.good ? "text-good" : "text-ink-2"}`} aria-live="polite">
          {note.text}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}

      {phase === "ended" ? (
        <div className="card animate-rise space-y-4 p-5">
          <p className="font-display text-xl font-semibold text-navy">Session done</p>
          {total > 0 && (
            <dl className="grid grid-cols-4 gap-2 text-center text-sm">
              {[
                { label: "knew", value: tally.knew },
                { label: "partly", value: tally.partial },
                { label: "missed", value: tally.missed },
                { label: "points", value: tally.points + POINTS.sessionDone },
              ].map((x) => (
                <div key={x.label} className="rounded-xl bg-canvas p-2">
                  <dd className="text-xl font-semibold tabular-nums">{x.value}</dd>
                  <dt className="text-ink-2">{x.label}</dt>
                </div>
              ))}
            </dl>
          )}
          {tally.mastered.length > 0 && (
            <p className="text-sm">
              <span className="font-semibold text-navy">Mastered today:</span> {tally.mastered.join(", ")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Link href="/drill" className="btn">
              Run a drill
            </Link>
            <Link href="/home" className="btn btn-primary">
              Home
            </Link>
          </div>
        </div>
      ) : (
        <form
          className="sticky bottom-2 space-y-2 rounded-2xl border border-line bg-surface p-2 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            submit(typed);
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={input}
              rows={1}
              className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-base"
              placeholder={phase === "coach" ? "…" : "Type your answer"}
              aria-label="Your answer"
              value={typed}
              autoCapitalize="none"
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter makes a new line.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(typed);
                }
              }}
            />
            <button className="btn btn-primary" disabled={phase !== "ready" || !typed.trim()}>
              Send
            </button>
          </div>
          <div className="flex items-center justify-between px-1 text-sm text-ink-2">
            <button type="button" className="underline" disabled={phase !== "ready"} onClick={() => submit("I don't know this one.")}>
              Don&apos;t know
            </button>
            <button type="button" className="underline" disabled={phase !== "ready"} onClick={() => submit("I need to stop for today.")}>
              End session
            </button>
          </div>
        </form>
      )}
      <div ref={bottom} />
    </div>
  );
}
