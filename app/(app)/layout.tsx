import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { LEARNER_NAME } from "@/lib/config";
import { exitPreview } from "./dashboard/actions";

const LEARNER_NAV = [
  { href: "/home", label: "Home" },
  { href: "/coach", label: "Coach" },
  { href: "/drill", label: "Drills" },
  { href: "/milestones", label: "Milestones" },
  { href: "/words", label: "Words" },
];
const OBSERVER_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/words", label: "Words" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const nav = member.role === "learner" || member.preview ? LEARNER_NAV : OBSERVER_NAV;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-[env(safe-area-inset-bottom)]">
      {member.preview && (
        <div className="-mx-4 flex items-center justify-between gap-3 bg-gold px-4 py-2 text-sm text-ink">
          <p>
            <span className="font-semibold">Viewing as {LEARNER_NAME}.</span> Nothing you do here is saved.
          </p>
          <form action={exitPreview}>
            <button className="shrink-0 font-semibold underline">Exit</button>
          </form>
        </div>
      )}
      <header className="py-3">
        <nav className="flex justify-between gap-1 sm:justify-start">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-2.5 py-2 text-sm font-semibold text-ink-2 hover:bg-white hover:text-navy sm:px-3">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 pb-6">{children}</main>
      <footer className="pb-6 text-center">
        {/* A plain link: sign-out must be a full navigation, never a prefetch. */}
        <a href="/auth/signout" className="px-2 py-2 text-sm text-muted underline">
          Sign out
        </a>
      </footer>
    </div>
  );
}
