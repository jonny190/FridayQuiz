"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Save } from "lucide-react";
import { toast } from "sonner";

type Question = {
  id: string;
  order: number;
  text: string;
  answer: string;
  points: number;
  imageUrls: string[];
};

type Quiz = {
  id: string;
  number: number;
  title: string | null;
  questions: Question[];
};

export default function AnswersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { answer: string; points: string }>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/quizzes/${id}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load quiz (${res.status})`);
        return (await res.json()) as Quiz;
      })
      .then((data) => {
        if (cancelled) return;
        setQuiz(data);
        const initial: Record<string, { answer: string; points: string }> = {};
        for (const q of data.questions) {
          initial[q.id] = { answer: q.answer, points: String(q.points) };
        }
        setDrafts(initial);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load quiz");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const update = (qid: string, patch: Partial<{ answer: string; points: string }>) => {
    setDrafts((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  };

  const handleSave = async () => {
    if (!quiz) return;

    const answers: { id: string; answer: string; points?: number }[] = [];
    for (const q of quiz.questions) {
      const draft = drafts[q.id];
      if (!draft) continue;
      const points = Number(draft.points);
      if (!Number.isFinite(points) || points < 0) {
        toast.error(`Q${q.order}: points must be a non-negative number`);
        return;
      }
      answers.push({ id: q.id, answer: draft.answer.trim(), points });
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/quizzes/${id}/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save answers");
        return;
      }
      toast.success(`Saved answers for ${answers.length} question${answers.length === 1 ? "" : "s"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading quiz…</p>;
  }

  if (error || !quiz) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/quizzes">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load quiz</CardTitle>
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
              Answers — Quiz {quiz.number}
              {quiz.title && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {quiz.title}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              Fill in the correct answer and point value for each question.
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-1">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save all"}
        </Button>
      </div>

      <div className="space-y-3">
        {quiz.questions.map((q) => (
          <Card key={q.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <span className="text-sm text-muted-foreground min-w-[2rem] pt-1">
                  Q{q.order}
                </span>
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">{q.text}</p>
                  {q.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {q.imageUrls.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={src}
                          alt={`Q${q.order} image ${i + 1}`}
                          className="h-20 w-20 rounded border object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                <div className="grid gap-1.5">
                  <Label htmlFor={`a-${q.id}`} className="text-xs text-muted-foreground">
                    Correct answer
                  </Label>
                  <textarea
                    id={`a-${q.id}`}
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={drafts[q.id]?.answer ?? ""}
                    onChange={(e) => update(q.id, { answer: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`p-${q.id}`} className="text-xs text-muted-foreground">
                    Points
                  </Label>
                  <Input
                    id={`p-${q.id}`}
                    type="number"
                    step="0.5"
                    min="0"
                    value={drafts[q.id]?.points ?? ""}
                    onChange={(e) => update(q.id, { points: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save all"}
        </Button>
      </div>
    </div>
  );
}
