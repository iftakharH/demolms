import { marked } from 'marked';

marked.use({ gfm: true, breaks: false });

/**
 * Markdown -> HTML for lesson bodies, course descriptions, assignment briefs
 * and seeded emails.
 *
 * Note (demo simplification): content is authored by admins, so the sanitiser
 * below is deliberately simple - it removes script/style/iframe tags and inline
 * event handlers rather than running a full HTML sanitiser.
 */
export function renderMarkdown(markdown: string | null | undefined): string {
  if (!markdown) return '';
  const html = marked.parse(markdown, { async: false }) as string;
  return sanitize(html);
}

function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}
