'use client';

import { useState } from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  expandable?: boolean;
  expandedContent?: React.ReactNode;
}

export function Card({ children, className = '', expandable = false, expandedContent }: CardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-card rounded-xl border border-border transition-all duration-200 ease-in-out ${className}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card-hover)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'; }}
    >
      <div>{children}</div>
      {expandable && expandedContent && (
        <>
          <div className="px-4 pb-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-muted hover:text-dark transition-colors flex items-center gap-1"
            >
              <span>{expanded ? '▲ Collapse' : '▼ Expand details'}</span>
            </button>
          </div>
          {expanded && (
            <div className="border-t border-border transition-all duration-200 ease-in-out">
              {expandedContent}
            </div>
          )}
        </>
      )}
    </div>
  );
}
