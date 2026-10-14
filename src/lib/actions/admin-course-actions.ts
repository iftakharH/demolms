'use server';

import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminWriter } from '@/lib/auth';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { query, queryOne, run } from '@/lib/db';
import { slugify } from '@/lib/ids';
import { removeUpload, saveUpload, UploadError } from '@/lib/uploads';
import { notifyAllLearners } from '@/lib/notify';
import { sendMail } from '@/lib/mailer';
import { coursePublishedAnnouncement } from '@/lib/email-templates';
import { usersWithPreference } from '@/lib/auth';
import type { FormState } from '@/lib/action-state';

/* ------------------------------------------------------------------ helpers */

const QUESTION_AUDIT = 'course.question_saved';

interface CourseRow {
  id: number;
  slug: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  price_pence: number;
  subtitle: string;
}

function courseBySlugOrThrow(slug: string): CourseRow {
  const course = queryOne<CourseRow>(
    'SELECT id, slug, title, status, price_pence, subtitle FROM courses WHERE slug = ?',
    slug,
  );
  if (!course) notFound();
  return course;
}

function revalidateCourse(slug: string): void {
  revalidatePath(`/admin/courses/${slug}`);
  revalidatePath('/admin/courses');
  revalidatePath('/courses');
  revalidatePath(`/courses/${slug}`);
  revalidatePath('/');
}

function uniqueSlug(base: string, excludeId?: number): string {
  let candidate = slugify(base) || 'course';
  let suffix = 2;
  for (;;) {
    const clash = queryOne<{ id: number }>(
      'SELECT id FROM courses WHERE slug = ? AND id != ?',
      candidate,
      excludeId ?? -1,
    );
    if (!clash) return candidate;
    candidate = `${slugify(base)}-${suffix}`;
    suffix += 1;
  }
}

function parsePoundsToPence(value: FormDataEntryValue | null): number {
  const raw = String(value ?? '').trim().replace(/[£,\s]/g, '');
  if (!raw) return 0;
  const pounds = Number.parseFloat(raw);
  if (!Number.isFinite(pounds) || pounds < 0) return 0;
  return Math.round(pounds * 100);
}

/* ------------------------------------------------------------------ courses */

const courseSettingsSchema = z.object({
  title: z.string().trim().min(3, 'Give the course a title').max(160),
  subtitle: z.string().trim().max(200).optional().default(''),
  description: z.string().trim().max(20000).optional().default(''),
  categoryId: z.string().optional().default(''),
  instructorName: z.string().trim().min(2, 'Add an instructor name').max(120),
  instructorBio: z.string().trim().max(4000).optional().default(''),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  tags: z.string().max(400).optional().default(''),
  outcomes: z.string().max(4000).optional().default(''),
  requirements: z.string().max(2000).optional().default(''),
  certificateEnabled: z.boolean(),
  requiresQuizPass: z.boolean(),
  requiresAssignments: z.boolean(),
});

export async function createCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminWriter();

  const title = z.string().trim().min(3, 'Give the course a title').max(160).safeParse(formData.get('title'));
  if (!title.success) {
    return { error: title.error.issues[0].message, fieldErrors: { title: title.error.issues[0].message } };
  }
  const categoryId = Number.parseInt(String(formData.get('category_id') ?? ''), 10) || null;
  const level = String(formData.get('level') ?? 'beginner');
  const pricePence = parsePoundsToPence(formData.get('price'));

  const slug = uniqueSlug(title.data);
  const info = run(
    `INSERT INTO courses (slug, title, subtitle, description_md, category_id, instructor_name,
                          instructor_bio_md, level, price_pence, thumbnail_path, tags, outcomes_md,
                          requirements_md, status, certificate_enabled, requires_quiz_pass, requires_assignments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'draft', 1, 0, 1)`,
    slug,
    title.data,
    '',
    '',
    categoryId,
    admin.name,
    '',
    ['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'beginner',
    pricePence,
    '',
    '',
    '',
  );
  const courseId = Number(info.lastInsertRowid);

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.courseCreated,
    entityType: 'course',
    entityId: courseId,
    summary: `Created course "${title.data}" (draft)`,
    meta: { slug, pricePence },
  });

  revalidatePath('/admin/courses');
  redirect(`/admin/courses/${slug}`);
}

