import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { APP_URL } from './env';

/**
 * Certificate PDF, generated locally with pdfkit + a QR code that points at the
 * public verification page.
 */

export interface CertificatePdfInput {
  certificateId: string;
  learnerName: string;
  courseTitle: string;
  courseSubtitle: string;
  instructorName: string;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

function formatIssued(value: string): string {
  const date = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(date);
}

export async function buildCertificatePdf(input: CertificatePdfInput): Promise<Buffer> {
  const verifyUrl = `${APP_URL}/verify/${input.certificateId}`;
  const qrPng = await QRCode.toBuffer(verifyUrl, {
    type: 'png',
    margin: 0,
    width: 320,
    color: { dark: '#1b1a24', light: '#ffffff' },
  });

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    info: {
      Title: `Certificate ${input.certificateId}`,
      Author: 'demolms (demo)',
      Subject: input.courseTitle,
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width;
  const height = doc.page.height;

  // ---- background + border
  doc.rect(0, 0, width, height).fill('#ffffff');
  doc.rect(24, 24, width - 48, height - 48).lineWidth(2).strokeColor('#6c4cf1').stroke();
  doc.rect(34, 34, width - 68, height - 68).lineWidth(0.75).strokeColor('#c9c1fb').stroke();

  // corner marks
  doc.save();
  doc.rect(24, 24, 96, 6).fill('#6c4cf1');
  doc.rect(width - 120, height - 30, 96, 6).fill('#6c4cf1');
  doc.restore();

  // ---- header
  doc
    .fillColor('#6c4cf1')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text('DEMOLMS · CERTIFICATE OF COMPLETION', 0, 74, { align: 'center', characterSpacing: 2 });

  doc
    .fillColor('#1b1a24')
    .font('Helvetica-Bold')
    .fontSize(38)
    .text(input.learnerName, 60, 128, { align: 'center' });

  doc
    .fillColor('#5c5a6b')
    .font('Helvetica')
    .fontSize(14)
    .text('has successfully completed the course', 60, 184, { align: 'center' });

  doc
    .fillColor('#1b1a24')
    .font('Helvetica-Bold')
    .fontSize(24)
    .text(input.courseTitle, 80, 214, { align: 'center', width: width - 160 });

  if (input.courseSubtitle) {
    doc
      .fillColor('#5c5a6b')
      .font('Helvetica-Oblique')
      .fontSize(12)
      .text(input.courseSubtitle, 80, 246, { align: 'center', width: width - 160 });
  }

  // ---- rule
  doc
    .moveTo(width / 2 - 120, 286)
    .lineTo(width / 2 + 120, 286)
    .lineWidth(1)
    .strokeColor('#e8e7f0')
    .stroke();

  // ---- signature block
  doc
    .fillColor('#1b1a24')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(input.instructorName, 96, 320, { width: 220, align: 'center' });
  doc
    .moveTo(96, 340)
    .lineTo(316, 340)
    .lineWidth(0.75)
    .strokeColor('#d9d8e4')
    .stroke();
  doc
    .fillColor('#7c7a8c')
    .font('Helvetica')
    .fontSize(9)
    .text('Course instructor', 96, 346, { width: 220, align: 'center' });

  doc
    .fillColor('#1b1a24')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(formatIssued(input.issuedAt), width - 316, 320, { width: 220, align: 'center' });
  doc
    .moveTo(width - 316, 340)
    .lineTo(width - 96, 340)
    .lineWidth(0.75)
    .strokeColor('#d9d8e4')
    .stroke();
  doc
    .fillColor('#7c7a8c')
    .font('Helvetica')
    .fontSize(9)
    .text('Date of issue', width - 316, 346, { width: 220, align: 'center' });

  // ---- QR + id
  doc.image(qrPng, width / 2 - 42, 300, { width: 84, height: 84 });
  doc
    .fillColor('#7c7a8c')
    .font('Helvetica')
    .fontSize(8)
    .text('Scan to verify', width / 2 - 60, 390, { width: 120, align: 'center' });

  doc
    .fillColor('#5c5a6b')
    .font('Helvetica')
    .fontSize(9)
    .text(
      `Certificate ID ${input.certificateId} · verify at ${verifyUrl}`,
      60,
      height - 72,
      { align: 'center', width: width - 120 },
    );

  if (input.revokedAt) {
    doc
      .save()
      .fillColor('#dc2626')
      .font('Helvetica-Bold')
      .fontSize(46)
      .opacity(0.18)
      .rotate(-18, { origin: [width / 2, height / 2] })
      .text('REVOKED', 0, height / 2 - 30, { align: 'center', width })
      .restore();
    doc
      .fillColor('#dc2626')
      .font('Helvetica')
      .fontSize(10)
      .text(
        `Revoked on ${formatIssued(input.revokedAt)}${input.revokeReason ? ` - ${input.revokeReason}` : ''}`,
        60,
        height - 56,
        { align: 'center', width: width - 120 },
      );
  }

  doc.end();
  return done;
}

/** PNG data URL for the verification QR, used on the certificate page itself. */
export async function verificationQrDataUrl(certificateId: string, size = 180): Promise<string> {
  return QRCode.toDataURL(`${APP_URL}/verify/${certificateId}`, {
    margin: 1,
    width: size,
    color: { dark: '#1b1a24', light: '#ffffff' },
  });
}
