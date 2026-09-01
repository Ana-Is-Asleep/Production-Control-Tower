'use client';

import { LayoutGrid, FileBarChart, Database } from 'lucide-react';

interface NavItem {
  key: string;
  label: string;
  icon: typeof LayoutGrid;
  active: boolean;
}

// "Reports" and "Raw data" are placeholder nav entries matching the target design — this app is
// still a single dashboard route, so they render but don't navigate anywhere yet. Only "Dashboard"
// is a real, active page.
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, active: true },
  { key: 'reports', label: 'Reports', icon: FileBarChart, active: false },
  { key: 'raw-data', label: 'Raw data', icon: Database, active: false },
];

// Fixed light-theme left navigation shell — tokens (colors, radius, spacing) follow the Emma
// Omnihub UI design system's sidebar spec, simplified to just logo + nav items per the target
// design (no workspace selector / collapse toggle / profile footer requested here).
export function Sidebar() {
  return (
    <aside className="w-[164px] shrink-0 h-screen bg-white border-r border-[#e9e3df] flex flex-col">
      <div className="px-3 pt-3 pb-2">
        <img src="/emma-logo.svg" alt="emma" className="h-5 w-auto" />
      </div>
      <nav className="flex-1 min-h-0 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              disabled={!item.active}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                item.active
                  ? 'bg-[#f5f2ee] text-[#1c1612] font-bold'
                  : 'text-[#403833] font-medium hover:bg-[#f5f2ee] cursor-not-allowed opacity-60'
              }`}
            >
              <Icon size={18} className={item.active ? 'text-[#1c1612]' : 'text-[#7b7571]'} strokeWidth={2} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