export async function updateCourseSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const course = courseBySlugOrThrow(slug);

  const parsed = courseSettingsSchema.safeParse({
    title: formData.get('title'),
    subtitle: formData.get('subtitle') ?? '',
    description: formData.get('description') ?? '',
    categoryId: formData.get('category_id') ?? '',
    instructorName: formData.get('instructor_name'),
    instructorBio: formData.get('instructor_bio') ?? '',
    level: formData.get('level'),
    tags: formData.get('tags') ?? '',
    outcomes: formData.get('outcomes') ?? '',
    requirements: formData.get('requirements') ?? '',
    certificateEnabled: formData.get('certificate_enabled') === 'on',
    requiresQuizPass: formData.get('requires_quiz_pass') === 'on',
    requiresAssignments: formData.get('requires_assignments') === 'on',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }

  const data = parsed.data;
  const pricePence = parsePoundsToPence(formData.get('price'));

  let thumbnailPath: string | null | undefined;
  const thumbnail = formData.get('thumbnail');
  if (thumbnail instanceof File && thumbnail.size > 0) {
    try {
      const stored = await saveUpload(thumbnail, 'thumbnail', admin.id);
      if (stored) {
        // Note: the previous thumbnail file is intentionally left on disk. Seeded
        // covers are shared between courses, and deleting a file another row still
        // references would break it. A real product would garbage-collect safely.
        thumbnailPath = stored.path;
      }
    } catch (error) {
      if (error instanceof UploadError) return { error: error.message };
      throw error;
    }
  }

  const categoryId = Number.parseInt(data.categoryId, 10);

  const base = [
    'title = ?',
    'subtitle = ?',
    'description_md = ?',
    'category_id = ?',
    'instructor_name = ?',
    'instructor_bio_md = ?',
    'level = ?',
    'price_pence = ?',
    'tags = ?',
    'outcomes_md = ?',
    'requirements_md = ?',
    'certificate_enabled = ?',
    'requires_quiz_pass = ?',
    'requires_assignments = ?',
  ];
  const values: unknown[] = [
    data.title,
    data.subtitle,
    data.description,
    Number.isFinite(categoryId) ? categoryId : null,
    data.instructorName,
    data.instructorBio,
    data.level,
    pricePence,
    data.tags,
    data.outcomes,
    data.requirements,
    data.certificateEnabled ? 1 : 0,
    data.requiresQuizPass ? 1 : 0,
    data.requiresAssignments ? 1 : 0,
  ];

  if (thumbnailPath !== undefined) {
    base.push('thumbnail_path = ?');
    values.push(thumbnailPath);
  }

  // an optional rename (slug stays stable unless the admin changes it deliberately)
  const requestedSlug = String(formData.get('new_slug') ?? '').trim();
  let newSlug: string | null = null;
  if (requestedSlug && slugify(requestedSlug) !== slug) {
    newSlug = uniqueSlug(requestedSlug, course.id);
    base.push('slug = ?');
    values.push(newSlug);
  }

  base.push("updated_at = datetime('now')");
  run(`UPDATE courses SET ${base.join(', ')} WHERE id = ?`, ...values, course.id);

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.courseUpdated,
    entityType: 'course',
    entityId: course.id,
    summary: `Updated course settings for "${data.title}"`,
    meta: { pricePence, slugChanged: Boolean(newSlug) },
  });

  revalidateCourse(newSlug ?? slug);
  if (newSlug) redirect(`/admin/courses/${newSlug}?saved=1`);
  return { ok: true, message: 'Course settings saved.' };
}

