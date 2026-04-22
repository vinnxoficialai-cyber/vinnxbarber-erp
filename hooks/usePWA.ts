import { useEffect, useRef } from "react";

// ============================================================
// PWA MANIFEST CONFIGURATION
// ============================================================

interface PWAManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  orientation: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
}

// Default icons from the existing vite.config.ts
const SUPABASE_ICON_BASE = "https://enjyflztvyomrlzddavk.supabase.co/storage/v1/object/public/avatars/public";

const DEFAULT_ICONS = [
  { src: `${SUPABASE_ICON_BASE}/pwa_icon_192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
  { src: `${SUPABASE_ICON_BASE}/pwa_icon_512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
  { src: `${SUPABASE_ICON_BASE}/pwa_icon_maskable_192.png`, sizes: "192x192", type: "image/png", purpose: "maskable" },
  { src: `${SUPABASE_ICON_BASE}/pwa_icon_maskable_512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
];

const DEFAULT_MANIFEST: PWAManifest = {
  name: "VINNX BARBER",
  short_name: "VINNX",
  description: "Agende seu horário na melhor barbearia",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#0f172a",
  theme_color: "#10b981",
  orientation: "portrait-primary",
  icons: DEFAULT_ICONS,
};

// ============================================================
// usePWA HOOK
// Dynamically injects manifest + updates theme-color meta
// based on store_settings from Supabase.
//
// The VitePWA plugin still generates the Service Worker at build
// time. This hook only overrides the <link rel="manifest"> href
// at runtime with a blob URL containing dynamic settings.
// ============================================================

export function usePWA(settings: Record<string, string>) {
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Build manifest from defaults + user overrides
    const manifest: PWAManifest = { ...DEFAULT_MANIFEST };

    if (settings["pwa_store_name"]) manifest.name = settings["pwa_store_name"];
    if (settings["pwa_store_short_name"]) manifest.short_name = settings["pwa_store_short_name"];
    if (settings["pwa_store_theme_color"]) manifest.theme_color = settings["pwa_store_theme_color"];
    if (settings["pwa_store_bg_color"]) manifest.background_color = settings["pwa_store_bg_color"];
    if (settings["pwa_store_icon"]) {
      manifest.icons = [
        { src: settings["pwa_store_icon"], sizes: "512x512", type: "image/png" },
        { src: settings["pwa_store_icon"], sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];
    }

    // ── Inject manifest via blob URL ──
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = url;

    // ── Update theme-color meta ──
    let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = manifest.theme_color;

    // ── Update apple-touch-icon ──
    const iconSrc = manifest.icons[0]?.src;
    if (iconSrc) {
      let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
      if (!appleTouchIcon) {
        appleTouchIcon = document.createElement("link");
        appleTouchIcon.rel = "apple-touch-icon";
        document.head.appendChild(appleTouchIcon);
      }
      appleTouchIcon.href = iconSrc;
    }

    // ── Update apple-mobile-web-app-title ──
    let appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    if (!appTitle) {
      appTitle = document.createElement("meta");
      appTitle.name = "apple-mobile-web-app-title";
      document.head.appendChild(appTitle);
    }
    appTitle.content = manifest.short_name;

    // Revoke previous blob
    const oldUrl = blobUrlRef.current;
    blobUrlRef.current = url;
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }
  }, [settings]);
}
