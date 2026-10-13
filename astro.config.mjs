// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Static-first: every page is plain HTML on a CDN. The public origin comes from
// SITE_URL (defaults to lorecheck.co); src/site.ts reads the same value.
const SITE = process.env.SITE_URL || 'https://lorecheck.co';

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  server: { host: '127.0.0.1' },
  devToolbar: { enabled: false },
  vite: { plugins: [tailwindcss()] },
});
