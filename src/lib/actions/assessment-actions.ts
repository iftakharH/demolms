'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser, requireAdminWriter } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { query, queryOne, run } from '@/lib/db';
import { activeEnrolment, maybeCompleteCourse } from '@/lib/progress';
import { issueCertificateIfEligible } from '@/lib/certificates';
import { attemptOutcome, markAnswers, parseSubmittedAnswers } from '@/lib/quiz';
import {
  assignmentLesson,
  attemptAnswers,
  attemptById,
  quizLesson,
  quizQuestions,
  submissionById,
} from '@/lib/queries/assessment';
import { notify } from '@/lib/notify';
import { sendMailToUser } from '@/lib/mailer';
import { assignmentGraded, assignmentReceived, quizPendingReview, quizReviewed } from '@/lib/email-templates';
import { saveUpload, UploadError } from '@/lib/uploads';
import type { FormState } from '@/lib/action-state';

/* ------------------------------------------------------------------ learner: quiz */

export async function submitQuizAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);
  const lesson = quizLesson(lessonId);
  if (!lesson) return { error: 'That quiz is no longer available.' };

  if (!activeEnrolment(user.id, lesson.courseId)) {
    return { error: 'You need to be enrolled on this course to take the quiz.' };
  }

  const attempts = query<{ n: number }>(
    'SELECT COUNT(*) AS n FROM quiz_attempts WHERE lesson_id = ? AND user_id = ?',
    lessonId,
    user.id,
  )[0]?.n ?? 0;
  if (attempts >= lesson.maxAttempts) {
    return { error: `You have used all ${lesson.maxAttempts} attempts for this quiz.` };
  }

  const questions = quizQuestions(lessonId);
  if (questions.length === 0) return { error: 'This quiz has no questions yet.' };

  const answers = parseSubmittedAnswers(formData, questions);

  // every question needs an answer before submitting
  const unanswered = questions.filter((question) => {
    const answer = answers.find((item) => item.questionId === question.id);
    if (!answer) return true;
    if (question.type === 'essay' || question.type === 'short') return !(answer.text ?? '').trim();
    return (answer.choices ?? []).length === 0;
  });
  if (unanswered.length > 0) {
    return { error: `Please answer every question (${unanswered.length} left).` };
  }

  const marked = markAnswers(questions, answers);
  const outcome = attemptOutcome({
    autoPoints: marked.autoPoints,
    // essays are pending -> null. Without essays, everything is already marked.
    manualPoints: marked.hasManualQuestion ? null : 0,
    maxPoints: marked.maxPoints,
    passPercent: lesson.passPercent,
  });

  const attemptInfo = run(
    `INSERT INTO quiz_attempts (lesson_id, user_id, attempt_no, status, auto_points, auto_max,
                                manual_points, manual_max, total_points, max_points, score_percent, passed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    lessonId,
    user.id,
    attempts + 1,
    marked.hasManualQuestion ? 'pending_review' : 'graded',
    marked.autoPoints,
    marked.autoMax,
    marked.hasManualQuestion ? null : 0,
    marked.manualMax,
    outcome.totalPoints,
    marked.maxPoints,
    outcome.scorePercent,
    outcome.passed === null ? null : outcome.passed ? 1 : 0,
  );
  const attemptId = Number(attemptInfo.lastInsertRowid);

  for (const answer of marked.answers) {
    run(
      `INSERT INTO quiz_answers (attempt_id, question_id, answer_json, awarded_points, is_correct, feedback)
       VALUES (?, ?, ?, ?, ?, ?)`,
      attemptId,
      answer.questionId,
      JSON.stringify({
        choices: answer.answer.choices ?? [],
        text: answer.answer.text ?? '',
      }),
      answer.awardedPoints,
      answer.isCorrect === null ? null : answer.isCorrect ? 1 : 0,
      answer.feedback,
    );
  }

  if (!marked.hasManualQuestion && outcome.passed) {
    run(
      `UPDATE lesson_progress
          SET completed_at = COALESCE(completed_at, datetime('now')), updated_at = datetime('now')
        WHERE user_id = ? AND lesson_id = ?`,
      user.id,
      lessonId,
    );
    completeIfFinished(user.id, lesson.courseId, lesson.courseSlug, lesson.courseTitle);
  }

  if (marked.hasManualQuestion) {
    sendMailToUser(
      user.id,
      quizPendingReview({ courseTitle: lesson.courseTitle, lessonTitle: lesson.title }),
    );
    notify({
      userId: user.id,
      type: 'quiz_submitted',
      title: 'Quiz submitted - one answer needs a human',
      body: 'Your written answer is queued for your instructor.',
      href: `/learn/courses/${lesson.courseSlug}/quiz/${lessonId}?attempt=${attemptId}`,
    });
  }

  logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: 'quiz.submitted',
    entityType: 'attempt',
    entityId: attemptId,
    summary: `Quiz attempt #${attempts + 1} submitted on "${lesson.title}" (${outcome.status})`,
    meta: { autoPoints: marked.autoPoints, maxPoints: marked.maxPoints, manual: marked.hasManualQuestion },
  });

  revalidatePath(`/learn/courses/${lesson.courseSlug}`);
  revalidatePath(`/learn/grades`);
  redirect(`/learn/courses/${lesson.courseSlug}/quiz/${lessonId}?attempt=${attemptId}&submitted=1`);
}

