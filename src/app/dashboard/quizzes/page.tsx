"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Upload, Trash2 } from "lucide-react";
import Link from "next/link";

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/quizzes", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load quizzes (${res.status})`);
        }
        const data = (await res.json()) as Quiz[];
        if (!cancelled) setQuizzes(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load quizzes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
                  <div>
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
                  </div>
                  <Badge
                    variant={quizStatuses[quiz.status]?.variant}
                  >
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
                    <Button variant="outline" size="sm" className="gap-1">
                      <Upload className="h-4 w-4" />
                      Upload DOCX
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1">
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
    </div>
  );
}
