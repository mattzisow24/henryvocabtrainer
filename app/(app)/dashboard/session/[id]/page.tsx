import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { LEARNER_NAME } from "@/lib/config";
import type { TranscriptLine } from "@/lib/coach/session";
import { SessionSummary } from "@/components/session-summary";

export default async function SessionTranscript({ params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember();
  if (member.role === "learner") redirect("/home");
  const { id } = await params;
  const { data } = await member.supabase.from("sessions").select("day, summary, transcript").eq("id", id).maybeSingle();
  if (!data) notFound();
  const lines = (data.transcript ?? []) as TranscriptLine[];

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="text-sm text-accent underline">
        Back to dashboard
      </Link>
      <h1 className="text-3xl font-semibold text-navy">
        Coach session, {data.day}
      </h1>
      {data.summary && (
        <div className="card p-4">
          <SessionSummary text={data.summary} />
        </div>
      )}
      <p className="text-xs text-muted">{LEARNER_NAME}&apos;s lines are shown exactly as he typed them.</p>
      <div className="space-y-3">
        {lines.length === 0 && <p className="text-ink-2">Nothing was said in this session.</p>}
        {lines.map((line, i) => (
          <p key={i} className={line.who === "coach" ? "" : "rounded-xl bg-accent-soft p-3"}>
            <span className="block text-xs font-medium text-muted">{line.who === "coach" ? "Coach" : LEARNER_NAME}</span>
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}
