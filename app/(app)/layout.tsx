import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { LEARNER_NAME } from "@/lib/config";
import { Nav, type NavItem } from "@/components/nav";
import { exitPreview } from "./dashboard/actions";

const LEARNER_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/coach", label: "Coach", icon: "coach" },
  { href: "/drill", label: "Drills", icon: "drill" },
  { href: "/cards", label: "Cards", icon: "cards" },
  { href: "/words", label: "Words", icon: "words" },
];
const OBSERVER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/words", label: "Words", icon: "words" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const nav = member.role === "learner" || member.preview ? LEARNER_NAV : OBSERVER_NAV;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4">
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
      {/* Top room for the exit bar of a focused round; bottom room for the tab bar. */}
      <main className="flex-1 pb-6 pt-12 sm:pt-14">{children}</main>
      <footer className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-center">
        {/* A plain link: sign-out must be a full navigation, never a prefetch. */}
        <a href="/auth/signout" className="px-2 py-2 text-sm text-muted underline">
          Sign out
        </a>
      </footer>
      <Suspense>
        <Nav items={nav} />
      </Suspense>
    </div>
  );
}
