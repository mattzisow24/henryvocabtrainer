import "server-only";

// What the coach can do besides talk. Each tool is small and has one job.

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { LearnerProfile } from "@/lib/data";
import { POINTS } from "@/lib/rewards";
import { applyCoachGrade, MASTERED_BOX, newState, type Grade, type WordState } from "@/lib/srs";
import { formatSummary } from "@/lib/summary";
import { getWord } from "@/lib/words";

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "show_word",
    description:
      "Put a word card on the learner's screen. With reveal false it shows only the word; with reveal true it shows the meaning, example, other senses and memory hook. Reveal once he has answered or you have taught the word. Skip the unrevealed card when the word is the answer to a blank.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        word_id: { type: "string", description: "The word, exactly as listed in the session's word lists." },
        reveal: { type: "boolean", description: "True to show the meaning card; false to show only the word." },
      },
      required: ["word_id", "reveal"],
      additionalProperties: false,
    },
  },
  {
    name: "record_result",
    description:
      "Record how the learner did on a word, once per word per session, right after his first attempt. This sets when the word comes back for review.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        word_id: { type: "string", description: "The word, exactly as listed in the session's word lists." },
        grade: { type: "string", enum: ["knew", "partial", "missed"] },
        confused_with: {
          type: "string",
          description: "The word or sense he mixed it up with, e.g. 'accentuate' or 'the price-cut sense'. Empty string if none.",
        },
        note: {
          type: "string",
          description: "One short note that would help next time, e.g. 'right by elimination, could not define it'. Empty string if none.",
        },
      },
      required: ["word_id", "grade", "confused_with", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "update_profile",
    description:
      "Save what you have learned about how the learner learns. Later sessions and his parents read this. Each field replaces the previous value, so write the full, current picture; pass an empty string to leave a field as it is.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        interests: { type: "string", description: "What he is into and knows a lot about, specific enough to build examples from." },
        learns_best: { type: "string", description: "What makes things stick for him." },
        struggles_with: { type: "string", description: "What trips him up, in studying and on the test." },
        coaching_notes: { type: "string", description: "How to run sessions for him: pace, tone, what to avoid." },
      },
      required: ["interests", "learns_best", "struggles_with", "coaching_notes"],
      additionalProperties: false,
    },
  },
  {
    name: "end_session",
    description:
      "Close the session after your goodbye. The summary is read by the learner's parents on a phone, and is given back to you at the start of the next session. They want to scan it in a few seconds, so keep every field to a short phrase, not a paragraph.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        headline: { type: "string", description: "The session in one sentence of at most 15 words, e.g. 'Sharp session: 11 of 14 right, slips on near-synonyms.'" },
        went_well: { type: "string", description: "At most 12 words on what went well. Empty string if nothing stands out." },
        needs_work: {
          type: "string",
          description: "The specific words he missed or mixed up, as a comma-separated list, plus any habit worth naming in a few words. Empty string if none.",
        },
        next_focus: { type: "string", description: "At most 12 words on what the next session should focus on." },
      },
      required: ["headline", "went_well", "needs_work", "next_focus"],
      additionalProperties: false,
    },
  },
];

const ShowWord = z.object({ word_id: z.string(), reveal: z.boolean() });
const RecordResult = z.object({
  word_id: z.string(),
  grade: z.enum(["knew", "partial", "missed"]),
  confused_with: z.string(),
  note: z.string(),
});
const UpdateProfile = z.object({
  interests: z.string(),
  learns_best: z.string(),
  struggles_with: z.string(),
  coaching_notes: z.string(),
});
const EndSession = z.object({ headline: z.string(), went_well: z.string(), needs_work: z.string(), next_focus: z.string() });

/** Things the learner's screen should react to. */
export type UiEvent =
  | { t: "card"; wordId: string; reveal: boolean }
  | { t: "progress"; graded: number; total: number }
  | { t: "result"; wordId: string; grade: Grade; points: number; mastered: boolean }
  | { t: "ended" };

export type ToolContext = {
  db: SupabaseClient;
  learnerId: string;
  sessionId: string;
  day: string;
  /** Word ids in this session's plan. */
  planIds: string[];
  /** Word ids graded so far this session; the tools add to it. */
  graded: Set<string>;
  emit(event: UiEvent): void;
};

export type ToolOutcome = { content: string; isError?: boolean; ended?: boolean };

