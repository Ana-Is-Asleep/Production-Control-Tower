'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useData } from '../../context/DataContext';

const TABS = [
  { label: 'Overview',   href: '/' },
  { label: 'SOT + OTIF', href: '/sot-otif' },
  { label: 'Backlog',    href: '/backlog' },
  { label: 'Not Booked', href: '/not-booked' },
  { label: 'Invoices',   href: '/invoices' },
  { label: 'Pickups',    href: '/pickups' },
  { label: 'Lead Times', href: '/lead-times' },
  { label: 'SKU',        href: '/sku' },
];

interface NavTabsProps {
  className?: string;
}

export function NavTabs({ className = '' }: NavTabsProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { allLines } = useData();
  const hasData = allLines.length > 0;

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {TABS.map((tab) => {
        const isActive  = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        const disabled  = !hasData && tab.href !== '/';
        return (
          <button
            key={tab.href}
            onClick={() => { if (!disabled) router.push(tab.href); }}
            disabled={disabled}
            className={`px-[18px] py-2 rounded-full text-[13px] font-semibold border transition-all duration-150
              ${isActive
                ? 'bg-[#403833] text-white border-[#403833]'
                : disabled
                  ? 'bg-white text-[#c8c0bb] border-[#e9e3df] cursor-not-allowed'
                  : 'bg-white text-[#7b7571] border-[#e9e3df] hover:text-[#403833] hover:border-[#403833]'
              }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
