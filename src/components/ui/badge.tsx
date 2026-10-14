import type { ReactNode } from 'react';

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-100 text-brand-800',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  outline: 'border border-line text-ink-600',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={`badge ${TONES[tone]} ${className}`}>{children}</span>;
}

const COURSE_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  draft: { tone: 'warning', label: 'Draft' },
  published: { tone: 'success', label: 'Published' },
  archived: { tone: 'neutral', label: 'Archived' },
};

export function CourseStatusBadge({ status }: { status: string }) {
  const config = COURSE_STATUS[status] ?? { tone: 'neutral' as BadgeTone, label: status };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

const ORDER_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  pending: { tone: 'warning', label: 'Pending' },
  paid: { tone: 'success', label: 'Paid' },
  failed: { tone: 'danger', label: 'Failed' },
  refunded: { tone: 'info', label: 'Refunded' },
  partially_refunded: { tone: 'info', label: 'Partially refunded' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const config = ORDER_STATUS[status] ?? { tone: 'neutral' as BadgeTone, label: status };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

const SUBMISSION_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  submitted: { tone: 'warning', label: 'Awaiting grading' },
  graded: { tone: 'success', label: 'Graded' },
  resubmission_requested: { tone: 'info', label: 'Resubmission requested' },
  pending_review: { tone: 'warning', label: 'Pending review' },
};

export function SubmissionStatusBadge({ status }: { status: string }) {
  const config = SUBMISSION_STATUS[status] ?? { tone: 'neutral' as BadgeTone, label: status };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
