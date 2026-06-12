"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert as AlertCircle } from "@vibe/icons";

const errors: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have access to this resource.",
  Verification: "The verification link has expired or has already been used.",
  Default: "An unexpected error occurred.",
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const errorType = searchParams.get("error") || "Default";
  const errorMessage = errors[errorType] || errors.Default;

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <CardTitle>Authentication Error</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-gray-500">{errorMessage}</p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button asChild>
          <Link href="/auth/signin">Back to sign in</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
