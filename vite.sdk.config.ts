import { defineConfig } from 'vite';

export default defineConfig({
    publicDir: false,
    build: {
        lib: {
            entry: { index: 'src/sdk/index.ts', browser: 'src/sdk/browser.ts', html: 'src/sdk/html.ts' },
            formats: ['es', 'cjs'],
            fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`
        },
        outDir: 'dist/sdk',
        emptyOutDir: true
    }
});
