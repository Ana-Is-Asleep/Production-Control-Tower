'use client';

import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { DataProvider } from '../context/DataContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['400', '500', '600', '700'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased bg-[#F4F4F6] text-[#111]">
        <DataProvider>
          {children}
        </DataProvider>
      </body>
    </html>
  );
}