/* ------------------------------------------------------------------ learner: assignment */

export async function submitAssignmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);
  const assignment = assignmentLesson(lessonId);
  if (!assignment) return { error: 'That assignment is no longer available.' };

  if (!activeEnrolment(user.id, assignment.courseId)) {
    return { error: 'You need to be enrolled on this course to submit this assignment.' };
  }

  const body = z
    .string()
    .trim()
    .min(20, 'Write at least a couple of sentences so your instructor can mark it.')
    .max(20_000)
    .safeParse(formData.get('body_text'));
  const file = formData.get('file');

  const hasFile = file instanceof File && file.size > 0;
  if (!body.success && !hasFile) {
    return {
      error: body.error.issues[0].message,
      fieldErrors: { body_text: body.error.issues[0].message },
    };
  }

  let fileId: number | null = null;
  if (hasFile && assignment.allowFiles) {
    try {
      const stored = await saveUpload(file, 'submission', user.id);
      fileId = stored?.id ?? null;
    } catch (error) {
      if (error instanceof UploadError) return { error: error.message };
      throw error;
    }
  } else if (hasFile && !assignment.allowFiles) {
    return { error: 'This assignment does not accept file uploads.' };
  }

  const info = run(
    `INSERT INTO assignment_submissions (lesson_id, user_id, body_text, file_id, status, max_score)
     VALUES (?, ?, ?, ?, 'submitted', ?)`,
    lessonId,
    user.id,
    body.success ? body.data : '',
    fileId,
    assignment.maxScore,
  );

  sendMailToUser(
    user.id,
    assignmentReceived({ courseTitle: assignment.courseTitle, assignmentTitle: assignment.title }),
  );
  notify({
    userId: user.id,
    type: 'assignment_submitted',
    title: 'Submission received',
    body: `Your work for ${assignment.title} is queued for grading.`,
    href: `/learn/courses/${assignment.courseSlug}/assignment/${lessonId}`,
  });

  logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: 'assignment.submitted',
    entityType: 'submission',
    entityId: Number(info.lastInsertRowid),
    summary: `Assignment submitted: "${assignment.title}" (${assignment.courseTitle})`,
    meta: { withFile: Boolean(fileId) },
  });

  revalidatePath(`/learn/courses/${assignment.courseSlug}`);
  revalidatePath(`/admin/grading`);
  redirect(`/learn/courses/${assignment.courseSlug}/assignment/${lessonId}?submitted=1`);
}

