'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, FileBarChart, Database } from 'lucide-react';

interface NavItem {
  key: string;
  label: string;
  icon: typeof LayoutGrid;
  href: string | null; // null = not a real page yet
}

// "Raw data" is still a placeholder nav entry — no such page exists yet, so it renders disabled.
// Dashboard and Reports are real routes; which one is highlighted is driven by the current path,
// not a hardcoded flag, so this stays correct as more routes are added.
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, href: '/' },
  { key: 'reports', label: 'Reports', icon: FileBarChart, href: '/reports' },
  { key: 'raw-data', label: 'Raw data', icon: Database, href: null },
];

// Fixed light-theme left navigation shell — tokens (colors, radius, spacing) follow the Emma
// Omnihub UI design system's sidebar spec, simplified to just logo + nav items per the target
// design (no workspace selector / collapse toggle / profile footer requested here).
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[164px] shrink-0 h-screen sticky top-0 bg-white border-r border-[#e9e3df] flex flex-col">
      <div className="px-3 pt-3 pb-2">
        <img src="/emma-logo.svg" alt="emma" className="h-5 w-auto" />
      </div>
      <nav className="flex-1 min-h-0 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          // Dashboard covers every drill-down page too (they're all reached from it, per their
          // own "Dashboard > ..." breadcrumbs) — it's active whenever no other real route matches.
          const isActive = item.key === 'dashboard' ? !pathname.startsWith('/reports') : item.href !== null && pathname.startsWith(item.href);
          const className = `w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
            isActive
              ? 'bg-[#f5f2ee] text-[#1c1612] font-bold'
              : 'text-[#403833] font-medium hover:bg-[#f5f2ee] cursor-not-allowed opacity-60'
          }`;

          if (!item.href) {
            return (
              <button key={item.key} disabled className={className}>
                <Icon size={18} className="text-[#7b7571]" strokeWidth={2} />
                {item.label}
              </button>
            );
          }

          return (
            <Link key={item.key} href={item.href} className={className}>
              <Icon size={18} className={isActive ? 'text-[#1c1612]' : 'text-[#7b7571]'} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
