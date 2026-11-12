// Vite settings. The Tailwind plugin turns the Tailwind classes used in the
// HTML and JavaScript into real CSS.
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
});
