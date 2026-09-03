"use client";

import { useState } from "react";

type FieldErrors = {
  username?: string;
  password?: string;
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">(
    "idle",
  );

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!username.trim()) next.username = "Username is required.";
    if (!password) next.password = "Password is required.";
    return next;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus("idle");
      return;
    }

    // No backend yet: simulate the request boundary so the loading state is real.
    setStatus("submitting");
    await new Promise((resolve) => setTimeout(resolve, 600));
    setStatus("submitted");
  }

  return (
    <main className="font-sans flex min-h-dvh flex-col items-center bg-gradient-to-b from-[#2757D2] to-[#ABC1F8] px-4 py-10 sm:py-8">
      <header className="text-center">
        <h1 className="max-w-[15rem] text-xl leading-tight font-bold text-white sm:max-w-[19rem] sm:text-3xl">
          Electrochemical Sensor Monitor
        </h1>
        <p className="mt-1 text-sm font-bold tracking-[0.08em] text-[#0b1020] uppercase sm:text-lg">
          Precision Data Suite
        </p>
      </header>

      <section className="mt-10 w-full max-w-[32rem] rounded-3xl bg-linear-to-b from-[#1847a9] to-[#6081BE] px-6 pt-[1.125rem] pb-6 sm:mt-14 sm:px-9 sm:pt-[1.875rem] sm:pb-10">
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">
          Welcome Back
        </h2>

        <form onSubmit={handleSubmit} noValidate className="mt-8 sm:mt-10">
          <div className="space-y-12 sm:space-y-14">
            <div>
              <label
                htmlFor="username"
                className="block text-lg text-white sm:text-xl"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                aria-invalid={Boolean(errors.username)}
                aria-describedby={
                  errors.username ? "username-error" : undefined
                }
                className="mt-3 block h-14 w-full rounded-xl bg-[#253784] px-4 text-white caret-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/70"
              />
              {errors.username ? (
                <p
                  id="username-error"
                  role="alert"
                  className="mt-2 text-sm font-medium text-[#ffe0e0]"
                >
                  {errors.username}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-lg text-white sm:text-xl"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
                className="mt-3 block h-14 w-full rounded-xl bg-[#344389] px-4 text-white caret-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/70"
              />
              {errors.password ? (
                <p
                  id="password-error"
                  role="alert"
                  className="mt-2 text-sm font-medium text-[#ffe0e0]"
                >
                  {errors.password}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center">
            <button
              type="submit"
              disabled={status === "submitting"}
              className="h-12 w-full max-w-[15rem] rounded-xl bg-[#31428E] text-lg text-white transition-colors hover:bg-[#454fa4] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none disabled:opacity-70"
            >
              {status === "submitting" ? "Signing In…" : "Sign In"}
            </button>

            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-6 rounded text-xl text-white underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
            >
              Reset Password
            </button>
          </div>

          <p aria-live="polite" className="mt-6 text-center text-sm text-white">
            {status === "submitted"
              ? "Sign-in is not connected yet — this is the frontend only."
              : ""}
          </p>
        </form>
      </section>
    </main>
  );
}
