/**
 * Seeds (or re-seeds) the demo database. `npm run seed` always resets.
 * `src/db/ensure.ts` calls runSeed() only when the database is empty.
 *
 * Everything here is synthetic demo data. Nothing talks to a network.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import PDFDocument from 'pdfkit';
import { getDb } from '../lib/db';
import { newCertificateId, newOrderPublicId, sha256, token } from '../lib/ids';
import { STORAGE_ROOT } from '../lib/uploads';
import { button, emailShell, p } from '../lib/email-templates';
import {
  SEED_CATEGORIES,
  SEED_COURSES,
  SAMPLE_VIDEO,
  SAMPLE_CAPTIONS,
  type SeedCourse,
  type SeedLesson,
} from './seed-content';

export const DEMO_PASSWORD = 'Demo1234!';
/** Demo-only TOTP secrets. The app prints the current valid code in dev mode. */
export const ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
export const AUDITOR_TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
export const WEBHOOK_SECRET = 'whsec_demo_local_secret';

const TABLES = [
  'audit_log',
  'emails',
  'notifications',
  'certificates',
  'assignment_submissions',
  'quiz_answers',
  'quiz_attempts',
  'lesson_resources',
  'files',
  'orders',
  'webhook_events',
  'coupons',
  'lesson_notes',
  'lesson_progress',
  'enrolments',
  'questions',
  'lessons',
  'sections',
  'courses',
  'categories',
  'auth_tokens',
  'sessions',
  'rate_limits',
  'settings',
  'users',
];

/* ------------------------------------------------------------------ helpers */

/** 'YYYY-MM-DD HH:MM:SS' UTC, matching datetime('now'). */
function ts(daysAgo = 0, minutesAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000 - minutesAgo * 60_000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function orderPublicId(): string {
  return newOrderPublicId();
}

/* ------------------------------------------------------------------ assets */

const VTT = `WEBVTT

00:00:00.000 --> 00:00:05.000
Welcome to this sample lesson.

00:00:05.000 --> 00:00:11.500
Everything here runs locally: no CDN, no external service, no API keys.

00:00:11.500 --> 00:00:17.500
Your playback position is saved every few seconds.

00:00:17.500 --> 00:00:24.000
Close the tab and come back - the player resumes right where you stopped.
`;

async function writePdf(
  relPath: string,
  build: (doc: PDFKit.PDFDocument) => void,
): Promise<void> {
  const abs = path.join(STORAGE_ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 56,
      info: { Title: path.basename(relPath), Author: 'demolms (demo)' },
    });
    const stream = fs.createWriteStream(abs);
    doc.pipe(stream);
    build(doc);
    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}

function pdfHeader(doc: PDFKit.PDFDocument, kicker: string, title: string) {
  doc.fillColor('#6c4cf1').font('Helvetica-Bold').fontSize(9).text(kicker.toUpperCase(), {
    characterSpacing: 1.4,
  });
  doc.moveDown(0.35);
  doc.fillColor('#1b1a24').font('Helvetica-Bold').fontSize(20).text(title);
  doc.moveDown(0.3);
  doc
    .moveTo(doc.x, doc.y)
    .lineTo(doc.page.width - 56, doc.y)
    .strokeColor('#e8e7f0')
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.9);
}

function pdfFooter(doc: PDFKit.PDFDocument) {
  const y = doc.page.height - 48;
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#7c7a8c')
    .text('demolms demo resource - generated locally, for demonstration only', 56, y, {
      width: doc.page.width - 112,
      align: 'center',
    });
}

function pdfSection(doc: PDFKit.PDFDocument, heading: string, body: string[]) {
  doc.fillColor('#1b1a24').font('Helvetica-Bold').fontSize(12.5).text(heading);
  doc.moveDown(0.4);
  for (const line of body) {
    doc.fillColor('#2e2c3a').font('Helvetica').fontSize(10.5).text(line, { lineGap: 3 });
    doc.moveDown(0.5);
  }
  doc.moveDown(0.4);
}

function pdfCode(doc: PDFKit.PDFDocument, code: string) {
  const x = doc.x;
  const y = doc.y;
  const width = doc.page.width - 112;
  const lines = code.split('\n');
  const height = lines.length * 13 + 18;
  doc.save().roundedRect(x, y, width, height, 8).fill('#171631').restore();
  doc.fillColor('#c9c1fb').font('Courier').fontSize(9).text(code, x + 12, y + 9, {
    width: width - 24,
    lineGap: 3.5,
  });
  doc.y = y + height + 12;
  doc.fillColor('#2e2c3a').font('Helvetica');
}

