import { query, queryOne, run } from './db';

/** Progress and completion rules for a learner on a course. */

export interface LessonProgressRow {
  lessonId: number;
  completedAt: string | null;
  videoPositionSeconds: number;
  noteBody: string | null;
  updatedAt: string | null;
}

export interface PlayerLesson {
  id: number;
  sectionId: number;
  title: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  durationMinutes: number;
  isPreview: boolean;
  sortOrder: number;
  sectionTitle: string;
  videoPath: string | null;
  captionsPath: string | null;
  posterPath: string | null;
  bodyMd: string | null;
  assignmentBriefMd: string | null;
  quizPassPercent: number | null;
  quizMaxAttempts: number | null;
  /** progress */
  completedAt: string | null;
  videoPositionSeconds: number;
  /** quiz state (latest attempt) */
  attemptCount: number;
  bestScorePercent: number | null;
  quizPassed: boolean | null;
  pendingReview: boolean;
  /** assignment state (latest submission) */
  submissionStatus: string | null;
  submissionScore: number | null;
  submissionFeedback: string | null;
  resourceCount: number;
}

export function playerLessons(userId: number, courseId: number): PlayerLesson[] {
  const rows = query<Record<string, unknown>>(
    `SELECT l.id, l.section_id, l.title, l.type, l.duration_minutes, l.is_preview, l.sort_order,
            s.title AS section_title,
            l.video_path, l.captions_path, l.poster_path, l.body_md, l.assignment_brief_md,
            l.quiz_pass_percent, l.quiz_max_attempts,
            lp.completed_at, COALESCE(lp.video_position_seconds, 0) AS video_position_seconds,
            (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.lesson_id = l.id AND qa.user_id = ?) AS attempt_count,
            (SELECT MAX(qa.score_percent) FROM quiz_attempts qa
              WHERE qa.lesson_id = l.id AND qa.user_id = ? AND qa.status = 'graded') AS best_score_percent,
            (SELECT MAX(qa.passed) FROM quiz_attempts qa
              WHERE qa.lesson_id = l.id AND qa.user_id = ? AND qa.status = 'graded') AS quiz_passed,
            (SELECT COUNT(*) FROM quiz_attempts qa
              WHERE qa.lesson_id = l.id AND qa.user_id = ? AND qa.status = 'pending_review') AS pending_review,
            (SELECT ass.status FROM assignment_submissions ass
              WHERE ass.lesson_id = l.id AND ass.user_id = ?
              ORDER BY ass.submitted_at DESC LIMIT 1) AS submission_status,
            (SELECT ass.score FROM assignment_submissions ass
              WHERE ass.lesson_id = l.id AND ass.user_id = ?
              ORDER BY ass.submitted_at DESC LIMIT 1) AS submission_score,
            (SELECT ass.feedback FROM assignment_submissions ass
              WHERE ass.lesson_id = l.id AND ass.user_id = ?
              ORDER BY ass.submitted_at DESC LIMIT 1) AS submission_feedback,
            (SELECT COUNT(*) FROM lesson_resources r WHERE r.lesson_id = l.id) AS resource_count
       FROM lessons l
       JOIN sections s ON s.id = l.section_id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
      WHERE l.course_id = ?
      ORDER BY s.sort_order, s.id, l.sort_order, l.id`,
    userId,
    userId,
    userId,
    userId,
    userId,
    userId,
    userId,
    userId,
    courseId,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    sectionId: Number(row.section_id),
    title: String(row.title),
    type: row.type as PlayerLesson['type'],
    durationMinutes: Number(row.duration_minutes ?? 0),
    isPreview: Boolean(row.is_preview),
    sortOrder: Number(row.sort_order ?? 0),
    sectionTitle: String(row.section_title),
    videoPath: (row.video_path as string | null) ?? null,
    captionsPath: (row.captions_path as string | null) ?? null,
    posterPath: (row.poster_path as string | null) ?? null,
    bodyMd: (row.body_md as string | null) ?? null,
    assignmentBriefMd: (row.assignment_brief_md as string | null) ?? null,
    quizPassPercent: (row.quiz_pass_percent as number | null) ?? null,
    quizMaxAttempts: (row.quiz_max_attempts as number | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    videoPositionSeconds: Number(row.video_position_seconds ?? 0),
    attemptCount: Number(row.attempt_count ?? 0),
    bestScorePercent: (row.best_score_percent as number | null) ?? null,
    quizPassed: row.quiz_passed === null || row.quiz_passed === undefined ? null : Boolean(row.quiz_passed),
    pendingReview: Number(row.pending_review ?? 0) > 0,
    submissionStatus: (row.submission_status as string | null) ?? null,
    submissionScore: (row.submission_score as number | null) ?? null,
    submissionFeedback: (row.submission_feedback as string | null) ?? null,
    resourceCount: Number(row.resource_count ?? 0),
  }));
}

export interface CourseCompletion {
  totalLessons: number;
  completedLessons: number;
  percent: number;
  lessonsDone: boolean;
  quizRequirementMet: boolean;
  assignmentRequirementMet: boolean;
  complete: boolean;
  nextLessonId: number | null;
}

