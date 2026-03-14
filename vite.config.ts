/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // Paths relativos para compatibilidade com itch.io e subdiretórios
  build: {
    outDir: 'docs'
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Tiny RPG Studio',
        short_name: 'Tiny RPG',
        description: 'Crie aventuras pixeladas e compartilhe seus mundos Tiny RPG Studio.',
        theme_color: '#1D2B53',
        background_color: '#05060e',
        display: 'standalone',
        start_url: '.',
        icons: [
          {
            src: './icons/icon-128.png',
            sizes: '128x128',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'examples/**'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'json-summary', 'text'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/**', 'docs/**', 'src/__tests__/**', 'tests/**', 'public/**', '*.config.*']
    }
  }
})
