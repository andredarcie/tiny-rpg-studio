import { defineConfig } from 'vite';

export default defineConfig({
    publicDir: false,
    build: {
        lib: {
            entry: 'src/sdk/index.ts',
            formats: ['es', 'cjs'],
            fileName: 'index'
        },
        outDir: 'dist/sdk',
        emptyOutDir: true
    }
});
