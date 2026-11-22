import "server-only";

// One turn of the coach: the learner's words go in, the coach's reply streams
// out, and any tools the coach calls are run along the way.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachSession, TranscriptLine } from "./session";
import { runTool, TOOLS, type ToolContext, type UiEvent } from "./tools";

const MODEL = process.env.COACH_MODEL ?? "claude-opus-5-5";

/** A turn is a few sentences plus small tool calls; this leaves room for thinking. */
const MAX_TOKENS = 4000;
/** Tool round-trips allowed in one turn before giving up. */
const MAX_STEPS = 8;

export type TurnEvent = UiEvent | { t: "text"; d: string } | { t: "done" } | { t: "error"; message: string };

let client: Anthropic | null = null;

export async function runTurn(opts: {
  db: SupabaseClient;
  session: CoachSession;
  /** What the learner typed, or a bracketed stage note such as "[Session start]". */
  userText: string;
  /** False for stage notes, which are not shown in the readable transcript. */
  spoken: boolean;
  emit(event: TurnEvent): void;
}): Promise<void> {
  const { db, session, emit } = opts;
  client ??= new Anthropic();

  const messages = [...session.messages, { role: "user" as const, content: opts.userText }];
  const transcript: TranscriptLine[] = [...session.transcript];
  if (opts.spoken) transcript.push({ who: "learner", text: opts.userText, at: new Date().toISOString() });

  const graded = new Set(session.plan.graded);
  const ctx: ToolContext = {
    db,
    learnerId: session.learner_id,
    sessionId: session.id,
    day: session.day,
    planIds: session.plan.wordIds,
    graded,
    emit,
  };

  let said = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Short replies: low effort keeps the wait before the coach answers brief.
      output_config: { effort: "low" },
      // If a safety filter declines a turn, let the API retry it on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: session.system_prompt,
      tools: TOOLS,
      messages,
    });
    stream.on("text", (delta) => {
      said += delta;
      emit({ t: "text", d: delta });
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      // Nothing is saved for a declined turn; the learner can simply answer again.
      emit({ t: "text", d: " Lost my place for a second. Send that again?" });
      emit({ t: "done" });
      return;
    }

    messages.push({ role: "assistant", content: message.content });
    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (calls.length === 0 || message.stop_reason === "max_tokens") break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    let ended = false;
    for (const call of calls) {
      const outcome = await runTool(call.name, call.input, ctx);
      ended ||= !!outcome.ended;
      results.push({ type: "tool_result", tool_use_id: call.id, content: outcome.content, is_error: outcome.isError });
    }
    messages.push({ role: "user", content: results });
    // The goodbye comes before end_session, so there is nothing left to say.
    if (ended) break;
    // A new sentence follows the tool call; keep it from running into the last one.
    if (said && !/\s$/.test(said)) {
      said += " ";
      emit({ t: "text", d: " " });
    }
  }

  if (said.trim()) transcript.push({ who: "coach", text: said.trim(), at: new Date().toISOString() });
  const { error } = await db
    .from("sessions")
    .update({
      messages,
      transcript,
      plan: { ...session.plan, graded: [...graded] },
      last_turn_at: new Date().toISOString(),
    })
    .eq("id", session.id);
  if (error) throw new Error(error.message);
  emit({ t: "done" });
}