async function writeAllAssets(): Promise<void> {
  // Covers are generative now (components/course/course-art.tsx) and no longer
  // written to disk: seeded courses carry thumbnail_path = null and draw their own.

  // captions + a generic assignment brief sample (zip placeholder is a text file)
  fs.mkdirSync(path.join(STORAGE_ROOT, 'videos'), { recursive: true });
  fs.writeFileSync(path.join(STORAGE_ROOT, 'videos', 'sample.vtt'), VTT, 'utf8');

  // resources (PDF)
  await writePdf('resources/typescript-cheatsheet.pdf', (doc) => {
    pdfHeader(doc, 'TypeScript for Production Teams', 'TypeScript cheat-sheet');
    pdfSection(doc, 'Narrowing you will actually use', [
      'Narrow with typeof, instanceof, in and discriminated unions before reaching for a cast.',
      'Every `as` is a promise you are making to the compiler. Keep the list short.',
    ]);
    pdfCode(
      doc,
      `type Result<T> =\n  | { ok: true; value: T }\n  | { ok: false; error: string };\n\nfunction unwrap<T>(r: Result<T>): T {\n  if (!r.ok) throw new Error(r.error);\n  return r.value;\n}`,
    );
    pdfSection(doc, 'The five utility types worth memorising', [
      'Partial<T> - every property optional. Omit<T, K> - drop keys.',
      'Pick<T, K> - keep keys. Record<K, V> - map a key union to values.',
      'ReturnType<typeof fn> - derive instead of duplicating.',
    ]);
    pdfSection(doc, 'Strict flags, in migration order', [
      '1. strictNullChecks  2. noImplicitAny  3. strictFunctionTypes',
      '4. noImplicitThis  5. strictBindCallApply  6. exactOptionalPropertyTypes',
    ]);
    pdfFooter(doc);
  });

  await writePdf('resources/migration-worksheet.pdf', (doc) => {
    pdfHeader(doc, 'TypeScript for Production Teams', 'Migration worksheet');
    pdfSection(doc, 'Step 1 - Baseline', [
      'Turn on `allowJs` and `checkJs: false`. Add `// @ts-check` to one leaf module and fix it.',
      'Commit. This is the only step that must land before anything else.',
    ]);
    pdfSection(doc, 'Step 2 - Boundary types', [
      'Type the edges first: HTTP clients, database rows, third-party payloads.',
      'Do not type internals yet - they will fall out of the boundaries.',
    ]);
    pdfSection(doc, 'Step 3 - Rename and fix', [
      'Rename one file per pull request. Keep the diff under 300 lines.',
      'Ban `any` in review with a comment: `// eslint-disable-next-line` is a red flag, not a fix.',
    ]);
    pdfSection(doc, 'Step 4 - Turn up strictness', [
      'Enable strictNullChecks. Fix. Then noImplicitAny. Fix. Ship each step separately.',
    ]);
    pdfSection(doc, 'Step 5 - Keep it strict', [
      'Add `tsc --noEmit` to CI. A migration that CI does not enforce is already reverting.',
    ]);
    pdfFooter(doc);
  });

  await writePdf('resources/dashboard-rubric.pdf', (doc) => {
    pdfHeader(doc, 'Data Storytelling & Dashboards', 'One-page dashboard rubric');
    pdfSection(doc, 'Marking guide (100 points)', [
      'Question stated in one sentence (15) - would a new joiner understand what this page answers?',
      'Headline metric is the decision, not the data (20) - one number, one comparison.',
      'Chart choices justified (20) - form follows the question; no dual axes, no 3D.',
      'Hierarchy and layout (20) - the eye lands on the answer first, on mobile too.',
      'Commentary leads to an action (25) - says what changed, why, and what to do next.',
    ]);
    pdfSection(doc, 'Automatic deductions', [
      '-10 for a truncated bar axis. -15 for a pie chart with more than four slices.',
      '-20 for a dashboard with no stated question anywhere on the page.',
    ]);
    pdfFooter(doc);
  });

  fs.writeFileSync(
    path.join(STORAGE_ROOT, 'resources', 'starter-code.txt'),
    'Starter module for the migration assignment.\n' +
      'Placeholder text file standing in for a .zip in this demo.\n',
    'utf8',
  );
}

/* ------------------------------------------------------------------ seed */

interface SeedUser {
  email: string;
  name: string;
  role: 'learner' | 'admin' | 'auditor';
  verified: boolean;
  isActive?: boolean;
  totp?: string;
  lastLoginDaysAgo?: number;
  joinedDaysAgo: number;
  prefs?: Record<string, boolean>;
}

const USERS: SeedUser[] = [
  { email: 'learner@demo.test', name: 'Alex Morgan', role: 'learner', verified: true, lastLoginDaysAgo: 0, joinedDaysAgo: 45 },
  { email: 'admin@demo.test', name: 'Imogen Clark', role: 'admin', verified: true, totp: ADMIN_TOTP_SECRET, lastLoginDaysAgo: 0, joinedDaysAgo: 60 },
  { email: 'auditor@demo.test', name: 'Sam Okonkwo', role: 'auditor', verified: true, totp: AUDITOR_TOTP_SECRET, lastLoginDaysAgo: 2, joinedDaysAgo: 30 },
  { email: 'ravi@demo.test', name: 'Ravi Patel', role: 'learner', verified: true, lastLoginDaysAgo: 3, joinedDaysAgo: 26 },
  { email: 'grace@demo.test', name: 'Grace Adeyemi', role: 'learner', verified: true, lastLoginDaysAgo: 1, joinedDaysAgo: 9 },
  { email: 'newbie@demo.test', name: 'Noor Shah', role: 'learner', verified: false, joinedDaysAgo: 1 },
];

