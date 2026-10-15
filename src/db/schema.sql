-- demolms schema (SQLite). Applied idempotently by src/db/ensure.ts / src/db/seed.ts.
-- Money is stored as integer pence. Timestamps are ISO-ish UTC strings (datetime('now')).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- users & auth

CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name              TEXT    NOT NULL,
  password_hash     TEXT    NOT NULL,
  role              TEXT    NOT NULL DEFAULT 'learner'
                            CHECK (role IN ('learner', 'admin', 'auditor')),
  avatar_path       TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  email_verified_at TEXT,
  last_login_at     TEXT,
  -- admin TOTP (MFA)
  totp_secret       TEXT,
  totp_confirmed_at TEXT,
  -- notification preferences: JSON object of booleans
  email_prefs_json  TEXT    NOT NULL DEFAULT
    '{"receipts":true,"grades":true,"certificates":true,"marketing":false}',
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,               -- sha256 hex of the raw cookie token
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  needs_mfa  INTEGER NOT NULL DEFAULT 0,        -- 1 while waiting for the TOTP step
  impersonated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- support access: the admin behind it
  ip         TEXT,
  user_agent TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL CHECK (kind IN ('verify_email', 'reset_password')),
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  used_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, kind);

CREATE TABLE IF NOT EXISTS rate_limits (
  key               TEXT    PRIMARY KEY,        -- e.g. 'login:ip:127.0.0.1'
  count             INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT    NOT NULL DEFAULT (datetime('now')),
  blocked_until     TEXT
);

-- ---------------------------------------------------------------- platform

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,                  -- e.g. 'announcement_text'
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------- catalog

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  slug        TEXT    NOT NULL UNIQUE,
  description TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS courses (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                  TEXT    NOT NULL UNIQUE,
  title                 TEXT    NOT NULL,
  subtitle              TEXT    NOT NULL DEFAULT '',
  description_md        TEXT    NOT NULL DEFAULT '',
  category_id           INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  instructor_name       TEXT    NOT NULL DEFAULT 'Demo Instructor',
  instructor_bio_md     TEXT    NOT NULL DEFAULT '',
  level                 TEXT    NOT NULL DEFAULT 'beginner'
                                CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  price_pence           INTEGER NOT NULL DEFAULT 0,
  thumbnail_path        TEXT,
  tags                  TEXT    NOT NULL DEFAULT '',   -- comma separated
  outcomes_md           TEXT    NOT NULL DEFAULT '',   -- one bullet per line
  requirements_md       TEXT    NOT NULL DEFAULT '',
  status                TEXT    NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'published', 'archived')),
  featured              INTEGER NOT NULL DEFAULT 0,
  certificate_enabled   INTEGER NOT NULL DEFAULT 1,
  requires_quiz_pass    INTEGER NOT NULL DEFAULT 0,
  requires_assignments  INTEGER NOT NULL DEFAULT 1,
  published_at          TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);

CREATE TABLE IF NOT EXISTS sections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sections_course ON sections(course_id, sort_order);

