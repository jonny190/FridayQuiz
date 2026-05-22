"use client";

import { useState } from "react";
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

interface QuizResult {
  id: string;
  quizNumber: number;
  quizDate: string;
  teamName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  rank: number;
}

export default function ResultsPage() {
  const [selectedQuiz, setSelectedQuiz] = useState<string>("all");
  const [results] = useState<QuizResult[]>([]);

  const handleExport = () => {
    toast.info("Export functionality will be implemented");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Results</h1>
          <p className="text-muted-foreground">
            View and export quiz results
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export Excel
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
              <CardDescription>
                Select a quiz to view results
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedQuiz} onValueChange={(v) => setSelectedQuiz(v || "all")}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select quiz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quizzes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
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
                  <TableHead>Rank</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      {result.rank === 1 && <span className="text-lg">🥇</span>}
                      {result.rank === 2 && <span className="text-lg">🥈</span>}
                      {result.rank === 3 && <span className="text-lg">🥉</span>}
                      {result.rank > 3 && <span>{result.rank}</span>}
                    </TableCell>
                    <TableCell className="font-medium">{result.teamName}</TableCell>
                    <TableCell>{result.score}/{result.totalQuestions}</TableCell>
                    <TableCell>
                      <Badge
                        variant={result.percentage >= 70 ? "default" : "secondary"}
                      >
                        {result.percentage}%
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