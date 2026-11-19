import { defineConfig } from 'vite';

// base './' keeps asset URLs relative, so the page works on a GitHub Pages subpath.
export default defineConfig({
  base: './',
});