export async function setCourseStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const status = String(formData.get('status') ?? '');
  const course = courseBySlugOrThrow(slug);
  if (!['draft', 'published', 'archived'].includes(status)) return;

  const lessonCount =
    queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM lessons WHERE course_id = ?', course.id)?.n ?? 0;
  const sectionCount =
    queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM sections WHERE course_id = ?', course.id)?.n ?? 0;
  const questionCount =
    queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM questions q JOIN lessons l ON l.id = q.lesson_id WHERE l.course_id = ?`,
      course.id,
    )?.n ?? 0;

  // publishing needs something to publish
  if (status === 'published' && (sectionCount === 0 || lessonCount === 0 || questionCount === 0)) {
    redirect(
      `/admin/courses/${slug}?error=${encodeURIComponent(
        'A course needs at least one section, one lesson and one quiz question before it can be published.',
      )}`,
    );
  }

  run(
    `UPDATE courses
        SET status = ?,
            published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, datetime('now')) ELSE published_at END,
            updated_at = datetime('now')
      WHERE id = ?`,
    status,
    status,
    course.id,
  );

  const action =
    status === 'published'
      ? AUDIT_ACTIONS.coursePublished
      : status === 'archived'
        ? AUDIT_ACTIONS.courseArchived
        : AUDIT_ACTIONS.courseUpdated;

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action,
    entityType: 'course',
    entityId: course.id,
    summary: `Course "${course.title}" set to ${status}`,
  });

  if (status === 'published') {
    // in-app + email announcement to learners who opted in
    notifyAllLearners({
      type: 'course_published',
      title: `New course: ${course.title}`,
      body: course.subtitle,
      href: `/courses/${slug}`,
    });
    for (const learner of usersWithPreference('marketing')) {
      sendMail(
        learner.email,
        coursePublishedAnnouncement({
          name: learner.name,
          courseTitle: course.title,
          courseSlug: slug,
          summary: course.subtitle,
        }),
      );
    }
  }

  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}?saved=1`);
}

export async function deleteCourseAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const course = courseBySlugOrThrow(slug);

  if (course.status !== 'draft') {
    redirect(
      `/admin/courses/${slug}?error=${encodeURIComponent(
        'Only draft courses can be deleted. Archive published courses instead.',
      )}`,
    );
  }

  // remove uploaded files belonging to the course
  const files = query<{ path: string }>(
    `SELECT f.path FROM files f
      WHERE f.uploaded_by IS NOT NULL AND f.id IN (
        SELECT r.file_id FROM lesson_resources r WHERE r.course_id = ?
        UNION SELECT f2.id FROM files f2 WHERE f2.path IN (
          SELECT l.video_path FROM lessons l WHERE l.course_id = ?
          UNION SELECT l.captions_path FROM lessons l WHERE l.course_id = ?
          UNION SELECT l.poster_path FROM lessons l WHERE l.course_id = ?
        )
      )`,
    course.id,
    course.id,
    course.id,
    course.id,
  );

  run('DELETE FROM courses WHERE id = ?', course.id);
  for (const file of files) removeUpload(file.path);

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.courseDeleted,
    entityType: 'course',
    entityId: course.id,
    summary: `Deleted draft course "${course.title}"`,
  });

  revalidatePath('/admin/courses');
  revalidatePath('/courses');
  redirect('/admin/courses?deleted=1');
}

/* ------------------------------------------------------------------ sections */

export async function createSectionAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const title = z.string().trim().min(2).max(160).safeParse(formData.get('title'));
  const course = courseBySlugOrThrow(slug);
  if (!title.success) {
    redirect(`/admin/courses/${slug}?error=${encodeURIComponent('Give the section a title.')}`);
  }

  const next =
    (queryOne<{ n: number | null }>(
      'SELECT MAX(sort_order) AS n FROM sections WHERE course_id = ?',
      course.id,
    )?.n ?? -1) + 1;

  run('INSERT INTO sections (course_id, title, sort_order) VALUES (?, ?, ?)', course.id, title.data, next);

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.sectionCreated,
    entityType: 'course',
    entityId: course.id,
    summary: `Added section "${title.data}" to "${course.title}"`,
  });
  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}?saved=1#sections`);
}

