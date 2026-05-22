"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { FileText, Plus, Upload, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const quizStatuses = {
  DRAFT: { variant: "secondary" as const, label: "Draft" },
  ACTIVE: { variant: "default" as const, label: "Active" },
  GRADED: { variant: "outline" as const, label: "Graded" },
  PUBLISHED: { variant: "outline" as const, label: "Published" },
  ARCHIVED: { variant: "secondary" as const, label: "Archived" },
} as const;

type Quiz = {
  id: string;
  number: number;
  title: string | null;
  date: string;
  status: keyof typeof quizStatuses;
  _count: { questions: number };
};

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Quiz | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/quizzes", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load quizzes (${res.status})`);
      const data = (await res.json()) as Quiz[];
      setQuizzes(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const triggerUpload = (quizId: string) => {
    uploadTargetRef.current = quizId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const quizId = uploadTargetRef.current;
    e.target.value = "";
    uploadTargetRef.current = null;
    if (!file || !quizId) return;
    if (!file.name.endsWith(".docx")) {
      toast.error("Please upload a .docx file only");
      return;
    }

    setBusyId(quizId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/quizzes/${quizId}`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to upload DOCX");
        return;
      }
      toast.success("Questions replaced from DOCX");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload DOCX");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    const quiz = pendingDelete;
    if (!quiz) return;
    setBusyId(quiz.id);
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete quiz");
        return;
      }
      toast.success(`Quiz ${quiz.number} deleted`);
      setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete quiz");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quizzes</h1>
          <p className="text-muted-foreground">
            Manage your Friday quizzes
          </p>
        </div>
        <Link href="/dashboard/quizzes/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Quiz
          </Button>
        </Link>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={handleFileSelected}
      />

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading quizzes…</CardTitle>
          </CardHeader>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load quizzes</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : quizzes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No quizzes yet</CardTitle>
            <CardDescription>
              Create your first quiz to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/quizzes/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Quiz
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <Card key={quiz.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/quizzes/${quiz.id}`}
                    className="hover:underline"
                  >
                    <CardTitle className="text-lg">
                      Quiz No. {quiz.number}
                      {quiz.title && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          — {quiz.title}
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {new Date(quiz.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </CardDescription>
                  </Link>
                  <Badge variant={quizStatuses[quiz.status]?.variant}>
                    {quizStatuses[quiz.status]?.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {quiz._count.questions} questions
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/quizzes/${quiz.id}`}>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={busyId === quiz.id}
                      onClick={() => triggerUpload(quiz.id)}
                    >
                      <Upload className="h-4 w-4" />
                      Upload DOCX
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={busyId === quiz.id}
                      onClick={() => setPendingDelete(quiz)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `Quiz ${pendingDelete.number}${
                  pendingDelete.title ? ` — ${pendingDelete.title}` : ""
                } and all its questions, answers and results will be permanently removed.`}
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
