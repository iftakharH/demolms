import { query, queryOne } from '../db';

/** Course catalogue queries. Only published courses are ever public. */

export interface CourseCard {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  categoryName: string | null;
  categorySlug: string | null;
  instructorName: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  pricePence: number;
  thumbnailPath: string | null;
  tags: string[];
  featured: boolean;
  status: 'draft' | 'published' | 'archived';
  lessonCount: number;
  durationMinutes: number;
  enrolledCount: number;
  publishedAt: string | null;
}

export type CatalogDuration = 'short' | 'long';

export interface CatalogFilters {
  q?: string;
  category?: string;
  level?: string;
  price?: 'free' | 'paid';
  duration?: CatalogDuration;
  sort?: 'newest' | 'popular' | 'price-asc' | 'price-desc' | 'title';
  page?: number;
  perPage?: number;
}

export interface CatalogResult {
  courses: CourseCard[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface CourseRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  description_md: string;
  category_name: string | null;
  category_slug: string | null;
  instructor_name: string;
  level: CourseCard['level'];
  price_pence: number;
  thumbnail_path: string | null;
  tags: string;
  featured: number;
  status: CourseCard['status'];
  lesson_count: number;
  duration_minutes: number;
  enrolled_count: number;
  published_at: string | null;
}

const CARD_SELECT = `
  SELECT c.id, c.slug, c.title, c.subtitle, c.description_md, c.instructor_name, c.level,
         c.price_pence, c.thumbnail_path, c.tags, c.featured, c.status, c.published_at,
         cat.name AS category_name, cat.slug AS category_slug,
         (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count,
         (SELECT COALESCE(SUM(l.duration_minutes), 0) FROM lessons l WHERE l.course_id = c.id) AS duration_minutes,
         (SELECT COUNT(*) FROM enrolments e WHERE e.course_id = c.id AND e.access_revoked = 0) AS enrolled_count
    FROM courses c
    LEFT JOIN categories cat ON cat.id = c.category_id
`;

function toCard(row: CourseRow): CourseCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description_md,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    instructorName: row.instructor_name,
    level: row.level,
    pricePence: row.price_pence,
    thumbnailPath: row.thumbnail_path,
    tags: row.tags ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
    featured: Boolean(row.featured),
    status: row.status,
    lessonCount: row.lesson_count,
    durationMinutes: row.duration_minutes,
    enrolledCount: row.enrolled_count,
    publishedAt: row.published_at,
  };
}

function durationClause(duration: CatalogFilters['duration']): { sql: string; params: unknown[] } {
  const total = '(SELECT COALESCE(SUM(l.duration_minutes),0) FROM lessons l WHERE l.course_id = c.id)';
  switch (duration) {
    case 'short':
      return { sql: `${total} < 60`, params: [] };
    case 'long':
      return { sql: `${total} >= 60`, params: [] };
    default:
      return { sql: '', params: [] };
  }
}

function orderClause(sort: CatalogFilters['sort']): string {
  switch (sort) {
    case 'popular':
      return 'ORDER BY enrolled_count DESC, c.published_at DESC';
    case 'price-asc':
      return 'ORDER BY c.price_pence ASC, c.title ASC';
    case 'price-desc':
      return 'ORDER BY c.price_pence DESC, c.title ASC';
    case 'title':
      return 'ORDER BY c.title ASC';
    default:
      return 'ORDER BY c.featured DESC, c.published_at DESC';
  }
}

