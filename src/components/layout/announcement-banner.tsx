import { Megaphone } from 'lucide-react';
import { platformSettings } from '@/lib/settings';

/** Site-wide announcement strip, controlled from /admin/settings. */
export async function AnnouncementBanner() {
  const settings = platformSettings();
  if (!settings.announcementEnabled || !settings.announcementText) return null;

  return (
    <div className="no-print border-b border-brand-200 bg-brand-50">
      <p className="mx-auto flex w-full max-w-6xl items-center gap-2.5 px-4 py-2.5 text-sm text-brand-900 sm:px-6">
        <Megaphone className="size-4 shrink-0 text-brand-600" aria-hidden />
        {settings.announcementText}
      </p>
    </div>
  );
}
