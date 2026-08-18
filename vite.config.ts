import { defineConfig } from 'vite';

// base relativa e saida em IIFE: o jogo roda em subpasta, em file:// e
// como arquivo unico, sem depender de modulos ES servidos por http.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
