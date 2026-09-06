// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

import { site } from './src/config/site.ts';

// Pages that must never appear in the sitemap: noindex/internal only.
// Keep in sync with any page that sets <meta name="robots" content="noindex">.
const SITEMAP_EXCLUDE = ['/style-guide/', '/jobber-connected/'];

// https://astro.build/config
export default defineConfig({
  // Canonical origin for the whole site. Single source of truth lives in
  // src/config/site.ts so the domain can never drift between the
  // <link rel="canonical"> tags and the sitemap.
  site: site.url,

  integrations: [
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDE.includes(new URL(page).pathname),
    }),
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});
