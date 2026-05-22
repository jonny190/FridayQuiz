import * as mammoth from "mammoth";

interface ParsedQuestion {
  number: number;
  question: string;
  answer: string;
  points: number;
}

export async function parseQuizDocx(fileBuffer: Buffer): Promise<{
  quizNumber: number | null;
  quizTitle: string | null;
  questions: ParsedQuestion[];
  answers?: ParsedQuestion[];
}> {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const text = result.value;
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

    // Try to detect quiz number from text
    const quizNumberMatch = text.match(/(?:quiz\s*no\.?|number)\s*[:#]?\s*(\d+)/i);
    const quizNumber = quizNumberMatch ? parseInt(quizNumberMatch[1], 10) : null;

    // Try to detect quiz title
    const titleMatch = text.match(/^(.+?\s*quiz\s*\d+)$/m);
    const quizTitle = titleMatch ? titleMatch[1].trim() : null;

    // Parse questions
    const questions = parseQuestionsFromText(lines);

    // Try to detect if this is an answers document
    const isAnswersDoc = /answers?|solutions?|correct answers?/i.test(text);

    let answers: ParsedQuestion[] | undefined;
    if (isAnswersDoc) {
      answers = parseAnswersFromText(lines);
    }

    return {
      quizNumber,
      quizTitle,
      questions,
      answers,
    };
  } catch (error) {
    console.error("Error parsing DOCX:", error);
    throw new Error("Failed to parse DOCX file");
  }
}

function parseQuestionsFromText(lines: string[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let currentQuestion: ParsedQuestion | null = null;
  let currentPointValue: number | null = null;

  for (const line of lines) {
    // Check for point value indicators
    const pointMatch = line.match(/\((\d+)\s*(?:pts?|points?)?\)/i);
    if (pointMatch && !currentQuestion) {
      currentPointValue = parseInt(pointMatch[1], 10);
      continue;
    }

    // Check for question number pattern
    const questionMatch = line.match(/^(\d+)\.?\s*[:\-–—]?[\s]*(.*)/);
    if (questionMatch) {
      // Save previous question
      if (currentQuestion) {
        questions.push(currentQuestion);
      }

      currentQuestion = {
        number: parseInt(questionMatch[1], 10),
        question: questionMatch[2].trim(),
        answer: "",
        points: currentPointValue || 1,
      };
      currentPointValue = null;
      continue;
    }

    // If we have a current question and this looks like a continuation
    if (currentQuestion && line && !line.match(/^a\)|b\)|c\)|d\)/i)) {
      currentQuestion.question += " " + line;
    }

    // Check for answer pattern
    const answerMatch = line.match(/(?:answer|answers?|solution|correct)\s*[:#]?\s*[:–—]?[\s]*(.+)/i);
    if (answerMatch && currentQuestion) {
      currentQuestion.answer = answerMatch[1].trim();
    }
  }

  // Don't forget the last question
  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions;
}

function parseAnswersFromText(lines: string[]): ParsedQuestion[] {
  const answers: ParsedQuestion[] = [];
  let currentAnswer: ParsedQuestion | null = null;

  for (const line of lines) {
    const questionMatch = line.match(/^(\d+)\.?\s*[:\-–—]?[\s]*(.*)/);
    if (questionMatch) {
      if (currentAnswer) {
        answers.push(currentAnswer);
      }
      currentAnswer = {
        number: parseInt(questionMatch[1], 10),
        question: "",
        answer: questionMatch[2].trim(),
        points: 1,
      };
      continue;
    }

    if (currentAnswer && line) {
      currentAnswer.answer += " " + line;
    }
  }

  if (currentAnswer) {
    answers.push(currentAnswer);
  }

  return answers;
}