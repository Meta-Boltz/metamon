import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import solid from 'vite-plugin-solid';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mtmPluginFixed } from './src/mtm-plugin-fixed.js';

export default defineConfig({
  plugins: [
    // Fixed MTM Plugin with chunk loader compatibility - must be first
    mtmPluginFixed({
      include: ['**/*.mtm'],
      hmr: true,
      sourceMaps: true,
      ssr: true,
      safePropertyAssignment: true,
      chunkCompatMode: 'safe'
    }),
    react({
      include: ['**/*.jsx', '**/*.tsx'],
      exclude: ['**/components/Solid*.jsx', '**/components/Svelte*.svelte']
    }),
    vue({
      include: ['**/*.vue']
    }),
    solid({
      include: ['**/components/Solid*.jsx', '**/mount-solid.js'],
      exclude: ['**/components/React*.jsx', '**/components/Shared*.jsx']
    }),
    svelte({
      include: ['**/*.svelte']
    })
  ],
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages'
    }
  },
  server: {
    port: 3000
  }
});