'use client';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

const variantStyles = {
  primary: 'bg-brand text-white hover:bg-brand-soft',
  outline: 'border border-border-strong text-dark hover:bg-canvas',
  ghost: 'text-muted hover:text-dark hover:bg-canvas',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors ${variantStyles[variant]} ${sizeStyles[size]} disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
