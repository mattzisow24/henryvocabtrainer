// The daily email for parents: what the learner did today, where he stands,
// and a short note. `composeDigest` is pure so it can be tested; loading the
// data and writing the note happen in digest-server.ts.

import { LEARNER_NAME, NEW_WORD_CUTOFF_DAYS } from "./config";
import { parentLine } from "./exam";
import type { DrillRow, ReviewRow, SessionRow, StateRow } from "./data";
import { daysBetween } from "./dates";
import { dailyActivity, summarize, type DayActivity, type Progress } from "./progress";
import { computeRewards } from "./rewards";
import { parseSummary } from "./summary";
import type { Word } from "./words";

const N = LEARNER_NAME;

export type DigestFacts = {
  day: string;
  today: DayActivity;
  progress: Progress;
  /** Days practiced out of the days counted (up to the last 7). */
  week: { practiced: number; days: number };
  level: number;
  points: number;
  /** Words he missed with the coach or in a drill today. */
  missedToday: { word: string; confusedWith: string | null }[];
  /** The headline of each of today's coach session summaries. */
  sessionNotes: string[];
  /** Whether the current rate of new words reaches the whole list before the test. */
  pace: { perDay: number; needPerDay: number; onTrack: boolean } | null;
};

export function digestFacts(opts: {
  words: Word[];
  states: Map<string, StateRow>;
  sessions: SessionRow[];
  drills: DrillRow[];
  reviews: ReviewRow[];
  day: string;
}): DigestFacts {
  const { words, states, sessions, drills, reviews, day } = opts;
  const progress = summarize(opts);
  const rewards = computeRewards(opts);
  const days = dailyActivity({ sessions, drills, reviews, day, maxDays: 7 });
  const today: DayActivity = days.find((d) => d.day === day) ?? {
    day,
    practiced: false,
    minutes: 0,
    coach: { knew: 0, partial: 0, missed: 0 },
    drills: { rounds: 0, correct: 0, total: 0 },
  };

  const byId = new Map(words.map((w) => [w.id, w]));
  const missedIds = [...new Set(reviews.filter((r) => r.day === day && r.grade === "missed").map((r) => r.word_id))];
  const missedToday = missedIds
    .map((id) => byId.get(id))
    .filter((w): w is Word => !!w)
    .map((w) => ({ word: w.word, confusedWith: states.get(w.id)?.confused_with ?? null }));

  // Pace: words met so far, spread over the days since he started.
  const started = progress.total - progress.notStarted;
  const allDays = [...sessions.map((s) => s.day), ...drills.map((d) => d.day), ...reviews.map((r) => r.day)];
  let pace: DigestFacts["pace"] = null;
  // New words stop a few days before the test, so those days do not count.
  const daysLeft = progress.exam.daysAway - NEW_WORD_CUTOFF_DAYS;
  if (started > 0 && allDays.length > 0 && daysLeft > 0 && progress.notStarted > 0) {
    const first = allDays.reduce((a, b) => (a < b ? a : b));
    const perDay = started / (daysBetween(first, day) + 1);
    const needPerDay = progress.notStarted / daysLeft;
    pace = { perDay: Math.round(perDay * 10) / 10, needPerDay: Math.round(needPerDay * 10) / 10, onTrack: perDay >= needPerDay };
  }

  return {
    day,
    today,
    progress,
    week: { practiced: days.filter((d) => d.practiced).length, days: days.length },
    level: rewards.level,
    points: rewards.points,
    missedToday,
    sessionNotes: sessions.filter((s) => s.day === day && s.summary).map((s) => parseSummary(s.summary!).headline),
    pace,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const longDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/** The written part of the email: one sentence, then at most three short points. */
export type DigestNote = { headline: string; points: string[] };

/** Reads the note back out of the model's reply: a first line, then "- " points. */
export function parseNote(reply: string): DigestNote | null {
  const lines = reply.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const points = lines.slice(1).map((l) => l.replace(/^[-*\u2022]\s*/, "")).filter(Boolean).slice(0, 3);
  return { headline: lines[0].replace(/^[-*\u2022]\s*/, ""), points };
}

/** The figures as short label/value rows; the text and HTML versions are both built from these. */
function rows(f: DigestFacts): [string, string][] {
  const { today, progress: p } = f;
  const coachTotal = today.coach.knew + today.coach.partial + today.coach.missed;
  const out: [string, string][] = [];

  if (!today.practiced) out.push(["Today", "No practice yet"]);
  else {
    out.push(["Today", `${today.minutes} min`]);
    if (coachTotal > 0) out.push(["Coach", `${plural(coachTotal, "word")}: ${today.coach.knew} knew, ${today.coach.partial} close, ${today.coach.missed} missed`]);
    if (today.drills.rounds > 0) {
      const pct = Math.round((today.drills.correct / today.drills.total) * 100);
      out.push(["Drills", `${today.drills.correct} of ${today.drills.total} correct (${pct}%)`]);
    }
  }
  if (f.missedToday.length > 0) {
    out.push(["Missed", f.missedToday.map((m) => (m.confusedWith ? `${m.word} (said ${m.confusedWith})` : m.word)).join(", ")]);
  }
  if (f.sessionNotes.length > 0) out.push(["Coach says", f.sessionNotes.join(" ")]);
  if (f.week.days > 0) out.push(["Habit", `${f.week.practiced} of last ${plural(f.week.days, "day")}, streak ${p.streak}`]);
  out.push(["Words", `${p.mastered} mastered, ${p.learning} learning, ${p.notStarted} to go`]);
  if (f.pace) out.push(["Pace", `${f.pace.onTrack ? "On track" : "Behind"}: ${f.pace.perDay} new a day, needs ${f.pace.needPerDay}`]);
  out.push(["Test", parentLine(p.exam)]);
  return out;
}

export function digestSubject(f: DigestFacts): string {
  if (!f.today.practiced) return `${N} hasn't practiced today`;
  const coachTotal = f.today.coach.knew + f.today.coach.partial + f.today.coach.missed;
  const bits = [plural(f.today.minutes, "min", "min")];
  if (coachTotal > 0) bits.push(plural(coachTotal, "word"));
  if (f.today.drills.rounds > 0) bits.push(plural(f.today.drills.rounds, "drill"));
  return `${N} practiced today: ${bits.join(", ")}`;
}

/** The finished email. Pass a null note to send the figures alone. */
export function composeDigest(f: DigestFacts, note: DigestNote | null, dashboardUrl: string | null): { subject: string; text: string; html: string } {
  const table = rows(f);
  const width = Math.max(...table.map(([label]) => label.length));

  const text = [
    `${digestSubject(f)} (${longDay(f.day)})`,
    "",
    ...(note ? [note.headline, ...note.points.map((pt) => `- ${pt}`), ""] : []),
    ...table.map(([label, value]) => `${label.padEnd(width)}  ${value}`),
    ...(dashboardUrl ? ["", `Dashboard: ${dashboardUrl}`] : []),
  ].join("\n");

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#262626;line-height:1.45">
<div style="background:#012169;color:#ffffff;padding:16px 20px;border-radius:14px 14px 0 0">
<div style="font-size:12px;opacity:.8">${esc(longDay(f.day))}</div>
<div style="font-size:19px;font-weight:700">${esc(digestSubject(f))}</div>
</div>
<div style="border:1px solid #e2e6ed;border-top:0;padding:16px 20px;border-radius:0 0 14px 14px">
${
  note
    ? `<p style="margin:0 0 6px;font-size:15px;font-weight:600">${esc(note.headline)}</p>${
        note.points.length ? `<ul style="margin:0 0 14px;padding-left:18px;font-size:14px">${note.points.map((pt) => `<li style="margin:2px 0">${esc(pt)}</li>`).join("")}</ul>` : `<div style="height:8px"></div>`
      }`
    : ""
}
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
${table
  .map(
    ([label, value]) =>
      `<tr><td style="padding:6px 12px 6px 0;border-top:1px solid #e2e6ed;color:#6b7280;white-space:nowrap;vertical-align:top;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${esc(label)}</td><td style="padding:6px 0;border-top:1px solid #e2e6ed;vertical-align:top">${esc(value)}</td></tr>`,
  )
  .join("\n")}
</table>
${dashboardUrl ? `<p style="margin:16px 0 0"><a href="${esc(dashboardUrl)}" style="display:inline-block;background:#00539b;color:#ffffff;text-decoration:none;font-weight:600;padding:9px 18px;border-radius:999px;font-size:14px">Open the dashboard</a></p>` : ""}
</div>
</div>`;

  return { subject: digestSubject(f), text, html };
}
