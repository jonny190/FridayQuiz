import * as mammoth from "mammoth";

export interface ParsedQuestion {
  number: number;
  question: string;
  answer: string;
  points: number;
  imageUrls: string[];
}

export interface ParsedDocx {
  quizNumber: number | null;
  quizTitle: string | null;
  questions: ParsedQuestion[];
}

export async function parseQuizDocx(fileBuffer: Buffer): Promise<ParsedDocx> {
  const { value: html } = await mammoth.convertToHtml({ buffer: fileBuffer });

  // Strip the wrapping <ol>/<ul>/<p> tags but keep <li>, <img>, <strong>, <sup>
  // so we can walk in document order.
  const blocks = tokenise(html);

  const titleLine = findTitle(blocks)
    ? collapseSpaces(findTitle(blocks)!)
    : null;
  const quizNumberMatch = stripText(html).match(
    /quiz(?:\s*no\.?|\s*number)?\s*[:#]?\s*(\d+)/i
  );
  const quizNumber = quizNumberMatch ? parseInt(quizNumberMatch[1], 10) : null;

  const questions = buildQuestions(blocks, titleLine);

  return { quizNumber, quizTitle: titleLine, questions };
}

type Block =
  | { kind: "text"; text: string }
  | { kind: "image"; src: string };

const TOKEN_RE = /<li[^>]*>([\s\S]*?)<\/li>|<p[^>]*>([\s\S]*?)<\/p>|<img\b[^>]*\bsrc="([^"]+)"[^>]*\/?>/gi;

function tokenise(html: string): Block[] {
  const out: Block[] = [];
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(html)) !== null) {
    if (m[3]) {
      out.push({ kind: "image", src: m[3] });
    } else {
      const inner = m[1] ?? m[2] ?? "";
      const text = stripText(inner);
      if (text) out.push({ kind: "text", text });
    }
  }
  return out;
}

// Decode HTML and strip tags but DO NOT collapse internal whitespace —
// the 2+ space gap between question and answer in answer-bearing docs is
// load-bearing.
function stripText(htmlFragment: string): string {
  return htmlFragment
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/^\s+|\s+$/g, "");
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function findTitle(blocks: Block[]): string | null {
  for (const b of blocks) {
    if (b.kind !== "text") continue;
    if (isTitleLike(b.text)) return b.text;
  }
  return null;
}

function isTitleLike(line: string): boolean {
  if (line.length > 80) return false;
  if (!/quiz/i.test(line)) return false;
  return /\b(19|20)\d{2}\b|\b\d{1,2}(st|nd|rd|th)\b|\bjan(uary)?\b|\bfeb(ruary)?\b|\bmar(ch)?\b|\bapr(il)?\b|\bmay\b|\bjun(e)?\b|\bjul(y)?\b|\baug(ust)?\b|\bsep(tember)?\b|\boct(ober)?\b|\bnov(ember)?\b|\bdec(ember)?\b|\bno\.?\s*\d+\b/i.test(
    line
  );
}

const NUMBERED_PREFIX_RE = /^(\d{1,3})[.)]\s*[:\-–—]?\s*(.+)/;

function buildQuestions(blocks: Block[], titleLine: string | null): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;

  const isQuestionText = (text: string) => {
    if (text.length < 5) return false;
    if (titleLine && text === titleLine) return false;
    if (isTitleLike(text)) return false;
    if (/^[•·\-–—\s]+$/.test(text)) return false;
    return true;
  };

  for (const block of blocks) {
    if (block.kind === "image") {
      if (current) current.imageUrls.push(block.src);
      continue;
    }

    if (!isQuestionText(collapseSpaces(block.text))) continue;

    let text = block.text;
    const numbered = text.match(NUMBERED_PREFIX_RE);
    if (numbered) {
      text = numbered[2];
    }

    const [questionText, answerText] = splitQuestionAndAnswer(text);
    const cleanQuestion = collapseSpaces(questionText);
    const cleanAnswer = collapseSpaces(answerText);
    if (!cleanQuestion) continue;

    current = {
      number: questions.length + 1,
      question: cleanQuestion,
      answer: cleanAnswer,
      points: 1,
      imageUrls: [],
    };
    questions.push(current);
  }

  return questions;
}

// In answer-bearing docs, each paragraph is "question text  answer text".
// Question is everything up to the last "?"; the answer follows after a gap
// of 2+ spaces. If there's no "?", the whole line is the question.
function splitQuestionAndAnswer(line: string): [string, string] {
  const lastQ = line.lastIndexOf("?");
  if (lastQ !== -1) {
    const question = line.slice(0, lastQ + 1).trim();
    const rest = line.slice(lastQ + 1);
    const gapMatch = rest.match(/^\s{2,}(.+)$/);
    if (gapMatch) return [question, gapMatch[1].trim()];
    return [question, ""];
  }
  // Fallback for "Name the X    Sinners" — no "?", but the answer
  // is separated from the prompt by 3+ spaces.
  const fallback = line.match(/^(.+?)\s{3,}(.+)$/);
  if (fallback) return [fallback[1].trim(), fallback[2].trim()];
  return [line, ""];
}