/* ------------------------------------------------------------------ shared completion hook */

function completeIfFinished(userId: number, courseId: number, courseSlug: string, courseTitle: string): void {
  const outcome = maybeCompleteCourse(userId, courseId);
  if (outcome.completed && !outcome.already) {
    const certificate = issueCertificateIfEligible(userId, courseId);
    notify({
      userId,
      type: 'course_completed',
      title: `You completed ${courseTitle}`,
      body: certificate
        ? `Your certificate ${certificate.certificateId} has been issued.`
        : 'All lessons and requirements are done.',
      href: certificate ? '/learn/certificates' : `/learn/courses/${courseSlug}`,
    });
    logAudit({
      actor: null,
      action: 'course.completed',
      entityType: 'course',
      entityId: courseId,
      summary: `Course completed by user #${userId}: ${courseTitle}`,
      meta: { certificate: certificate?.certificateId ?? null },
    });
  }
}

/* ------------------------------------------------------------------ admin: grade a quiz attempt */

export async function gradeQuizAttemptAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminWriter();
  const attemptId = Number.parseInt(String(formData.get('attempt_id') ?? ''), 10);
  const attempt = attemptById(attemptId);
  if (!attempt) return { error: 'Attempt not found.' };
  if (attempt.status === 'graded') return { error: 'That attempt has already been graded.' };

  const answers = attemptAnswers(attemptId);
  const manualAnswers = answers.filter((answer) => answer.isCorrect === null);
  if (manualAnswers.length === 0) {
    return { error: 'There is nothing left to mark on this attempt.' };
  }

  let manualPoints = 0;
  for (const answer of manualAnswers) {
    const raw = formData.get(`points_${answer.questionId}`);
    const points = Math.max(0, Math.min(answer.points, Number.parseFloat(String(raw ?? '0')) || 0));
    const feedback = String(formData.get(`feedback_${answer.questionId}`) ?? '').trim();
    manualPoints += points;
    run(
      'UPDATE quiz_answers SET awarded_points = ?, is_correct = ?, feedback = ? WHERE attempt_id = ? AND question_id = ?',
      points,
      points >= answer.points / 2 ? 1 : 0,
      feedback || (points >= answer.points / 2 ? 'Marked as correct.' : 'See the model answer.'),
      attemptId,
      answer.questionId,
    );
  }

  const lesson = quizLesson(attempt.lessonId);
  const passPercent = lesson?.passPercent ?? 70;
  const outcome = attemptOutcome({
    autoPoints: attempt.autoPoints,
    manualPoints,
    maxPoints: attempt.maxPoints,
    passPercent,
  });

  run(
    `UPDATE quiz_attempts
        SET status = 'graded', manual_points = ?, total_points = ?, score_percent = ?, passed = ?,
            reviewed_at = datetime('now'), reviewed_by = ?
      WHERE id = ?`,
    manualPoints,
    outcome.totalPoints,
    outcome.scorePercent,
    outcome.passed ? 1 : 0,
    admin.id,
    attemptId,
  );

  sendMailToUser(
    attempt.userId,
    quizReviewed({
      courseTitle: attempt.courseTitle,
      lessonTitle: attempt.lessonTitle,
      scorePercent: outcome.scorePercent ?? 0,
      passed: Boolean(outcome.passed),
    }),
  );
  notify({
    userId: attempt.userId,
    type: 'quiz_reviewed',
    title: `Quiz reviewed: ${outcome.scorePercent}%`,
    body: outcome.passed ? 'You passed - well done.' : 'You can review your answers and try again.',
    href: `/learn/courses/${attempt.courseSlug}/quiz/${attempt.lessonId}?attempt=${attemptId}`,
  });

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: 'quiz.reviewed',
    entityType: 'attempt',
    entityId: attemptId,
    summary: `Marked ${manualAnswers.length} written answer(s) on "${attempt.lessonTitle}" for ${attempt.userEmail}: ${outcome.scorePercent}%`,
    meta: { manualPoints, passed: outcome.passed },
  });

  if (outcome.passed) {
    run(
      `UPDATE lesson_progress
          SET completed_at = COALESCE(completed_at, datetime('now')), updated_at = datetime('now')
        WHERE user_id = ? AND lesson_id = ?`,
      attempt.userId,
      attempt.lessonId,
    );
    completeIfFinished(attempt.userId, courseIdOfLesson(attempt.lessonId), attempt.courseSlug, attempt.courseTitle);
  }

  revalidatePath('/admin/grading');
  revalidatePath(`/learn/courses/${attempt.courseSlug}`);
  return { ok: true, message: `Marked. Final score ${outcome.scorePercent}%.` };
}

