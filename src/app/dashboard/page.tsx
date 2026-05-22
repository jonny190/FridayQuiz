"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Trophy, Activity } from "lucide-react";

type Stats = {
  totalQuizzes: number;
  activeQuizzes: number;
  totalTeams: number;
  publishedResults: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load stats (${res.status})`);
        return res.json() as Promise<Stats>;
      })
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load stats");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const display = (value: number | undefined) =>
    stats ? value ?? 0 : error ? "—" : "…";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to Friday Quiz Management
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quizzes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{display(stats?.totalQuizzes)}</div>
            <p className="text-xs text-muted-foreground">Created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Quizzes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{display(stats?.activeQuizzes)}</div>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{display(stats?.totalTeams)}</div>
            <p className="text-xs text-muted-foreground">Registered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quiz Results</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{display(stats?.publishedResults)}</div>
            <p className="text-xs text-muted-foreground">Published</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with Friday Quiz</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <a
                href="/dashboard/quizzes/new"
                className="flex items-center justify-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span>New Quiz</span>
              </a>
              <a
                href="/dashboard/teams"
                className="flex items-center justify-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
              >
                <Users className="h-4 w-4" />
                <span>Manage Teams</span>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>At a glance</CardTitle>
            <CardDescription>Snapshot of your account</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : stats && stats.totalQuizzes === 0 ? (
              <p className="text-sm text-muted-foreground">
                No quizzes yet. Create your first quiz to get started.
              </p>
            ) : stats ? (
              <p className="text-sm text-muted-foreground">
                {stats.totalQuizzes} quiz{stats.totalQuizzes === 1 ? "" : "zes"} •{" "}
                {stats.totalTeams} team{stats.totalTeams === 1 ? "" : "s"} •{" "}
                {stats.publishedResults} published result{stats.publishedResults === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
