import { avatarTint, initials } from '@/lib/format';

/** Initials avatar with a deterministic tint. No external image hosts. */
export function Avatar({
  name,
  src,
  size = 'md',
  className = '',
}: {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizes: Record<string, string> = {
    xs: 'size-6 text-[0.625rem]',
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-14 text-base',
    xl: 'size-20 text-xl',
  };
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${sizes[size]} ${className}`;

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- local /uploads files, no optimisation needed
    return <img src={src} alt={name} className={`${base} object-cover`} />;
  }

  return (
    <span className={`${base} ${avatarTint(name)}`} aria-hidden>
      {initials(name)}
    </span>
  );
}
