'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface LargeModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  rightActions?: React.ReactNode;
}

// Shared ~90-95vw x ~85-90vh overlay for anything that needs to break out of its small card
// (expanded charts, "view all" tables) — closes via the X, the Esc key, or a click on the backdrop.
export function LargeModal({ title, onClose, children, rightActions }: LargeModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#f5f2ee] rounded-lg w-full flex flex-col overflow-hidden"
        style={{ width: '94vw', height: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-[#e9e3df] shrink-0">
          <p className="text-sm font-bold text-[#403833]">{title}</p>
          <div className="flex items-center gap-2">
            {rightActions}
            <button onClick={onClose} title="Close" className="p-1.5 rounded hover:bg-[#f5f2ee] text-[#7b7571]">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
