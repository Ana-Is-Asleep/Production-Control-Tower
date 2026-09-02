import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Static site: relative asset links (base: './') so dist/ can be dropped into any subpath
// without a rebuild, matching the "vite build outputs to dist/ with relative links" requirement.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