export async function updateSectionAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const sectionId = Number.parseInt(String(formData.get('section_id') ?? ''), 10);
  const title = z.string().trim().min(2).max(160).safeParse(formData.get('title'));
  if (!title.success) redirect(`/admin/courses/${slug}?error=${encodeURIComponent('Invalid section title.')}`);

  run('UPDATE sections SET title = ? WHERE id = ?', title.data, sectionId);
  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.courseUpdated,
    entityType: 'section',
    entityId: sectionId,
    summary: `Renamed section to "${title.data}"`,
  });
  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}?saved=1#sections`);
}

export async function moveSectionAction(formData: FormData): Promise<void> {
  await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const sectionId = Number.parseInt(String(formData.get('section_id') ?? ''), 10);
  const direction = String(formData.get('direction') ?? 'up');
  const course = courseBySlugOrThrow(slug);

  const sections = query<{ id: number; sort_order: number }>(
    'SELECT id, sort_order FROM sections WHERE course_id = ? ORDER BY sort_order, id',
    course.id,
  );
  const index = sections.findIndex((section) => section.id === sectionId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index >= 0 && swapWith >= 0 && swapWith < sections.length) {
    const a = sections[index];
    const b = sections[swapWith];
    run('UPDATE sections SET sort_order = ? WHERE id = ?', b.sort_order === a.sort_order ? swapWith : b.sort_order, a.id);
    run('UPDATE sections SET sort_order = ? WHERE id = ?', a.sort_order === b.sort_order ? index : a.sort_order, b.id);
  }
  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}#sections`);
}

export async function deleteSectionAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const sectionId = Number.parseInt(String(formData.get('section_id') ?? ''), 10);
  const course = courseBySlugOrThrow(slug);

  const submissions =
    queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM assignment_submissions s
        JOIN lessons l ON l.id = s.lesson_id WHERE l.section_id = ?`,
      sectionId,
    )?.n ?? 0;
  if (submissions > 0) {
    redirect(
      `/admin/courses/${slug}?error=${encodeURIComponent(
        'That section has learner submissions, so it cannot be deleted. Archive the course instead.',
      )}`,
    );
  }

  run('DELETE FROM sections WHERE id = ? AND course_id = ?', sectionId, course.id);
  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.courseUpdated,
    entityType: 'section',
    entityId: sectionId,
    summary: `Deleted a section from "${course.title}"`,
  });
  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}#sections`);
}

/* ------------------------------------------------------------------ lessons */

