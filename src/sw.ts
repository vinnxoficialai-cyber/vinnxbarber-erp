/// <reference lib="webworker" />

// ============================================================
// VINNX Barber — Service Worker (injectManifest)
// Handles: precaching, runtime caching, push notifications
// ============================================================

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

// ═══════════════════════════════════════════
// PRECACHE — auto-injected by VitePWA build
// ═══════════════════════════════════════════
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

// ═══════════════════════════════════════════
// RUNTIME CACHING
// ═══════════════════════════════════════════

// Never cache Supabase auth/REST API calls
registerRoute(
  /^https:\/\/.*\.supabase\.co\/(auth|rest)\/.*/i,
  new NetworkOnly()
);

// Cache Supabase storage assets (images, avatars) with NetworkFirst
registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-storage-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
  })
);

// ═══════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════

const DEFAULT_ICON =
  'https://enjyflztvyomrlzddavk.supabase.co/storage/v1/object/public/avatars/public/pwa_icon_192.png';

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data: Record<string, unknown>;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'VINNX', body: event.data.text() };
  }

  const title = (data.title as string) || 'VINNX';
  const options: NotificationOptions & { image?: string; actions?: Array<{ action: string; title: string }>; vibrate?: number[] } = {
    body: (data.body as string) || '',
    icon: (data.icon as string) || DEFAULT_ICON,
    image: (data.image as string) || undefined,
    badge: (data.badge as string) || undefined,
    tag: (data.tag as string) || 'vinnx-' + Date.now(),
    data: { url: (data.url as string) || '/#/site' },
    vibrate: [200, 100, 200],
  };

  // Add actions if provided
  if (Array.isArray(data.actions)) {
    options.actions = data.actions as Array<{ action: string; title: string }>;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// ═══════════════════════════════════════════
// NOTIFICATION CLICK
// ═══════════════════════════════════════════

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data?.url as string) || '/#/site';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes('/#/site') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});

// ═══════════════════════════════════════════
// PUSH SUBSCRIPTION CHANGE
// When the browser revokes/expires the subscription,
// notify the open window so PublicSite.tsx can re-subscribe.
// ═══════════════════════════════════════════
self.addEventListener('pushsubscriptionchange', ((event: any) => {
  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window' }).then((clients: any[]) => {
      clients.forEach((client: any) => {
        client.postMessage({ type: 'push-subscription-expired' });
      });
    })
  );
}) as EventListener);
