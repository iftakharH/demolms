import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, ExternalLink, ShieldCheck, ShieldX } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { certificateByPublicId } from '@/lib/certificates';
import { verificationQrDataUrl } from '@/lib/certificate-pdf';
import { PrintButton } from '@/components/ui/print-button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { isStaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Certificate',
  robots: { index: false },
};

export default async function CertificatePage({
  params,
}: PageProps<'/learn/certificates/[certificateId]'>) {
  const user = await requireUser('/learn/certificates');
  const { certificateId } = await params;

  const certificate = certificateByPublicId(certificateId);
  if (!certificate) notFound();
  if (certificate.userId !== user.id && !isStaffRole(user.role)) notFound();

  const qr = await verificationQrDataUrl(certificate.certificateId, 200);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/learn/certificates"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All certificates
        </Link>
        <div className="flex flex-wrap gap-2">
          <PrintButton label="Print" />
          <a href={`/api/certificates/${certificate.certificateId}/pdf`} className="btn-primary">
            <Download className="size-4" aria-hidden />
            Download PDF
          </a>
          <Link href={`/verify/${certificate.certificateId}`} className="btn-secondary" target="_blank">
            Public page
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      {certificate.revokedAt ? (
        <p className="no-print flex items-start gap-2 rounded-xl border border-rose-200 bg-danger-soft px-4 py-3 text-sm text-danger">
          <ShieldX className="mt-0.5 size-4 shrink-0" aria-hidden />
          This certificate was revoked on {formatDate(certificate.revokedAt)}
          {certificate.revokeReason ? `: ${certificate.revokeReason}` : '.'}
        </p>
      ) : null}

      {/* ------------------------------------------------------------ certificate */}
      <article
        className={`print-page relative overflow-hidden rounded-3xl border-2 ${
          certificate.revokedAt ? 'border-danger/40' : 'border-brand-600'
        } bg-surface p-8 sm:p-12`}
      >
        <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-brand-50" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-24 size-72 rounded-full bg-brand-50/60" aria-hidden />

        <div className="relative text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-700 uppercase">
            demolms · certificate of completion
          </p>

          <p className="mt-8 text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            {certificate.userName}
          </p>
          <p className="mt-3 text-sm text-ink-500">has successfully completed the course</p>
          <p className="mt-4 text-xl font-semibold text-ink-900 sm:text-2xl">{certificate.courseTitle}</p>

          {certificate.revokedAt ? (
            <p className="mt-6 inline-block rotate-[-6deg] rounded-lg border-2 border-danger px-4 py-1.5 text-lg font-bold tracking-widest text-danger uppercase">
              Revoked
            </p>
          ) : null}

          <div className="mt-10 flex flex-col items-center justify-between gap-8 sm:flex-row sm:items-end">
            <div className="text-center">
              <p className="text-sm font-semibold text-ink-900">{certificate.instructorName}</p>
              <p className="mt-1 w-40 border-t border-line-strong pt-1 text-xs text-ink-500">
                Course instructor
              </p>
            </div>

            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
              <img src={qr} alt={`Verification QR code for ${certificate.certificateId}`} className="mx-auto size-32" />
              <p className="mt-1 text-[0.6875rem] text-ink-500">Scan to verify</p>
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-ink-900">{formatDate(certificate.issuedAt)}</p>
              <p className="mt-1 w-40 border-t border-line-strong pt-1 text-xs text-ink-500">Date of issue</p>
            </div>
          </div>

          <p className="mt-8 font-mono text-xs text-ink-500">
            Certificate ID {certificate.certificateId}
          </p>
        </div>
      </article>

      <div className="no-print card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          {certificate.revokedAt ? (
            <ShieldX className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          ) : (
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          )}
          <div>
            <p className="text-sm font-semibold text-ink-900">
              {certificate.revokedAt ? 'This certificate is revoked' : 'Anyone can verify this certificate'}
            </p>
            <p className="mt-0.5 text-sm text-ink-500">
              The QR code and the public link open /verify/{certificate.certificateId}, which shows the
              learner, course, date and status.
            </p>
          </div>
        </div>
        <Badge tone={certificate.revokedAt ? 'danger' : 'success'}>
          {certificate.revokedAt ? 'Revoked' : 'Valid'}
        </Badge>
      </div>
    </div>
  );
}
