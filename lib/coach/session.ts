import "server-only";

// Finds today's coach session or starts a new one.

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProfile, loadStates } from "@/lib/data";
import { today } from "@/lib/dates";
import { outlook } from "@/lib/exam";
import { dailyPlan } from "@/lib/plan";
import { WORDS, type Word } from "@/lib/words";
import { dailyPrompt } from "./prompt";

export type TranscriptLine = { who: "coach" | "learner"; text: string; at: string };

export type CoachSession = {
  id: string;
  learner_id: string;
  status: "active" | "done";
  day: string;
  plan: { wordIds: string[]; graded: string[] };
  system_prompt: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  transcript: TranscriptLine[];
};

const COLUMNS = "id, learner_id, status, day, plan, system_prompt, messages, transcript";

export async function loadSession(db: SupabaseClient, id: string): Promise<CoachSession | null> {
  const { data, error } = await db.from("sessions").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as CoachSession | null;
}

/**
 * Today's unfinished session if there is one; otherwise a new one. Null when
 * the first-day sort has not been done: the plan depends on it.
 */
export async function startOrResume(db: SupabaseClient, learnerId: string): Promise<{ session: CoachSession; resumed: boolean } | null> {
  const day = today();
  const { data: open, error } = await db
    .from("sessions")
    .select(COLUMNS)
    .eq("learner_id", learnerId)
    .eq("status", "active")
    .order("started_at", { ascending: false });
  if (error) throw new Error(error.message);

  let current: CoachSession | null = null;
  for (const s of (open ?? []) as CoachSession[]) {
    if (!current && s.day === day && s.messages.length > 0) {
      current = s;
      continue;
    }
    // Left open on an earlier day: close it so it stops counting as in progress.
    await db.from("sessions").update({ status: "done", ended_at: new Date().toISOString() }).eq("id", s.id);
  }
  if (current) return { session: current, resumed: true };

  const [{ profile, onboardedAt }, states] = await Promise.all([loadProfile(db), loadStates(db)]);
  if (!onboardedAt) return null;
  const words = new Map<string, Word>(WORDS.map((w) => [w.id, w]));
  const { review, fresh } = dailyPlan(WORDS, states, day, outlook(day).daysAway);
  const { data: last } = await db
    .from("sessions")
    .select("summary")
    .eq("learner_id", learnerId)
    .not("summary", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const systemPrompt = dailyPrompt({ day, profile, review, fresh, words, states, lastSummary: last?.summary ?? null });

  const { data: created, error: createError } = await db
    .from("sessions")
    .insert({ learner_id: learnerId, day, plan: { wordIds: [...review, ...fresh], graded: [] }, system_prompt: systemPrompt })
    .select(COLUMNS)
    .single();
  if (createError) throw new Error(createError.message);
  return { session: created as CoachSession, resumed: false };
}
