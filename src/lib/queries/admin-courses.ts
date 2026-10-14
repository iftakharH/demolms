import { query, queryOne } from '../db';

/** Admin-side course queries (everything, including drafts and archived). */

export interface AdminCourseRow {
  id: number;
  slug: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  level: string;
  pricePence: number;
  categoryName: string | null;
  instructorName: string;
  updatedAt: string;
  publishedAt: string | null;
  sectionCount: number;
  lessonCount: number;
  durationMinutes: number;
  enrolledCount: number;
  thumbnailPath: string | null;
}

export function adminCourseList(filters: { status?: string; q?: string } = {}): AdminCourseRow[] {
  const where: string[] = ['1=1'];
  const params: unknown[] = [];
  if (filters.status && ['draft', 'published', 'archived'].includes(filters.status)) {
    where.push('c.status = ?');
    params.push(filters.status);
  }
  if (filters.q) {
    where.push('(LOWER(c.title) LIKE ? OR LOWER(c.slug) LIKE ?)');
    const like = `%${filters.q.toLowerCase()}%`;
    params.push(like, like);
  }

  return query<AdminCourseRow>(
    `SELECT c.id, c.slug, c.title, c.status, c.level, c.price_pence AS pricePence,
            c.instructor_name AS instructorName, c.updated_at AS updatedAt,
            c.published_at AS publishedAt, c.thumbnail_path AS thumbnailPath,
            cat.name AS categoryName,
            (SELECT COUNT(*) FROM sections s WHERE s.course_id = c.id) AS sectionCount,
            (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessonCount,
            (SELECT COALESCE(SUM(l.duration_minutes), 0) FROM lessons l WHERE l.course_id = c.id) AS durationMinutes,
            (SELECT COUNT(*) FROM enrolments e WHERE e.course_id = c.id AND e.access_revoked = 0) AS enrolledCount
       FROM courses c
       LEFT JOIN categories cat ON cat.id = c.category_id
      WHERE ${where.join(' AND ')}
      ORDER BY c.updated_at DESC`,
    ...params,
  );
}

export interface AdminCourseStats {
  lessons: number;
  quizzes: number;
  assignments: number;
  videos: number;
  resources: number;
  questions: number;
}

export function adminCourseStats(courseId: number): AdminCourseStats {
  const row = queryOne<AdminCourseStats>(
    `SELECT
       (SELECT COUNT(*) FROM lessons WHERE course_id = ?) AS lessons,
       (SELECT COUNT(*) FROM lessons WHERE course_id = ? AND type = 'quiz') AS quizzes,
       (SELECT COUNT(*) FROM lessons WHERE course_id = ? AND type = 'assignment') AS assignments,
       (SELECT COUNT(*) FROM lessons WHERE course_id = ? AND type = 'video') AS videos,
       (SELECT COUNT(*) FROM lesson_resources WHERE course_id = ?) AS resources,
       (SELECT COUNT(*) FROM questions q JOIN lessons l ON l.id = q.lesson_id
         WHERE l.course_id = ?) AS questions`,
    courseId,
    courseId,
    courseId,
    courseId,
    courseId,
    courseId,
  );
  return row ?? { lessons: 0, quizzes: 0, assignments: 0, videos: 0, resources: 0, questions: 0 };
}

export interface AdminSection {
  id: number;
  title: string;
  sortOrder: number;
  lessons: AdminLesson[];
}

export interface AdminLesson {
  id: number;
  sectionId: number;
  title: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  sortOrder: number;
  isPreview: boolean;
  durationMinutes: number;
  videoPath: string | null;
  captionsPath: string | null;
  posterPath: string | null;
  hasBody: boolean;
  quizPassPercent: number | null;
  quizMaxAttempts: number | null;
  questionCount: number;
  resourceCount: number;
  submissionCount: number;
}

export function adminSections(courseId: number): AdminSection[] {
  const sections = query<{ id: number; title: string; sort_order: number }>(
    'SELECT id, title, sort_order FROM sections WHERE course_id = ? ORDER BY sort_order, id',
    courseId,
  );
  const lessons = query<{
    id: number;
    section_id: number;
    title: string;
    type: AdminLesson['type'];
    sort_order: number;
    is_preview: number;
    duration_minutes: number;
    video_path: string | null;
    captions_path: string | null;
    poster_path: string | null;
    body_md: string | null;
    quiz_pass_percent: number | null;
    quiz_max_attempts: number | null;
    question_count: number;
    resource_count: number;
    submission_count: number;
  }>(
    `SELECT l.id, l.section_id, l.title, l.type, l.sort_order, l.is_preview, l.duration_minutes,
            l.video_path, l.captions_path, l.poster_path, l.body_md,
            l.quiz_pass_percent, l.quiz_max_attempts,
            (SELECT COUNT(*) FROM questions q WHERE q.lesson_id = l.id) AS question_count,
            (SELECT COUNT(*) FROM lesson_resources r WHERE r.lesson_id = l.id) AS resource_count,
            (SELECT COUNT(*) FROM assignment_submissions s WHERE s.lesson_id = l.id) AS submission_count
       FROM lessons l
      WHERE l.course_id = ?
      ORDER BY l.sort_order, l.id`,
    courseId,
  );

  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    sortOrder: section.sort_order,
    lessons: lessons
      .filter((lesson) => lesson.section_id === section.id)
      .map((lesson) => ({
        id: lesson.id,
        sectionId: lesson.section_id,
        title: lesson.title,
        type: lesson.type,
        sortOrder: lesson.sort_order,
        isPreview: Boolean(lesson.is_preview),
        durationMinutes: lesson.duration_minutes,
        videoPath: lesson.video_path,
        captionsPath: lesson.captions_path,
        posterPath: lesson.poster_path,
        hasBody: Boolean(lesson.body_md && lesson.body_md.trim().length > 0),
        quizPassPercent: lesson.quiz_pass_percent,
        quizMaxAttempts: lesson.quiz_max_attempts,
        questionCount: lesson.question_count,
        resourceCount: lesson.resource_count,
        submissionCount: lesson.submission_count,
      })),
  }));
}

