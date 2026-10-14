import { query } from '@/lib/db';

export interface CourseProgressRow {
  courseId: number;
  slug: string;
  title: string;
  subtitle: string;
  thumbnailPath: string | null;
  instructorName: string;
  level: string;
  totalLessons: number;
  completedLessons: number;
  /** minutes of teaching left in this course for this learner */
  remainingMinutes: number;
  percent: number;
  lastActivityAt: string | null;
  enrolledAt: string;
  completedAt: string | null;
  accessRevoked: number;
}

/**
 * Enrolments with progress. Progress is lesson completion; access_revoked rows
 * are excluded from the learner's own views.
 */
export function enrolledCourses(userId: number): CourseProgressRow[] {
  return query<CourseProgressRow>(
    `SELECT c.id AS courseId,
            c.slug AS slug,
            c.title AS title,
            c.subtitle AS subtitle,
            c.thumbnail_path AS thumbnailPath,
            c.instructor_name AS instructorName,
            c.level AS level,
            e.enrolled_at AS enrolledAt,
            e.completed_at AS completedAt,
            e.access_revoked AS accessRevoked,
            (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS totalLessons,
            (SELECT COUNT(*) FROM lesson_progress lp
              WHERE lp.course_id = c.id AND lp.user_id = e.user_id AND lp.completed_at IS NOT NULL) AS completedLessons,
            (SELECT COALESCE(SUM(l.duration_minutes), 0) FROM lessons l
              WHERE l.course_id = c.id
                AND l.id NOT IN (
                  SELECT lp.lesson_id FROM lesson_progress lp
                   WHERE lp.user_id = e.user_id AND lp.completed_at IS NOT NULL
                )) AS remainingMinutes,
            (SELECT MAX(lp.updated_at) FROM lesson_progress lp
              WHERE lp.course_id = c.id AND lp.user_id = e.user_id) AS lastActivityAt
       FROM enrolments e
       JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ? AND e.access_revoked = 0
      ORDER BY COALESCE(lastActivityAt, e.enrolled_at) DESC`,
    userId,
  ).map((row) => ({
    ...row,
    percent: row.totalLessons > 0 ? Math.round((row.completedLessons / row.totalLessons) * 100) : 0,
  }));
}

export interface LearnerStats {
  enrolled: number;
  inProgress: number;
  completed: number;
  lessonsDone: number;
  certificates: number;
}

export function learnerStats(userId: number): LearnerStats {
  const courses = enrolledCourses(userId);
  const certificates =
    query<{ n: number }>(
      'SELECT COUNT(*) AS n FROM certificates WHERE user_id = ? AND revoked_at IS NULL',
      userId,
    )[0]?.n ?? 0;
  return {
    enrolled: courses.length,
    inProgress: courses.filter((course) => course.percent > 0 && course.percent < 100).length,
    completed: courses.filter((course) => course.percent >= 100).length,
    lessonsDone: courses.reduce((sum, course) => sum + course.completedLessons, 0),
    certificates,
  };
}
