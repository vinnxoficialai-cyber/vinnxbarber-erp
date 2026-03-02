import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'VINNX ERP',
          short_name: 'VINNX',
          description: 'Sistema ERP completo para gestão empresarial',
          theme_color: '#10b981',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'https://enjyflztvyomrlzddavk.supabase.co/storage/v1/object/public/avatars/public/pwa_icon_192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'https://enjyflztvyomrlzddavk.supabase.co/storage/v1/object/public/avatars/public/pwa_icon_512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'https://enjyflztvyomrlzddavk.supabase.co/storage/v1/object/public/avatars/public/pwa_icon_maskable_192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'https://enjyflztvyomrlzddavk.supabase.co/storage/v1/object/public/avatars/public/pwa_icon_maskable_512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          categories: ['business', 'productivity', 'finance'],
          screenshots: [
            {
              src: 'screenshot-desktop.png',
              sizes: '1920x1080',
              type: 'image/png',
              form_factor: 'wide'
            },
            {
              src: 'screenshot-mobile.png',
              sizes: '750x1334',
              type: 'image/png',
              form_factor: 'narrow'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              // Never cache auth or REST API calls — always go to network
              urlPattern: /^https:\/\/.*\.supabase\.co\/(auth|rest)\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Cache storage assets (images, avatars) with NetworkFirst
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-storage-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
