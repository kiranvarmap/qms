"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { AttentionBox, Button, TextField } from "@vibe/core";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    window.location.href = callbackUrl;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <AttentionBox type="negative" text={error} compact />}
      <TextField
        id="email"
        title="Email"
        type="email"
        required
        value={email}
        onChange={(value: string) => setEmail(value)}
        placeholder="hello@test.com"
        autoComplete="email"
        size="medium"
      />
      <TextField
        id="password"
        title="Password"
        type="password"
        required
        value={password}
        onChange={(value: string) => setPassword(value)}
        placeholder="••••••••"
        autoComplete="current-password"
        size="medium"
      />
      <Button
        type="submit"
        disabled={loading}
        loading={loading}
        size="medium"
        className="w-full"
      >
        Sign in
      </Button>
      <p className="text-center text-sm text-[var(--secondary-text-color)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/signup"
          className="font-medium text-[var(--link-color)] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
