import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { certificateByPublicId } from '@/lib/certificates';
import { queryOne } from '@/lib/db';
import { buildCertificatePdf } from '@/lib/certificate-pdf';
import { isStaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Certificate PDF download. Restricted to the certificate owner and staff -
 * the *verification* page is the public surface.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> },
) {
  const { certificateId } = await params;
  const certificate = certificateByPublicId(certificateId);
  if (!certificate) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to download this certificate.' }, { status: 401 });
  if (user.id !== certificate.userId && !isStaffRole(user.role)) {
    return NextResponse.json({ error: 'That certificate belongs to someone else.' }, { status: 403 });
  }

  const course = queryOne<{ subtitle: string }>('SELECT subtitle FROM courses WHERE id = ?', certificate.courseId);

  const pdf = await buildCertificatePdf({
    certificateId: certificate.certificateId,
    learnerName: certificate.userName,
    courseTitle: certificate.courseTitle,
    courseSubtitle: course?.subtitle ?? '',
    instructorName: certificate.instructorName,
    issuedAt: certificate.issuedAt,
    revokedAt: certificate.revokedAt,
    revokeReason: certificate.revokeReason,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${certificate.certificateId}.pdf"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'private, no-store',
    },
  });
}
