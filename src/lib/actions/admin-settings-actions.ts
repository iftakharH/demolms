'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminWriter } from '@/lib/auth';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { query, queryOne, run } from '@/lib/db';
import { slugify } from '@/lib/ids';
import { setSetting, platformSettings } from '@/lib/settings';
import type { FormState } from '@/lib/action-state';

/**
 * Platform settings: announcement banner, enrolment pause, and category
 * management. Every write is admin-only and audited.
 */

function revalidateCatalog(): void {
  revalidatePath('/admin/settings');
  revalidatePath('/admin/courses');
  revalidatePath('/');
  revalidatePath('/courses');
  revalidatePath('/categories');
}

/* --------------------------------------------------------- platform toggles */

/** Quick on/off for the announcement banner, straight from the dashboard widget. */
export async function toggleAnnouncementAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const current = platformSettings();
  const next = !current.announcementEnabled;

  // switching on needs some text; send the admin to the settings form to add it
  if (next && current.announcementText.trim().length === 0) {
    redirect(`/admin/settings?error=${encodeURIComponent('Add some announcement text first.')}#platform`);
  }

  setSetting('announcement_enabled', next ? '1' : '0');
  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.settingsChanged,
    entityType: 'settings',
    entityId: 'announcement',
    summary: `Announcement banner turned ${next ? 'on' : 'off'}`,
  });

  revalidateCatalog();
  revalidatePath('/admin');
  redirect(String(formData.get('back') ?? '/admin'));
}

export async function updatePlatformSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdminWriter();

  const text = z
    .string()
    .trim()
    .max(200, 'Keep the announcement under 200 characters')
    .safeParse(formData.get('announcement_text') ?? '');
  if (!text.success) return { error: text.error.issues[0].message };

  const enabled = formData.get('announcement_enabled') === 'on';
  const paused = formData.get('enrolments_paused') === 'on';

  setSetting('announcement_text', text.data);
  setSetting('announcement_enabled', enabled && text.data.length > 0 ? '1' : '0');
  setSetting('enrolments_paused', paused ? '1' : '0');

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.settingsChanged,
    entityType: 'settings',
    entityId: 'platform',
    summary: `Platform settings updated (announcement ${enabled && text.data ? 'on' : 'off'}, enrolments ${paused ? 'paused' : 'open'})`,
    meta: { announcementEnabled: enabled, announcementText: text.data, enrolmentsPaused: paused },
  });

  revalidateCatalog();
  return {
    ok: true,
    message: paused
      ? 'Saved. New enrolments are paused; existing learners keep their access.'
      : 'Saved. Platform settings are live.',
  };
}

/* -------------------------------------------------------------- categories */

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Give the category a name').max(60),
  slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .default(''),
  description: z.string().trim().max(300).optional().default(''),
});

function backWith(query: string): never {
  redirect(`/admin/settings?${query}#categories`);
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const parsed = categorySchema.safeParse({
    name: formData.get('name') ?? '',
    slug: formData.get('slug') ?? '',
    description: formData.get('description') ?? '',
  });
  if (!parsed.success) {
    backWith(`error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const slug = slugify(parsed.data.slug || parsed.data.name) || 'category';
  const clash = queryOne<{ id: number }>(
    'SELECT id FROM categories WHERE slug = ? OR LOWER(name) = LOWER(?)',
    slug,
    parsed.data.name,
  );
  if (clash) {
    backWith(`error=${encodeURIComponent('A category with that name or slug already exists.')}`);
  }

  const next =
    (queryOne<{ n: number | null }>('SELECT MAX(sort_order) AS n FROM categories')?.n ?? -1) + 1;
  run(
    'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)',
    parsed.data.name,
    slug,
    parsed.data.description,
    next,
  );

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.settingsChanged,
    entityType: 'category',
    entityId: slug,
    summary: `Created category "${parsed.data.name}"`,
  });

  revalidateCatalog();
  backWith('saved=1');
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const id = Number.parseInt(String(formData.get('category_id') ?? ''), 10);
  const parsed = categorySchema.safeParse({
    name: formData.get('name') ?? '',
    slug: formData.get('slug') ?? '',
    description: formData.get('description') ?? '',
  });
  if (!parsed.success) {
    backWith(`error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const existing = queryOne<{ id: number; name: string; slug: string }>(
    'SELECT id, name, slug FROM categories WHERE id = ?',
    id,
  );
  if (!existing) backWith(`error=${encodeURIComponent('That category no longer exists.')}`);

  const slug = slugify(parsed.data.slug || parsed.data.name) || existing.slug;
  const clash = queryOne<{ id: number }>(
    'SELECT id FROM categories WHERE (slug = ? OR LOWER(name) = LOWER(?)) AND id != ?',
    slug,
    parsed.data.name,
    id,
  );
  if (clash) {
    backWith(`error=${encodeURIComponent('Another category already uses that name or slug.')}`);
  }

  run(
    'UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?',
    parsed.data.name,
    slug,
    parsed.data.description,
    id,
  );

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.settingsChanged,
    entityType: 'category',
    entityId: id,
    summary: `Updated category "${existing.name}" -> "${parsed.data.name}"`,
    meta: { slug },
  });

  revalidateCatalog();
  backWith('saved=1');
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  await requireAdminWriter();
  const id = Number.parseInt(String(formData.get('category_id') ?? ''), 10);
  const direction = String(formData.get('direction') ?? 'up');

  const categories = query<{ id: number; sort_order: number }>(
    'SELECT id, sort_order FROM categories ORDER BY sort_order, id',
  );
  const index = categories.findIndex((category) => category.id === id);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index >= 0 && swapWith >= 0 && swapWith < categories.length) {
    const a = categories[index];
    const b = categories[swapWith];
    run('UPDATE categories SET sort_order = ? WHERE id = ?', b.sort_order === a.sort_order ? swapWith : b.sort_order, a.id);
    run('UPDATE categories SET sort_order = ? WHERE id = ?', a.sort_order === b.sort_order ? index : a.sort_order, b.id);
  }

  revalidateCatalog();
  backWith('saved=1');
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const id = Number.parseInt(String(formData.get('category_id') ?? ''), 10);

  const category = queryOne<{ id: number; name: string }>('SELECT id, name FROM categories WHERE id = ?', id);
  if (!category) backWith(`error=${encodeURIComponent('That category no longer exists.')}`);

  const courses =
    queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM courses WHERE category_id = ?', id)?.n ?? 0;

  // courses.category_id is ON DELETE SET NULL: orphaned courses become uncategorised
  run('DELETE FROM categories WHERE id = ?', id);

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.settingsChanged,
    entityType: 'category',
    entityId: id,
    summary: `Deleted category "${category.name}"${courses > 0 ? ` (${courses} course${courses === 1 ? '' : 's'} moved to uncategorised)` : ''}`,
  });

  revalidateCatalog();
  backWith(courses > 0 ? `saved=1&moved=${courses}` : 'saved=1');
}
