import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { LEARNER_NAME } from "@/lib/config";
import { parentLine } from "@/lib/exam";
import { loadDrills, loadProfile, loadReviews, loadSessions, loadStates } from "@/lib/data";
import { addDays, today } from "@/lib/dates";
import { dailyActivity, drillAccuracy, sessionMinutes, summarize } from "@/lib/progress";
import { getWord, WORDS } from "@/lib/words";
import { SessionSummary } from "@/components/session-summary";
import { Stat, StageBar } from "@/components/stage-bar";
import { emailConfigured } from "@/lib/email";
import { addMember, removeMember, sendTestDigest, startPreview } from "./actions";

const fmtDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const emailResult = (await searchParams).email;
  const member = await requireMember();
  if (member.role === "learner") redirect("/home");
  const db = member.supabase;
  const day = today();
  const [states, sessions, drills, reviews, { profile, onboardedAt }, { data: members }] = await Promise.all([
    loadStates(db),
    loadSessions(db),
    loadDrills(db),
    loadReviews(db, addDays(day, -60)),
    loadProfile(db),
    db.from("members").select("email, role, display_name").order("role"),
  ]);
  const p = summarize({ words: WORDS, states, sessions, drills, reviews, day });
  const activity = dailyActivity({ sessions, drills, reviews, day });
  const daysOff = activity.filter((a) => !a.practiced && a.day !== day).length;
  const weekAgo = addDays(day, -6);
  const recentDrills = drills.filter((d) => d.day >= weekAgo);
  const accuracy = [
    { label: "Practice", ...drillAccuracy(recentDrills, false) },
    { label: "Timed", ...drillAccuracy(recentDrills, true) },
  ];

  // Words that keep slipping: missed last time, dropped back, or mixed up with another word.
  const trouble = [...states.values()]
    .filter((s) => s.box > 0 && s.box < 4 && (s.last_grade === "missed" || s.lapses > 0 || s.confused_with))
    .sort((a, b) => b.lapses - a.lapses || a.box - b.box)
    .slice(0, 12);

  const flagged = WORDS.filter((w) => w.listCheck === "imprecise" || w.listCheck === "wrong");
  const profileRows = [
    ["Interests", profile.interests],
    ["Learns best when", profile.learns_best],
    ["Struggles with", profile.struggles_with],
    ["Coaching notes", profile.coaching_notes],
  ].filter((row): row is [string, string] => !!row[1]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-navy">{LEARNER_NAME}&apos;s progress</h1>
          <p className="text-ink-2">
            {parentLine(p.exam)} {p.practicedToday ? "Practiced today." : "No practice yet today."}
          </p>
        </div>
        {member.role === "parent" && (
          <form action={startPreview}>
            <button className="btn">View as {LEARNER_NAME}</button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Days to test"
          value={Math.max(0, p.exam.daysAway)}
        />
        <Stat label="Day streak" value={p.streak} />
        <Stat label="Minutes, last 7 days" value={p.minutesThisWeek} />
        <Stat label="Words mastered" value={p.mastered} note={`of ${p.total}`} />
      </div>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Day by day</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-ink-2">{LEARNER_NAME} hasn&apos;t practiced yet. Each day will show up here once he starts.</p>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              Practiced {activity.filter((a) => a.practiced).length} of the last {activity.length} day{activity.length === 1 ? "" : "s"}
              {daysOff > 0 ? `, with ${daysOff} day${daysOff === 1 ? "" : "s"} off` : ""}.
            </p>
            {/* Oldest to newest, left to right. Filled = practiced, outlined = a day off. */}
            <ol className="flex flex-wrap gap-1" aria-label="Practice by day, oldest first">
              {[...activity].reverse().map((a) => (
                <li
                  key={a.day}
                  title={`${fmtDay(a.day)}: ${a.practiced ? `${a.minutes} min` : a.day === day ? "not yet" : "no practice"}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-[0.65rem] font-semibold ${
                    a.practiced ? "bg-brand text-white" : a.day === day ? "border border-dashed border-muted text-muted" : "border border-bad text-bad"
                  }`}
                >
                  {new Date(`${a.day}T12:00:00Z`).getUTCDate()}
                  <span className="sr-only">{a.practiced ? " practiced" : " no practice"}</span>
                </li>
              ))}
            </ol>
            <ul className="divide-y divide-line text-sm">
              {activity.map((a) => {
                const coachTotal = a.coach.knew + a.coach.partial + a.coach.missed;
                return (
                  <li key={a.day} className="space-y-0.5 py-2.5">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {fmtDay(a.day)}
                        {a.day === day ? " (today)" : ""}
                      </span>
                      {a.practiced ? (
                        <span className="tabular-nums text-ink-2">{a.minutes} min</span>
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.day === day ? "bg-canvas text-muted" : "bg-bad-soft text-bad"}`}>
                          {a.day === day ? "Not yet today" : "No practice"}
                        </span>
                      )}
                    </p>
                    {coachTotal > 0 && (
                      <p className="text-ink-2">
                        Coach: {coachTotal} word{coachTotal === 1 ? "" : "s"}. {a.coach.knew} knew, {a.coach.partial} close, {a.coach.missed} missed.
                      </p>
                    )}
                    {a.drills.rounds > 0 && (
                      <p className="text-ink-2">
                        Drills: {a.drills.rounds} round{a.drills.rounds === 1 ? "" : "s"}, {a.drills.correct} of {a.drills.total} correct (
                        {Math.round((a.drills.correct / a.drills.total) * 100)}%).
                      </p>
                    )}
                    {a.practiced && coachTotal === 0 && a.drills.rounds === 0 && <p className="text-ink-2">Opened a coach session but answered no words.</p>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Where the {p.total} words stand</h2>
        <StageBar progress={p} />
        <p className="text-sm text-ink-2">
          A word counts as mastered once {LEARNER_NAME} has got it right at least twice on separate days, with his coach or in a Words in Context drill. {p.due} due for review today.
        </p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Words in Context accuracy, last 7 days</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-2">
              <th className="py-1 font-medium">Mode</th>
              <th className="py-1 pl-3 text-right font-medium">Correct</th>
              <th className="py-1 pl-3 text-right font-medium">Rounds</th>
              <th className="py-1 pl-3 text-right font-medium">Timed pace</th>
            </tr>
          </thead>
          <tbody>
            {accuracy.map((a) => (
              <tr key={a.label} className="border-t border-line">
                <td className="py-2">{a.label}</td>
                <td className="py-2 pl-3 text-right tabular-nums">
                  {a.total ? `${a.correct} of ${a.total} (${Math.round((a.correct / a.total) * 100)}%)` : "No rounds yet"}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums">{a.runs}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{a.secondsPerQuestion ? `${a.secondsPerQuestion}s per question` : "Not timed yet"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted">The SAT allows about 71 seconds per Reading and Writing question.</p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Words that keep slipping</h2>
        {trouble.length === 0 ? (
          <p className="text-sm text-ink-2">Nothing yet. Words show up here when {LEARNER_NAME} misses one more than once or mixes it up with another.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {trouble.map((s) => {
              const w = getWord(s.word_id);
              return (
                <li key={s.word_id} className="py-2">
                  <span className="font-semibold">{w?.word ?? s.word_id}</span> <span className="text-ink-2">{w?.definition}</span>
                  {s.confused_with && <span className="block text-ink-2">Mixed up with: {s.confused_with}</span>}
                  {s.note && <span className="block text-ink-2">Coach&apos;s note: {s.note}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">How {LEARNER_NAME} learns</h2>
        {profileRows.length === 0 ? (
          <p className="text-sm text-ink-2">
            {onboardedAt ? "The coach hasn't saved notes yet." : `The coach adds notes here once ${LEARNER_NAME} starts.`}
          </p>
        ) : (
          <dl className="space-y-2 text-sm">
            {profileRows.map(([label, value]) => (
              <div key={label}>
                <dt className="font-medium">{label}</dt>
                <dd className="text-ink-2">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Coach sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-ink-2">No sessions yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {sessions.slice(0, 15).map((s) => (
              <li key={s.id} className="space-y-1 py-3">
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {fmtDay(s.day)} · {sessionMinutes(s)} min
                    {s.status === "active" ? " · in progress" : ""}
                  </span>
                  <Link href={`/dashboard/session/${s.id}`} className="text-link underline">
                    Transcript
                  </Link>
                </p>
                {s.summary && <SessionSummary text={s.summary} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="text-base font-semibold">The word list</h2>
        <p className="text-ink-2">
          {WORDS.length} words chosen from the tutor&apos;s list of 646 student-reported SAT words, ranked by how many reports and how many separate
          test dates each drew. The tutor&apos;s list gave short meanings for {WORDS.filter((w) => w.listCheck !== "none").length} of them;{" "}
          {flagged.length === 0
            ? "all hold up."
            : `${flagged.length} were imprecise (${flagged.map((w) => w.word).join(", ")}), and the coach tells ${LEARNER_NAME} what they left out.`}
        </p>
        <Link href="/words" className="text-link underline">
          See the words
        </Link>
      </section>

      {member.role === "parent" && (
        <section id="daily-email" className="card space-y-3 p-4 text-sm">
          <h2 className="text-base font-semibold">Daily email</h2>
          <p className="text-ink-2">
            Every evening between 8 and 9 pm Eastern, each parent on the access list gets a summary of {LEARNER_NAME}&apos;s day: whether he practiced,
            how it went, the words he missed, and whether he is on pace for the test.
          </p>
          {!emailConfigured() || !process.env.SUPABASE_SECRET_KEY || !process.env.CRON_SECRET ? (
            <p className="rounded-xl bg-gold-soft p-3">
              Not switched on yet. Still needed in Vercel:{" "}
              {[
                !emailConfigured() && "the email settings (GMAIL_USER and GMAIL_APP_PASSWORD)",
                !process.env.SUPABASE_SECRET_KEY && "SUPABASE_SECRET_KEY",
                !process.env.CRON_SECRET && "CRON_SECRET",
              ]
                .filter(Boolean)
                .join(", ")}
              .
            </p>
          ) : (
            <p className="font-medium text-good">Switched on.</p>
          )}
          {emailResult && (
            <p role="status" className={emailResult === "sent" ? "font-medium text-good" : "text-bad"}>
              {emailResult === "sent" ? `Sent to ${member.email}. Check your inbox.` : `Couldn't send: ${emailResult}`}
            </p>
          )}
          <form action={sendTestDigest}>
            <button className="btn" disabled={!emailConfigured()}>
              Send me today&apos;s email now
            </button>
          </form>
        </section>
      )}

      {member.role === "parent" && (
        <section className="card space-y-3 p-4 text-sm">
          <h2 className="text-base font-semibold">Who has access</h2>
          <ul className="divide-y divide-line">
            {(members ?? []).map((m) => (
              <li key={m.email} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.display_name || m.email}</span>
                  <span className="block truncate text-ink-2">
                    {m.email} · {m.role}
                  </span>
                </span>
                {m.role !== "learner" && m.email !== member.email && (
                  <form action={removeMember}>
                    <input type="hidden" name="email" value={m.email} />
                    <button className="text-bad underline">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <form action={addMember} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <input name="name" placeholder="Name" aria-label="Name" className="h-11 rounded-xl border border-line bg-field px-3" />
            <input name="email" type="email" required placeholder="Email" aria-label="Email" className="h-11 rounded-xl border border-line bg-field px-3" />
            <select name="role" aria-label="Role" className="h-11 rounded-xl border border-line bg-field px-3">
              <option value="parent">Parent</option>
            </select>
            <button className="btn btn-primary">Add</button>
          </form>
          <p className="text-xs text-muted">Parents see this dashboard and the word list, and can change who has access. {LEARNER_NAME} is told on his screens that his sessions are visible here.</p>
        </section>
      )}
    </div>
  );
}
