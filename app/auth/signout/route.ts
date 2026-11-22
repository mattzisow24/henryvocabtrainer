import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Signs out and returns to the login page, optionally with a reason to show. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL("/login", request.url);
  if (request.nextUrl.searchParams.get("reason") === "not-a-member") url.searchParams.set("error", "not-a-member");
  return NextResponse.redirect(url);
}