/** Single source of truth for "has this learner finished the course?". */
export function courseCompletion(userId: number, courseId: number): CourseCompletion {
  const course = queryOne<{ requires_quiz_pass: number; requires_assignments: number }>(
    'SELECT requires_quiz_pass, requires_assignments FROM courses WHERE id = ?',
    courseId,
  );
  const lessons = playerLessons(userId, courseId);

  const totalLessons = lessons.length;
  const completedLessons = lessons.filter((lesson) => lesson.completedAt).length;

  const quizLessons = lessons.filter((lesson) => lesson.type === 'quiz');
  const quizRequirementMet = quizLessons.every((lesson) => lesson.quizPassed === true);

  const assignmentLessons = lessons.filter((lesson) => lesson.type === 'assignment');
  const assignmentRequirementMet = assignmentLessons.every(
    (lesson) => lesson.submissionStatus === 'graded',
  );

  const lessonsDone = totalLessons > 0 && completedLessons === totalLessons;
  const needsQuizzes = Boolean(course?.requires_quiz_pass) && quizLessons.length > 0;
  const needsAssignments = Boolean(course?.requires_assignments) && assignmentLessons.length > 0;

  return {
    totalLessons,
    completedLessons,
    percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    lessonsDone,
    quizRequirementMet,
    assignmentRequirementMet,
    complete:
      lessonsDone &&
      (!needsQuizzes || quizRequirementMet) &&
      (!needsAssignments || assignmentRequirementMet),
    nextLessonId: lessons.find((lesson) => !lesson.completedAt)?.id ?? null,
  };
}

/** Mark a lesson complete (idempotent). */
export function markLessonComplete(userId: number, courseId: number, lessonId: number): void {
  run(
    `INSERT INTO lesson_progress (user_id, lesson_id, course_id, completed_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(user_id, lesson_id)
     DO UPDATE SET completed_at = COALESCE(lesson_progress.completed_at, datetime('now')),
                   updated_at = datetime('now')`,
    userId,
    lessonId,
    courseId,
  );
}

export function unmarkLessonComplete(userId: number, lessonId: number): void {
  run(
    'UPDATE lesson_progress SET completed_at = NULL, updated_at = datetime(\'now\') WHERE user_id = ? AND lesson_id = ?',
    userId,
    lessonId,
  );
}

export function saveVideoPosition(
  userId: number,
  courseId: number,
  lessonId: number,
  positionSeconds: number,
): void {
  const position = Math.max(0, Math.min(86_400, Math.round(positionSeconds)));
  run(
    `INSERT INTO lesson_progress (user_id, lesson_id, course_id, video_position_seconds, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, lesson_id)
     DO UPDATE SET video_position_seconds = excluded.video_position_seconds,
                   updated_at = datetime('now')`,
    userId,
    lessonId,
    courseId,
    position,
  );
}

/**
 * Called after every completion change. Sets completed_at exactly once and
 * notifies the learner; certificate issuance hooks in on top of this.
 */
export function maybeCompleteCourse(userId: number, courseId: number): { completed: boolean; already: boolean } {
  const completion = courseCompletion(userId, courseId);
  const enrolment = queryOne<{ id: number; completed_at: string | null }>(
    'SELECT id, completed_at FROM enrolments WHERE user_id = ? AND course_id = ?',
    userId,
    courseId,
  );
  if (!enrolment) return { completed: false, already: false };

  if (!completion.complete) return { completed: false, already: Boolean(enrolment.completed_at) };
  if (enrolment.completed_at) return { completed: true, already: true };

  run("UPDATE enrolments SET completed_at = datetime('now') WHERE id = ?", enrolment.id);
  return { completed: true, already: false };
}

export interface LessonNote {
  id: number;
  lessonId: number;
  lessonTitle: string;
  body: string;
  updatedAt: string;
}

export function courseNotes(userId: number, courseId: number): LessonNote[] {
  return query<LessonNote>(
    `SELECT n.id, n.lesson_id AS lessonId, l.title AS lessonTitle, n.body, n.updated_at AS updatedAt
       FROM lesson_notes n
       JOIN lessons l ON l.id = n.lesson_id
      WHERE n.user_id = ? AND n.course_id = ? AND LENGTH(TRIM(n.body)) > 0
      ORDER BY n.updated_at DESC`,
    userId,
    courseId,
  );
}

export function saveNote(userId: number, courseId: number, lessonId: number, body: string): void {
  run(
    `INSERT INTO lesson_notes (user_id, lesson_id, course_id, body, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, lesson_id)
     DO UPDATE SET body = excluded.body, updated_at = datetime('now')`,
    userId,
    lessonId,
    courseId,
    body.slice(0, 20_000),
  );
}

/** Enrolment guard used by the player, the progress API and resource downloads. */
export function activeEnrolment(userId: number, courseId: number) {
  return queryOne<{ id: number; source: string; completed_at: string | null }>(
    'SELECT id, source, completed_at FROM enrolments WHERE user_id = ? AND course_id = ? AND access_revoked = 0',
    userId,
    courseId,
  );
}

/* ------------------------------------------------------------------ learner-facing summaries */

