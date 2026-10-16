import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, Download, ExternalLink, GraduationCap, Share2, ShieldCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CopyButton } from '@/components/ui/copy-button';
import { appUrl } from '@/lib/paths';
import { formatDate, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Certificates' };

export default async function CertificatesPage() {
  const user = await requireUser('/learn/certificates');

  const certificates = query<{
    certificateId: string;
    issuedAt: string;
    revokedAt: string | null;
    revokeReason: string | null;
    courseTitle: string;
    courseSlug: string;
    instructorName: string;
  }>(
    `SELECT cert.certificate_id AS certificateId, cert.issued_at AS issuedAt,
            cert.revoked_at AS revokedAt, cert.revoke_reason AS revokeReason,
            c.title AS courseTitle, c.slug AS courseSlug, c.instructor_name AS instructorName
       FROM certificates cert
       JOIN courses c ON c.id = cert.course_id
      WHERE cert.user_id = ?
      ORDER BY cert.issued_at DESC`,
    user.id,
  );

  const inProgress = query<{ slug: string; title: string; percent: number; remainingMinutes: number }>(
    `SELECT c.slug, c.title,
            CAST(ROUND(100.0 * (SELECT COUNT(*) FROM lesson_progress lp
                                  WHERE lp.course_id = c.id AND lp.user_id = e.user_id
                                    AND lp.completed_at IS NOT NULL)
                        / MAX(1, (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id))) AS INTEGER) AS percent,
            (SELECT COALESCE(SUM(l.duration_minutes), 0) FROM lessons l
              WHERE l.course_id = c.id
                AND l.id NOT IN (SELECT lp.lesson_id FROM lesson_progress lp
                                  WHERE lp.user_id = e.user_id AND lp.completed_at IS NOT NULL)) AS remainingMinutes
       FROM enrolments e
       JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ? AND e.access_revoked = 0 AND e.completed_at IS NULL
        AND c.certificate_enabled = 1
      ORDER BY percent DESC
      LIMIT 3`,
    user.id,
  );

  const valid = certificates.filter((certificate) => !certificate.revokedAt);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Certificates</h1>
          <p className="mt-1 text-sm text-ink-500">
            {valid.length} valid{ certificates.length - valid.length > 0 ? ` · ${certificates.length - valid.length} revoked` : ''} ·
            each one has a public verification page and a downloadable PDF.
          </p>
        </div>
      </div>

      {certificates.length === 0 ? (
        <EmptyState
          icon={<Award className="size-8" aria-hidden />}
          title="No certificates yet"
          description="Finish every lesson, pass the required quizzes and have your assignments graded, and a certificate is issued automatically."
        >
          <Link href="/learn/my-learning" className="btn-primary">
            Continue learning
          </Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {certificates.map((certificate) => {
            const verifyUrl = `${appUrl()}/verify/${certificate.certificateId}`;
            return (
              <article key={certificate.certificateId} className="card animate-rise overflow-hidden">
                {/* preview of the certificate */}
                <div className="border-b border-line bg-canvas p-4">
                  <div
                    className={`rounded-xl border-2 bg-surface px-5 py-6 text-center ${
                      certificate.revokedAt ? 'border-danger/40' : 'border-brand-600'
                    }`}
                  >
                    <p className="text-[0.5625rem] font-semibold tracking-[0.18em] text-brand-700 uppercase">
                      Certificate of completion
                    </p>
                    <p className="mt-2 truncate text-base font-semibold text-ink-900">{user.name}</p>
                    <p className="mt-0.5 text-[0.6875rem] text-ink-500">has successfully completed</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink-800">
                      {certificate.courseTitle}
                    </p>
                    <p className="mt-2 font-mono text-[0.625rem] text-ink-400">{certificate.certificateId}</p>
                  </div>
                </div>

                <div className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-ink-500">
                      <GraduationCap className="size-4 text-ink-400" aria-hidden />
                      Issued {formatDate(certificate.issuedAt)} · {timeAgo(certificate.issuedAt)}
                    </div>
                    {certificate.revokedAt ? <Badge tone="danger">Revoked</Badge> : <Badge tone="success">Valid</Badge>}
                  </div>

                  {certificate.revokedAt ? (
                    <p className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-xs text-danger">
                      Revoked {formatDate(certificate.revokedAt)}
                      {certificate.revokeReason ? `: ${certificate.revokeReason}` : ''}
                    </p>
                  ) : (
                    <p className="flex items-center gap-2 rounded-xl border border-line bg-ink-50 px-3.5 py-2.5 text-xs text-ink-600">
                      <ShieldCheck className="size-3.5 shrink-0 text-success" aria-hidden />
                      Anyone with the link can verify it - no account needed.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/learn/certificates/${certificate.certificateId}`} className="btn-primary btn-sm">
                      View certificate
                    </Link>
                    <a href={`/api/certificates/${certificate.certificateId}/pdf`} className="btn-secondary btn-sm">
                      <Download className="size-3.5" aria-hidden />
                      PDF
                    </a>
                    <Link
                      href={`/verify/${certificate.certificateId}`}
                      className="btn-ghost btn-sm"
                      target="_blank"
                    >
                      Public page
                      <ExternalLink className="size-3" aria-hidden />
                    </Link>
                    <CopyButton value={verifyUrl} label="Copy verification link" className="btn-ghost btn-sm" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {inProgress.length > 0 ? (
        <section className="card p-5">
          <h2 className="section-title flex items-center gap-2">
            <Share2 className="size-4 text-brand-600" aria-hidden />
            Closest to earning one
          </h2>
          <ul className="mt-4 space-y-3">
            {inProgress.map((course) => (
              <li key={course.slug} className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{course.title}</span>
                <span className="text-xs text-ink-500">
                  {course.percent}%
                  {course.remainingMinutes > 0 ? ` · ${Math.round(course.remainingMinutes / 60)}h left` : ''}
                </span>
                <Link href={`/learn/courses/${course.slug}`} className="btn-secondary btn-sm">
                  Continue
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
