"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function VerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const next = searchParams.get("next");
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");

  // Only follow next= if it's a same-origin relative path so the
  // sign-in link can't be used as an open redirect.
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const handleSignIn = async () => {
    if (!token) {
      setStatus("error");
      return;
    }
    setStatus("verifying");

    const result = await signIn("credentials", {
      redirect: false,
      magicToken: token,
    });

    if (result?.error || !result?.ok) {
      setStatus("error");
      return;
    }

    router.replace(safeNext);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Friday Quiz</CardTitle>
          <CardDescription>
            {!token
              ? "This sign-in link is missing its token."
              : status === "error"
                ? "This sign-in link is invalid or has expired."
                : status === "verifying"
                  ? "Signing you in…"
                  : "Click the button below to sign in."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          {token && status !== "error" && (
            <Button
              className="w-full"
              onClick={handleSignIn}
              disabled={status === "verifying"}
            >
              {status === "verifying" ? "Signing in…" : "Continue to Friday Quiz"}
            </Button>
          )}
          {status === "error" && (
            <p className="text-sm text-muted-foreground">
              <a href="/auth/signin" className="underline">
                Request a new link
              </a>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
