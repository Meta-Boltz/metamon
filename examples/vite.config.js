import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import solid from 'vite-plugin-solid';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
// import { mtmPlugin } from './build/mtm-plugin.js';

export default defineConfig({
  plugins: [
    // mtmPlugin(), // Temporarily disabled for testing
    tailwindcss(),
    react({
      include: ['**/*.jsx', '**/*.tsx']
    }),
    vue({
      include: ['**/*.vue']
    }),
    solid({
      include: ['**/components/Solid*.jsx']
    }),
    svelte({
      include: ['**/*.svelte']
    })
  ],
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@styles': '/src/styles'
    }
  },
  server: {
    port: 3000,
    open: true
  },

  build: {
    outDir: 'dist',
    sourcemap: true
  }
});