export function catalog(filters: CatalogFilters = {}): CatalogResult {
  const perPage = Math.min(24, Math.max(3, filters.perPage ?? 6));
  const page = Math.max(1, filters.page ?? 1);

  const where: string[] = ["c.status = 'published'"];
  const params: unknown[] = [];

  if (filters.q) {
    const like = `%${filters.q.trim().toLowerCase()}%`;
    where.push(
      '(LOWER(c.title) LIKE ? OR LOWER(c.subtitle) LIKE ? OR LOWER(c.description_md) LIKE ? OR LOWER(c.tags) LIKE ?)',
    );
    params.push(like, like, like, like);
  }
  if (filters.category) {
    where.push('cat.slug = ?');
    params.push(filters.category);
  }
  if (filters.level && ['beginner', 'intermediate', 'advanced'].includes(filters.level)) {
    where.push('c.level = ?');
    params.push(filters.level);
  }
  if (filters.price === 'free') where.push('c.price_pence = 0');
  if (filters.price === 'paid') where.push('c.price_pence > 0');

  const duration = durationClause(filters.duration);
  if (duration.sql) where.push(duration.sql.replace(/^AND /, ''));
  params.push(...duration.params);

  const whereSql = where.join(' AND ');

  const total =
    queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM courses c LEFT JOIN categories cat ON cat.id = c.category_id WHERE ${whereSql}`,
      ...params,
    )?.n ?? 0;

  const rows = query<CourseRow>(
    `${CARD_SELECT} WHERE ${whereSql} ${orderClause(filters.sort)} LIMIT ? OFFSET ?`,
    ...params,
    perPage,
    (page - 1) * perPage,
  );

  return {
    courses: rows.map(toCard),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export function featuredCourses(limit = 3): CourseCard[] {
  return query<CourseRow>(
    `${CARD_SELECT} WHERE c.status = 'published' AND c.featured = 1
      ORDER BY c.published_at DESC LIMIT ?`,
    limit,
  ).map(toCard);
}

export function newestCourses(limit = 6): CourseCard[] {
  return query<CourseRow>(
    `${CARD_SELECT} WHERE c.status = 'published' ORDER BY c.published_at DESC LIMIT ?`,
    limit,
  ).map(toCard);
}

export interface CategorySummary {
  id: number;
  name: string;
  slug: string;
  description: string;
  courseCount: number;
}

export function categoriesWithCounts(): CategorySummary[] {
  return query<CategorySummary>(
    `SELECT cat.id, cat.name, cat.slug, cat.description,
            (SELECT COUNT(*) FROM courses c WHERE c.category_id = cat.id AND c.status = 'published') AS courseCount
       FROM categories cat
      ORDER BY cat.sort_order, cat.name`,
  );
}

export interface LessonOutline {
  id: number;
  title: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  durationMinutes: number;
  isPreview: boolean;
  sortOrder: number;
}

export interface SectionOutline {
  id: number;
  title: string;
  sortOrder: number;
  lessons: LessonOutline[];
}

export interface CourseDetail extends CourseCard {
  descriptionMd: string;
  outcomes: string[];
  requirements: string;
  instructorBio: string;
  certificateEnabled: boolean;
  requiresQuizPass: boolean;
  requiresAssignments: boolean;
  sections: SectionOutline[];
  previewLessonCount: number;
}

export function courseBySlug(slug: string, options: { includeUnpublished?: boolean } = {}): CourseDetail | null {
  const statusClause = options.includeUnpublished ? '' : " AND c.status = 'published'";
  const row = queryOne<CourseRow>(
    `${CARD_SELECT} WHERE c.slug = ?${statusClause}`,
    slug,
  );
  if (!row) return null;

  const sections = query<{ id: number; title: string; sort_order: number }>(
    'SELECT id, title, sort_order FROM sections WHERE course_id = ? ORDER BY sort_order, id',
    row.id,
  );
  const lessons = query<{
    id: number;
    section_id: number;
    title: string;
    type: LessonOutline['type'];
    duration_minutes: number;
    is_preview: number;
    sort_order: number;
  }>(
    `SELECT id, section_id, title, type, duration_minutes, is_preview, sort_order
       FROM lessons WHERE course_id = ? ORDER BY sort_order, id`,
    row.id,
  );

  const outline: SectionOutline[] = sections.map((section) => ({
    id: section.id,
    title: section.title,
    sortOrder: section.sort_order,
    lessons: lessons
      .filter((lesson) => lesson.section_id === section.id)
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        durationMinutes: lesson.duration_minutes,
        isPreview: Boolean(lesson.is_preview),
        sortOrder: lesson.sort_order,
      })),
  }));

  const course = queryOne<{
    description_md: string;
    outcomes_md: string;
    requirements_md: string;
    instructor_bio_md: string;
    certificate_enabled: number;
    requires_quiz_pass: number;
    requires_assignments: number;
  }>(
    `SELECT description_md, outcomes_md, requirements_md, instructor_bio_md,
            certificate_enabled, requires_quiz_pass, requires_assignments
       FROM courses WHERE id = ?`,
    row.id,
  )!;

  return {
    ...toCard(row),
    descriptionMd: course.description_md,
    outcomes: course.outcomes_md.split('\n').map((line) => line.trim()).filter(Boolean),
    requirements: course.requirements_md,
    instructorBio: course.instructor_bio_md,
    certificateEnabled: Boolean(course.certificate_enabled),
    requiresQuizPass: Boolean(course.requires_quiz_pass),
    requiresAssignments: Boolean(course.requires_assignments),
    sections: outline,
    previewLessonCount: lessons.filter((lesson) => lesson.is_preview).length,
  };
}

export function relatedCourses(course: CourseCard, limit = 3): CourseCard[] {
  return query<CourseRow>(
    `${CARD_SELECT}
      WHERE c.status = 'published' AND c.id != ?
        AND (c.category_id = (SELECT category_id FROM courses WHERE id = ?) OR c.category_id IS NULL)
      ORDER BY (SELECT COUNT(*) FROM enrolments e WHERE e.course_id = c.id AND e.access_revoked = 0) DESC
      LIMIT ?`,
    course.id,
    course.id,
    limit,
  ).map(toCard);
}

export interface PreviewLesson {
  id: number;
  title: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  durationMinutes: number;
  bodyMd: string | null;
  videoPath: string | null;
  captionsPath: string | null;
  posterPath: string | null;
}

export function previewLesson(lessonId: number): { lesson: PreviewLesson; course: { slug: string; title: string } } | null {
  const lesson = queryOne<PreviewLesson & { course_slug: string; course_title: string }>(
    `SELECT l.id, l.title, l.type, l.duration_minutes, l.body_md AS bodyMd,
            l.video_path AS videoPath, l.captions_path AS captionsPath, l.poster_path AS posterPath,
            c.slug AS course_slug, c.title AS course_title
       FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.id = ? AND l.is_preview = 1 AND c.status = 'published'`,
    lessonId,
  );
  if (!lesson) return null;
  const { course_slug, course_title, ...rest } = lesson;
  return { lesson: rest, course: { slug: course_slug, title: course_title } };
}

/** Tag cloud for the catalogue sidebar. */
export function popularTags(limit = 12): { tag: string; count: number }[] {
  const rows = query<{ tags: string }>("SELECT tags FROM courses WHERE status = 'published'");
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of row.tags.split(',').map((value) => value.trim()).filter(Boolean)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/** Used by the sitemap. */
export function allPublishedCourseSlugs(): { slug: string; updatedAt: string }[] {
  return query<{ slug: string; updatedAt: string }>(
    "SELECT slug, updated_at AS updatedAt FROM courses WHERE status = 'published' ORDER BY updated_at DESC",
  );
}