export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  switch (name) {
    case "show_word": {
      const p = ShowWord.safeParse(input);
      if (!p.success) return invalid();
      const word = getWord(p.data.word_id);
      if (!word) return unknownWord(p.data.word_id);
      ctx.emit({ t: "card", wordId: word.id, reveal: p.data.reveal });
      return { content: "shown" };
    }
    case "record_result": {
      const p = RecordResult.safeParse(input);
      if (!p.success) return invalid();
      const word = getWord(p.data.word_id);
      if (!word) return unknownWord(p.data.word_id);
      if (ctx.graded.has(word.id)) return { content: "Already recorded this session; the first attempt stands." };

      const { data: row, error: readError } = await ctx.db
        .from("word_state")
        .select("word_id, box, due, seen, correct, lapses, last_grade")
        .eq("learner_id", ctx.learnerId)
        .eq("word_id", word.id)
        .maybeSingle();
      if (readError) return failed(readError.message);
      const prev = (row as WordState | null) ?? newState(word.id, ctx.day);
      const next = applyCoachGrade(prev, p.data.grade, ctx.day);
      const mastered = next.box >= MASTERED_BOX && prev.box < MASTERED_BOX;
      const { error: writeError } = await ctx.db.from("word_state").upsert({
        learner_id: ctx.learnerId,
        ...next,
        // Keep an earlier confusion on record unless he has now got the word right.
        ...(p.data.confused_with ? { confused_with: p.data.confused_with } : p.data.grade === "knew" ? { confused_with: null } : {}),
        ...(p.data.note ? { note: p.data.note } : {}),
        updated_at: new Date().toISOString(),
      });
      if (writeError) return failed(writeError.message);
      const { error: logError } = await ctx.db.from("reviews").insert({
        learner_id: ctx.learnerId,
        word_id: word.id,
        source: "coach",
        grade: p.data.grade,
        session_id: ctx.sessionId,
        day: ctx.day,
      });
      if (logError) return failed(logError.message);

      ctx.graded.add(word.id);
      ctx.emit({
        t: "result",
        wordId: word.id,
        grade: p.data.grade,
        points: POINTS[p.data.grade] + (mastered ? POINTS.mastered : 0),
        mastered,
      });
      ctx.emit({ t: "progress", graded: ctx.graded.size, total: ctx.planIds.length });
      const left = ctx.planIds.filter((id) => !ctx.graded.has(id)).length;
      return { content: `recorded; ${left} word${left === 1 ? "" : "s"} left in today's list` };
    }
    case "update_profile": {
      const p = UpdateProfile.safeParse(input);
      if (!p.success) return invalid();
      const { data: row, error: readError } = await ctx.db
        .from("learner_profile")
        .select("profile")
        .eq("learner_id", ctx.learnerId)
        .maybeSingle();
      if (readError) return failed(readError.message);
      const profile: LearnerProfile = { ...((row?.profile as LearnerProfile) ?? {}) };
      for (const [key, value] of Object.entries(p.data)) {
        if (value.trim()) profile[key as keyof LearnerProfile] = value.trim();
      }
      const { error } = await ctx.db
        .from("learner_profile")
        .upsert({ learner_id: ctx.learnerId, profile, updated_at: new Date().toISOString() });
      if (error) return failed(error.message);
      return { content: "saved" };
    }
    case "end_session": {
      const p = EndSession.safeParse(input);
      if (!p.success) return invalid();
      const now = new Date().toISOString();
      const { error } = await ctx.db
        .from("sessions")
        .update({ status: "done", summary: formatSummary(p.data), ended_at: now })
        .eq("id", ctx.sessionId);
      if (error) return failed(error.message);
      ctx.emit({ t: "ended" });
      return { content: "session closed", ended: true };
    }
    default:
      return { content: `Unknown tool: ${name}`, isError: true };
  }
}

/** Marks the first-day sort as complete without touching the saved profile. */
export async function markOnboarded(db: SupabaseClient, learnerId: string) {
  const now = new Date().toISOString();
  const { data } = await db.from("learner_profile").select("learner_id").eq("learner_id", learnerId).maybeSingle();
  return data
    ? db.from("learner_profile").update({ onboarded_at: now, updated_at: now }).eq("learner_id", learnerId)
    : db.from("learner_profile").insert({ learner_id: learnerId, onboarded_at: now });
}

const invalid = (): ToolOutcome => ({ content: "The tool input was not valid. Call the tool again with every field filled in.", isError: true });
const unknownWord = (id: string): ToolOutcome => ({
  content: `"${id}" is not in the word list. Use a word_id exactly as it appears in the session's word lists.`,
  isError: true,
});
const failed = (message: string): ToolOutcome => ({ content: `Could not save (${message}). Carry on with the session; do not retry.`, isError: true });
