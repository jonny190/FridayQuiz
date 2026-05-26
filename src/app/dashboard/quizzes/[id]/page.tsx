"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { CheckSquare, ChevronLeft, ClipboardCheck, Image as ImageIcon, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Question = {
  id: string;
  order: number;
  type: string;
  text: string;
  answer: string;
  points: number;
  imageUrls: string[];
  isImageBased: boolean;
};

type Quiz = {
  id: string;
  number: number;
  title: string | null;
  date: string;
  status: "DRAFT" | "ACTIVE" | "GRADED" | "PUBLISHED" | "ARCHIVED";
  questions: Question[];
};

const STATUS_LABELS: Record<Quiz["status"], string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  GRADED: "Graded",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

type FormState = { text: string; answer: string; points: string };
const EMPTY_FORM: FormState = { text: "", answer: "", points: "1" };

export default function QuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const [editing, setEditing] = useState<Question | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null);

  const [publishOpen, setPublishOpen] = useState(false);
  const [includeMembers, setIncludeMembers] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteIncludeMembers, setInviteIncludeMembers] = useState(false);
  const [inviting, setInviting] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/quizzes/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load quiz (${res.status})`);
      const data = (await res.json()) as Quiz;
      setQuiz(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load quiz");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleStatusChange = async (value: string | null) => {
    if (!quiz || !value || value === quiz.status) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/quizzes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to update status");
        return;
      }
      toast.success(`Status set to ${STATUS_LABELS[value as Quiz["status"]]}`);
      await load();
    } finally {
      setStatusSaving(false);
    }
  };

  const openEdit = (question: Question) => {
    setEditing(question);
    setAdding(false);
    setForm({
      text: question.text,
      answer: question.answer,
      points: String(question.points),
    });
  };

  const openAdd = () => {
    setAdding(true);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const closeSheet = () => {
    setEditing(null);
    setAdding(false);
  };

  const handleSave = async () => {
    const text = form.text.trim();
    if (!text) {
      toast.error("Question text is required");
      return;
    }
    const points = Number(form.points);
    if (!Number.isFinite(points) || points < 0) {
      toast.error("Points must be a non-negative number");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/questions/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, answer: form.answer.trim(), points }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to update question");
          return;
        }
        toast.success("Question updated");
      } else if (adding) {
        const res = await fetch(`/api/quizzes/${id}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, answer: form.answer.trim(), points }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to add question");
          return;
        }
        toast.success("Question added");
      }
      closeSheet();
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    setInviteOpen(false);
    setInviting(true);
    try {
      const res = await fetch(`/api/quizzes/${id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeMembers: inviteIncludeMembers }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Failed to send invitations");
        return;
      }
      const result = await res.json();
      const fail =
        result.emailsFailed > 0 ? ` (${result.emailsFailed} failed)` : "";
      toast.success(
        `Invitations sent — ${result.emailsSent} email${result.emailsSent === 1 ? "" : "s"}${fail}`
      );
    } finally {
      setInviting(false);
    }
  };

  const handlePublish = async () => {
    setPublishOpen(false);
    setPublishing(true);
    try {
      const res = await fetch(`/api/quizzes/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeMembers }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Failed to publish");
        return;
      }
      const result = await res.json();
      const emailSummary =
        result.emailsSent > 0
          ? ` · ${result.emailsSent} email${result.emailsSent === 1 ? "" : "s"} sent`
          : "";
      const failSummary =
        result.emailsFailed > 0 ? ` (${result.emailsFailed} failed)` : "";
      toast.success(
        `Published — ${result.published} team result(s)${emailSummary}${failSummary}`
      );
      await load();
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    const q = pendingDelete;
    if (!q) return;
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/questions/${q.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete question");
        return;
      }
      toast.success("Question deleted");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete question");
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading quiz…</p>;
  }

  if (error || !quiz) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
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
          <Link href="/dashboard/quizzes">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Quiz No. {quiz.number}
              {quiz.title && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {quiz.title}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              {new Date(quiz.date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}{" "}
              · {quiz.questions.length} question
              {quiz.questions.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="status" className="text-sm text-muted-foreground">
            Status
          </Label>
          <Select
            value={quiz.status}
            onValueChange={handleStatusChange}
            disabled={statusSaving}
          >
            <SelectTrigger id="status" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {quiz.status === "ACTIVE" && (
            <Button
              variant="outline"
              onClick={() => setInviteOpen(true)}
              disabled={inviting}
              className="gap-1"
            >
              <Mail className="h-4 w-4" />
              {inviting ? "Sending…" : "Send invitations"}
            </Button>
          )}
          <Button
            onClick={() => setPublishOpen(true)}
            disabled={publishing}
          >
            {publishing ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Questions</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/quizzes/${id}/answers`}>
            <Button variant="outline" size="sm" className="gap-1">
              <CheckSquare className="h-4 w-4" />
              Set answers
            </Button>
          </Link>
          <Link href={`/dashboard/quizzes/${id}/marking`}>
            <Button variant="outline" size="sm" className="gap-1">
              <ClipboardCheck className="h-4 w-4" />
              Review submissions
            </Button>
          </Link>
          <Button onClick={openAdd} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>
      </div>

      {quiz.questions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No questions yet</CardTitle>
            <CardDescription>
              Add questions manually or re-upload a DOCX from the quizzes list.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {quiz.questions.map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>Q{q.order}</span>
                      <Badge variant="secondary" className="text-xs">
                        {q.points} pt{q.points === 1 ? "" : "s"}
                      </Badge>
                      {q.isImageBased && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {q.imageUrls.length} image
                          {q.imageUrls.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base font-medium leading-snug">
                      {q.text}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(q)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(q)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {q.imageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {q.imageUrls.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt={`Q${q.order} image ${i + 1}`}
                        className="h-24 w-24 rounded border object-cover"
                      />
                    ))}
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Answer: </span>
                  {q.answer ? (
                    <span>{q.answer}</span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      (not set)
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={editing !== null || adding} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent>
          <SheetHeader className="text-left">
            <SheetTitle>{editing ? "Edit Question" : "Add Question"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Update the question text, answer, or points."
                : "Add a new question to this quiz."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="questionText">Question *</Label>
              <textarea
                id="questionText"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="questionAnswer">Answer</Label>
              <textarea
                id="questionAnswer"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="questionPoints">Points</Label>
              <Input
                id="questionPoints"
                type="number"
                step="0.5"
                min="0"
                value={form.points}
                onChange={(e) => setForm({ ...form, points: e.target.value })}
              />
            </div>
          </div>
          <SheetFooter className="mt-4">
            <Button variant="outline" onClick={closeSheet} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Add"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send play invitations?</AlertDialogTitle>
            <AlertDialogDescription>
              Every active team&apos;s contact email gets a magic-link to
              this quiz&apos;s play page. They&apos;ll be signed in
              automatically when they click the link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 py-2 text-sm">
            <input
              type="checkbox"
              checked={inviteIncludeMembers}
              onChange={(e) => setInviteIncludeMembers(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span>Also email every team member, not just the contact</span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleInvite}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish results?</AlertDialogTitle>
            <AlertDialogDescription>
              This ranks teams by the points entered on this quiz, marks the
              quiz as Published, and emails the leaderboard to each team&apos;s
              contact email. Re-publishing later overwrites the previous
              results and resends the emails.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeMembers}
              onChange={(e) => setIncludeMembers(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span>Also email every team member, not just the contact</span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish}>
              Publish &amp; send emails
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `Q${pendingDelete.order} and any answers / suggestions teams have submitted for it will be permanently removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
