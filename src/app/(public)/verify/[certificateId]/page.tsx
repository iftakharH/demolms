import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap, SearchX, ShieldCheck, ShieldX } from 'lucide-react';
import { certificateByPublicId } from '@/lib/certificates';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/verify/[certificateId]'>): Promise<Metadata> {
  const { certificateId } = await params;
  const certificate = certificateByPublicId(certificateId);
  if (!certificate) {
    return { title: 'Certificate not found', robots: { index: false } };
  }
  return {
    title: `${certificate.courseTitle} certificate - ${certificate.userName}`,
    description: certificate.revokedAt
      ? `This certificate was revoked${certificate.revokeReason ? `: ${certificate.revokeReason}` : ''}.`
      : `Verified certificate for ${certificate.userName} on ${certificate.courseTitle}, issued ${formatDate(certificate.issuedAt)}.`,
    robots: { index: certificate.revokedAt ? false : true },
  };
}

/**
 * Public verification page - reachable by scanning the QR code on a
 * certificate. Shows valid / revoked / not found.
 */
export default async function VerifyPage({ params }: PageProps<'/verify/[certificateId]'>) {
  const { certificateId } = await params;
  const certificate = certificateByPublicId(certificateId);

  if (!certificate) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-20 text-center sm:px-6">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
          <SearchX className="size-7" aria-hidden />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink-900">
          No certificate found
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          We have no record of a certificate with the ID{' '}
          <span className="font-mono text-ink-700">{certificateId}</span>. Check the code and try again.
        </p>
        <div className="mt-7 flex justify-center gap-2">
          <Link href="/" className="btn-primary">
            Back to demolms
          </Link>
          <Link href="/courses" className="btn-secondary">
            Browse courses
          </Link>
        </div>
      </div>
    );
  }

  const revoked = Boolean(certificate.revokedAt);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <div
        className={`card overflow-hidden ${revoked ? 'border-danger-line' : 'border-success-line'}`}
      >
        <div
          className={`flex items-center gap-3 px-6 py-5 ${
            revoked ? 'bg-danger-soft' : 'bg-success-soft'
          }`}
        >
          {revoked ? (
            <ShieldX className="size-8 shrink-0 text-danger" aria-hidden />
          ) : (
            <ShieldCheck className="size-8 shrink-0 text-success" aria-hidden />
          )}
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-600 uppercase">
              demolms certificate verification
            </p>
            <h1 className="text-xl font-semibold text-ink-900">
              {revoked ? 'This certificate has been revoked' : 'This certificate is valid'}
            </h1>
          </div>
        </div>

        <dl className="grid gap-x-8 gap-y-4 px-6 py-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Learner</dt>
            <dd className="mt-1 text-sm font-medium text-ink-900">{certificate.userName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Course</dt>
            <dd className="mt-1 text-sm font-medium text-ink-900">{certificate.courseTitle}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Issued</dt>
            <dd className="mt-1 text-sm text-ink-800">{formatDate(certificate.issuedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Instructor</dt>
            <dd className="mt-1 text-sm text-ink-800">{certificate.instructorName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Certificate ID</dt>
            <dd className="mt-1 font-mono text-xs text-ink-700">{certificate.certificateId}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Status</dt>
            <dd className="mt-1">
              <Badge tone={revoked ? 'danger' : 'success'}>{revoked ? 'Revoked' : 'Valid'}</Badge>
            </dd>
          </div>
        </dl>

        {revoked ? (
          <div className="border-t border-danger-line bg-danger-soft px-6 py-4">
            <p className="text-sm text-danger">
              Revoked {certificate.revokedAt ? formatDate(certificate.revokedAt) : ''}
              {certificate.revokeReason ? ` - ${certificate.revokeReason}` : ''}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <GraduationCap className="size-4" aria-hidden />
            Issued by demolms · local demo build
          </p>
          <Link href={`/courses/${certificate.courseSlug}`} className="btn-secondary btn-sm">
            View the course
          </Link>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-ink-500">
        Every demolms certificate carries a unique ID and this public page. Learners can download the
        PDF from their certificates page.
      </p>
    </div>
  );
}
