'use client';

// Everything now lives inline on the one dashboard route, so this is just a static
// product label rather than a multi-tab navigation bar.
export function NavTabs({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <span className="px-3 py-1.5 rounded-full text-[13px] font-semibold bg-[#403833] text-white">
        Overview
      </span>
    </div>
  );
}
