import type { MetadataRoute } from 'next';
import { allPublishedCourseSlugs } from '@/lib/queries/catalog';
import { APP_URL } from '@/lib/env';

/**
 * Rendering this per request (rather than baking it at build time) keeps the URLs
 * in step with APP_URL: change the env var on a host and the sitemap follows on the
 * next request, instead of needing a redeploy to un-bake localhost.
 */
export const dynamic = 'force-dynamic';

/** Static + dynamic routes for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${APP_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${APP_URL}/courses`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${APP_URL}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${APP_URL}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${APP_URL}/register`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const courses: MetadataRoute.Sitemap = allPublishedCourseSlugs().map((course) => ({
    url: `${APP_URL}/courses/${course.slug}`,
    lastModified: new Date(course.updatedAt.replace(' ', 'T') + 'Z'),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...courses];
}
