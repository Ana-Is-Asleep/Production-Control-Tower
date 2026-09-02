'use client';

import { useEffect } from 'react';

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function SlideOver({ open, onClose, title, children, width = 'w-[720px]' }: SlideOverProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-dark/30" onClick={onClose} />
      <div
        className={`relative ${width} max-w-full bg-card h-full flex flex-col overflow-hidden`}
        style={{ boxShadow: 'var(--shadow-slide)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-navy font-semibold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-dark transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
