/**
 * Makes sure the demo database and generated assets exist.
 *
 * Called from three places: `npm run dev` and `npm run build` (via
 * `src/db/ensure-cli.ts`), and once at server start (`src/instrumentation.ts`),
 * which is what lets a fresh deployment with an empty disk seed itself.
 *
 * Idempotent: an existing database is left alone, an empty one is seeded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb } from '../lib/db';
import { runSeed } from './seed';

export async function ensureDatabase(): Promise<void> {
  const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
  const db = getDb();
  db.exec(fs.readFileSync(schemaPath, 'utf8'));

  // ---- tiny forward migrations ---------------------------------------
  // schema.sql only CREATEs tables that do not exist, so columns added after
  // a database was first created need an explicit ALTER here.
  const sessionColumns = db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[];
  if (!sessionColumns.some((column) => column.name === 'impersonated_by')) {
    db.exec('ALTER TABLE sessions ADD COLUMN impersonated_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
    console.log('[db] migrated: sessions.impersonated_by (support access)');
  }

  const { n: userCount } = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };

  if (userCount === 0) {
    console.log('[db] empty database - seeding demo data...');
    await runSeed((msg) => console.log(msg));
  } else {
    console.log(`[db] ready (${userCount} users)`);
  }

  // sample video: generated with ffmpeg on first need
  const video = path.join(process.cwd(), 'public', 'uploads', 'videos', 'sample.mp4');
  if (!fs.existsSync(video)) {
    console.log('[assets] sample video missing, trying ffmpeg...');
    const res = spawnSync(process.execPath, ['scripts/make-sample-video.mjs'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    if (res.status !== 0 || !fs.existsSync(video)) {
      console.warn(
        '[assets] could not create the sample video. Video lessons will show a ' +
          '"media unavailable" state until public/uploads/videos/sample.mp4 exists.',
      );
    }
  }
}
