"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, X, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function NewQuizPage() {
  const router = useRouter();
  const [quizNumber, setQuizNumber] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [activeTab, setActiveTab] = useState("upload");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile?.name.endsWith(".docx")) {
      setFile(uploadedFile);
      toast.success(`${uploadedFile.name} ready to upload`);
    } else {
      toast.error("Please upload a .docx file only");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    multiple: false,
  });

  const addQuestion = () => {
    setQuestions([...questions, ""]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  const handleSave = async () => {
    if (!quizNumber.trim()) {
      toast.error("Please enter a quiz number");
      return;
    }

    const validManualQuestions = questions.map((q) => q.trim()).filter(Boolean);
    const hasManual = activeTab === "manual" && validManualQuestions.length > 0;
    const hasFile = activeTab === "upload" && file;

    if (!hasManual && !hasFile) {
      toast.error(
        activeTab === "upload"
          ? "Please upload a DOCX file"
          : "Please add at least one question"
      );
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("quizNumber", quizNumber.trim());
      if (quizTitle.trim()) {
        formData.append("quizTitle", quizTitle.trim());
      }
      if (hasFile && file) {
        formData.append("file", file);
      }
      if (hasManual) {
        formData.append("manualQuestions", JSON.stringify(validManualQuestions));
      }

      const res = await fetch("/api/quizzes", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to create quiz");
        return;
      }

      toast.success(`Quiz #${quizNumber} created`);
      router.push("/dashboard/quizzes");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create quiz");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create New Quiz</h1>
          <p className="text-muted-foreground">
            Create a quiz by uploading a DOCX file or adding questions manually
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quiz Details</CardTitle>
          <CardDescription>Enter the quiz number and optional title</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="quizNumber">Quiz Number *</Label>
            <Input
              id="quizNumber"
              placeholder="e.g. 921"
              value={quizNumber}
              onChange={(e) => setQuizNumber(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quizTitle">Title (Optional)</Label>
            <Input
              id="quizTitle"
              placeholder="e.g. Sports Special"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload DOCX
          </TabsTrigger>
          <TabsTrigger value="manual">
            <FileText className="h-4 w-4 mr-2" />
            Manual Entry
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Quiz DOCX</CardTitle>
              <CardDescription>
                Drag and drop your quiz document here. Questions will be parsed on the server.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-accent"
                    : "border-muted-foreground/20 hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5" />
                    <span>{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium">
                      {isDragActive ? "Drop the file here" : "Drag & drop a DOCX file here"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      or click to select a file
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Manual Questions</CardTitle>
                <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add Question
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((question, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground min-w-[2rem] pt-2">
                    {index + 1}.
                  </span>
                  <Input
                    placeholder={`Question ${index + 1}`}
                    value={question}
                    onChange={(e) => updateQuestion(index, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(index)}
                    disabled={questions.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <ChevronRight className="h-4 w-4 mr-2" />
          {saving ? "Creating…" : "Create Quiz"}
        </Button>
      </div>
    </div>
  );
}
