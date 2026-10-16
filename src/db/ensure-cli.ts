/**
 * CLI entry for the `predev` / `prebuild` hooks in package.json.
 * The work itself lives in `ensure.ts` so the server can reuse it at boot.
 */
import { ensureDatabase } from './ensure';

ensureDatabase().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