export interface LearnerCourseSummary {
  enrolled: boolean;
  accessRevoked: boolean;
  source: string | null;
  completedLessons: number;
  totalLessons: number;
  percent: number;
  nextLesson: { id: number; title: string; type: PlayerLesson['type']; durationMinutes: number } | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  certificateId: string | null;
}

/**
 * Everything a "you already own this" surface needs, in one place: progress,
 * the lesson to pick up next, and the certificate if there is one.
 */
export function learnerCourseSummary(userId: number, courseId: number): LearnerCourseSummary {
  const enrolment = queryOne<{
    source: string;
    access_revoked: number;
    completed_at: string | null;
  }>(
    'SELECT source, access_revoked, completed_at FROM enrolments WHERE user_id = ? AND course_id = ?',
    userId,
    courseId,
  );

  const lessons = playerLessons(userId, courseId);
  const completedLessons = lessons.filter((lesson) => lesson.completedAt).length;
  const next =
    lessons.find((lesson) => !lesson.completedAt) ??
    lessons[lessons.length - 1] ??
    null;

  const lastActivity = queryOne<{ last: string | null }>(
    'SELECT MAX(updated_at) AS last FROM lesson_progress WHERE user_id = ? AND course_id = ?',
    userId,
    courseId,
  )?.last ?? null;

  const certificate = queryOne<{ certificate_id: string; revoked_at: string | null }>(
    'SELECT certificate_id, revoked_at FROM certificates WHERE user_id = ? AND course_id = ?',
    userId,
    courseId,
  );

  return {
    enrolled: Boolean(enrolment && enrolment.access_revoked === 0),
    accessRevoked: Boolean(enrolment?.access_revoked),
    source: enrolment?.source ?? null,
    completedLessons,
    totalLessons: lessons.length,
    percent: lessons.length > 0 ? Math.round((completedLessons / lessons.length) * 100) : 0,
    nextLesson: next
      ? { id: next.id, title: next.title, type: next.type, durationMinutes: next.durationMinutes }
      : null,
    lastActivityAt: lastActivity,
    completedAt: enrolment?.completed_at ?? null,
    certificateId: certificate && !certificate.revoked_at ? certificate.certificate_id : null,
  };
}

export interface EnrolledCourseProgress {
  percent: number;
  completedLessons: number;
  totalLessons: number;
  completed: boolean;
}

/**
 * Progress for every course a learner is enrolled on, keyed by course id.
 * Used by catalogue cards so an owned course shows progress instead of a price.
 */
export function enrolledCourseProgress(userId: number): Map<number, EnrolledCourseProgress> {
  const rows = query<{
    courseId: number;
    completedLessons: number;
    totalLessons: number;
    completedAt: string | null;
  }>(
    `SELECT e.course_id AS courseId,
            (SELECT COUNT(*) FROM lesson_progress lp
              WHERE lp.course_id = e.course_id AND lp.user_id = e.user_id
                AND lp.completed_at IS NOT NULL) AS completedLessons,
            (SELECT COUNT(*) FROM lessons l WHERE l.course_id = e.course_id) AS totalLessons,
            e.completed_at AS completedAt
       FROM enrolments e
      WHERE e.user_id = ? AND e.access_revoked = 0`,
    userId,
  );

  const map = new Map<number, EnrolledCourseProgress>();
  for (const row of rows) {
    map.set(row.courseId, {
      percent: row.totalLessons > 0 ? Math.round((row.completedLessons / row.totalLessons) * 100) : 0,
      completedLessons: row.completedLessons,
      totalLessons: row.totalLessons,
      completed: Boolean(row.completedAt),
    });
  }
  return map;
}

/** Pending work for the dashboard: quizzes awaiting review + ungraded submissions. */
export interface PendingWork {
  kind: 'quiz' | 'assignment';
  lessonId: number;
  lessonTitle: string;
  courseSlug: string;
  courseTitle: string;
  detail: string;
  status: string;
}

export function pendingWork(userId: number, limit = 5): PendingWork[] {
  const quizzes = query<PendingWork>(
    `SELECT 'quiz' AS kind, l.id AS lessonId, l.title AS lessonTitle,
            c.slug AS courseSlug, c.title AS courseTitle,
            'Awaiting instructor review' AS detail, 'pending_review' AS status
       FROM quiz_attempts qa
       JOIN lessons l ON l.id = qa.lesson_id
       JOIN courses c ON c.id = l.course_id
      WHERE qa.user_id = ? AND qa.status = 'pending_review'`,
    userId,
  );
  const assignments = query<PendingWork>(
    `SELECT 'assignment' AS kind, l.id AS lessonId, l.title AS lessonTitle,
            c.slug AS courseSlug, c.title AS courseTitle,
            'Submitted - waiting to be graded' AS detail, ass.status AS status
       FROM assignment_submissions ass
       JOIN lessons l ON l.id = ass.lesson_id
       JOIN courses c ON c.id = l.course_id
      WHERE ass.user_id = ? AND ass.status = 'submitted'`,
    userId,
  );
  return [...quizzes, ...assignments].slice(0, limit);
}
