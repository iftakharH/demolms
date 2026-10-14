import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { categoryOptions } from '@/lib/queries/admin-courses';
import { NewCourseForm } from '@/components/admin/new-course-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'New course · Admin' };

export default async function NewCoursePage() {
  const user = await requireStaff('/admin/courses/new');
  // Auditors are read-only: send them back to the list with an explanation
  // rather than rendering an error boundary.
  if (user.role !== 'admin') {
    redirect(
      `/admin/courses?error=${encodeURIComponent(
        'Auditor accounts are read-only, so creating courses is disabled.',
      )}`,
    );
  }

  const categories = categoryOptions();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/courses" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Back to courses
      </Link>
      <div>
        <h1 className="page-title">New course</h1>
        <p className="mt-1 text-sm text-ink-500">
          Start with the basics. The new course is saved as a draft - add sections, lessons and a quiz
          next, then publish.
        </p>
      </div>
      <NewCourseForm categories={categories} />
    </div>
  );
}
