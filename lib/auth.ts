import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Role = "learner" | "parent";

export type Member = {
  userId: string;
  email: string;
  role: Role;
  name: string;
  /**
   * True when a parent is looking at the learner's screens. The preview reads
   * the learner's data but can never change it: every write path checks
   * `role === "learner"`, and the database rules enforce the same.
   */
  preview: boolean;
  supabase: SupabaseClient;
};

/** Cookie that switches a parent into the learner's view. */
export const PREVIEW_COOKIE = "view_as_learner";

/** The signed-in member, or null when signed out or not on the member list. */
export const getMember = cache(async (): Promise<Member | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const email = user.email.toLowerCase();
  const { data } = await supabase.from("members").select("role, display_name").eq("email", email).maybeSingle();
  if (!data) return null;
  const role = data.role as Role;
  const preview = role === "parent" && (await cookies()).get(PREVIEW_COOKIE)?.value === "1";
  return { userId: user.id, email, role, name: data.display_name || email, preview, supabase };
});

/** For pages: signed-in member, or a redirect. Non-members are signed out. */
export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) redirect("/auth/signout?reason=not-a-member");
  return member;
}

/** For the learner's screens: the learner, or a parent in preview. */
export async function requireLearner(): Promise<Member> {
  const member = await requireMember();
  if (member.role !== "learner" && !member.preview) redirect("/dashboard");
  return member;
}
