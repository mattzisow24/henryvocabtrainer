"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getMember, PREVIEW_COOKIE } from "@/lib/auth";
import { sendDigest } from "@/lib/digest-server";

const NewMember = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["parent"]),
  name: z.string().trim().max(60),
});

/** Parents can give another adult access. The database also enforces this. */
export async function addMember(form: FormData): Promise<void> {
  const member = await getMember();
  if (member?.role !== "parent") return;
  const parsed = NewMember.safeParse({ email: form.get("email"), role: form.get("role"), name: form.get("name") ?? "" });
  if (!parsed.success) return;
  await member.supabase.from("members").upsert({ email: parsed.data.email, role: parsed.data.role, display_name: parsed.data.name });
  revalidatePath("/dashboard");
}

export async function removeMember(form: FormData): Promise<void> {
  const member = await getMember();
  if (member?.role !== "parent") return;
  const email = String(form.get("email") ?? "").toLowerCase();
  // Parents can't remove themselves or the learner from here.
  if (!email || email === member.email) return;
  await member.supabase.from("members").delete().eq("email", email).neq("role", "learner");
  revalidatePath("/dashboard");
}

/** Parents only: look at the app the way the learner sees it. Read-only. */
export async function startPreview(): Promise<void> {
  const member = await getMember();
  if (member?.role !== "parent") return;
  (await cookies()).set(PREVIEW_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 4 });
  redirect("/home");
}

export async function exitPreview(): Promise<void> {
  (await cookies()).delete(PREVIEW_COOKIE);
  redirect("/dashboard");
}

/** Parents only: send today's email to yourself now, to check it works. */
export async function sendTestDigest(): Promise<void> {
  const member = await getMember();
  if (member?.role !== "parent") return;
  const result = await sendDigest(member.supabase, [member.email]);
  redirect(`/dashboard?email=${result.ok ? "sent" : encodeURIComponent(result.reason)}#daily-email`);
}
