"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "code" | "password";

export function LoginForm({ initialMessage }: { initialMessage: string | null }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>("password");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage);

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setMessage(null);
    const error = await action();
    if (error) setMessage(error);
    setBusy(false);
  }

  const sendCode = () =>
    run(async () => {
      const { error } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) return error.message;
      setStep("code");
      return null;
    });

  const verifyCode = () =>
    run(async () => {
      const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
      if (error) return "That code didn't work. Check it, or request a new one.";
      window.location.href = "/";
      return null;
    });

  const signInWithPassword = () =>
    run(async () => {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) return "That email and password don't match.";
      window.location.href = "/";
      return null;
    });

  const input = "h-12 w-full rounded-xl border border-line bg-white px-3 text-base";

  return (
    <form
      className="mx-auto w-full max-w-sm space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "email") void sendCode();
        else if (step === "code") void verifyCode();
        else void signInWithPassword();
      }}
    >
      <h2 className="text-xl font-semibold text-navy">Sign in</h2>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input
            className={input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={step === "code"}
          />
        </label>

        {step === "code" && (
          <label className="block space-y-1">
            <span className="text-sm font-medium">Code from your email</span>
            <input
              className={`${input} tracking-widest`}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <span className="block text-xs text-ink-2">We emailed a sign-in code to {email}. The link in that email works too.</span>
          </label>
        )}

        {step === "password" && (
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                className={`${input} pr-16`}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                // Stops phones from capitalizing or "correcting" a password while it is visible.
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-controls="password"
                className="absolute inset-y-0 right-0 flex w-16 items-center justify-center rounded-r-xl text-sm font-semibold text-accent"
              >
                {showPassword ? "Hide" : "Show"}
                <span className="sr-only"> password</span>
              </button>
            </div>
          </div>
        )}

        {message && (
          <p role="alert" className="text-sm text-bad">
            {message}
          </p>
        )}

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "One moment…" : step === "email" ? "Email me a code" : "Sign in"}
        </button>

        <button
          type="button"
          className="w-full text-center text-sm text-ink-2 underline"
          onClick={() => {
            setMessage(null);
            setStep(step === "password" ? "email" : "password");
          }}
        >
          {step === "password" ? "Forgot your password? Email me a code" : "Use my password"}
        </button>
    </form>
  );
}
