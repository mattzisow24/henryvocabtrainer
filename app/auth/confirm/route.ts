import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifies email-link auth (invites, magic links, recovery, email change) via
 * the one-time `token_hash`.
 *
 * Unlike the PKCE code exchange in /auth/callback, `verifyOtp` needs NO
 * client-side code_verifier cookie — so it works for admin-generated invite
 * links, where the auth flow was never initiated in the recipient's browser.
 * (The PKCE callback is kept for flows the user starts themselves, e.g. the
 * magic-link request on the login page.)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only allow same-origin relative redirects (guard against open redirects).
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Missing/expired/already-used link — send to login with a friendly notice.
  return NextResponse.redirect(`${origin}/login?error=link`);
}
