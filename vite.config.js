import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'crown-logo.png', 'ctpat-logo.png'],
      workbox: {
        // Precargar el app shell: HTML, JS, CSS, fuentes, imágenes
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        // No cachear las llamadas a la API (se manejan por separado)
        navigateFallbackDenylist: [/^\/api\//],
        // Tamaño máximo de cache para precarga
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // Cachear fuentes de Google
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            // Cachear imágenes de Vercel Blob (PDFs/logos externos)
            urlPattern: /^https:\/\/.*\.public\.blob\.vercel-storage\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'blob-assets-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      manifest: {
        lang: 'es',
        name: 'Crown Xpress Transport · Inspección',
        short_name: 'Crown Inspección',
        description: 'Sistema de Inspección de 20 Puntos - Crown Xpress Transport',
        theme_color: '#1e5b7a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/crown-logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/crown-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
