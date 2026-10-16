/**
 * Maps literal Tailwind palette utilities onto the semantic design tokens from
 * DESIGN.md, so components survive a theme change without dark: variants.
 *
 * Idempotent: run it again after adding components that use raw palette colours.
 *
 *   node scripts/sweep-tokens.mjs          # report only
 *   node scripts/sweep-tokens.mjs --write  # apply
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'src';
const WRITE = process.argv.includes('--write');

/** family -> semantic token */
const FAMILY = {
  emerald: 'success',
  green: 'success',
  rose: 'danger',
  red: 'danger',
  amber: 'warning',
  orange: 'warning',
  yellow: 'warning',
  sky: 'info',
  blue: 'info',
  indigo: 'info',
};

/** literal utility -> replacement */
const MAP = [
  // soft backgrounds
  [/^bg-(emerald|green|rose|red|amber|orange|yellow|sky|blue|indigo)-50$/, (m) => `bg-${FAMILY[m[1]]}-soft`],
  [/^bg-(emerald|green|rose|red|amber|orange|yellow|sky|blue|indigo)-100$/, (m) => `bg-${FAMILY[m[1]]}-soft`],
  // text on soft backgrounds
  [/^text-(emerald|green|rose|red|amber|orange|yellow|sky|blue|indigo)-(700|800|900)$/, (m) => `text-${FAMILY[m[1]]}-strong`],
  [/^text-(emerald|green|rose|red|amber|orange|yellow|sky|blue|indigo)-(400|500|600)$/, (m) => `text-${FAMILY[m[1]]}`],
  // borders
  [/^border-(emerald|green|rose|red|amber|orange|yellow|sky|blue|indigo)-(200|300|400)$/, (m) => `border-${FAMILY[m[1]]}-line`],
  // solid fills
  [/^bg-(emerald|green|rose|red|amber|orange|yellow|sky|blue|indigo)-(500|600)$/, (m) => `bg-${FAMILY[m[1]]}`],
  // solid surfaces and always-dark surfaces
  [/^bg-white$/, () => 'bg-surface'],
  [/^bg-white\/(\d+)$/, (m) => `bg-surface/${m[1]}`],
  [/^bg-ink-950$/, () => 'bg-scrim'],
  [/^(from|via)-ink-950\/(\d+)$/, (m) => `${m[1]}-scrim/${m[2]}`],
];

const SKIP_FILES = new Set([
  'src/app/globals.css',
  'src/lib/format.ts', // avatar tints are decorative, not semantic
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx|ts)$/.test(entry.name) ? [full] : [];
  });
}

function isClassPosition(text, index) {
  // cheap heuristic: the token sits inside a string literal near className/class/
  // bg-/text-/border- usage - we only ever replace keys that already look like utilities
  const before = text.slice(Math.max(0, index - 400), index);
  return /className\s*=\s*["'{][^"'{}]*$/.test(before) || /["'`][^"'`]*$/.test(before);
}

const report = [];
let changedFiles = 0;

for (const file of walk(ROOT)) {
  if (SKIP_FILES.has(file.replace(/\\/g, '/'))) continue;
  const original = fs.readFileSync(file, 'utf8');
  let text = original;
  let replacements = 0;

  for (const [pattern, replacement] of MAP) {
    // iterate class-name tokens: split on characters that cannot be inside a utility
    text = text.replace(/[A-Za-z0-9_:/.[\]-]+/g, (token, offset) => {
      if (!isClassPosition(text, offset)) return token;
      const match = token.match(pattern);
      if (!match) return token;
      replacements += 1;
      return replacement(match);
    });
  }

  if (replacements > 0) {
    report.push({ file: file.replace(/\\/g, '/'), replacements });
    if (WRITE) {
      fs.writeFileSync(file, text, 'utf8');
      changedFiles += 1;
    }
  }
}

report.sort((a, b) => b.replacements - a.replacements);
for (const row of report) console.log(`${String(row.replacements).padStart(3)}  ${row.file}`);
console.log(`\n${report.reduce((sum, row) => sum + row.replacements, 0)} replacements across ${report.length} files`);
console.log(WRITE ? `written to ${changedFiles} files` : 'dry run - pass --write to apply');
