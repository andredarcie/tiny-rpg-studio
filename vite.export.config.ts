import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Paths relativos para compatibilidade com itch.io
  publicDir: false,
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'TinyRPGExport',
      formats: ['iife'],
      fileName: () => 'export.bundle.js',
    },
    outDir: 'public',
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