export interface AdminLessonDetail {
  id: number;
  courseId: number;
  sectionId: number;
  courseSlug: string;
  courseTitle: string;
  title: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  durationMinutes: number;
  isPreview: boolean;
  videoPath: string | null;
  captionsPath: string | null;
  posterPath: string | null;
  bodyMd: string | null;
  quizPassPercent: number | null;
  quizMaxAttempts: number | null;
  quizShowAnswers: boolean;
  assignmentBriefMd: string | null;
  assignmentMaxScore: number;
  assignmentAllowFiles: boolean;
}

export function adminLessonDetail(lessonId: number): AdminLessonDetail | null {
  const row = queryOne<AdminLessonDetail & { quiz_show_answers: number; assignment_allow_files: number }>(
    `SELECT l.id, l.course_id AS courseId, l.section_id AS sectionId, c.slug AS courseSlug,
            c.title AS courseTitle, l.title, l.type, l.duration_minutes AS durationMinutes,
            l.is_preview AS isPreview, l.video_path AS videoPath, l.captions_path AS captionsPath,
            l.poster_path AS posterPath, l.body_md AS bodyMd, l.quiz_pass_percent AS quizPassPercent,
            l.quiz_max_attempts AS quizMaxAttempts, l.quiz_show_answers AS quiz_show_answers,
            l.assignment_brief_md AS assignmentBriefMd, l.assignment_max_score AS assignmentMaxScore,
            l.assignment_allow_files AS assignment_allow_files
       FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.id = ?`,
    lessonId,
  );
  if (!row) return null;
  return {
    ...row,
    isPreview: Boolean(row.isPreview),
    quizShowAnswers: Boolean(row.quiz_show_answers),
    assignmentAllowFiles: Boolean(row.assignment_allow_files),
  };
}

export interface AdminQuestion {
  id: number;
  type: 'single' | 'multiple' | 'truefalse' | 'short' | 'essay';
  prompt: string;
  options: string[];
  correct: (number | string)[];
  explanation: string;
  points: number;
  sortOrder: number;
}

export function adminQuestions(lessonId: number): AdminQuestion[] {
  return query<{
    id: number;
    type: AdminQuestion['type'];
    prompt: string;
    options_json: string;
    correct_json: string;
    explanation: string;
    points: number;
    sort_order: number;
  }>(
    `SELECT id, type, prompt, options_json, correct_json, explanation, points, sort_order
       FROM questions WHERE lesson_id = ? ORDER BY sort_order, id`,
    lessonId,
  ).map((row) => {
    let options: string[] = [];
    let correct: (number | string)[] = [];
    try {
      options = JSON.parse(row.options_json) as string[];
    } catch {
      /* ignore malformed seed data */
    }
    try {
      correct = JSON.parse(row.correct_json) as (number | string)[];
    } catch {
      /* ignore malformed seed data */
    }
    return {
      id: row.id,
      type: row.type,
      prompt: row.prompt,
      options,
      correct,
      explanation: row.explanation,
      points: row.points,
      sortOrder: row.sort_order,
    };
  });
}

export interface LessonResource {
  id: number;
  title: string;
  fileId: number;
  path: string;
  originalName: string;
  sizeBytes: number;
  mime: string;
}

export function lessonResources(lessonId: number): LessonResource[] {
  return query<LessonResource>(
    `SELECT r.id, r.title, f.id AS fileId, f.path, f.original_name AS originalName,
            f.size_bytes AS sizeBytes, f.mime
       FROM lesson_resources r JOIN files f ON f.id = r.file_id
      WHERE r.lesson_id = ? ORDER BY r.id`,
    lessonId,
  );
}

export interface CategoryOption {
  id: number;
  name: string;
  slug: string;
}

export function categoryOptions(): CategoryOption[] {
  return query<CategoryOption>('SELECT id, name, slug FROM categories ORDER BY sort_order, name');
}
