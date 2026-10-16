import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <span
        data-brand-tile
        className="flex size-8 items-center justify-center rounded-[0.5rem] bg-primary text-primary-fg transition-transform duration-200 group-hover:-translate-y-px"
      >
        <GraduationCap className="size-4.5" aria-hidden />
      </span>
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink-900">
        demo<span className="text-brand-700">lms</span>
      </span>
    </Link>
  );
}
