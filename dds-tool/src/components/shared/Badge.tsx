'use client';

type BadgeVariant = 'pass' | 'fail' | 'warn' | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  pass: 'bg-pass-bg text-pass-text',
  fail: 'bg-fail-bg text-fail-text',
  warn: 'bg-warn-bg text-warn-text',
  neutral: 'bg-[#f4f1ef] text-[#58524e]',
};

const dotStyles: Record<BadgeVariant, string> = {
  pass: 'bg-pass',
  fail: 'bg-fail',
  warn: 'bg-warn',
  neutral: 'bg-[#9c9794]',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />
      {children}
    </span>
  );
}
