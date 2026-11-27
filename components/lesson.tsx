"use client";

// A lesson: mixed exercises, one per screen. Pick an answer, check it, read
// why, continue. Anything missed comes round again at the end; only the first
// attempt at each exercise is saved.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveLesson } from "@/app/(app)/lesson/actions";
import type { Exercise, Graded } from "@/lib/lesson";
import { POINTS } from "@/lib/rewards";
import { typedIsOneOf } from "@/lib/typed";
import { Passage } from "./passage";

const LETTERS = ["A", "B", "C", "D"];
const isGraded = (e: Exercise): e is Graded => e.kind === "question" || e.kind === "choose" || e.kind === "type";

export function Lesson({ exercises, words, preview }: { exercises: Exercise[]; words: Record<string, string>; preview: boolean }) {
  /** Exercises still to do, in order. A missed one is appended again. */
  const [queue, setQueue] = useState<Exercise[]>(exercises);
  const [pos, setPos] = useState(0);
  /** First attempt at each graded exercise: what he answered and whether it was right. */
  const [first, setFirst] = useState<Record<string, { answer: string | null; ok: boolean }>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "failed">("idle");
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(0);
  const savedOnce = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const done = pos >= queue.length;

  useEffect(() => {
    if (!done || savedOnce.current) return;
    savedOnce.current = true;
    const took = Math.min(7200, Math.floor((Date.now() - startedAt.current) / 1000));
    const answers = Object.entries(first).map(([id, a]) => ({ id, answer: a.answer }));
    // Deferred so the state change happens after this render pass, not during it.
    const timer = setTimeout(() => {
      setSeconds(took);
      if (!preview && answers.length > 0) setSaved("saving");
    }, 0);
    if (!preview && answers.length > 0) {
      saveLesson({ seconds: took, answers })
        .then((r) => setSaved(r.ok ? "ok" : "failed"))
        .catch(() => setSaved("failed"));
    }
    return () => clearTimeout(timer);
  }, [done, first, preview]);

  if (exercises.length === 0) {
    return (
      <div className="card mx-auto max-w-md space-y-3 p-6 text-center">
        <p className="font-display text-xl font-semibold text-navy">Nothing to practice yet</p>
        <Link href="/home" className="btn btn-primary w-full">
          Home
        </Link>
      </div>
    );
  }

  if (done) {
    const graded = exercises.filter(isGraded);
    const right = graded.filter((e) => first[e.id]?.ok).length;
    const missed = [...new Set(graded.filter((e) => first[e.id] && !first[e.id].ok).map((e) => words[e.wordId] ?? e.wordId))];
    const learned = exercises.filter((e) => e.kind === "intro").length;
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="card animate-rise space-y-4 p-6">
          <p className="font-display text-2xl font-semibold text-navy">{missed.length === 0 ? "Clean lesson" : "Lesson done"}</p>
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            {[
              { label: "first try", value: `${right}/${graded.length}` },
              { label: "time", value: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` },
              { label: "points", value: `+${right * POINTS.drillCorrect}` },
            ].map((x) => (
              <div key={x.label} className="rounded-xl bg-canvas p-3">
                <dd className="font-display text-xl font-semibold tabular-nums">{x.value}</dd>
                <dt className="text-ink-2">{x.label}</dt>
              </div>
            ))}
          </dl>
          {learned > 0 && (
            <p className="text-sm text-ink-2">
              {learned} new word{learned === 1 ? "" : "s"} introduced.
            </p>
          )}
          {missed.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Missed, and now with your coach:</p>
              <ul className="flex flex-wrap gap-1.5">
                {missed.map((w) => (
                  <li key={w} className="rounded-full bg-bad-soft px-2.5 py-0.5 text-sm font-medium text-bad">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-muted" aria-live="polite">
            {preview ? "Preview: this lesson was not saved." : saved === "failed" ? "Couldn't save this lesson." : saved === "ok" ? "Saved." : "Saving…"}
          </p>
        </div>
        <div className="grid gap-2">
          {missed.length > 0 && (
            <Link href="/coach" className="btn btn-primary">
              Go over the misses with your coach
            </Link>
          )}
          <div className="grid grid-cols-2 gap-2">
            {/* A plain link: a full load builds a fresh lesson. */}
            <a href="/lesson" className={`btn ${missed.length === 0 ? "btn-primary" : ""}`}>
              Another lesson
            </a>
            <Link href="/home" className="btn">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ex = queue[pos];
  const retry = pos >= exercises.length;

  function check(ok: boolean, answer: string | null) {
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (!retry && isGraded(ex) && !(ex.id in first)) setFirst({ ...first, [ex.id]: { answer, ok } });
    setResult(ok);
  }

  function next() {
    // A miss comes round again at the end, until he gets it.
    if (result === false && isGraded(ex)) setQueue([...queue, ex]);
    setPicked(null);
    setTyped("");
    setResult(null);
    setPos(pos + 1);
  }

  const choiceList = (choices: string[], answer: number) => (
    <div className="space-y-2">
      {choices.map((choice, i) => {
        const isAnswer = result !== null && i === answer;
        const isWrong = result !== null && picked === i && i !== answer;
        return (
          <button
            key={i}
            onClick={() => setPicked(i)}
            disabled={result !== null}
            aria-pressed={picked === i}
            className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-4 py-2 text-left active:scale-[0.99] ${
              isAnswer
                ? "border-good bg-good-soft"
                : isWrong
                  ? "border-bad bg-bad-soft"
                  : picked === i
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface"
            }`}
          >
            <span className="w-5 shrink-0 text-sm font-semibold text-muted">{LETTERS[i]}</span>
            <span className="flex-1">{choice}</span>
          </button>
        );
      })}
    </div>
  );

  let body: React.ReactNode;
  let canCheck = false;
  let onCheck: () => void = () => {};
  let correctText = "";
  let why = "";
  let extra = "";
  /** Screens that move on without a check: an introduction or a matching round. */
  let ungraded: "ready" | "waiting" | null = null;

  if (ex.kind === "intro") {
    ungraded = "ready";
    body = (
      <>
        <p className="text-sm font-semibold text-link">New word</p>
        <div className="card space-y-3 p-5">
          <p>
            <span className="font-display text-3xl font-semibold tracking-tight text-navy">{ex.word}</span>
            <span className="ml-2 text-sm text-muted">{ex.pos}</span>
          </p>
          <p className="text-lg">{ex.definition}</p>
          <p className="italic text-ink-2">&ldquo;{ex.example}&rdquo;</p>
          {ex.senses.map((s) => (
            <p key={s.meaning} className="text-sm text-ink-2">
              <span className="font-medium text-ink">Also:</span> {s.meaning}
            </p>
          ))}
          <p className="rounded-xl bg-accent-soft p-3 text-sm">
            <span className="font-medium">Hook:</span> {ex.hook}
          </p>
        </div>
      </>
    );
  } else if (ex.kind === "match") {
    body = <Match key={pos} ex={ex} onDone={() => setResult(true)} />;
    ungraded = result === null ? "waiting" : "ready";
  } else if (ex.kind === "question") {
    canCheck = picked !== null;
    onCheck = () => check(picked === ex.answer, picked === null ? null : ex.choices[picked]);
    correctText = ex.choices[ex.answer];
    why = ex.why;
    extra = ex.meaning;
    body = (
      <>
        <div className="card space-y-3 p-5">
          <Passage text={ex.passage} className="text-[17px] leading-relaxed" />
          <p className="text-sm font-medium text-ink-2">{ex.stem}</p>
        </div>
        {choiceList(ex.choices, ex.answer)}
      </>
    );
  } else if (ex.kind === "choose") {
    canCheck = picked !== null;
    onCheck = () => check(picked === ex.answer, picked === null ? null : ex.choices[picked]);
    correctText = ex.choices[ex.answer];
    why = ex.why;
    body = (
      <>
        <p className="text-sm font-semibold text-link">Which word means this?</p>
        <div className="card p-5">
          <p className="text-lg">{ex.definition}</p>
        </div>
        {choiceList(ex.choices, ex.answer)}
      </>
    );
  } else {
    canCheck = typed.trim().length > 0;
    onCheck = () => check(typedIsOneOf(ex.accept, typed), typed.trim());
    correctText = ex.answer;
    why = ex.why;
    body = (
      <>
        <p className="text-sm font-semibold text-link">Type the missing word</p>
        <div className="card space-y-3 p-5">
          <Passage text={ex.sentence} className="text-[17px] leading-relaxed" />
          <p className="text-sm text-ink-2">
            <span className="font-medium text-ink">Means:</span> {ex.definition}
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canCheck && result === null) onCheck();
          }}
        >
          <input
            key={pos}
            autoFocus
            className="h-12 min-w-0 flex-1 rounded-xl border-2 border-line bg-field px-3 text-base outline-none focus:border-accent"
            placeholder={`${ex.answer[0]}… (${ex.answer.length} letters)`}
            aria-label="The missing word"
            value={typed}
            disabled={result !== null}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            onChange={(e) => setTyped(e.target.value)}
          />
          {/* In the flow, not in the bottom bar, so the keyboard cannot cover it. */}
          {result === null && (
            <button className="btn btn-primary" disabled={!canCheck}>
              Check
            </button>
          )}
        </form>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-56">
      <div className="h-2 overflow-hidden rounded-full bg-stage-new">
        <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${(pos / queue.length) * 100}%` }} />
      </div>
      {retry && <p className="text-sm font-semibold text-bad">One you missed. Try it again.</p>}
      <div key={pos} className="animate-rise space-y-4">
        {body}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30">
        {ungraded ? (
          <div className="border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto max-w-xl">
              <button className="btn btn-primary w-full" disabled={ungraded === "waiting"} onClick={next}>
                {ungraded === "waiting" ? "Match them all" : "Continue"}
              </button>
            </div>
          </div>
        ) : result === null ? (
          ex.kind !== "type" && (
            <div className="border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <div className="mx-auto max-w-xl">
                <button className="btn btn-primary w-full" disabled={!canCheck} onClick={onCheck}>
                  Check
                </button>
              </div>
            </div>
          )
        ) : (
          <div
            className={`max-h-[70dvh] animate-rise overflow-y-auto border-t-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 ${
              result ? "border-good bg-good-soft" : "border-bad bg-bad-soft"
            }`}
            aria-live="polite"
          >
            <div className="mx-auto max-w-xl space-y-2">
              <p className={`font-display text-xl font-semibold ${result ? "text-good" : "text-bad"}`}>{result ? "Correct" : "Incorrect"}</p>
              {!result && (
                <p>
                  <span className="font-medium">Answer:</span> {correctText}
                </p>
              )}
              <p className="text-sm">{why}</p>
              {extra && <p className="text-sm text-ink-2">{extra}</p>}
              <button className="btn btn-primary w-full" autoFocus onClick={next}>
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Tap a word, then its meaning. A wrong pair flashes and clears. */
function Match({ ex, onDone }: { ex: Extract<Exercise, { kind: "match" }>; onDone: () => void }) {
  const [word, setWord] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<{ word: number; def: number } | null>(null);

  function pickDef(def: number) {
    if (word === null || matched.includes(def)) return;
    if (def === word) {
      const all = [...matched, def];
      setMatched(all);
      setWord(null);
      if (all.length === ex.pairs.length) onDone();
    } else {
      setWrong({ word, def });
      setWord(null);
      setTimeout(() => setWrong(null), 500);
    }
  }

  const cell = "min-h-12 w-full rounded-xl border-2 px-3 py-2 text-left text-sm active:scale-[0.99]";
  return (
    <>
      <p className="text-sm font-semibold text-link">Match each word to its meaning</p>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
        <div className="space-y-2">
          {ex.pairs.map((p, i) => (
            <button
              key={p.wordId}
              disabled={matched.includes(i)}
              onClick={() => setWord(i)}
              aria-pressed={word === i}
              className={`${cell} font-semibold ${
                matched.includes(i)
                  ? "border-good bg-good-soft text-good opacity-60"
                  : wrong?.word === i
                    ? "border-bad bg-bad-soft"
                    : word === i
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-surface"
              }`}
            >
              {p.word}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {ex.order.map((i) => (
            <button
              key={i}
              disabled={matched.includes(i) || word === null}
              onClick={() => pickDef(i)}
              className={`${cell} ${
                matched.includes(i) ? "border-good bg-good-soft opacity-60" : wrong?.def === i ? "border-bad bg-bad-soft" : "border-line bg-surface"
              }`}
            >
              {ex.pairs[i].definition}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
