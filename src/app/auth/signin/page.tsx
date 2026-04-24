"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

const errorMessages: Record<string, string> = {
  MissingCSRF: "Session expired. Please try again.",
  Configuration: "There is a problem with the server configuration.",
  OAuthCallback: "Could not complete sign in. Please try again.",
  OAuthSignin: "Could not start sign in. Please try again.",
  Default: "An error occurred during sign in.",
};

function Redirect() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const error = searchParams.get("error");
  const { status } = useSession();
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    // Already authenticated — go to dashboard
    if (status === "authenticated") {
      window.location.href = callbackUrl;
      return;
    }

    // Still loading session — wait
    if (status === "loading") return;

    // If there's an error param, don't auto-redirect (prevents loop)
    if (error) return;

    // Only trigger once
    if (triggered) return;
    setTriggered(true);

    signIn("auth0", { callbackUrl });
  }, [status, error, callbackUrl, triggered]);

  // Show error with retry button
  if (error) {
    const message = errorMessages[error] || errorMessages.Default;
    return (
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="rounded-full bg-red-100 p-3">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <p className="text-sm text-gray-600">{message}</p>
        <button
          onClick={() => signIn("auth0", { callbackUrl })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-gray-500">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-sm">Redirecting to sign in…</p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-blue-600" />}>
        <Redirect />
      </Suspense>
    </div>
  );
}
