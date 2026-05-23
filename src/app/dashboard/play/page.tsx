"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

type Item = {
  quizId: string;
  quizNumber: number;
  quizTitle: string | null;
  quizDate: string;
  teamId: string;
  teamName: string;
  isOwner: boolean;
  state: "not_started" | "draft" | "submitted";
};

const STATE_BADGES: Record<Item["state"], { label: string; variant: "secondary" | "default" | "outline" }> = {
  not_started: { label: "Not started", variant: "secondary" },
  draft: { label: "Draft saved", variant: "outline" },
  submitted: { label: "Submitted", variant: "default" },
};

export default function PlayPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/play", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        return (await res.json()) as Item[];
      })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Play</h1>
        <p className="text-muted-foreground">
          Active quizzes you can submit answers for.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load quizzes</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Nothing to play right now
            </CardTitle>
            <CardDescription>
              When the quizmaster activates a quiz and you&apos;re on a team,
              it&apos;ll show up here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const badge = STATE_BADGES[it.state];
            const href = `/dashboard/play/${it.quizId}?teamId=${it.teamId}`;
            return (
              <Card key={`${it.quizId}::${it.teamId}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Quiz {it.quizNumber}
                        {it.quizTitle && (
                          <span className="ml-2 font-normal text-muted-foreground">
                            — {it.quizTitle}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Playing as <strong>{it.teamName}</strong>
                        {it.isOwner ? " (team owner)" : ""}
                      </CardDescription>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {new Date(it.quizDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <Link href={href}>
                      <Button size="sm">
                        {it.state === "submitted"
                          ? "View submission"
                          : it.state === "draft"
                            ? "Continue"
                            : "Start"}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
