"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";

type Question = {
  id: string;
  order: number;
  text: string;
  answer: string;
  points: number;
  imageUrls: string[];
};

type Team = { id: string; name: string };

type Answer = {
  id: string;
  questionId: string;
  teamId: string;
  answer: string;
  points: number | null;
};

type Data = {
  quiz: {
    id: string;
    number: number;
    title: string | null;
    status: string;
    questions: Question[];
  };
  teams: Team[];
  answers: Answer[];
};

export default function SubmissionsReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/quizzes/${id}/marking`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setData((await res.json()) as Data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const findAnswer = (questionId: string, teamId: string) =>
    data?.answers.find((a) => a.questionId === questionId && a.teamId === teamId) ??
    null;

  const overrideKey = (questionId: string, teamId: string) =>
    `${questionId}::${teamId}`;

  const saveOverride = async (
    question: Question,
    team: Team,
    newPoints: number
  ) => {
    if (!data) return;
    const existing = findAnswer(question.id, team.id);
    setSavingId(overrideKey(question.id, team.id));
    try {
      const res = await fetch(`/api/quizzes/${id}/marking`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          entries: [
            {
              teamId: team.id,
              answer: existing?.answer ?? "",
              points: newPoints,
            },
          ],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Failed to save");
        return;
      }
      await load();
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[overrideKey(question.id, team.id)];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/quizzes">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load submissions</CardTitle>
            <CardDescription>{error ?? "Not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/quizzes/${id}`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Submissions — Quiz {data.quiz.number}
              {data.quiz.title && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {data.quiz.title}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              Auto-scored when each team locks in. Use the override buttons
              to mark a wrong-but-acceptable answer as correct (or vice
              versa) before publishing.
            </p>
          </div>
        </div>
      </div>

      {data.teams.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No active teams</CardTitle>
            <CardDescription>
              Add at least one active team in{" "}
              <Link href="/dashboard/teams" className="underline">
                Teams
              </Link>{" "}
              before submissions can come in.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.quiz.questions.map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Q{q.order}. {q.text}
                </CardTitle>
                <CardDescription>
                  Correct: <strong>{q.answer || "(not set)"}</strong> · worth{" "}
                  {q.points} pt{q.points === 1 ? "" : "s"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.teams.map((t) => {
                    const ans = findAnswer(q.id, t.id);
                    const submitted = ans ? !!ans.answer : false;
                    const ptsRaw =
                      overrides[overrideKey(q.id, t.id)] ??
                      (ans?.points === null || ans?.points === undefined
                        ? ""
                        : String(ans.points));
                    const ptsVal = Number(ptsRaw);
                    const isFull =
                      ptsRaw !== "" &&
                      Number.isFinite(ptsVal) &&
                      ptsVal === q.points;
                    const isZero =
                      ptsRaw !== "" && Number.isFinite(ptsVal) && ptsVal === 0;
                    const saving =
                      savingId === overrideKey(q.id, t.id);
                    return (
                      <div
                        key={t.id}
                        className="grid gap-2 rounded border p-3 md:grid-cols-[160px_1fr_140px_160px] md:items-center"
                      >
                        <div className="font-medium">{t.name}</div>
                        <div className="text-sm">
                          {submitted ? (
                            <span>{ans!.answer}</span>
                          ) : (
                            <span className="italic text-muted-foreground">
                              No submission
                            </span>
                          )}
                        </div>
                        <div>
                          {submitted ? (
                            <Badge
                              variant={isFull ? "default" : isZero ? "secondary" : "outline"}
                            >
                              {ptsRaw === "" ? "Unscored" : `${ptsVal} pt${ptsVal === 1 ? "" : "s"}`}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="sm"
                            variant={isZero ? "default" : "outline"}
                            disabled={!submitted || saving}
                            onClick={() => saveOverride(q, t, 0)}
                            className="gap-1"
                            title="Mark as wrong"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={isFull ? "default" : "outline"}
                            disabled={!submitted || saving}
                            onClick={() => saveOverride(q, t, q.points)}
                            className="gap-1"
                            title="Mark as correct"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            disabled={!submitted || saving}
                            value={ptsRaw}
                            onChange={(e) =>
                              setOverrides((prev) => ({
                                ...prev,
                                [overrideKey(q.id, t.id)]: e.target.value,
                              }))
                            }
                            onBlur={() => {
                              const raw = overrides[overrideKey(q.id, t.id)];
                              if (raw === undefined) return;
                              const v = Number(raw);
                              if (!Number.isFinite(v) || v < 0) return;
                              if (ans?.points !== v) {
                                saveOverride(q, t, v);
                              }
                            }}
                            className="w-20"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
