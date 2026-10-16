/**
 * Server startup hook - runs once per process, before the app serves anything.
 *
 * This is what makes a deployment on a disk-backed host self-seeding: the first
 * boot against an empty volume applies the schema and seeds the demo content, so
 * nobody has to open a shell on the server.
 *
 * Skipped on the edge runtime (no filesystem there), and never fatal: a host with
 * a read-only disk should still start and report its own errors per request
 * rather than refusing to boot.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { ensureDatabase } = await import('./db/ensure');
    await ensureDatabase();
  } catch (error) {
    console.error('[db] startup check failed - requests will report the error instead', error);
  }
}
