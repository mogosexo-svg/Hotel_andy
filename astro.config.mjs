import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://hotelandyatacames.org',
  output: 'static',
  integrations: [react(), sitemap({ filter: (p) => !p.includes('/panel') })],
});
