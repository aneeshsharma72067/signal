// @ts-check
import { defineConfig } from 'astro/config';

// Static marketing site. Zero client JS by default — brutalism is flat CSS,
// so nothing hydrates unless a component opts in with a client: directive.
export default defineConfig({
  site: 'https://getsignal.app',
});
