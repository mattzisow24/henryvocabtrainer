"use client";

// The coach session: a typed chat. The learner starts it, the coach asks, he
// types, and the two take turns until the coach ends the session.

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
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

/**
 * The part of the screen that is actually visible. On a phone the keyboard
 * covers the bottom of the page without resizing it, so a chat laid out
 * against the page ends up behind the keyboard or gets pushed off the top.
 * Sizing the chat to this box keeps the question directly above the input.
 * While active it also stops the page behind from scrolling.
 */
function useVisibleBox(active: boolean): { top: number; height: number } | null {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const update = () => setBox({ top: vv?.offsetTop ?? 0, height: vv?.height ?? window.innerHeight });
    const frame = requestAnimationFrame(update);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.body.style.overflow = overflow;
    };
  }, [active]);
  return box;
}

/**
 * Answer choices the coach offered, if its last message ends with a line like
 * "attenuate / accentuate / augment / abate". Shown as buttons so he can tap
 * instead of typing.
 */
function choicesIn(text: string): string[] {
  const last = text.trim().split("\n").pop() ?? "";
  const parts = last.split(" / ").map((x) => x.trim());
  const ok = parts.length >= 2 && parts.length <= 5 && parts.every((x) => /^[a-z][a-z' -]{1,28}$/i.test(x));
  return ok ? parts : [];
}

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
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const box = useVisibleBox(phase !== "idle");

  // Keep the newest message in view, including when the keyboard opens and
  // the visible area shrinks.
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, phase, card, note, box]);
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
        if (!res.ok || !res.body) {
          const info = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null;
          if (info?.error === "sort first") throw new Error("Sort the list first; the session is built from it.");
          if (info?.error === "session ended") throw new Error("This session has already ended.");
          if (res.status === 401) throw new Error("You have been signed out. Reload the page and sign in again.");
          // Anything else is a fault on our side: show enough to trace it.
          throw new Error(`The coach couldn't start (${res.status}${info?.detail ? `: ${info.detail}` : ""}). Try again.`);
        }
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
    if (input.current) input.current.style.height = "auto";
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
  const lastLine = lines[lines.length - 1];
  const compact = !!box && box.height < 480;
  const choices = phase === "ready" && lastLine?.who === "coach" ? choicesIn(lastLine.text) : [];

  // The word card and the result note sit above the newest coach message, so
  // the question he has to answer is always the last thing on screen.
  const aside = (
    <>
      {shown && phase !== "ended" && (
        <div key={`${card?.wordId}-${card?.reveal}`} className="card animate-rise space-y-2 p-4">
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
        <p key={note.text} className={`w-fit animate-rise rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${note.good ? "bg-good-soft text-good" : "bg-stage-new/60 text-ink-2"}`}>
          {note.text}
        </p>
      )}
    </>
  );

  const renderLine = (line: Line, i: number, before: React.ReactNode) =>
    line.who === "coach" ? (
      <Fragment key={i}>
        {before}
        <div className="animate-rise whitespace-pre-wrap text-[17px] leading-relaxed">
          {line.text || (
            <span className="dots" aria-label="The coach is writing">
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
      </Fragment>
    ) : (
      <p key={i} className="ml-auto w-fit max-w-[85%] animate-rise whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-white">
        {line.text}
      </p>
    );

  return (
    <div className="fixed inset-x-0 z-40 flex animate-fade flex-col bg-canvas" style={{ top: box?.top ?? 0, height: box ? box.height : "100dvh" }}>
      <header className="mx-auto flex w-full max-w-xl shrink-0 items-center gap-3 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link href="/home" aria-label="Leave the session; you can resume it later" className="-ml-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stage-new">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progress && progress.total > 0 ? (progress.graded / progress.total) * 100 : 0}%` }}
          />
        </div>
        {progress && progress.total > 0 && (
          <span className="text-sm tabular-nums text-ink-2">
            {progress.graded} / {progress.total}
          </span>
        )}
      </header>

      <div ref={thread} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-end gap-3 px-4 py-3" aria-live="polite">
          {lines.map((line, i) => renderLine(line, i, i === lines.length - 1 && line.who === "coach" ? aside : null))}

          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}

          {phase === "ended" && (
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
          )}
        </div>
      </div>

      {phase !== "ended" && (
        <form
          className="shrink-0 border-t border-line bg-surface pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            submit(typed);
          }}
        >
          <div className="mx-auto w-full max-w-xl space-y-2 px-3 pt-2">
            {choices.length > 0 && (
              <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]">
                {choices.map((c) => (
                  <button key={c} type="button" className="shrink-0 animate-rise rounded-full border border-accent/40 bg-accent-soft px-3 py-1.5 text-sm font-semibold text-navy" onClick={() => submit(c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={input}
                rows={1}
                className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line bg-field px-3 py-2.5 text-base outline-none focus:border-accent"
                placeholder={phase === "coach" ? "" : "Type your answer"}
                aria-label="Your answer"
                value={typed}
                autoCapitalize="none"
                autoComplete="off"
                enterKeyHint="send"
                onChange={(e) => {
                  setTyped(e.target.value);
                  // Grow with the text, up to the max height.
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight + 2}px`;
                }}
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
            {/* Hidden while the keyboard is up, to leave the room to the question. */}
            <div className={`items-center justify-between px-1 text-sm text-ink-2 ${compact ? "hidden" : "flex"}`}>
              <button type="button" className="py-1 underline" disabled={phase !== "ready"} onClick={() => submit("I don't know this one.")}>
                Don&apos;t know
              </button>
              <button type="button" className="py-1 underline" disabled={phase !== "ready"} onClick={() => submit("I need to stop for today.")}>
                End session
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