function courseIdOfLesson(lessonId: number): number {
  return queryOne<{ courseId: number }>('SELECT course_id AS courseId FROM lessons WHERE id = ?', lessonId)?.courseId ?? 0;
}

/* ------------------------------------------------------------------ admin: grade an assignment */

export async function gradeSubmissionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminWriter();
  const submissionId = Number.parseInt(String(formData.get('submission_id') ?? ''), 10);
  const submission = submissionById(submissionId);
  if (!submission) return { error: 'Submission not found.' };

  const requestResubmission = formData.get('request_resubmission') === 'on';
  const maxScore = submission.maxScore;

  const scoreRaw = String(formData.get('score') ?? '').replace(/[^\d.]/g, '');
  const score = requestResubmission ? null : Math.max(0, Math.min(maxScore, Number.parseFloat(scoreRaw) || 0));
  if (!requestResubmission && !scoreRaw) {
    return { error: 'Give a score, or tick "request resubmission".', fieldErrors: { score: 'Required' } };
  }

  const feedback = z
    .string()
    .trim()
    .min(4, 'Write some feedback - it lands in the learner inbox.')
    .max(4000)
    .safeParse(formData.get('feedback'));
  if (!feedback.success) {
    return { error: feedback.error.issues[0].message, fieldErrors: { feedback: feedback.error.issues[0].message } };
  }

  run(
    `UPDATE assignment_submissions
        SET status = ?, score = ?, feedback = ?, graded_at = datetime('now'), graded_by = ?
      WHERE id = ?`,
    requestResubmission ? 'resubmission_requested' : 'graded',
    score,
    feedback.data,
    admin.id,
    submissionId,
  );

  sendMailToUser(
    submission.userId,
    assignmentGraded({
      name: submission.userName,
      courseTitle: submission.courseTitle,
      assignmentTitle: submission.lessonTitle,
      score: score ?? 0,
      maxScore,
      feedback: feedback.data,
      resubmissionRequested: requestResubmission,
    }),
  );
  notify({
    userId: submission.userId,
    type: 'assignment_graded',
    title: requestResubmission
      ? `Resubmission requested: ${submission.lessonTitle}`
      : `Assignment graded: ${score}/${maxScore}`,
    body: feedback.data.slice(0, 160),
    href: `/learn/courses/${submission.courseSlug}/assignment/${submission.lessonId}`,
  });

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: 'submission.graded',
    entityType: 'submission',
    entityId: submissionId,
    summary: requestResubmission
      ? `Requested resubmission for "${submission.lessonTitle}" (${submission.userEmail})`
      : `Graded "${submission.lessonTitle}" for ${submission.userEmail}: ${score}/${maxScore}`,
    meta: { score, resubmission: requestResubmission },
  });

  if (!requestResubmission) {
    completeIfFinished(
      submission.userId,
      courseIdOfLesson(submission.lessonId),
      submission.courseSlug,
      submission.courseTitle,
    );
  }

  revalidatePath('/admin/grading');
  revalidatePath(`/learn/courses/${submission.courseSlug}`);
  return { ok: true, message: requestResubmission ? 'Resubmission requested.' : 'Submission graded.' };
}
