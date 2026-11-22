import "server-only";

// Reads shared by the learner pages and the dashboard. There is one learner,
// so observers simply read every row the access rules let them see.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Grade, WordState } from "./srs";

export type LearnerProfile = {
  interests?: string;
  learns_best?: string;
  struggles_with?: string;
  coaching_notes?: string;
};

export type StateRow = WordState & { confused_with: string | null; note: string | null; updated_at: string };

export type SessionRow = {
  id: string;
  status: "active" | "done";
  day: string;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
  last_turn_at: string;
};

export type DrillRow = {
  id: string;
  timed: boolean;
  total: number;
  correct: number;
  seconds: number;
  day: string;
  created_at: string;
};

export type ReviewRow = { word_id: string; source: "coach" | "drill" | "sort"; grade: Grade; day: string };

export async function loadStates(db: SupabaseClient): Promise<Map<string, StateRow>> {
  const { data, error } = await db.from("word_state").select("*").limit(2000);
  if (error) throw new Error(error.message);
  return new Map((data as StateRow[]).map((r) => [r.word_id, r]));
}

export async function loadProfile(db: SupabaseClient): Promise<{ profile: LearnerProfile; onboardedAt: string | null }> {
  const { data, error } = await db.from("learner_profile").select("profile, onboarded_at").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return { profile: (data?.profile as LearnerProfile) ?? {}, onboardedAt: data?.onboarded_at ?? null };
}

export async function loadSessions(db: SupabaseClient, limit = 60): Promise<SessionRow[]> {
  const { data, error } = await db
    .from("sessions")
    .select("id, status, day, summary, started_at, ended_at, last_turn_at")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as SessionRow[];
}

export async function loadDrills(db: SupabaseClient, limit = 100): Promise<DrillRow[]> {
  const { data, error } = await db
    .from("drill_runs")
    .select("id, timed, total, correct, seconds, day, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as DrillRow[];
}

export async function loadReviews(db: SupabaseClient, sinceDay: string): Promise<ReviewRow[]> {
  const { data, error } = await db.from("reviews").select("word_id, source, grade, day").gte("day", sinceDay).limit(5000);
  if (error) throw new Error(error.message);
  return data as ReviewRow[];
}
