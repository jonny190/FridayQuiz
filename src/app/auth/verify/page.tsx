"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function VerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"verifying" | "error">("verifying");

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!token) {
        if (!cancelled) setStatus("error");
        return;
      }

      const result = await signIn("credentials", {
        redirect: false,
        magicToken: token,
      });

      if (cancelled) return;

      if (result?.error || !result?.ok) {
        setStatus("error");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Friday Quiz</CardTitle>
          <CardDescription>
            {status === "verifying"
              ? "Signing you in…"
              : "This sign-in link is invalid or has expired."}
          </CardDescription>
        </CardHeader>
        {status === "error" && (
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              <a href="/auth/signin" className="underline">
                Request a new link
              </a>
            </p>
          </CardContent>
        )}
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
