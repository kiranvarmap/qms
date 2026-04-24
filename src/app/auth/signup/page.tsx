"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

export default function SignUpPage() {
  useEffect(() => {
    signIn("auth0", { callbackUrl: "/dashboard" }, { screen_hint: "signup" });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm">Redirecting to sign up…</p>
      </div>
    </div>
  );
}
