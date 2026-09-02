import type { Config } from 'tailwindcss';

// Color tokens carried over exactly from the Next.js app's tailwind.config.ts — every component
// ported so far references these class names directly, so they must not drift.
const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas:         '#f5f2ee',
        surface:        '#f9f7f6',
        card:           '#FFFFFF',
        navy:           '#403833',
        brand:          '#FF8900',
        'brand-soft':   '#FFA236',
        'brand-dim':    'rgba(255,137,0,0.12)',
        dark:           '#403833',
        secondary:      '#58524e',
        muted:          '#7b7571',
        border:         '#e9e3df',
        'border-strong':'#d5cdc6',
        pass:           '#15803d',
        'pass-bg':      '#DCFCE7',
        'pass-text':    '#14532D',
        fail:           '#dc2626',
        'fail-bg':      '#FEE2E2',
        'fail-text':    '#991B1B',
        warn:           '#F59E0B',
        'warn-bg':      '#FEF3C7',
        'warn-text':    '#92400E',
      },
      fontFamily: {
        display: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
