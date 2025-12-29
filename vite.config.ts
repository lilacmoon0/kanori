import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'mascot.png', 'mascot.png'],
      manifest: {
        name: 'Life Management App',
        short_name: 'kanori',
        description: 'Life Management App',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          {
            src: '/mascot-pwa.png',
            sizes: 'any',
            type: 'image/svg+xml',
          },
          {
            src: '/mascot-pwa.png',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'https://kanori-service.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('element-plus')) return 'vendor-element-plus'
          if (id.includes('apexcharts') || id.includes('vue3-apexcharts')) return 'vendor-charts'
          if (id.includes('pinia')) return 'vendor-pinia'
          if (id.includes('vue-router')) return 'vendor-vue-router'
          if (id.includes('vue')) return 'vendor-vue'
          if (id.includes('lucide-vue-next')) return 'vendor-icons'

          return 'vendor'
        },
      },
    },
  },
})
