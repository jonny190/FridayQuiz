"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, ChevronLeft, ChevronRight, Save, X } from "lucide-react";
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

type MarkingData = {
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

type DraftEntry = { answer: string; points: string };

export default function MarkingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<MarkingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [drafts, setDrafts] = useState<
    Record<string /* questionId */, Record<string /* teamId */, DraftEntry>>
  >({});
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/quizzes/${id}/marking`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const json = (await res.json()) as MarkingData;
      setData(json);
      setError(null);

      // Build initial drafts from existing QuizAnswer rows.
      const next: Record<string, Record<string, DraftEntry>> = {};
      for (const q of json.quiz.questions) {
        next[q.id] = {};
        for (const t of json.teams) {
          next[q.id][t.id] = { answer: "", points: "" };
        }
      }
      for (const a of json.answers) {
        if (!next[a.questionId]) continue;
        next[a.questionId][a.teamId] = {
          answer: a.answer,
          points: a.points === null ? "" : String(a.points),
        };
      }
      setDrafts(next);
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

  const question = data?.quiz.questions[currentIndex] ?? null;

  const updateDraft = (teamId: string, patch: Partial<DraftEntry>) => {
    if (!question) return;
    setDrafts((prev) => {
      const forQ = { ...(prev[question.id] ?? {}) };
      forQ[teamId] = { ...(forQ[teamId] ?? { answer: "", points: "" }), ...patch };
      return { ...prev, [question.id]: forQ };
    });
  };

  const markFull = (teamId: string) => {
    if (!question) return;
    updateDraft(teamId, { points: String(question.points) });
  };
  const markZero = (teamId: string) => {
    updateDraft(teamId, { points: "0" });
  };

  const saveCurrent = async () => {
    if (!question || !data) return;
    const entries: { teamId: string; answer: string; points: number | null }[] = [];
    for (const team of data.teams) {
      const d = drafts[question.id]?.[team.id];
      if (!d) continue;
      const trimmed = d.answer.trim();
      const points = d.points === "" ? null : Number(d.points);
      if (points !== null && (!Number.isFinite(points) || points < 0)) {
        toast.error(`${team.name}: points must be a non-negative number`);
        return;
      }
      entries.push({ teamId: team.id, answer: trimmed, points });
    }

    setSavingQuestion(true);
    try {
      const res = await fetch(`/api/quizzes/${id}/marking`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, entries }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Failed to save");
        return;
      }
      toast.success(`Saved Q${question.order}`);
    } finally {
      setSavingQuestion(false);
    }
  };

  const goNext = async () => {
    if (!data) return;
    await saveCurrent();
    if (currentIndex < data.quiz.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  const goPrev = async () => {
    if (currentIndex <= 0) return;
    await saveCurrent();
    setCurrentIndex(currentIndex - 1);
  };

  const totals = useMemo(() => {
    if (!data) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const t of data.teams) m.set(t.id, 0);
    for (const qid of Object.keys(drafts)) {
      for (const tid of Object.keys(drafts[qid])) {
        const v = Number(drafts[qid][tid].points);
        if (Number.isFinite(v)) {
          m.set(tid, (m.get(tid) ?? 0) + v);
        }
      }
    }
    return m;
  }, [data, drafts]);

  const handlePublish = async () => {
    setPublishOpen(false);
    setPublishing(true);
    try {
      await saveCurrent();
      const res = await fetch(`/api/quizzes/${id}/publish`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Failed to publish");
        return;
      }
      const result = await res.json();
      toast.success(`Published — ${result.published} team result(s)`);
      router.push(`/dashboard/quizzes/${id}`);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

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
            <CardTitle>Couldn&apos;t load marking</CardTitle>
            <CardDescription>{error ?? "Not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data.teams.length === 0) {
    return (
      <div className="space-y-4">
        <Link href={`/dashboard/quizzes/${id}`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>No active teams</CardTitle>
            <CardDescription>
              Add at least one active team in{" "}
              <Link href="/dashboard/teams" className="underline">
                Teams
              </Link>{" "}
              before you can mark a quiz.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data.quiz.questions.length === 0) {
    return (
      <div className="space-y-4">
        <Link href={`/dashboard/quizzes/${id}`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>No questions to mark</CardTitle>
            <CardDescription>
              This quiz has no questions yet.
            </CardDescription>
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
              Marking — Quiz {data.quiz.number}
              {data.quiz.title && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {data.quiz.title}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              Question {currentIndex + 1} of {data.quiz.questions.length} ·{" "}
              {data.teams.length} team{data.teams.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPublishOpen(true)}
            disabled={publishing}
          >
            Publish results
          </Button>
        </div>
      </div>

      {question && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">
                  Q{question.order}. {question.text}
                </CardTitle>
                <CardDescription>
                  Worth {question.points} pt{question.points === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <Badge variant="outline">
                Correct: {question.answer || "(not set)"}
              </Badge>
            </div>
          </CardHeader>
          {question.imageUrls.length > 0 && (
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {question.imageUrls.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt={`Q${question.order} image ${i + 1}`}
                    className="h-32 rounded border object-contain"
                  />
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <div className="space-y-3">
        {data.teams.map((team) => {
          const d = drafts[question!.id]?.[team.id] ?? {
            answer: "",
            points: "",
          };
          const ptsVal = Number(d.points);
          const isFull =
            d.points !== "" &&
            Number.isFinite(ptsVal) &&
            ptsVal === question!.points;
          const isZero =
            d.points !== "" && Number.isFinite(ptsVal) && ptsVal === 0;
          return (
            <Card key={team.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Total so far: {totals.get(team.id) ?? 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isZero ? "default" : "outline"}
                      onClick={() => markZero(team.id)}
                      className="gap-1"
                    >
                      <X className="h-4 w-4" />
                      Wrong
                    </Button>
                    <Button
                      size="sm"
                      variant={isFull ? "default" : "outline"}
                      onClick={() => markFull(team.id)}
                      className="gap-1"
                    >
                      <Check className="h-4 w-4" />
                      Correct
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor={`ans-${team.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Team&apos;s answer
                    </Label>
                    <Input
                      id={`ans-${team.id}`}
                      value={d.answer}
                      placeholder="(no answer)"
                      onChange={(e) =>
                        updateDraft(team.id, { answer: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor={`pts-${team.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Points
                    </Label>
                    <Input
                      id={`pts-${team.id}`}
                      type="number"
                      step="0.5"
                      min="0"
                      value={d.points}
                      onChange={(e) =>
                        updateDraft(team.id, { points: e.target.value })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={goPrev} disabled={currentIndex === 0 || savingQuestion}>
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <Button variant="outline" onClick={saveCurrent} disabled={savingQuestion} className="gap-1">
          <Save className="h-4 w-4" />
          {savingQuestion ? "Saving…" : "Save question"}
        </Button>
        <Button
          onClick={goNext}
          disabled={
            currentIndex >= data.quiz.questions.length - 1 || savingQuestion
          }
          className="gap-1"
        >
          Save &amp; next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish results?</AlertDialogTitle>
            <AlertDialogDescription>
              This will compute team totals from the points entered on this
              quiz, rank them, and mark the quiz as Published. Re-publishing
              later will overwrite the previous results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
