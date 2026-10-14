import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <span
        data-brand-tile
        className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_18px_-10px_rgba(108,76,241,.95)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
      >
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <span className="text-[1.05rem] font-semibold tracking-tight text-ink-900">
        demo<span className="text-brand-700">lms</span>
      </span>
    </Link>
  );
}
