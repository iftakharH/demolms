import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, ExternalLink } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { query } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RevokeCertificateForm } from '@/components/admin/revoke-certificate-form';
import { formatDate, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Certificates · Admin' };

export default async function AdminCertificatesPage() {
  const user = await requireStaff('/admin/certificates');

  const certificates = query<{
    certificateId: string;
    issuedAt: string;
    revokedAt: string | null;
    revokeReason: string | null;
    revokedByEmail: string | null;
    userName: string;
    userEmail: string;
    courseTitle: string;
  }>(
    `SELECT cert.certificate_id AS certificateId, cert.issued_at AS issuedAt, cert.revoked_at AS revokedAt,
            cert.revoke_reason AS revokeReason, ru.email AS revokedByEmail,
            u.name AS userName, u.email AS userEmail, c.title AS courseTitle
       FROM certificates cert
       JOIN users u ON u.id = cert.user_id
       JOIN courses c ON c.id = cert.course_id
       LEFT JOIN users ru ON ru.id = cert.revoked_by
      ORDER BY cert.issued_at DESC`,
  );

  const valid = certificates.filter((certificate) => !certificate.revokedAt);
  const revoked = certificates.filter((certificate) => certificate.revokedAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Certificates</h1>
        <p className="mt-1 text-sm text-ink-500">
          {valid.length} valid · {revoked.length} revoked. Revoking updates the public verification page
          immediately and notifies the learner.
        </p>
      </div>

      {certificates.length === 0 ? (
        <EmptyState
          icon={<Award className="size-8" aria-hidden />}
          title="No certificates issued yet"
          description="Certificates are issued automatically when a learner satisfies the course completion rules."
        />
      ) : (
        <ul className="space-y-4">
          {certificates.map((certificate) => (
            <li key={certificate.certificateId} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={certificate.revokedAt ? 'danger' : 'success'}>
                      {certificate.revokedAt ? 'Revoked' : 'Valid'}
                    </Badge>
                    <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">
                      {certificate.certificateId}
                    </code>
                    <span className="text-xs text-ink-500">issued {timeAgo(certificate.issuedAt)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-ink-900">{certificate.courseTitle}</p>
                  <p className="text-xs text-ink-500">
                    {certificate.userName} · {certificate.userEmail}
                  </p>
                  {certificate.revokedAt ? (
                    <p className="mt-2 text-xs text-danger">
                      Revoked {formatDate(certificate.revokedAt)}
                      {certificate.revokedByEmail ? ` by ${certificate.revokedByEmail}` : ''}
                      {certificate.revokeReason ? ` - ${certificate.revokeReason}` : ''}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/verify/${certificate.certificateId}`} className="btn-secondary btn-sm" target="_blank">
                    Verification page
                    <ExternalLink className="size-3" aria-hidden />
                  </Link>
                  <a
                    href={`/api/certificates/${certificate.certificateId}/pdf`}
                    className="btn-ghost btn-sm"
                    target="_blank"
                  >
                    PDF
                  </a>
                </div>
              </div>

              {!certificate.revokedAt ? (
                <div className="mt-4 border-t border-line pt-4">
                  <RevokeCertificateForm certificateId={certificate.certificateId} canWrite={user.role === 'admin'} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
