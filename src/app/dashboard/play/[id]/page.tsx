"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { ChevronLeft, Lock, Save } from "lucide-react";
import { toast } from "sonner";

type Question = {
  id: string;
  order: number;
  text: string;
  imageUrls: string[];
  isImageBased: boolean;
  points: number;
};

type AnswerRow = {
  questionId: string;
  answer: string;
  isDraft: boolean;
  points: number | null;
};

type PlayData = {
  quiz: { id: string; number: number; title: string | null; status: string };
  team: { id: string; name: string };
  isOwner: boolean;
  submitted: boolean;
  questions: Question[];
  answers: AnswerRow[];
};

export default function PlayQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const search = useSearchParams();
  const router = useRouter();
  const teamId = search.get("teamId");

  const [data, setData] = useState<PlayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function load() {
    if (!teamId) {
      setError("Missing teamId");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/play/${id}?teamId=${encodeURIComponent(teamId)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      const json = (await res.json()) as PlayData;
      setData(json);
      const initial: Record<string, string> = {};
      for (const q of json.questions) {
        const existing = json.answers.find((a) => a.questionId === q.id);
        initial[q.id] = existing?.answer ?? "";
      }
      setDrafts(initial);
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
  }, [id, teamId]);

  const handleSaveDraft = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const answers = data.questions.map((q) => ({
        questionId: q.id,
        answer: drafts[q.id] ?? "",
      }));
      const res = await fetch(`/api/play/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, answers }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Failed to save draft");
        return;
      }
      toast.success("Draft saved");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      // Save the current edits first so they're included in the lock.
      await handleSaveDraft();
      const res = await fetch(`/api/play/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Failed to submit");
        return;
      }
      const result = await res.json();
      toast.success(
        `Locked in — auto-score ${result.autoScore} / ${result.maxScore}`
      );
      router.push("/dashboard/play");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/play">
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

  const readOnly = data.submitted;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/play">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Quiz {data.quiz.number}
              {data.quiz.title && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {data.quiz.title}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              Playing as <strong>{data.team.name}</strong>
              {readOnly ? " · locked" : ""}
            </p>
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saving || submitting}
              className="gap-1"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!data.isOwner || submitting}
              className="gap-1"
              title={
                data.isOwner
                  ? undefined
                  : "Only the team owner can lock in answers"
              }
            >
              <Lock className="h-4 w-4" />
              {submitting ? "Submitting…" : "Submit & lock"}
            </Button>
          </div>
        )}
      </div>

      {readOnly && (
        <Card>
          <CardHeader>
            <CardTitle>Answers locked</CardTitle>
            <CardDescription>
              Your team&apos;s answers are locked in. Auto-scores will appear
              once the quizmaster publishes the results.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!data.isOwner && !readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">You&apos;re a team member</CardTitle>
            <CardDescription>
              You can save drafts, but only the team owner can submit and lock
              the final answers.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="space-y-3">
        {data.questions.map((q) => (
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
                          className="h-28 rounded border object-contain"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Label htmlFor={`a-${q.id}`} className="text-xs text-muted-foreground">
                Your team&apos;s answer
              </Label>
              <textarea
                id={`a-${q.id}`}
                className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
                value={drafts[q.id] ?? ""}
                disabled={readOnly}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || submitting}
            className="gap-1"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!data.isOwner || submitting}
            className="gap-1"
          >
            <Lock className="h-4 w-4" />
            Submit &amp; lock
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock in your team&apos;s answers?</AlertDialogTitle>
            <AlertDialogDescription>
              After locking, no one on your team can edit answers and the
              quiz will be auto-scored against the correct answers. You
              can&apos;t undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>
              Lock in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
