'use client';

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, FileBarChart, Database, ListChecks, BookOpen, HelpCircle, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

interface NavItem {
  key: string;
  label: string;
  icon: typeof LayoutGrid;
  href: string | null; // null = not a real page yet
}

// Dashboard, Reports, Raw Data, Actions and Data Dictionary are all real routes; which one is
// highlighted is driven by the current path, not a hardcoded flag, so this stays correct as more
// routes are added.
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, href: '/' },
  { key: 'reports', label: 'Reports', icon: FileBarChart, href: '/reports' },
  { key: 'raw-data', label: 'Raw data', icon: Database, href: '/raw-data' },
  { key: 'actions', label: 'Actions', icon: ListChecks, href: '/actions' },
  { key: 'data-dictionary', label: 'Data Dictionary', icon: BookOpen, href: '/data-dictionary' },
];

// Help/Settings have no destination page yet, so — same as Raw Data before it existed — they
// render as disabled placeholders rather than linking somewhere fake.
const FOOTER_ITEMS: { key: string; label: string; icon: typeof HelpCircle }[] = [
  { key: 'help', label: 'Help', icon: HelpCircle },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const EXCLUSIVE_ROUTES = NAV_ITEMS.filter((i) => i.key !== 'dashboard').map((i) => i.href!);

// Fixed light-theme left navigation shell — tokens (colors, radius, spacing) follow the Emma
// Omnihub UI design system's sidebar spec. Collapsible to an icon-only rail; the collapsed state
// is local to this component so no other page needs to know or care about the sidebar's width.
export function Sidebar() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`${collapsed ? 'w-[56px]' : 'w-[164px]'} shrink-0 h-screen sticky top-0 bg-white border-r border-[#e9e3df] flex flex-col transition-[width] duration-150`}>
      <div className="px-3 pt-3 pb-2">
        {collapsed ? (
          <div className="w-5 h-5 rounded bg-brand" />
        ) : (
          <img src="/emma-logo.svg" alt="emma" className="h-5 w-auto" />
        )}
      </div>
      <nav className="flex-1 min-h-0 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          // Dashboard covers every drill-down page too (they're all reached from it, per their
          // own "Dashboard > ..." breadcrumbs) — it's active whenever no other real route matches.
          const isActive = item.key === 'dashboard'
            ? !EXCLUSIVE_ROUTES.some((r) => pathname.startsWith(r))
            : item.href !== null && pathname.startsWith(item.href);
          const className = `w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
            isActive
              ? 'bg-[#f5f2ee] text-[#1c1612] font-bold'
              : 'text-[#403833] font-medium hover:bg-[#f5f2ee] cursor-not-allowed opacity-60'
          }`;

          if (!item.href) {
            return (
              <button key={item.key} disabled className={className} title={collapsed ? item.label : undefined}>
                <Icon size={18} className="text-[#7b7571] shrink-0" strokeWidth={2} />
                {!collapsed && item.label}
              </button>
            );
          }

          return (
            <Link key={item.key} to={item.href} className={className} title={collapsed ? item.label : undefined}>
              <Icon size={18} className={`shrink-0 ${isActive ? 'text-[#1c1612]' : 'text-[#7b7571]'}`} strokeWidth={2} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-2 space-y-0.5 border-t border-[#f4f1ef] pt-2">
        {FOOTER_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              disabled
              title={collapsed ? item.label : undefined}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-[#403833] font-medium opacity-60 cursor-not-allowed"
            >
              <Icon size={18} className="text-[#7b7571] shrink-0" strokeWidth={2} />
              {!collapsed && item.label}
            </button>
          );
        })}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-[#403833] font-medium hover:bg-[#f5f2ee] transition-colors"
        >
          {collapsed ? <ChevronRight size={18} className="text-[#7b7571] shrink-0" strokeWidth={2} /> : <ChevronLeft size={18} className="text-[#7b7571] shrink-0" strokeWidth={2} />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}
