import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas:         '#FAF4E8',
        card:           '#FFFFFF',
        navy:           '#1E2A3A',
        brand:          '#FF8900',
        'brand-soft':   '#FFA236',
        'brand-dim':    'rgba(255,137,0,0.12)',
        dark:           '#2C2825',
        secondary:      '#3D3730',
        muted:          '#8A7E74',
        border:         '#E2D8C6',
        'border-strong':'#C8BAA6',
        pass:           '#34A853',
        'pass-bg':      '#DCFCE7',
        'pass-text':    '#14532D',
        fail:           '#DC3545',
        'fail-bg':      '#FEE2E2',
        'fail-text':    '#991B1B',
        warn:           '#F59E0B',
        'warn-bg':      '#FEF3C7',
        'warn-text':    '#92400E',
      },
      fontFamily: {
        serif:   ['Georgia', 'serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
