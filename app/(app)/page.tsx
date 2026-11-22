import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";

export default async function Index() {
  const member = await requireMember();
  redirect(member.role === "learner" || member.preview ? "/home" : "/dashboard");
}