export async function runSeed(log: (msg: string) => void = console.log): Promise<void> {
  const db = getDb();

  // ---- reset --------------------------------------------------------
  db.pragma('foreign_keys = OFF');
  for (const table of TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`);
  const schema = fs.readFileSync(path.join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf8');
  db.exec(schema);
  db.pragma('foreign_keys = ON');

  await writeAllAssets();
  log('  assets: covers, captions, resource PDFs written to public/uploads');

  const insert = (table: string, data: Record<string, unknown>): number => {
    const keys = Object.keys(data);
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys
      .map((k) => `@${k}`)
      .join(', ')})`;
    const info = db.prepare(sql).run(data as never);
    return Number(info.lastInsertRowid);
  };

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  // ---- categories ---------------------------------------------------
  const categoryIds = new Map<string, number>();
  SEED_CATEGORIES.forEach((category, i) => {
    categoryIds.set(
      category.slug,
      insert('categories', {
        name: category.name,
        slug: category.slug,
        description: category.description,
        sort_order: i,
      }),
    );
  });
  log(`  ${SEED_CATEGORIES.length} categories`);

  // ---- users --------------------------------------------------------
  const userIds = new Map<string, number>();
  for (const user of USERS) {
    const id = insert('users', {
      email: user.email,
      name: user.name,
      password_hash: passwordHash,
      role: user.role,
      is_active: user.isActive === false ? 0 : 1,
      email_verified_at: user.verified ? ts(40) : null,
      last_login_at: user.lastLoginDaysAgo !== undefined ? ts(user.lastLoginDaysAgo) : null,
      totp_secret: user.totp ?? null,
      totp_confirmed_at: user.totp ? ts(45) : null,
      email_prefs_json: JSON.stringify(
        user.prefs ?? { receipts: true, grades: true, certificates: true, marketing: false },
      ),
      created_at: ts(user.joinedDaysAgo),
      updated_at: ts(Math.min(user.joinedDaysAgo, 10)),
    });
    userIds.set(user.email, id);
  }
  log(`  ${USERS.length} users`);

  // pending verification email for the unverified demo account
  {
    const newbie = userIds.get('newbie@demo.test')!;
    const raw = token();
    insert('auth_tokens', {
      user_id: newbie,
      kind: 'verify_email',
      token_hash: sha256(raw),
      expires_at: ts(-1, -0),
      created_at: ts(1),
    });
    insert('emails', {
      to_email: 'newbie@demo.test',
      to_user_id: newbie,
      template: 'verify_email',
      subject: 'Confirm your email address',
      body_html: emailShell(
        'Welcome to demolms, Noor',
        p('One click and your account is ready. This link is valid for 24 hours.') +
          button(`/verify-email?token=${raw}`, 'Verify my email') +
          p('<span style="color:#7c7a8c;font-size:12px">If you did not create an account, ignore this email.</span>'),
      ),
      created_at: ts(1),
    });
  }

  // a still-valid password reset email for the main learner
  {
    const alex = userIds.get('learner@demo.test')!;
    const raw = token();
    insert('auth_tokens', {
      user_id: alex,
      kind: 'reset_password',
      token_hash: sha256(raw),
      expires_at: ts(-1),
      created_at: ts(0, 20),
    });
    insert('emails', {
      to_email: 'learner@demo.test',
      to_user_id: alex,
      template: 'reset_password',
      subject: 'Reset your password',
      body_html: emailShell(
        'Reset your password',
        p('We received a request to reset the password for your demolms account.') +
          button(`/reset-password?token=${raw}`, 'Choose a new password') +
          p('<span style="color:#7c7a8c;font-size:12px">This link expires in 1 hour. If you did not ask for it, no action is needed.</span>'),
      ),
      created_at: ts(0, 20),
    });
  }

  // ---- courses ------------------------------------------------------
  const courseIds = new Map<string, number>();
  const resourceFiles: { title: string; rel: string; lessonId: number }[] = [];

  const insertLesson = (
    courseId: number,
    sectionId: number,
    lesson: SeedLesson,
    sortOrder: number,
  ): number => {
    const id = insert('lessons', {
      course_id: courseId,
      section_id: sectionId,
      title: lesson.title,
      type: lesson.type,
      sort_order: sortOrder,
      is_preview: lesson.isPreview ? 1 : 0,
      duration_minutes: lesson.duration,
      video_path: lesson.type === 'video' ? (lesson.video ?? SAMPLE_VIDEO) : null,
      captions_path: lesson.type === 'video' ? (lesson.captions ?? SAMPLE_CAPTIONS) : null,
      poster_path: lesson.type === 'video' ? 'videos/sample-poster.jpg' : null,
      body_md: lesson.type === 'text' ? (lesson.body ?? '') : null,
      quiz_pass_percent: lesson.quiz?.passPercent ?? null,
      quiz_max_attempts: lesson.quiz?.maxAttempts ?? null,
      quiz_show_answers: lesson.quiz?.showAnswers ? 1 : 0,
      assignment_brief_md: lesson.assignment?.brief ?? null,
      assignment_max_score: lesson.assignment?.maxScore ?? 100,
      assignment_allow_files: lesson.assignment?.allowFiles ? 1 : 0,
      created_at: ts(30),
      updated_at: ts(30),
    });

    if (lesson.quiz) {
      lesson.quiz.questions.forEach((question, qi) => {
        insert('questions', {
          lesson_id: id,
          type: question.type,
          prompt: question.prompt,
          options_json: JSON.stringify(question.options ?? []),
          correct_json: JSON.stringify(question.correct ?? []),
          explanation: question.explanation ?? '',
          points: question.points ?? 1,
          sort_order: qi,
        });
      });
    }

    for (const resource of lesson.resources ?? []) {
      resourceFiles.push({
        title: resource.title,
        rel: resource.file,
        // attach to the lesson we just created, not via a shared key map
        lessonId: id,
      });
    }
    return id;
  };

  SEED_COURSES.forEach((course: SeedCourse, courseIndex: number) => {
    const publishedAt = course.status === 'published' ? ts(35 - courseIndex * 2) : null;
    const courseId = insert('courses', {
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      description_md: course.description,
      category_id: categoryIds.get(course.category) ?? null,
      instructor_name: course.instructor,
      instructor_bio_md: course.instructorBio,
      level: course.level,
      price_pence: course.pricePence,
      thumbnail_path: null,
      tags: course.tags.join(','),
      outcomes_md: course.outcomes.join('\n'),
      requirements_md: course.requirements,
      status: course.status,
      featured: course.featured ? 1 : 0,
      certificate_enabled: course.certificateEnabled ? 1 : 0,
      requires_quiz_pass: course.requiresQuizPass ? 1 : 0,
      requires_assignments: course.requiresAssignments ? 1 : 0,
      published_at: publishedAt,
      created_at: ts(38 - courseIndex),
      updated_at: ts(10),
    });
    courseIds.set(course.slug, courseId);

    course.sections.forEach((section, si) => {
      const sectionId = insert('sections', {
        course_id: courseId,
        title: section.title,
        sort_order: si,
      });
      section.lessons.forEach((lesson, li) => {
        insertLesson(courseId, sectionId, lesson, li);
      });
    });
  });
  log(`  ${SEED_COURSES.length} courses with sections, lessons and quiz questions`);

  // resource files rows + lesson links
  for (const resource of resourceFiles) {
    const fileId = insert('files', {
      path: resource.rel,
      original_name: path.basename(resource.rel),
      mime: resource.rel.endsWith('.pdf') ? 'application/pdf' : 'text/plain',
      size_bytes: fs.existsSync(path.join(STORAGE_ROOT, resource.rel))
        ? fs.statSync(path.join(STORAGE_ROOT, resource.rel)).size
        : 0,
      purpose: 'resource',
      uploaded_by: userIds.get('admin@demo.test') ?? null,
      created_at: ts(28),
    });
    const courseId =
      (
        db.prepare('SELECT course_id AS courseId FROM lessons WHERE id = ?').get(resource.lessonId) as
          | { courseId: number }
          | undefined
      )?.courseId ?? 0;
    insert('lesson_resources', {
      lesson_id: resource.lessonId,
      course_id: courseId,
      file_id: fileId,
      title: resource.title,
      created_at: ts(28),
    });
  }

  // ---- enrolments + progress ---------------------------------------
  const courseLessons = (slug: string): { id: number; type: string; duration: number }[] =>
    db
      .prepare(
        `SELECT l.id, l.type, l.duration_minutes AS duration
           FROM lessons l
           JOIN sections s ON s.id = l.section_id
           JOIN courses c ON c.id = l.course_id
          WHERE c.slug = ?
          ORDER BY s.sort_order, s.id, l.sort_order, l.id`,
      )
      .all(slug) as { id: number; type: string; duration: number }[];

  const setProgress = (
    userId: number,
    courseId: number,
    lessonId: number,
    daysAgo: number,
    videoPosition?: number,
    completed = true,
  ) => {
    insert('lesson_progress', {
      user_id: userId,
      lesson_id: lessonId,
      course_id: courseId,
      completed_at: completed ? ts(daysAgo) : null,
      video_position_seconds: videoPosition ?? 0,
      updated_at: ts(daysAgo, 5),
    });
  };

  const enrol = (
    email: string,
    slug: string,
    source: string,
    daysAgo: number,
    completedAt: string | null = null,
    revoked = false,
    revokedReason: string | null = null,
  ): number => {
    const id = insert('enrolments', {
      user_id: userIds.get(email)!,
      course_id: courseIds.get(slug)!,
      source,
      access_revoked: revoked ? 1 : 0,
      revoked_reason: revokedReason,
      enrolled_at: ts(daysAgo),
      completed_at: completedAt,
    });
    return id;
  };

  const alex = userIds.get('learner@demo.test')!;
  const ravi = userIds.get('ravi@demo.test')!;
  const grace = userIds.get('grace@demo.test')!;
  const admin = userIds.get('admin@demo.test')!;
  const auditor = userIds.get('auditor@demo.test')!;

  // Alex: TypeScript (partial, video mid-way for the resume demo)
  {
    const courseId = courseIds.get('typescript-for-production-teams')!;
    enrol('learner@demo.test', 'typescript-for-production-teams', 'purchase', 20);
    const lessons = courseLessons('typescript-for-production-teams');
    setProgress(alex, courseId, lessons[0].id, 19);
    setProgress(alex, courseId, lessons[1].id, 19);
    // second video lesson, watched most of the way and abandoned: the resume demo
    // (the bundled sample clip is 24 seconds long)
    setProgress(alex, courseId, lessons[2].id, 18, 14, false);
    insert('lesson_notes', {
      user_id: alex,
      lesson_id: lessons[0].id,
      course_id: courseId,
      body: 'Key takeaway: `strict` is a family of flags, not one switch. Enable strictNullChecks first.',
      created_at: ts(19),
      updated_at: ts(19),
    });
    insert('lesson_notes', {
      user_id: alex,
      lesson_id: lessons[3].id,
      course_id: courseId,
      body: 'Discriminated unions for the payment state machine - revisit before the assignment.',
      created_at: ts(18, 40),
      updated_at: ts(18, 40),
    });
  }

  // Alex: Figma (partial)
  {
    const courseId = courseIds.get('clean-product-design-figma')!;
    enrol('learner@demo.test', 'clean-product-design-figma', 'purchase', 12);
    const lessons = courseLessons('clean-product-design-figma');
    setProgress(alex, courseId, lessons[0].id, 11);
    setProgress(alex, courseId, lessons[1].id, 11, 44, false);
  }

  // Alex: JavaScript (completed, certificate issued)
  {
    const courseId = courseIds.get('javascript-fundamentals')!;
    enrol('learner@demo.test', 'javascript-fundamentals', 'free', 30, ts(10));
    const lessons = courseLessons('javascript-fundamentals');
    lessons.forEach((lesson, i) => setProgress(alex, courseId, lesson.id, 12 + i, undefined, true));
  }

  // Alex: Dashboards (refunded, access revoked)
  {
    const courseId = courseIds.get('data-storytelling-dashboards')!;
    enrol('learner@demo.test', 'data-storytelling-dashboards', 'purchase', 8, null, true, 'Refunded: duplicate purchase');
    const lessons = courseLessons('data-storytelling-dashboards');
    setProgress(alex, courseId, lessons[0].id, 8);
  }

  // Ravi: TypeScript (paid with coupon) with an assignment waiting to be graded
  {
    const courseId = courseIds.get('typescript-for-production-teams')!;
    enrol('ravi@demo.test', 'typescript-for-production-teams', 'purchase', 25);
    const lessons = courseLessons('typescript-for-production-teams');
    setProgress(ravi, courseId, lessons[0].id, 24);
    setProgress(ravi, courseId, lessons[1].id, 24);
    setProgress(ravi, courseId, lessons[2].id, 23);
    setProgress(ravi, courseId, lessons[3].id, 22);
  }

  // Ravi: Dashboards (paid), quiz + assignment awaiting review
  {
    const courseId = courseIds.get('data-storytelling-dashboards')!;
    enrol('ravi@demo.test', 'data-storytelling-dashboards', 'purchase', 15);
    const lessons = courseLessons('data-storytelling-dashboards');
    setProgress(ravi, courseId, lessons[0].id, 14);
    setProgress(ravi, courseId, lessons[1].id, 14);
    setProgress(ravi, courseId, lessons[2].id, 13);
  }

  // Ravi: JavaScript (free, completed, certificate)
  {
    const courseId = courseIds.get('javascript-fundamentals')!;
    enrol('ravi@demo.test', 'javascript-fundamentals', 'free', 28, ts(20));
    const lessons = courseLessons('javascript-fundamentals');
    lessons.forEach((lesson, i) => setProgress(ravi, courseId, lesson.id, 22 + i, undefined, true));
  }

  // Grace: SQL (free, partial) and Design Systems (paid, partial)
  {
    const sqlCourse = courseIds.get('sql-for-analysts')!;
    enrol('grace@demo.test', 'sql-for-analysts', 'free', 9);
    const sqlLessons = courseLessons('sql-for-analysts');
    setProgress(grace, sqlCourse, sqlLessons[0].id, 9);
    setProgress(grace, sqlCourse, sqlLessons[1].id, 8, 0, false);

    const dsCourse = courseIds.get('design-systems-that-scale')!;
    enrol('grace@demo.test', 'design-systems-that-scale', 'purchase', 6);
    const dsLessons = courseLessons('design-systems-that-scale');
    setProgress(grace, dsCourse, dsLessons[0].id, 6);
    setProgress(grace, dsCourse, dsLessons[1].id, 5, 61, false);
  }

  // Grace: JavaScript (free) with assignment awaiting grading
  {
    const courseId = courseIds.get('javascript-fundamentals')!;
    enrol('grace@demo.test', 'javascript-fundamentals', 'free', 4);
    const lessons = courseLessons('javascript-fundamentals');
    lessons.slice(0, 5).forEach((lesson, i) => setProgress(grace, courseId, lesson.id, 4 - i * 0.5));
  }

  // admin + auditor enrolled in nothing, but a couple of enrolments for the KPIs
  {
    const sqlCourse = courseIds.get('sql-for-analysts')!;
    enrol('newbie@demo.test', 'sql-for-analysts', 'free', 1);
    const lessons = courseLessons('sql-for-analysts');
    setProgress(userIds.get('newbie@demo.test')!, sqlCourse, lessons[0].id, 1);
  }
  log('  enrolments, progress, notes');

  // ---- coupons ------------------------------------------------------
  const couponIds = new Map<string, number>();
  const coupons = [
    {
      code: 'WELCOME10',
      kind: 'percent',
      value: 10,
      course_id: null,
      expires_at: ts(-90),
      max_uses: 500,
      used_count: 1,
      is_active: 1,
      created_at: ts(35),
    },
    {
      code: 'FREE100',
      kind: 'percent',
      value: 100,
      course_id: null,
      expires_at: ts(-30),
      max_uses: 25,
      used_count: 0,
      is_active: 1,
      created_at: ts(30),
    },
    {
      code: 'TYPESCRIPT20',
      kind: 'percent',
      value: 20,
      course_id: courseIds.get('typescript-for-production-teams')!,
      expires_at: ts(-60),
      max_uses: 5,
      used_count: 1,
      is_active: 1,
      created_at: ts(26),
    },
    {
      code: 'EXPIRED10',
      kind: 'fixed',
      value: 500,
      course_id: null,
      expires_at: ts(2),
      max_uses: 100,
      used_count: 7,
      is_active: 1,
      created_at: ts(60),
    },
  ];
  for (const coupon of coupons) {
    couponIds.set(
      coupon.code,
      insert('coupons', { ...coupon, created_by: admin, updated_at: coupon.created_at }),
    );
  }
  log(`  ${coupons.length} coupons`);

  // ---- orders -------------------------------------------------------
  const orders = [
    {
      n: 1,
      email: 'ravi@demo.test',
      slug: 'typescript-for-production-teams',
      subtotal: 8900,
      discount: 1780,
      coupon: 'TYPESCRIPT20',
      status: 'paid',
      daysAgo: 25,
      last4: '4242',
      brand: 'Visa',
    },
    {
      n: 2,
      email: 'learner@demo.test',
      slug: 'typescript-for-production-teams',
      subtotal: 8900,
      discount: 890,
      coupon: 'WELCOME10',
      status: 'paid',
      daysAgo: 20,
      last4: '4242',
      brand: 'Visa',
    },
    {
      n: 3,
      email: 'ravi@demo.test',
      slug: 'data-storytelling-dashboards',
      subtotal: 9900,
      discount: 0,
      coupon: null,
      status: 'paid',
      daysAgo: 15,
      last4: '1881',
      brand: 'Visa (debit)',
    },
    {
      n: 4,
      email: 'learner@demo.test',
      slug: 'clean-product-design-figma',
      subtotal: 6900,
      discount: 0,
      coupon: null,
      status: 'paid',
      daysAgo: 12,
      last4: '4242',
      brand: 'Visa',
    },
    {
      n: 5,
      email: 'learner@demo.test',
      slug: 'data-storytelling-dashboards',
      subtotal: 9900,
      discount: 0,
      coupon: null,
      status: 'refunded',
      daysAgo: 8,
      last4: '4242',
      brand: 'Visa',
    },
    {
      n: 6,
      email: 'grace@demo.test',
      slug: 'design-systems-that-scale',
      subtotal: 12900,
      discount: 0,
      coupon: null,
      status: 'paid',
      daysAgo: 6,
      last4: '0341',
      brand: 'Mastercard',
    },
  ];

  const orderIds: number[] = [];
  const orderPublicIds: string[] = [];
  for (const order of orders) {
    const total = order.subtotal - order.discount;
    const isRefunded = order.status === 'refunded';
    const publicId = orderPublicId();
    orderPublicIds.push(publicId);
    const id = insert('orders', {
      public_id: publicId,
      user_id: userIds.get(order.email)!,
      course_id: courseIds.get(order.slug)!,
      status: order.status,
      currency: 'GBP',
      subtotal_pence: order.subtotal,
      discount_pence: order.discount,
      total_pence: total,
      coupon_id: order.coupon ? couponIds.get(order.coupon)! : null,
      coupon_code: order.coupon,
      payment_ref: `pi_demo_${crypto.randomBytes(6).toString('hex')}`,
      card_last4: order.last4,
      card_brand: order.brand,
      paid_at: ts(order.daysAgo),
      refunded_pence: isRefunded ? total : 0,
      refund_reason: isRefunded ? 'Duplicate purchase - learner bought the same course twice' : null,
      refunded_at: isRefunded ? ts(5) : null,
      refunded_by: isRefunded ? admin : null,
      created_at: ts(order.daysAgo, 30),
      updated_at: ts(order.daysAgo),
    });
    orderIds.push(id);

    insert('webhook_events', {
      id: `evt_demo_${order.n}_${crypto.randomBytes(4).toString('hex')}`,
      type: 'payment.succeeded',
      signature_valid: 1,
      payload: JSON.stringify({
        id: `evt_demo_${order.n}`,
        type: 'payment.succeeded',
        data: { orderPublicId: publicId, amountPence: total },
      }),
      note: isRefunded ? 'Processed, later refunded by admin' : 'Processed: order paid + enrolment created',
      received_at: ts(order.daysAgo, 29),
      processed_at: ts(order.daysAgo, 29),
    });

    if (isRefunded) {
      insert('webhook_events', {
        id: `evt_refund_${order.n}_${crypto.randomBytes(4).toString('hex')}`,
        type: 'charge.refunded',
        signature_valid: 1,
        payload: JSON.stringify({ id: `evt_refund_${order.n}`, type: 'charge.refunded' }),
        note: 'Processed: refund recorded',
        received_at: ts(5),
        processed_at: ts(5),
      });
    }
  }
  log(`  ${orders.length} orders (+ webhook events)`);

  // ---- quiz attempts + answers --------------------------------------
  const questionsForLesson = (lessonId: number) =>
    db
      .prepare(`SELECT id, type, points FROM questions WHERE lesson_id = ? ORDER BY sort_order`)
      .all(lessonId) as { id: number; type: string; points: number }[];

  /** Robust lesson lookup: by course slug + type (+ optional title fragment). */
  const findLesson = (courseSlug: string, type: string, titleLike = '%'): number => {
    const row = db
      .prepare(
        `SELECT l.id AS id FROM lessons l JOIN courses c ON c.id = l.course_id
          WHERE c.slug = ? AND l.type = ? AND l.title LIKE ? ORDER BY l.sort_order LIMIT 1`,
      )
      .get(courseSlug, type, `%${titleLike}%`) as { id: number } | undefined;
    if (!row) throw new Error(`seed: no ${type} lesson found in ${courseSlug} (${titleLike})`);
    return row.id;
  };

  const jsQuizLesson = findLesson('javascript-fundamentals', 'quiz');
  const tsQuizLesson = findLesson('typescript-for-production-teams', 'quiz');
  const dashQuizLesson = findLesson('data-storytelling-dashboards', 'quiz');

  const insertAttempt = (opts: {
    lessonId: number;
    userId: number;
    attemptNo: number;
    status: 'graded' | 'pending_review';
    autoPoints: number;
    autoMax: number;
    manualPoints: number | null;
    manualMax: number;
    maxPoints: number;
    submittedDaysAgo: number;
    reviewedDaysAgo?: number;
    reviewer?: number | null;
    awarded: { questionIndex: number; points: number; correct: boolean | null; feedback?: string }[];
    answers: { key: string; value: unknown }[];
  }): number => {
    const total = opts.autoPoints + (opts.manualPoints ?? 0);
    const attemptId = insert('quiz_attempts', {
      lesson_id: opts.lessonId,
      user_id: opts.userId,
      attempt_no: opts.attemptNo,
      status: opts.status,
      auto_points: opts.autoPoints,
      auto_max: opts.autoMax,
      manual_points: opts.manualPoints,
      manual_max: opts.manualMax,
      total_points: opts.status === 'graded' ? total : null,
      max_points: opts.maxPoints,
      score_percent: opts.status === 'graded' ? Math.round((total / opts.maxPoints) * 1000) / 10 : null,
      passed:
        opts.status === 'graded'
          ? total / opts.maxPoints >= 0.6
            ? 1
            : 0
          : null,
      submitted_at: ts(opts.submittedDaysAgo),
      reviewed_at: opts.reviewedDaysAgo !== undefined ? ts(opts.reviewedDaysAgo) : null,
      reviewed_by: opts.reviewedDaysAgo !== undefined ? (opts.reviewer ?? null) : null,
    });
    const questions = questionsForLesson(opts.lessonId);
    opts.awarded.forEach((award) => {
      const question = questions[award.questionIndex];
      if (!question) return;
      insert('quiz_answers', {
        attempt_id: attemptId,
        question_id: question.id,
        answer_json: JSON.stringify(opts.answers[award.questionIndex]?.value ?? {}),
        awarded_points: award.points,
        is_correct: award.correct === null ? null : award.correct ? 1 : 0,
        feedback: award.feedback ?? '',
      });
    });
    return attemptId;
  };

  // Alex, JavaScript quiz: passed, one short answer wrong (shows correct answers)
  insertAttempt({
    lessonId: jsQuizLesson,
    userId: alex,
    attemptNo: 1,
    status: 'graded',
    autoPoints: 3,
    autoMax: 4,
    manualPoints: 3,
    manualMax: 3,
    maxPoints: 7,
    submittedDaysAgo: 11,
    reviewedDaysAgo: 10,
    reviewer: admin,
    awarded: [
      { questionIndex: 0, points: 1, correct: true },
      { questionIndex: 1, points: 1, correct: true },
      { questionIndex: 2, points: 1, correct: true },
      { questionIndex: 3, points: 0, correct: false, feedback: 'Accepted answer: "map". You wrote "forEach".' },
      { questionIndex: 4, points: 3, correct: null, feedback: 'Clear, honest answer with a concrete plan. Nicely done.' },
    ],
    answers: [
      { key: 'q0', value: { choices: [2] } },
      { key: 'q1', value: { choices: [0, 1, 3] } },
      { key: 'q2', value: { choices: [0] } },
      { key: 'q3', value: { text: 'forEach' } },
      { key: 'q4', value: { text: '`this` inside a callback confused me until I traced it: a regular function gets its own `this`, so the timer callback lost the instance. I fixed it with an arrow function and now read call sites before assuming.' } },
    ],
  });

  // Alex, TypeScript checkpoint: passed with essay feedback
  insertAttempt({
    lessonId: tsQuizLesson,
    userId: alex,
    attemptNo: 1,
    status: 'graded',
    autoPoints: 3,
    autoMax: 4,
    manualPoints: 2.5,
    manualMax: 3,
    maxPoints: 7,
    submittedDaysAgo: 6,
    reviewedDaysAgo: 4,
    reviewer: admin,
    awarded: [
      { questionIndex: 0, points: 1, correct: true },
      { questionIndex: 1, points: 0, correct: false, feedback: 'You missed one option: a value of any type can be assigned to `unknown`.' },
      { questionIndex: 2, points: 1, correct: true },
      { questionIndex: 3, points: 1, correct: true },
      { questionIndex: 4, points: 2.5, correct: null, feedback: 'Good incremental plan. Next time include how you would keep CI green while the migration is in flight.' },
    ],
    answers: [
      { key: 'q0', value: { choices: [0] } },
      { key: 'q1', value: { choices: [0, 1] } },
      { key: 'q2', value: { choices: [0] } },
      { key: 'q3', value: { text: 'Partial' } },
      { key: 'q4', value: { text: 'I would start at the boundaries: type the HTTP client and the database row shapes first, turn on allowJs, and migrate one leaf module per pull request. After four weeks of that, enable strictNullChecks and fix the fallout in prioritised batches, then noImplicitAny, with tsc --noEmit as a CI gate from week one.' } },
    ],
  });

  // Ravi, Dashboards quiz: waiting for manual review (essay)
  insertAttempt({
    lessonId: dashQuizLesson,
    userId: ravi,
    attemptNo: 1,
    status: 'pending_review',
    autoPoints: 2,
    autoMax: 3,
    manualPoints: null,
    manualMax: 3,
    maxPoints: 6,
    submittedDaysAgo: 2,
    awarded: [
      { questionIndex: 0, points: 1, correct: true },
      { questionIndex: 1, points: 1, correct: true },
      { questionIndex: 2, points: 0, correct: false, feedback: 'Accepted answer: "zero".' },
      { questionIndex: 3, points: 0, correct: null },
    ],
    answers: [
      { key: 'q0', value: { choices: [1] } },
      { key: 'q1', value: { choices: [0, 1, 3] } },
      { key: 'q2', value: { text: 'five' } },
      { key: 'q3', value: { text: 'For a subscription product I would lead with monthly churn: the headline number is churn versus the same month last year. Supporting charts: churn by plan tier and churn by tenure band. The commentary would name the largest movement and propose one action to the retention team.' } },
    ],
  });

  // ---- assignment submissions --------------------------------------
  const submissions = [
    {
      lessonId: findLesson('javascript-fundamentals', 'assignment'),
      email: 'learner@demo.test',
      daysAgo: 12,
      body: 'I built a tip calculator. State lives in three variables (bill, people, tipPercent), the DOM updates on input, and there is a small validation branch for an empty bill. The hardest part was remembering that input values are strings — I had to parse them before dividing.',
      status: 'graded' as const,
      score: 88,
      feedback: 'Clean separation of read/update/render, and you handled the empty-input edge case. Next time guard the divide-by-zero when people is 0.',
      gradedDaysAgo: 9,
    },
    {
      lessonId: findLesson('typescript-for-production-teams', 'assignment'),
      email: 'learner@demo.test',
      daysAgo: 6,
      body: 'I added types to the HTTP client, replaced the `any` on the response with a generic `request<T>` wrapper, and documented the two places where I chose a narrower type over `any`: the error path (now narrowed with instanceof) and the retry config (a discriminated union).',
      status: 'graded' as const,
      score: 92,
      feedback: 'Excellent narrow types and clear justifications. The retry union is exactly what I hoped to see. Next step: try `satisfies` where you used an explicit annotation.',
      gradedDaysAgo: 4,
    },
    {
      lessonId: findLesson('data-storytelling-dashboards', 'assignment'),
      email: 'ravi@demo.test',
      daysAgo: 2,
      body: 'Question: are we losing more subscribers than we win each month? Headline: net revenue retention versus last year. Supporting: churn by plan, activation rate, support tickets per 100 accounts. I deliberately left out the NPS trend — it answers a different question and would have made the page feel unfocused.',
      status: 'submitted' as const,
      score: null,
      feedback: '',
      gradedDaysAgo: null,
    },
    {
      lessonId: findLesson('javascript-fundamentals', 'assignment'),
      email: 'grace@demo.test',
      daysAgo: 1,
      body: 'A quiz card that shuffles five questions, tracks the score, and shows a summary at the end. I used an array of objects and a render function. Something I could not get working: the shuffle repeated the same question twice, so I added a check before picking the next one.',
      status: 'submitted' as const,
      score: null,
      feedback: '',
      gradedDaysAgo: null,
    },
  ];

  for (const submission of submissions) {
    insert('assignment_submissions', {
      lesson_id: submission.lessonId,
      user_id: userIds.get(submission.email)!,
      body_text: submission.body,
      file_id: null,
      status: submission.status,
      score: submission.score,
      max_score: 100,
      feedback: submission.feedback,
      submitted_at: ts(submission.daysAgo),
      graded_at: submission.gradedDaysAgo !== null ? ts(submission.gradedDaysAgo) : null,
      graded_by: submission.gradedDaysAgo !== null ? admin : null,
    });
  }
  log(`  ${submissions.length} assignment submissions (2 waiting for grading)`);

  // ---- certificates -------------------------------------------------
  const certAlex = newCertificateId();
  insert('certificates', {
    certificate_id: certAlex,
    user_id: alex,
    course_id: courseIds.get('javascript-fundamentals')!,
    issued_at: ts(10),
  });
  const certRavi = newCertificateId();
  insert('certificates', {
    certificate_id: certRavi,
    user_id: ravi,
    course_id: courseIds.get('javascript-fundamentals')!,
    issued_at: ts(20),
  });
  log('  2 certificates (both valid)');

  // ---- notifications ------------------------------------------------
  const notify = (
    userId: number,
    type: string,
    title: string,
    body: string,
    href: string | null,
    daysAgo: number,
    readDaysAgo: number | null = null,
  ) =>
    insert('notifications', {
      user_id: userId,
      type,
      title,
      body,
      href,
      read_at: readDaysAgo !== null ? ts(readDaysAgo) : null,
      created_at: ts(daysAgo),
    });

  notify(alex, 'welcome', 'Welcome to demolms', 'Your account is verified. Start with a free course.', '/dashboard', 30, 29);
  notify(alex, 'certificate_issued', 'Certificate issued', 'Your certificate for JavaScript Fundamentals is ready.', '/learn/certificates', 10, null);
  notify(alex, 'order_paid', 'Payment received', 'Your receipt for Clean Product Design in Figma is available.', '/learn/orders', 12, 11);
  notify(alex, 'assignment_graded', 'Assignment graded: 88/100', 'Your instructor left feedback on "Assignment: your first small app".', '/learn/grades', 9, 8);
  notify(alex, 'refund_processed', 'Refund processed', 'We refunded £99.00 for Data Storytelling & Dashboards.', '/learn/orders', 5, null);
  notify(alex, 'quiz_reviewed', 'Quiz reviewed: 79%', 'Your TypeScript checkpoint was reviewed. You passed.', '/learn/grades', 4, null);
  notify(ravi, 'assignment_submitted', 'Submission received', 'Your dashboard assignment is queued for grading.', '/learn/grades', 2, null);
  notify(grace, 'course_enrolled', 'You are enrolled in SQL for Analysts', 'Jump back in whenever you are ready.', '/learn/sql-for-analysts', 9, 8);
  log('  notifications');

  // ---- emails -------------------------------------------------------
  const emailRows = [
    {
      to: 'learner@demo.test',
      subject: 'Welcome to demolms',
      template: 'welcome',
      daysAgo: 30,
      title: 'Welcome to demolms, Alex',
      body: p('Your account is ready. Your first course is already unlocked — JavaScript Fundamentals is free, forever.') + button('/courses/javascript-fundamentals', 'Start learning'),
    },
    {
      to: 'learner@demo.test',
      subject: 'Your receipt for Clean Product Design in Figma',
      template: 'receipt',
      daysAgo: 12,
      title: 'Receipt: Clean Product Design in Figma',
      body: p('Thank you for your purchase. This is your receipt.') + p(`<strong>Total paid: £69.00</strong><br/>Card: Visa ending 4242<br/>Order: ${orderPublicIds[3]}`) + button('/learn/orders', 'View orders and receipts'),
    },
    {
      to: 'learner@demo.test',
      subject: 'Your assignment was graded: 88/100',
      template: 'assignment_graded',
      daysAgo: 9,
      title: 'Assignment graded: 88/100',
      body: p('Your instructor graded "Assignment: your first small app" in JavaScript Fundamentals.') + p('<em>Clean separation of read/update/render, and you handled the empty-input edge case.</em>') + button('/learn/grades', 'See your feedback'),
    },
    {
      to: 'learner@demo.test',
      subject: 'Your certificate for JavaScript Fundamentals',
      template: 'certificate_issued',
      daysAgo: 10,
      title: 'Certificate issued',
      body: p(`Congratulations. Your certificate for JavaScript Fundamentals has been issued with ID <strong>${certAlex}</strong>.`) + button('/learn/certificates', 'View and download'),
    },
    {
      to: 'learner@demo.test',
      subject: 'Refund processed: £99.00',
      template: 'refund_processed',
      daysAgo: 5,
      title: 'Refund processed',
      body: p('We have refunded £99.00 for Data Storytelling & Dashboards. Card refunds usually arrive within 5 working days.') + p('Access to the refunded course has been removed, as shown in your orders.') + button('/learn/orders', 'View orders'),
    },
    {
      to: 'ravi@demo.test',
      subject: 'We received your assignment',
      template: 'assignment_received',
      daysAgo: 2,
      title: 'Submission received',
      body: p('Your assignment for Data Storytelling & Dashboards is in the grading queue. You will get an email when it has been reviewed.') + button('/learn/grades', 'Track your grades'),
    },
    {
      to: 'ravi@demo.test',
      subject: 'Your quiz is awaiting manual review',
      template: 'quiz_pending_review',
      daysAgo: 2,
      title: 'Quiz submitted - one answer needs a human',
      body:
        p('Thanks for submitting <strong>Chart choice check</strong> in Data Storytelling & Dashboards.') +
        p('Your multiple choice and short answers are already marked. The written answer is with your instructor and will be reviewed shortly.') +
        button('/learn/grades', 'View your attempt'),
    },
    {
      to: 'learner@demo.test',
      subject: 'Quiz reviewed: 78.6%',
      template: 'quiz_reviewed',
      daysAgo: 4,
      title: 'Quiz reviewed: 78.6%',
      body:
        p('Your instructor has finished reviewing <strong>Checkpoint: types &amp; narrowing</strong> in TypeScript for Production Teams.') +
        p('Outcome: <strong style="color:#0f9d6e">passed</strong>. Good incremental migration plan in your written answer.') +
        button('/learn/grades', 'Review your answers'),
    },
  ] as const;

  for (const email of emailRows) {
    insert('emails', {
      to_email: email.to,
      to_user_id: userIds.get(email.to)!,
      template: email.template,
      subject: email.subject,
      body_html: emailShell(email.title, email.body),
      created_at: ts(email.daysAgo),
    });
  }
  log(`  ${emailRows.length + 2} emails in the outbox (including a live reset link)`);

  // ---- audit log ----------------------------------------------------
  const auditRows = [
    { actor: admin, action: 'course.published', entity: 'course', entityId: String(courseIds.get('typescript-for-production-teams')), summary: 'Published course "TypeScript for Production Teams"', daysAgo: 35 },
    { actor: admin, action: 'coupon.created', entity: 'coupon', entityId: String(couponIds.get('WELCOME10')), summary: 'Created coupon WELCOME10 (10% off, all courses)', daysAgo: 35 },
    { actor: admin, action: 'course.published', entity: 'course', entityId: String(courseIds.get('javascript-fundamentals')), summary: 'Published course "JavaScript Fundamentals: From Zero to Confident"', daysAgo: 34 },
    { actor: admin, action: 'user.role_changed', entity: 'user', entityId: String(auditor), summary: 'Changed role for auditor@demo.test to auditor', daysAgo: 30 },
    { actor: admin, action: 'course.published', entity: 'course', entityId: String(courseIds.get('data-storytelling-dashboards')), summary: 'Published course "Data Storytelling & Dashboards"', daysAgo: 29 },
    { actor: null, action: 'certificate.issued', entity: 'certificate', entityId: certRavi, summary: 'Certificate issued automatically to ravi@demo.test', daysAgo: 20 },
    { actor: admin, action: 'submission.graded', entity: 'submission', entityId: '1', summary: 'Graded assignment for learner@demo.test: 88/100', daysAgo: 9 },
    { actor: null, action: 'certificate.issued', entity: 'certificate', entityId: certAlex, summary: 'Certificate issued automatically to learner@demo.test', daysAgo: 10 },
    { actor: admin, action: 'order.refunded', entity: 'order', entityId: String(orderIds[4]), summary: `Refunded £99.00 on order ${orderPublicIds[4]} - duplicate purchase`, daysAgo: 5 },
    { actor: admin, action: 'quiz.reviewed', entity: 'attempt', entityId: '2', summary: 'Manually reviewed TypeScript checkpoint for learner@demo.test: 79%', daysAgo: 4 },
    { actor: null, action: 'auth.login', entity: 'user', entityId: String(auditor), summary: 'Login: auditor@demo.test (with MFA)', daysAgo: 2 },
    { actor: null, action: 'auth.login', entity: 'user', entityId: String(grace), summary: 'Login: grace@demo.test', daysAgo: 1 },
    { actor: null, action: 'auth.login', entity: 'user', entityId: String(alex), summary: 'Login: learner@demo.test', daysAgo: 0, minutesAgo: 190 },
    { actor: null, action: 'auth.login', entity: 'user', entityId: String(admin), summary: 'Login: admin@demo.test (with MFA)', daysAgo: 0, minutesAgo: 40 },
  ] as const;

  for (const row of auditRows) {
    const actorUser = row.actor
      ? (db.prepare('SELECT email, role FROM users WHERE id = ?').get(row.actor) as {
          email: string;
          role: string;
        })
      : null;
    insert('audit_log', {
      actor_user_id: row.actor,
      actor_email: actorUser?.email ?? 'system',
      actor_role: actorUser?.role ?? 'system',
      action: row.action,
      entity_type: row.entity,
      entity_id: row.entityId,
      summary: row.summary,
      meta_json: '{}',
      created_at: ts(row.daysAgo, 'minutesAgo' in row ? row.minutesAgo : 0),
    });
  }
  log(`  ${auditRows.length} audit log entries`);

  log(`\nSeeded the demo database at data/demolms.db`);
}

const invokedDirectly = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('/db/seed.ts');
if (invokedDirectly) {
  console.log('Resetting and seeding the demo database...');
  runSeed()
    .then(() => console.log('\nDone. Start the app with: npm run dev'))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
