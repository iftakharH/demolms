import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // private and demo-only surfaces
        disallow: ['/admin', '/learn', '/dashboard', '/dev', '/mock-stripe', '/api', '/notifications'],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