CREATE TABLE IF NOT EXISTS lessons (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id           INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id          INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title               TEXT    NOT NULL,
  type                TEXT    NOT NULL CHECK (type IN ('video', 'text', 'quiz', 'assignment')),
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_preview          INTEGER NOT NULL DEFAULT 0,
  duration_minutes    INTEGER NOT NULL DEFAULT 0,
  -- video lesson
  video_path          TEXT,
  captions_path       TEXT,
  poster_path         TEXT,
  -- text lesson
  body_md             TEXT,
  -- quiz settings
  quiz_pass_percent   INTEGER,
  quiz_max_attempts   INTEGER,
  quiz_show_answers   INTEGER NOT NULL DEFAULT 1,
  -- assignment settings
  assignment_brief_md TEXT,
  assignment_max_score INTEGER NOT NULL DEFAULT 100,
  assignment_allow_files INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_section ON lessons(section_id, sort_order);

CREATE TABLE IF NOT EXISTS questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type          TEXT    NOT NULL
                        CHECK (type IN ('single', 'multiple', 'truefalse', 'short', 'essay')),
  prompt        TEXT    NOT NULL,
  options_json  TEXT    NOT NULL DEFAULT '[]',  -- choice types: ["A","B"]; truefalse: ["True","False"]
  correct_json  TEXT    NOT NULL DEFAULT '[]',  -- single/multiple: [0,2]; truefalse: [1]; short: ["accepted","answers"]
  explanation   TEXT    NOT NULL DEFAULT '',
  points        INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_lesson ON questions(lesson_id, sort_order);

-- ---------------------------------------------------------------- files & resources

CREATE TABLE IF NOT EXISTS files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  path          TEXT    NOT NULL,               -- relative to the storage root (public/uploads/...)
  original_name TEXT    NOT NULL,
  mime          TEXT    NOT NULL DEFAULT 'application/octet-stream',
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  purpose       TEXT    NOT NULL DEFAULT 'general'
                        CHECK (purpose IN ('video', 'captions', 'poster', 'thumbnail',
                                           'resource', 'submission', 'avatar', 'general')),
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lesson_resources (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resources_lesson ON lesson_resources(lesson_id);
CREATE INDEX IF NOT EXISTS idx_resources_course ON lesson_resources(course_id);

-- ---------------------------------------------------------------- enrolment & progress

CREATE TABLE IF NOT EXISTS enrolments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id      INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  source         TEXT    NOT NULL DEFAULT 'free'
                         CHECK (source IN ('free', 'purchase', 'admin', 'seed')),
  access_revoked INTEGER NOT NULL DEFAULT 0,
  revoked_reason TEXT,
  enrolled_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at   TEXT,
  UNIQUE (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_enrolments_user ON enrolments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_course ON enrolments(course_id);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id              INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id              INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed_at           TEXT,
  video_position_seconds REAL NOT NULL DEFAULT 0,
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user_course ON lesson_progress(user_id, course_id);

CREATE TABLE IF NOT EXISTS lesson_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  body       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_notes_user_course ON lesson_notes(user_id, course_id);

-- ---------------------------------------------------------------- commerce

CREATE TABLE IF NOT EXISTS coupons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  kind       TEXT    NOT NULL CHECK (kind IN ('percent', 'fixed')),
  value      INTEGER NOT NULL,                  -- percent (1-100) or pence
  course_id  INTEGER REFERENCES courses(id) ON DELETE CASCADE, -- NULL = all courses
  expires_at TEXT,
  max_uses   INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id           TEXT    NOT NULL UNIQUE,   -- e.g. ORD-7Q4K2M
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id           INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status              TEXT    NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'paid', 'failed', 'refunded',
                                                'partially_refunded', 'cancelled')),
  currency            TEXT    NOT NULL DEFAULT 'GBP',
  subtotal_pence      INTEGER NOT NULL,
  discount_pence      INTEGER NOT NULL DEFAULT 0,
  total_pence         INTEGER NOT NULL,
  coupon_id           INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
  coupon_code         TEXT,
  payment_ref         TEXT,                      -- mock payment intent id
  card_last4          TEXT,
  card_brand          TEXT,
  paid_at             TEXT,
  refunded_pence      INTEGER NOT NULL DEFAULT 0,
  refund_reason       TEXT,
  refunded_at         TEXT,
  refunded_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS webhook_events (
  id              TEXT    PRIMARY KEY,           -- event id, e.g. evt_...
  type            TEXT    NOT NULL,
  signature_valid INTEGER NOT NULL DEFAULT 0,
  payload         TEXT    NOT NULL,
  note            TEXT    NOT NULL DEFAULT '',
  received_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  processed_at    TEXT
);

-- ---------------------------------------------------------------- assessment

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_no    INTEGER NOT NULL DEFAULT 1,
  status        TEXT    NOT NULL DEFAULT 'pending_review'
                        CHECK (status IN ('pending_review', 'graded')),
  auto_points   REAL    NOT NULL DEFAULT 0,
  auto_max      REAL    NOT NULL DEFAULT 0,
  manual_points REAL,
  manual_max    REAL    NOT NULL DEFAULT 0,
  total_points  REAL,
  max_points    REAL    NOT NULL DEFAULT 0,
  score_percent REAL,
  passed        INTEGER,
  submitted_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  reviewed_at   TEXT,
  reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON quiz_attempts(user_id, lesson_id);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id      INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id     INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_json     TEXT    NOT NULL DEFAULT '{}', -- {"choices":[0]} | {"text":"..."} | {"value":"true"}
  awarded_points  REAL,
  is_correct      INTEGER,
  feedback        TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt ON quiz_answers(attempt_id);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id    INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_text    TEXT    NOT NULL DEFAULT '',
  file_id      INTEGER REFERENCES files(id) ON DELETE SET NULL,
  status       TEXT    NOT NULL DEFAULT 'submitted'
                       CHECK (status IN ('submitted', 'graded', 'resubmission_requested')),
  score        REAL,
  max_score    REAL    NOT NULL DEFAULT 100,
  feedback     TEXT    NOT NULL DEFAULT '',
  submitted_at TEXT    NOT NULL DEFAULT (datetime('now')),
  graded_at    TEXT,
  graded_by    INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_submissions_lesson ON assignment_submissions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON assignment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON assignment_submissions(status);

-- ---------------------------------------------------------------- certificates

CREATE TABLE IF NOT EXISTS certificates (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id TEXT    NOT NULL UNIQUE,        -- public id: DEMO-2026-XXXXXX
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id      INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  issued_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  revoked_at     TEXT,
  revoked_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  revoke_reason  TEXT,
  UNIQUE (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- ---------------------------------------------------------------- notifications, email, audit

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  href       TEXT,
  read_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS emails (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email   TEXT    NOT NULL,
  to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  template   TEXT    NOT NULL,
  subject    TEXT    NOT NULL,
  body_html  TEXT    NOT NULL,
  read_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_emails_to ON emails(to_email);

CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_email   TEXT    NOT NULL DEFAULT '',
  actor_role    TEXT    NOT NULL DEFAULT '',
  action        TEXT    NOT NULL,               -- e.g. course.published, order.refunded
  entity_type   TEXT    NOT NULL DEFAULT '',
  entity_id     TEXT    NOT NULL DEFAULT '',
  summary       TEXT    NOT NULL,
  meta_json     TEXT    NOT NULL DEFAULT '{}',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
