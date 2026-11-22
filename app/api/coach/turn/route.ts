import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { LEARNER_NAME } from "@/lib/config";
import { runTurn, type TurnEvent } from "@/lib/coach/run";
import { loadSession, startOrResume } from "@/lib/coach/session";

export const maxDuration = 120;

const Body = z.union([
  z.object({ start: z.literal(true) }),
  z.object({ sessionId: z.string().uuid(), text: z.string().trim().min(1).max(2000) }),
]);

/**
 * One coach turn, streamed as newline-delimited JSON events. `{start: true}`
 * opens or resumes today's session; otherwise `text` is what the learner typed.
 */
export async function POST(request: Request) {
  const member = await getMember();
  if (member?.role !== "learner") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  let session;
  let userText: string;
  let spoken = true;
  let first: Record<string, unknown> | null = null;
  try {
    if ("start" in body.data) {
      const started = await startOrResume(member.supabase, member.userId);
      if (!started) return NextResponse.json({ error: "sort first" }, { status: 409 });
      session = started.session;
      spoken = false;
      userText = started.resumed
        ? `[${LEARNER_NAME} left and has come back. Pick up where you stopped, without ceremony.]`
        : "[Session start. One line, then the first word.]";
      first = {
        t: "session",
        sessionId: session.id,
        wordIds: session.plan.wordIds,
        graded: session.plan.graded.length,
      };
    } else {
      session = await loadSession(member.supabase, body.data.sessionId);
      if (!session || session.learner_id !== member.userId) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (session.status === "done") return NextResponse.json({ error: "session ended" }, { status: 409 });
      userText = body.data.text;
    }
  } catch (err) {
    console.error("[coach] could not open session", err);
    // The reason goes back to the screen: with one family using the app, a
    // screenshot of the error should be enough to diagnose it.
    return NextResponse.json({ error: "could not open session", detail: err instanceof Error ? err.message.slice(0, 200) : "" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: TurnEvent | Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      if (first) send(first);
      try {
        await runTurn({ db: member.supabase, session, userText, spoken, emit: send });
      } catch (err) {
        console.error("[coach] turn failed", err);
        send({ t: "error", message: describe(err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

function describe(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The coach's API key is missing or invalid.";
  if (err instanceof Anthropic.RateLimitError) return "The coach is busy right now. Try again in a minute.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the coach. Check the connection and try again.";
  if (err instanceof Anthropic.APIError) return "The coach hit a problem. Try again.";
  return "Something went wrong. Try again.";
}
