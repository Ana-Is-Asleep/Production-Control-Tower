'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { DataProvider } from '../context/DataContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-[#f5f2ee] text-[#403833]">
        <DataProvider>
          {children}
        </DataProvider>
      </body>
    </html>
  );
}
