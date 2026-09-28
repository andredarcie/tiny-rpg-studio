/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

/**
 * Makes the bundle's stylesheet links non-render-blocking so the inline boot
 * loading screen paints immediately, even on extremely slow connections. The
 * full-page boot overlay masks the brief unstyled flash; the engine is only
 * revealed once the styles (and assets) have loaded. Build-only — the dev
 * server injects CSS via JS and emits no stylesheet links.
 */
function asyncBundleCss(): Plugin {
  return {
    name: 'async-bundle-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          /<link\b([^>]*?)\brel="stylesheet"([^>]*)>/g,
          (match, before: string, after: string) => {
            if (!/\bhref="/.test(match)) return match;
            const attrs = `${before} ${after}`.replace(/\s+/g, ' ').trim();
            const asyncLink = `<link ${attrs} rel="stylesheet" media="print" onload="this.media='all'">`;
            const fallback = `<noscript><link ${attrs} rel="stylesheet"></noscript>`;
            return `${asyncLink}${fallback}`;
          },
        );
      },
    },
  };
}

function createAppVersion(): string {
  const envVersion = process.env.VITE_APP_VERSION;
  if (envVersion?.trim()) return envVersion.trim();
  const buildStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${pkg.version}+${buildStamp}`;
}

function emitVersionManifest(version: string): Plugin {
  return {
    name: 'emit-version-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify({ version }, null, 2)}\n`,
      });
    },
  };
}

const appVersion = createAppVersion();

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  base: './', // Paths relativos para compatibilidade com itch.io e subdiretórios
  build: {
    outDir: 'docs'
  },
  plugins: [
    asyncBundleCss(),
    emitVersionManifest(appVersion),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      workbox: {
        globIgnores: ['**/version.json', '**/plugins/**'],
      },
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
    exclude: ['tests/e2e/**', 'node_modules/**', 'examples/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'json-summary', 'text'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/**', 'docs/**', 'src/__tests__/**', 'tests/**', 'public/**', '*.config.*']
    }
  }
})
