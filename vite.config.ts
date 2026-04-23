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
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        manifest: {
          name: 'VINNX ERP',
          short_name: 'VINNX',
          description: 'Sistema ERP completo para gestão empresarial',
          theme_color: '#10b981',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/#/site',
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
        injectManifest: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html'
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
