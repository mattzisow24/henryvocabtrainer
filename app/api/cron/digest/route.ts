import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendDigest } from "@/lib/digest-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 120;

/**
 * Nightly email to every parent on the member list. Vercel's scheduler calls
 * this with `Authorization: Bearer <CRON_SECRET>`; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "SUPABASE_SECRET_KEY is not set" }, { status: 500 });

  const { data: parents, error } = await db.from("members").select("email").eq("role", "parent");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = await sendDigest(db, (parents ?? []).map((p) => p.email));
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
