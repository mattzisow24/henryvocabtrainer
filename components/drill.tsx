"use client";

// Words in Context drill in the digital SAT format. Practice mode explains each
// answer straight away; timed mode runs against the clock and reviews at the end.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveDrill } from "@/app/(app)/drill/actions";
import { POINTS } from "@/lib/rewards";
import { Passage } from "./passage";

export type DrillItem = {
  id: string;
  /** The SAT question stem. */
  stem: string;
  passage: string;
  choices: string[];
  answer: number;
  /** Shown after answering: why the answer is right and the tempting one is not. */
  why: string;
  /** The study word behind the question, and its meaning. */
  word: string;
  meaning: string;
};

const LETTERS = ["A", "B", "C", "D"];

/** Headline for the results screen, by share of answers correct. */
function verdict(correct: number, total: number): string {
  if (correct === total) return "Clean round";
  const share = correct / total;
  if (share >= 0.8) return "Strong round";
  if (share >= 0.5) return "Work to do";
  return "Rough round";
}

export function Drill(props: { timed: boolean; items: DrillItem[]; secondsAllowed: number; preview: boolean }) {
  const { timed, items, secondsAllowed, preview } = props;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState<"saving" | "ok" | "failed" | "preview">(preview ? "preview" : "saving");
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(timer);
  }, []);

  const outOfTime = timed && elapsed >= secondsAllowed;
  const done = finished || outOfTime;

  // Save once, when the drill ends. Unanswered questions count as wrong.
  const savedOnce = useRef(false);
  useEffect(() => {
    if (!done || savedOnce.current || preview) return;
    savedOnce.current = true;
    const seconds = Math.min(Math.floor((Date.now() - startedAt.current) / 1000), timed ? secondsAllowed : 7200);
    saveDrill({ timed, seconds, answers: items.map((item, i) => ({ id: item.id, chosen: answers[i] == null ? null : item.choices[answers[i]] })) })
      .then((r) => setSaved(r.ok ? "ok" : "failed"))
      .catch(() => setSaved("failed"));
  }, [done, answers, items, timed, secondsAllowed, preview]);

  function advance(nextAnswers: (number | null)[]) {
    setPicked(null);
    if (index + 1 >= items.length) setFinished(true);
    else setIndex(index + 1);
    setAnswers(nextAnswers);
  }

  function choose(choice: number) {
    if (picked !== null || done) return;
    const next = [...answers];
    next[index] = choice;
    if (timed) advance(next);
    else {
      setAnswers(next);
      setPicked(choice);
    }
  }

  if (done) {
    const correct = items.filter((item, i) => answers[i] === item.answer).length;
    const missed = items.map((item, i) => ({ item, chosen: answers[i] ?? null })).filter((x) => x.chosen !== x.item.answer);
    return (
      <div className="space-y-4">
        <div className="card animate-rise space-y-1 p-6 text-center">
          <p className="font-display text-2xl font-semibold text-navy">{outOfTime && !finished ? "Time's up" : verdict(correct, items.length)}</p>
          <p className="font-display text-5xl font-semibold tabular-nums text-accent">
            {correct} / {items.length}
          </p>
          {correct > 0 && <p className="font-semibold text-ink-2">+{correct * POINTS.drillCorrect} points</p>}
          <p className="text-sm text-muted">
            {saved === "saving"
              ? "Saving…"
              : saved === "ok"
                ? missed.length > 0
                  ? "Saved. The words you missed go back to your coach."
                  : "Saved."
                : saved === "preview"
                  ? "Preview: this round was not saved."
                  : "Couldn't save this round."}
          </p>
        </div>
        {missed.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold">Worth another look</h2>
            {missed.map(({ item, chosen }) => (
              <div key={item.id} className="card space-y-1 p-4">
                <Passage text={item.passage} className="text-sm" />
                <p className="text-sm">
                  <span className="text-good">Answer: {item.choices[item.answer]}</span>
                  {chosen !== null ? <span className="text-ink-2"> · You picked: {item.choices[chosen]}</span> : <span className="text-ink-2"> · Not answered</span>}
                </p>
                <p className="text-sm text-ink-2">{item.why}</p>
                <p className="text-sm text-ink-2">{item.meaning}</p>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/drill" className="btn">
            Another round
          </Link>
          <Link href="/home" className="btn btn-primary">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const item = items[index];
  const left = Math.max(0, secondsAllowed - elapsed);
  // Right answers in a row, counting back from the latest. Practice mode only:
  // timed mode gives no feedback until the end, like the real test.
  let run = 0;
  if (!timed) for (let i = answers.length - 1; i >= 0 && answers[i] === items[i].answer; i--) run++;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between text-sm text-ink-2">
        <span className="tabular-nums">
          {index + 1} of {items.length}
        </span>
        {run >= 2 && (
          <span className="font-semibold tabular-nums text-navy">{run} in a row</span>
        )}
        {timed && (
          <span className={`tabular-nums ${left <= 60 ? "font-semibold text-bad" : ""}`}>
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left
          </span>
        )}
      </div>

      <div className="card space-y-3 p-5">
        <Passage text={item.passage} className="text-[17px] leading-relaxed" />
        <p className="text-sm font-medium text-ink-2">{item.stem}</p>
      </div>

      <div className="space-y-2">
        {item.choices.map((choice, i) => {
          const isAnswer = picked !== null && i === item.answer;
          const isWrongPick = picked === i && i !== item.answer;
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={picked !== null}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left transition-transform active:scale-[0.99] ${
                isAnswer ? "border-good bg-good-soft" : isWrongPick ? "border-bad bg-bad-soft" : "border-line bg-surface"
              }`}
            >
              <span className="w-5 shrink-0 text-sm font-semibold text-muted">{LETTERS[i]}</span>
              <span className="flex-1">{choice}</span>
              {isAnswer && <span className="text-sm font-semibold text-good">Correct answer</span>}
              {isWrongPick && <span className="text-sm font-semibold text-bad">Your pick</span>}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="card animate-rise space-y-2 p-4" aria-live="polite">
          <p className={`font-display text-lg font-semibold ${picked === item.answer ? "text-good" : "text-bad"}`}>
            {picked === item.answer ? `Correct. +${POINTS.drillCorrect}` : "Incorrect."}
          </p>
          <p>{item.why}</p>
          <p className="text-sm text-ink-2">{item.meaning}</p>
          <button className="btn btn-primary w-full" autoFocus onClick={() => advance(answers)}>
            {index + 1 >= items.length ? "See results" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
