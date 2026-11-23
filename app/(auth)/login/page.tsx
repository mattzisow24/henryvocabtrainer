import { LoginForm } from "@/components/login-form";
import { LEARNER_NAME } from "@/lib/config";

const MESSAGES: Record<string, string> = {
  "not-a-member": "That email isn't on this app's member list. Ask a parent to add it.",
  link: "That sign-in link was invalid or already used. Request a new code below.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col bg-brand">
      <div className="flex flex-1 flex-col items-center justify-end px-6 pb-8 pt-12 text-center text-white">
        <h1 className="text-4xl font-semibold">{LEARNER_NAME}&apos;s SAT Vocab</h1>
        <p className="mt-1 text-white/80">Helping Henry grind on SAT vocab.</p>
      </div>
      <div className="rounded-t-[1.5rem] bg-canvas px-4 pb-10 pt-6">
        <LoginForm initialMessage={(error && MESSAGES[error]) || null} />
      </div>
    </main>
  );
}