export async function createLessonAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const sectionId = Number.parseInt(String(formData.get('section_id') ?? ''), 10);
  const type = String(formData.get('type') ?? 'text');
  const title = z.string().trim().min(2).max(180).safeParse(formData.get('title'));
  const course = courseBySlugOrThrow(slug);

  if (!title.success || !['video', 'text', 'quiz', 'assignment'].includes(type)) {
    redirect(`/admin/courses/${slug}?error=${encodeURIComponent('Add a lesson title and type.')}`);
  }

  const next =
    (queryOne<{ n: number | null }>(
      'SELECT MAX(sort_order) AS n FROM lessons WHERE section_id = ?',
      sectionId,
    )?.n ?? -1) + 1;

  const info = run(
    `INSERT INTO lessons (course_id, section_id, title, type, sort_order, duration_minutes,
                          body_md, quiz_pass_percent, quiz_max_attempts, assignment_max_score)
     VALUES (?, ?, ?, ?, ?, 10, '', 70, 3, 100)`,
    course.id,
    sectionId,
    title.data,
    type,
    next,
  );

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.lessonCreated,
    entityType: 'lesson',
    entityId: Number(info.lastInsertRowid),
    summary: `Added ${type} lesson "${title.data}" to "${course.title}"`,
  });
  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}/lessons/${Number(info.lastInsertRowid)}`);
}

export async function moveLessonAction(formData: FormData): Promise<void> {
  await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);
  const direction = String(formData.get('direction') ?? 'up');

  const lesson = queryOne<{ id: number; section_id: number; sort_order: number; course_id: number }>(
    'SELECT id, section_id, sort_order, course_id FROM lessons WHERE id = ?',
    lessonId,
  );
  if (lesson) {
    const siblings = query<{ id: number; sort_order: number }>(
      'SELECT id, sort_order FROM lessons WHERE section_id = ? ORDER BY sort_order, id',
      lesson.section_id,
    );
    const index = siblings.findIndex((item) => item.id === lessonId);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith >= 0 && swapWith < siblings.length) {
      const other = siblings[swapWith];
      run('UPDATE lessons SET sort_order = ? WHERE id = ?', other.sort_order === lesson.sort_order ? swapWith : other.sort_order, lesson.id);
      run('UPDATE lessons SET sort_order = ? WHERE id = ?', lesson.sort_order === other.sort_order ? index : lesson.sort_order, other.id);
    }
  }
  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}#sections`);
}

export async function deleteLessonAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);

  const submissions =
    queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM assignment_submissions WHERE lesson_id = ?',
      lessonId,
    )?.n ?? 0;
  const attempts =
    queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM quiz_attempts WHERE lesson_id = ?', lessonId)?.n ?? 0;

  if (submissions > 0 || attempts > 0) {
    redirect(
      `/admin/courses/${slug}?error=${encodeURIComponent(
        'That lesson already has learner attempts or submissions, so it cannot be deleted.',
      )}`,
    );
  }

  run('DELETE FROM lessons WHERE id = ?', lessonId);
  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.lessonDeleted,
    entityType: 'lesson',
    entityId: lessonId,
    summary: `Deleted lesson #${lessonId}`,
  });
  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}#sections`);
}

/* ------------------------------------------------------------------ lesson editor */

