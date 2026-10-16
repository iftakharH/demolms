/**
 * Downloads the Instrument Sans variable font (woff2, latin subset) into
 * src/fonts so the app is fully offline after `npm install`.
 * Run: `node scripts/fetch-fonts.mjs`. If it fails (no network), the app falls
 * back to the system sans stack - see DESIGN.md.
 *
 * Instrument Sans is the single family the design uses (variable weight 400-700).
 */
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.cwd(), 'src', 'fonts');
fs.mkdirSync(outDir, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';

const cssUrl =
  'https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap';

const res = await fetch(cssUrl, { headers: { 'User-Agent': UA } });
if (!res.ok) {
  console.error(`[fonts] CSS request failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const css = await res.text();

// Google's CSS is a sequence of:  /* subset */ @font-face { ... }
const blockRe = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/g;
const subsets = new Map();
for (const match of css.matchAll(blockRe)) {
  const [, subset, body] = match;
  const italic = /font-style:\s*italic/.test(body);
  const url = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url || italic) continue; // upright only: the UI never sets italic headings
  subsets.set(subset, url);
}

const targets = [
  { subset: 'latin', file: 'InstrumentSans-Variable.woff2' },
  { subset: 'latin-ext', file: 'InstrumentSans-Variable-latin-ext.woff2' },
];

let saved = 0;
for (const { subset, file } of targets) {
  const url = subsets.get(subset);
  if (!url) {
    console.warn(`[fonts] subset '${subset}' not found in the CSS response`);
    continue;
  }
  const bin = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!bin.ok) {
    console.warn(`[fonts] download failed for '${subset}': ${bin.status}`);
    continue;
  }
  const buf = Buffer.from(await bin.arrayBuffer());
  if (buf.subarray(0, 4).toString('ascii') !== 'wOF2') {
    console.warn(`[fonts] '${subset}' is not a woff2 file`);
    continue;
  }
  fs.writeFileSync(path.join(outDir, file), buf);
  console.log(`[fonts] ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
  saved += 1;
}

if (saved === 0) {
  console.error('[fonts] nothing downloaded');
  process.exit(1);
}
console.log('[fonts] done');
