import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import solid from 'vite-plugin-solid';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mtmPlugin } from '@metamon/build-tools';

export default defineConfig({
  plugins: [
    // MTM Plugin - processes .mtm files
    mtmPlugin({
      include: ['**/*.mtm'],
      hmr: true,
      sourceMaps: true
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