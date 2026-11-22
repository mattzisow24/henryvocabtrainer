import "server-only";

// Loads the data for the daily email, asks Claude for the short note that
// leads it, and sends it.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LEARNER_NAME } from "./config";
import { loadDrills, loadProfile, loadReviews, loadSessions, loadStates } from "./data";
import { addDays, today } from "./dates";
import { composeDigest, digestFacts, parseNote, type DigestFacts, type DigestNote } from "./digest";
import { emailConfigured, sendEmail } from "./email";
import { WORDS } from "./words";

const MODEL = process.env.COACH_MODEL ?? "claude-opus-5-5";

/** The app's public address, for the link back to the dashboard. */
function dashboardUrl(): string | null {
  const host = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  return host ? `${host.replace(/\/$/, "")}/dashboard` : null;
}

/**
 * The short written part of the email. Returns null if it can't be written,
 * so the email still goes out with the figures.
 */
async function writeNote(facts: DigestFacts, profile: unknown): Promise<DigestNote | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const response = await new Anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: `You write the top of a daily email to the parents of ${LEARNER_NAME}, a 16-year-old preparing for the SAT's Words in Context questions with a typed coaching app and a 100-word list. He already scores 750 in Reading and Writing and is working to add 20 to 30 points. The parents read it on a phone in a few seconds, and a table of every figure sits directly below your note, so never repeat a number that is in the data.

Reply in exactly this shape and nothing else:
- Line 1: the bottom line in one plain sentence of at most 15 words. Say how today went and whether anything needs their attention.
- Then zero to three lines, each starting with "- " and at most 14 words: only things worth knowing that the figures do not show, such as a pattern in what he gets wrong, a change in habit, or one concrete thing a parent could do. If nothing is worth adding, write no points at all. Do not pad.

The data gives the days left before his SAT. He is self-motivated and the parents are not looking to manage him, so report rather than prescribe. If he did not practice, say so plainly and without alarm. Do not invent concerns. Plain text only: no greeting, no sign-off, no markdown other than the "- " at the start of each point.`,
      messages: [
        {
          role: "user",
          content: `Today's data:\n${JSON.stringify(facts, null, 2)}\n\nWhat the coach has learned about how he learns:\n${JSON.stringify(profile, null, 2)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return parseNote(text);
  } catch (err) {
    console.error("[digest] note failed", err);
    return null;
  }
}

/** Builds today's email from whatever the given database client is allowed to read. */
export async function buildDigest(db: SupabaseClient) {
  const day = today();
  const [states, sessions, drills, reviews, { profile }] = await Promise.all([
    loadStates(db),
    loadSessions(db),
    loadDrills(db),
    loadReviews(db, addDays(day, -120)),
    loadProfile(db),
  ]);
  const facts = digestFacts({ words: WORDS, states, sessions, drills, reviews, day });
  const note = await writeNote(facts, profile);
  return composeDigest(facts, note, dashboardUrl());
}

export type DigestResult = { ok: true; sentTo: number } | { ok: false; reason: string };

/** Sends today's email to the given addresses. */
export async function sendDigest(db: SupabaseClient, to: string[]): Promise<DigestResult> {
  if (!emailConfigured()) return { ok: false, reason: "Email isn't set up yet. Add the email settings in Vercel." };
  if (to.length === 0) return { ok: false, reason: "No one to send to." };
  try {
    const digest = await buildDigest(db);
    await sendEmail({ to, ...digest });
    return { ok: true, sentTo: to.length };
  } catch (err) {
    console.error("[digest] send failed", err);
    return { ok: false, reason: err instanceof Error ? err.message : "The email could not be sent." };
  }
}