export async function updateLessonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminWriter();
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);
  const slug = String(formData.get('slug') ?? '');
  const lesson = queryOne<{ id: number; type: string; course_id: number; title: string }>(
    'SELECT id, type, course_id, title FROM lessons WHERE id = ?',
    lessonId,
  );
  if (!lesson) notFound();

  const title = z.string().trim().min(2, 'Give the lesson a title').max(180).safeParse(formData.get('title'));
  if (!title.success) {
    return { error: title.error.issues[0].message, fieldErrors: { title: title.error.issues[0].message } };
  }
  const duration = Math.max(0, Math.min(600, Number.parseInt(String(formData.get('duration') ?? '10'), 10) || 0));
  const isPreview = formData.get('is_preview') === 'on';

  const updates: string[] = ['title = ?', 'duration_minutes = ?', 'is_preview = ?'];
  const values: unknown[] = [title.data, duration, isPreview ? 1 : 0];

  // ---- type specific fields
  if (lesson.type === 'text') {
    updates.push('body_md = ?');
    values.push(String(formData.get('body_md') ?? ''));
  }

  if (lesson.type === 'quiz') {
    updates.push('quiz_pass_percent = ?', 'quiz_max_attempts = ?', 'quiz_show_answers = ?');
    values.push(
      Math.max(0, Math.min(100, Number.parseInt(String(formData.get('pass_percent') ?? '70'), 10) || 70)),
      Math.max(1, Math.min(20, Number.parseInt(String(formData.get('max_attempts') ?? '3'), 10) || 3)),
      formData.get('show_answers') === 'on' ? 1 : 0,
    );
  }

  if (lesson.type === 'assignment') {
    updates.push('assignment_brief_md = ?', 'assignment_max_score = ?', 'assignment_allow_files = ?');
    values.push(
      String(formData.get('brief_md') ?? ''),
      Math.max(1, Math.min(1000, Number.parseInt(String(formData.get('max_score') ?? '100'), 10) || 100)),
      formData.get('allow_files') === 'on' ? 1 : 0,
    );
  }

  // ---- video uploads (optional)
  if (lesson.type === 'video') {
    const uploads: { field: string; purpose: 'video' | 'captions' | 'poster' }[] = [
      { field: 'video', purpose: 'video' },
      { field: 'captions', purpose: 'captions' },
      { field: 'poster', purpose: 'poster' },
    ];
    for (const upload of uploads) {
      const file = formData.get(upload.field);
      if (file instanceof File && file.size > 0) {
        try {
          const stored = await saveUpload(file, upload.purpose, admin.id);
          if (stored) {
            updates.push(`${upload.field}_path = ?`);
            values.push(stored.path);
            logAudit({
              actor: { id: admin.id, email: admin.email, role: admin.role },
              action: AUDIT_ACTIONS.fileUploaded,
              entityType: 'lesson',
              entityId: lessonId,
              summary: `Uploaded ${upload.purpose} (${stored.originalName}) for lesson "${title.data}"`,
              meta: { path: stored.path, size: stored.size },
            });
          }
        } catch (error) {
          if (error instanceof UploadError) return { error: error.message };
          throw error;
        }
      }
    }
  }

  updates.push("updated_at = datetime('now')");
  run(`UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`, ...values, lessonId);

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.lessonUpdated,
    entityType: 'lesson',
    entityId: lessonId,
    summary: `Updated ${lesson.type} lesson "${title.data}"`,
  });

  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}/lessons/${lessonId}?saved=1`);
}

export async function addResourceAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);
  const title = String(formData.get('title') ?? '').trim();
  const file = formData.get('file');
  const course = courseBySlugOrThrow(slug);

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/admin/courses/${slug}/lessons/${lessonId}?error=${encodeURIComponent('Choose a file to upload.')}`);
  }

  try {
    const stored = await saveUpload(file, 'resource', admin.id);
    if (stored) {
      run(
        'INSERT INTO lesson_resources (lesson_id, course_id, file_id, title) VALUES (?, ?, ?, ?)',
        lessonId,
        course.id,
        stored.id,
        title || stored.originalName,
      );
      logAudit({
        actor: { id: admin.id, email: admin.email, role: admin.role },
        action: AUDIT_ACTIONS.fileUploaded,
        entityType: 'lesson',
        entityId: lessonId,
        summary: `Uploaded resource "${title || stored.originalName}" to "${course.title}"`,
        meta: { path: stored.path, size: stored.size },
      });
    }
  } catch (error) {
    if (error instanceof UploadError) {
      redirect(`/admin/courses/${slug}/lessons/${lessonId}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}/lessons/${lessonId}?saved=1`);
}

export async function deleteResourceAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);
  const resourceId = Number.parseInt(String(formData.get('resource_id') ?? ''), 10);

  const resource = queryOne<{ file_id: number; title: string; path: string }>(
    `SELECT r.file_id, r.title, f.path FROM lesson_resources r JOIN files f ON f.id = r.file_id
      WHERE r.id = ?`,
    resourceId,
  );
  if (resource) {
    run('DELETE FROM lesson_resources WHERE id = ?', resourceId);
    const stillUsed =
      queryOne<{ n: number }>(
        'SELECT COUNT(*) AS n FROM lesson_resources WHERE file_id = ?',
        resource.file_id,
      )?.n ?? 0;
    run('DELETE FROM files WHERE id = ?', resource.file_id);
    if (stillUsed === 0) removeUpload(resource.path);

    logAudit({
      actor: { id: admin.id, email: admin.email, role: admin.role },
      action: AUDIT_ACTIONS.lessonUpdated,
      entityType: 'lesson',
      entityId: lessonId,
      summary: `Removed resource "${resource.title}"`,
    });
  }

  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}/lessons/${lessonId}?saved=1`);
}

/* ------------------------------------------------------------------ quiz builder */

export async function saveQuestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminWriter();
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);
  const slug = String(formData.get('slug') ?? '');
  const questionId = Number.parseInt(String(formData.get('question_id') ?? ''), 10);
  const type = String(formData.get('type') ?? 'single');
  const prompt = z.string().trim().min(4, 'Write the question').max(2000).safeParse(formData.get('prompt'));
  const explanation = String(formData.get('explanation') ?? '').trim();
  const points = Math.max(1, Math.min(50, Number.parseInt(String(formData.get('points') ?? '1'), 10) || 1));

  if (!prompt.success || !['single', 'multiple', 'truefalse', 'short', 'essay'].includes(type)) {
    return { error: 'Please write the question and choose a type.' };
  }

  const options = formData
    .getAll('options')
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);

  let correctJson = '[]';
  if (type === 'truefalse') {
    correctJson = JSON.stringify([Number.parseInt(String(formData.get('truefalse_correct') ?? '0'), 10) === 1 ? 1 : 0]);
  } else if (type === 'single' || type === 'multiple') {
    const selected = formData.getAll('correct_index').map((value) => Number.parseInt(String(value), 10));
    const valid = selected.filter((index) => Number.isInteger(index) && index >= 0 && index < options.length);
    if (options.length < 2) return { error: 'Choice questions need at least two options.' };
    if (valid.length === 0) return { error: 'Select at least one correct option.' };
    if (type === 'single' && valid.length > 1) return { error: 'Single choice questions take exactly one answer.' };
    correctJson = JSON.stringify(valid);
  } else if (type === 'short') {
    const accepted = String(formData.get('accepted') ?? '')
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    if (accepted.length === 0) return { error: 'Add at least one accepted answer (one per line).' };
    correctJson = JSON.stringify(accepted);
  } else {
    correctJson = '[]';
  }

  const optionsJson =
    type === 'truefalse' ? JSON.stringify(['True', 'False']) : JSON.stringify(options);

  if (Number.isFinite(questionId) && questionId > 0) {
    run(
      `UPDATE questions SET type = ?, prompt = ?, options_json = ?, correct_json = ?, explanation = ?, points = ?
        WHERE id = ?`,
      type,
      prompt.data,
      optionsJson,
      correctJson,
      explanation,
      points,
      questionId,
    );
  } else {
    const next =
      (queryOne<{ n: number | null }>(
        'SELECT MAX(sort_order) AS n FROM questions WHERE lesson_id = ?',
        lessonId,
      )?.n ?? -1) + 1;
    run(
      `INSERT INTO questions (lesson_id, type, prompt, options_json, correct_json, explanation, points, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      lessonId,
      type,
      prompt.data,
      optionsJson,
      correctJson,
      explanation,
      points,
      next,
    );
  }

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: QUESTION_AUDIT,
    entityType: 'lesson',
    entityId: lessonId,
    summary: `${Number.isFinite(questionId) && questionId > 0 ? 'Updated' : 'Added'} ${type} question on lesson #${lessonId}`,
  });

  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}/lessons/${lessonId}?saved=1#questions`);
}

export async function deleteQuestionAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const slug = String(formData.get('slug') ?? '');
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);
  const questionId = Number.parseInt(String(formData.get('question_id') ?? ''), 10);

  const answered =
    queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM quiz_answers WHERE question_id = ?', questionId)?.n ?? 0;
  if (answered > 0) {
    redirect(
      `/admin/courses/${slug}/lessons/${lessonId}?error=${encodeURIComponent(
        'That question has already been answered by learners and cannot be deleted.',
      )}`,
    );
  }

  run('DELETE FROM questions WHERE id = ?', questionId);
  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: QUESTION_AUDIT,
    entityType: 'lesson',
    entityId: lessonId,
    summary: `Deleted question #${questionId}`,
  });
  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}/lessons/${lessonId}?saved=1#questions`);
}
