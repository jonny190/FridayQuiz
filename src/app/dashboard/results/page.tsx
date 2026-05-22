"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, Download, Filter } from "lucide-react";
import { toast } from "sonner";

type Result = {
  id: string;
  totalScore: number;
  rank: number | null;
  published: boolean;
  publishedAt: string | null;
  quiz: { id: string; number: number; title: string | null; status: string };
  team: { id: string; name: string };
};

export default function ResultsPage() {
  const [selectedQuiz, setSelectedQuiz] = useState<string>("all");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/results", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load results (${res.status})`);
        return (await res.json()) as Result[];
      })
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load results");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const quizOptions = useMemo(() => {
    const map = new Map<string, { id: string; number: number; title: string | null }>();
    for (const r of results) {
      if (!map.has(r.quiz.id)) {
        map.set(r.quiz.id, r.quiz);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.number - a.number);
  }, [results]);

  const filtered = useMemo(() => {
    if (selectedQuiz === "all") return results;
    return results.filter((r) => r.quiz.id === selectedQuiz);
  }, [results, selectedQuiz]);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.info("No results to export");
      return;
    }
    const header = ["Quiz", "Title", "Rank", "Team", "Score", "Published"];
    const rows = filtered.map((r) => [
      r.quiz.number,
      r.quiz.title ?? "",
      r.rank ?? "",
      r.team.name,
      r.totalScore,
      r.published ? "yes" : "no",
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Results</h1>
          <p className="text-muted-foreground">View and export quiz results</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleExport}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Quiz Results
              </CardTitle>
              <CardDescription>Select a quiz to view results</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedQuiz} onValueChange={(v) => setSelectedQuiz(v || "all")}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select quiz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quizzes</SelectItem>
                  {quizOptions.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      Quiz {q.number}
                      {q.title ? ` — ${q.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Loading results…
            </div>
          ) : error ? (
            <div className="text-center py-8 text-sm text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No results to display. Publish a quiz to see results here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Published</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      Quiz {result.quiz.number}
                      {result.quiz.title && (
                        <span className="ml-1 text-muted-foreground">
                          — {result.quiz.title}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.rank === 1 && <span className="text-lg">🥇</span>}
                      {result.rank === 2 && <span className="text-lg">🥈</span>}
                      {result.rank === 3 && <span className="text-lg">🥉</span>}
                      {result.rank !== null && result.rank > 3 && <span>{result.rank}</span>}
                      {result.rank === null && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-medium">{result.team.name}</TableCell>
                    <TableCell>{result.totalScore}</TableCell>
                    <TableCell>
                      <Badge variant={result.published ? "default" : "secondary"}>
                        {result.published ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
