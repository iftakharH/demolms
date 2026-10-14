import { query, queryOne } from '../db';
import type { QuizQuestion, QuestionKind } from '../quiz';

/** Assessment queries: quiz attempts, assignment submissions and the grading queue. */

export interface QuizAttemptRow {
  id: number;
  attemptNo: number;
  status: 'graded' | 'pending_review';
  autoPoints: number;
  manualPoints: number | null;
  totalPoints: number | null;
  maxPoints: number;
  scorePercent: number | null;
  passed: number | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export function quizQuestions(lessonId: number): QuizQuestion[] {
  return query<{
    id: number;
    type: QuestionKind;
    prompt: string;
    options_json: string;
    correct_json: string;
    explanation: string;
    points: number;
  }>(
    `SELECT id, type, prompt, options_json, correct_json, explanation, points
       FROM questions WHERE lesson_id = ? ORDER BY sort_order, id`,
    lessonId,
  ).map((row) => ({
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    options: safeJson<string[]>(row.options_json, []),
    correct: safeJson<(number | string)[]>(row.correct_json, []),
    explanation: row.explanation,
    points: row.points,
  }));
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function quizLesson(lessonId: number) {
  return queryOne<{
    id: number;
    title: string;
    courseId: number;
    courseSlug: string;
    courseTitle: string;
    passPercent: number;
    maxAttempts: number;
    showAnswers: boolean;
  }>(
    `SELECT l.id, l.title, l.course_id AS courseId, c.slug AS courseSlug, c.title AS courseTitle,
            COALESCE(l.quiz_pass_percent, 70) AS passPercent,
            COALESCE(l.quiz_max_attempts, 3) AS maxAttempts,
            l.quiz_show_answers AS showAnswers
       FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.id = ? AND l.type = 'quiz'`,
    lessonId,
  );
}

export function attemptsFor(lessonId: number, userId: number): QuizAttemptRow[] {
  return query<QuizAttemptRow>(
    `SELECT id, attempt_no AS attemptNo, status, auto_points AS autoPoints, manual_points AS manualPoints,
            total_points AS totalPoints, max_points AS maxPoints, score_percent AS scorePercent,
            passed, submitted_at AS submittedAt, reviewed_at AS reviewedAt
       FROM quiz_attempts WHERE lesson_id = ? AND user_id = ?
      ORDER BY attempt_no DESC`,
    lessonId,
    userId,
  );
}

export interface AttemptAnswerView {
  questionId: number;
  type: QuestionKind;
  prompt: string;
  options: string[];
  correct: (number | string)[];
  explanation: string;
  points: number;
  choices: number[];
  text: string;
  awardedPoints: number | null;
  isCorrect: number | null;
  feedback: string;
}

export function attemptAnswers(attemptId: number): AttemptAnswerView[] {
  const rows = query<{
    questionId: number;
    type: QuestionKind;
    prompt: string;
    optionsJson: string;
    correctJson: string;
    explanation: string;
    points: number;
    answerJson: string;
    awardedPoints: number | null;
    isCorrect: number | null;
    feedback: string;
  }>(
    `SELECT q.id AS questionId, q.type, q.prompt, q.options_json AS optionsJson,
            q.correct_json AS correctJson, q.explanation, q.points,
            a.answer_json AS answerJson, a.awarded_points AS awardedPoints,
            a.is_correct AS isCorrect, a.feedback
       FROM quiz_answers a
       JOIN questions q ON q.id = a.question_id
      WHERE a.attempt_id = ?
      ORDER BY q.sort_order, q.id`,
    attemptId,
  );

  return rows.map((row) => {
    const answer = safeJson<{ choices?: number[]; text?: string }>(row.answerJson, {});
    return {
      questionId: row.questionId,
      type: row.type,
      prompt: row.prompt,
      options: safeJson<string[]>(row.optionsJson, []),
      correct: safeJson<(number | string)[]>(row.correctJson, []),
      explanation: row.explanation,
      points: row.points,
      choices: answer.choices ?? [],
      text: answer.text ?? '',
      awardedPoints: row.awardedPoints,
      isCorrect: row.isCorrect,
      feedback: row.feedback,
    };
  });
}

export function attemptById(attemptId: number, userId?: number) {
  return queryOne<{
    id: number;
    lessonId: number;
    userId: number;
    status: string;
    scorePercent: number | null;
    passed: number | null;
    autoPoints: number;
    manualPoints: number | null;
    maxPoints: number;
    attemptNo: number;
    submittedAt: string;
    reviewedAt: string | null;
    courseSlug: string;
    courseTitle: string;
    lessonTitle: string;
    passPercent: number;
    userName: string;
    userEmail: string;
  }>(
    `SELECT qa.id, qa.lesson_id AS lessonId, qa.user_id AS userId, qa.status,
            qa.score_percent AS scorePercent, qa.passed, qa.auto_points AS autoPoints,
            qa.manual_points AS manualPoints, qa.max_points AS maxPoints, qa.attempt_no AS attemptNo,
            qa.submitted_at AS submittedAt, qa.reviewed_at AS reviewedAt,
            c.slug AS courseSlug, c.title AS courseTitle, l.title AS lessonTitle,
            COALESCE(l.quiz_pass_percent, 70) AS passPercent,
            u.name AS userName, u.email AS userEmail
       FROM quiz_attempts qa
       JOIN lessons l ON l.id = qa.lesson_id
       JOIN courses c ON c.id = l.course_id
       JOIN users u ON u.id = qa.user_id
      WHERE qa.id = ? ${userId ? 'AND qa.user_id = ?' : ''}`,
    ...(userId ? [attemptId, userId] : [attemptId]),
  );
}

/* ------------------------------------------------------------------ assignments */

export interface AssignmentRow {
  id: number;
  lessonId: number;
  title: string;
  courseId: number;
  courseSlug: string;
  courseTitle: string;
  briefMd: string | null;
  maxScore: number;
  allowFiles: boolean;
}

export function assignmentLesson(lessonId: number): AssignmentRow | null {
  const row = queryOne<{
    id: number;
    title: string;
    courseId: number;
    courseSlug: string;
    courseTitle: string;
    briefMd: string | null;
    maxScore: number;
    allowFiles: number;
  }>(
    `SELECT l.id, l.title, l.course_id AS courseId, c.slug AS courseSlug, c.title AS courseTitle,
            l.assignment_brief_md AS briefMd, COALESCE(l.assignment_max_score, 100) AS maxScore,
            l.assignment_allow_files AS allowFiles
       FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.id = ? AND l.type = 'assignment'`,
    lessonId,
  );
  return row
    ? { ...row, lessonId: row.id, allowFiles: Boolean(row.allowFiles) }
    : null;
}

export interface SubmissionRow {
  id: number;
  lessonId: number;
  userId: number;
  bodyText: string;
  fileId: number | null;
  fileName: string | null;
  status: 'submitted' | 'graded' | 'resubmission_requested';
  score: number | null;
  maxScore: number;
  feedback: string;
  submittedAt: string;
  gradedAt: string | null;
}

export function submissionsFor(lessonId: number, userId: number): SubmissionRow[] {
  return query<{
    id: number;
    lessonId: number;
    userId: number;
    bodyText: string;
    fileId: number | null;
    fileName: string | null;
    status: SubmissionRow['status'];
    score: number | null;
    maxScore: number;
    feedback: string;
    submittedAt: string;
    gradedAt: string | null;
  }>(
    `SELECT s.id, s.lesson_id AS lessonId, s.user_id AS userId, s.body_text AS bodyText,
            s.file_id AS fileId, f.original_name AS fileName, s.status, s.score,
            s.max_score AS maxScore, s.feedback, s.submitted_at AS submittedAt, s.graded_at AS gradedAt
       FROM assignment_submissions s
       LEFT JOIN files f ON f.id = s.file_id
      WHERE s.lesson_id = ? AND s.user_id = ?
      ORDER BY s.submitted_at DESC`,
    lessonId,
    userId,
  );
}

export function submissionById(submissionId: number) {
  return queryOne<{
    id: number;
    lessonId: number;
    userId: number;
    bodyText: string;
    status: string;
    score: number | null;
    maxScore: number;
    feedback: string;
    submittedAt: string;
    gradedAt: string | null;
    fileId: number | null;
    fileName: string | null;
    lessonTitle: string;
    courseSlug: string;
    courseTitle: string;
    userName: string;
    userEmail: string;
  }>(
    `SELECT s.id, s.lesson_id AS lessonId, s.user_id AS userId, s.body_text AS bodyText, s.status,
            s.score, s.max_score AS maxScore, s.feedback, s.submitted_at AS submittedAt,
            s.graded_at AS gradedAt, s.file_id AS fileId, f.original_name AS fileName,
            l.title AS lessonTitle, c.slug AS courseSlug, c.title AS courseTitle,
            u.name AS userName, u.email AS userEmail
       FROM assignment_submissions s
       JOIN lessons l ON l.id = s.lesson_id
       JOIN courses c ON c.id = l.course_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN files f ON f.id = s.file_id
      WHERE s.id = ?`,
    submissionId,
  );
}

export function submissionForGrader(submissionId: number) {
  return submissionById(submissionId);
}

/* ------------------------------------------------------------------ grading queue */

export interface GradingItem {
  kind: 'quiz' | 'assignment';
  id: number;
  submittedAt: string;
  userName: string;
  userEmail: string;
  lessonTitle: string;
  courseTitle: string;
  courseSlug: string;
  detail: string;
}

export function gradingQueue(): GradingItem[] {
  const quizzes = query<GradingItem>(
    `SELECT 'quiz' AS kind, qa.id, qa.submitted_at AS submittedAt, u.name AS userName, u.email AS userEmail,
            l.title AS lessonTitle, c.title AS courseTitle, c.slug AS courseSlug,
            (SELECT COUNT(*) FROM quiz_answers a WHERE a.attempt_id = qa.id AND a.is_correct IS NULL) || ' essay answer(s)' AS detail
       FROM quiz_attempts qa
       JOIN lessons l ON l.id = qa.lesson_id
       JOIN courses c ON c.id = l.course_id
       JOIN users u ON u.id = qa.user_id
      WHERE qa.status = 'pending_review'
      ORDER BY qa.submitted_at ASC`,
  );

  const submissions = query<GradingItem>(
    `SELECT 'assignment' AS kind, s.id, s.submitted_at AS submittedAt, u.name AS userName, u.email AS userEmail,
            l.title AS lessonTitle, c.title AS courseTitle, c.slug AS courseSlug,
            'score out of ' || s.max_score AS detail
       FROM assignment_submissions s
       JOIN lessons l ON l.id = s.lesson_id
       JOIN courses c ON c.id = l.course_id
       JOIN users u ON u.id = s.user_id
      WHERE s.status = 'submitted'
      ORDER BY s.submitted_at ASC`,
  );

  return [...quizzes, ...submissions].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

/* ------------------------------------------------------------------ learner grades */

export interface GradeItem {
  kind: 'quiz' | 'assignment';
  id: number;
  status: 'graded' | 'pending_review' | 'submitted' | 'resubmission_requested';
  title: string;
  courseTitle: string;
  courseSlug: string;
  lessonId: number;
  score: number | null;
  maxScore: number;
  percent: number | null;
  passed: boolean | null;
  feedback: string;
  at: string;
}

export function learnerGrades(userId: number): GradeItem[] {
  const quizzes = query<{
    id: number;
    lessonId: number;
    title: string;
    courseTitle: string;
    courseSlug: string;
    status: GradeItem['status'];
    scorePercent: number | null;
    passed: number | null;
    submittedAt: string;
  }>(
    `SELECT qa.id, qa.lesson_id AS lessonId, l.title, c.title AS courseTitle, c.slug AS courseSlug,
            qa.status, qa.score_percent AS scorePercent, qa.passed, qa.submitted_at AS submittedAt
       FROM quiz_attempts qa
       JOIN lessons l ON l.id = qa.lesson_id
       JOIN courses c ON c.id = l.course_id
      WHERE qa.user_id = ?
      ORDER BY qa.submitted_at DESC`,
    userId,
  ).map((row) => ({
    kind: 'quiz' as const,
    id: row.id,
    status: row.status === 'graded' ? ('graded' as const) : ('pending_review' as const),
    title: row.title,
    courseTitle: row.courseTitle,
    courseSlug: row.courseSlug,
    lessonId: row.lessonId,
    score: row.scorePercent,
    maxScore: 100,
    percent: row.scorePercent,
    passed: row.passed === null ? null : Boolean(row.passed),
    feedback: '',
    at: row.submittedAt,
  }));

  const submissions = query<{
    id: number;
    lessonId: number;
    title: string;
    courseTitle: string;
    courseSlug: string;
    status: GradeItem['status'];
    score: number | null;
    maxScore: number;
    feedback: string;
    submittedAt: string;
  }>(
    `SELECT s.id, s.lesson_id AS lessonId, l.title, c.title AS courseTitle, c.slug AS courseSlug,
            s.status, s.score, s.max_score AS maxScore, s.feedback, s.submitted_at AS submittedAt
       FROM assignment_submissions s
       JOIN lessons l ON l.id = s.lesson_id
       JOIN courses c ON c.id = l.course_id
      WHERE s.user_id = ?
      ORDER BY s.submitted_at DESC`,
    userId,
  ).map((row) => ({
    kind: 'assignment' as const,
    id: row.id,
    status: row.status,
    title: row.title,
    courseTitle: row.courseTitle,
    courseSlug: row.courseSlug,
    lessonId: row.lessonId,
    score: row.score,
    maxScore: row.maxScore,
    percent: row.score !== null && row.maxScore > 0 ? Math.round((row.score / row.maxScore) * 1000) / 10 : null,
    passed: row.score !== null && row.maxScore > 0 ? row.score / row.maxScore >= 0.5 : null,
    feedback: row.feedback,
    at: row.submittedAt,
  }));

  return [...quizzes, ...submissions].sort((a, b) => b.at.localeCompare(a.at));
}

export interface PendingCounts {
  quizAttempts: number;
  assignments: number;
}

export function pendingCounts(userId: number): PendingCounts {
  return {
    quizAttempts:
      queryOne<{ n: number }>(
        "SELECT COUNT(*) AS n FROM quiz_attempts WHERE user_id = ? AND status = 'pending_review'",
        userId,
      )?.n ?? 0,
    assignments:
      queryOne<{ n: number }>(
        "SELECT COUNT(*) AS n FROM assignment_submissions WHERE user_id = ? AND status = 'submitted'",
        userId,
      )?.n ?? 0,
  };
}
