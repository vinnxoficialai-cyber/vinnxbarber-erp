import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Calendar, Clock, History, Star, User, ChevronRight, ChevronLeft,
  MapPin, Scissors, Store, Loader2, LogOut, Check, X, AlertTriangle,
  Gift, Share2, Bell, Edit3, Lock, Eye, EyeOff, Camera, CreditCard,
  Phone, Mail, Award, Heart, Settings, ChevronDown, ChevronUp,
  MessageCircle, Copy, ExternalLink, Pause, XCircle, RefreshCw,
} from "lucide-react";
import type { CalendarEvent, WorkSchedule, Service, SubscriptionPlan, Subscription } from "../types";
import { usePlatform } from "../hooks/usePlatform";

// ============================================================
// DEDICATED Supabase client for PublicSite
// - Custom fetch injects saved access_token for REST calls,
//   ensuring auth survives SDK's internal SIGNED_OUT wipes
// - autoRefreshToken: false → no token validation pings
// ============================================================

// Module-level token storage — outside SDK's control
let _psAccessToken: string | null = null;
// Flag to prevent loadClientProfile auto-create during migration claim
let _migrationClaimInProgress = false;

// Capture beforeinstallprompt at module level (fires before React mounts)
let _deferredInstallPrompt: Event | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstallPrompt = e;
});

// Check JWT expiration without external deps
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch { return true; }
}

// Silent refresh — direct HTTP to GoTrue (bypasses SDK event system)
async function silentRefresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access_token && data.refresh_token) return data;
    return null;
  } catch { return null; }
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: true,
      storageKey: "vinnx-ps-auth", // Isolate from ERP's GoTrueClient BroadcastChannel
    },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        // Inject access token for REST API calls (RLS-protected)
        if (_psAccessToken && typeof input === "string" && input.includes("/rest/v1/")) {
          const headers = new Headers(init?.headers);
          headers.set("Authorization", `Bearer ${_psAccessToken}`);
          return fetch(input, { ...init, headers });
        }
        return fetch(input, init);
      }
    }
  }
);

// ============================================================
// STANDALONE QueryClient for PublicSite (no ERP providers)
// ============================================================
const publicQueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
});

// ============================================================
// INLINE useStoreSettings — uses our dedicated client
// (avoids importing useStoreCustomization which imports lib/supabase
//  and creates a second GoTrueClient that interferes via BroadcastChannel)
// ============================================================
function useStoreSettings(): (key: string, fallback?: string) => string {
  const { data } = useQuery({
    queryKey: ["store-customization"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return (data ?? []) as { key: string; value: string | null }[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [preview, setPreview] = useState<Record<string, string>>({});

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "store-customizer-preview" && typeof event.data.draft === "object") {
        setPreview(event.data.draft);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const map = useMemo(() => {
    const m: Record<string, string> = {};
    if (data) for (const s of data) if (s.value !== null) m[s.key] = s.value;
    return m;
  }, [data]);

  const merged = useMemo(() => {
    return Object.keys(preview).length > 0 ? { ...map, ...preview } : map;
  }, [map, preview]);

  return useCallback(
    (key: string, fallback: string = ""): string => merged[key] ?? fallback,
    [merged]
  );
}

// ============================================================
// WRAPPER — provides its own QueryClient
// ============================================================
export default function PublicSite() {
  return (
    <QueryClientProvider client={publicQueryClient}>
      <PublicSiteApp />
    </QueryClientProvider>
  );
}

// ============================================================
// TYPES
// ============================================================
type ViewName = "agendar" | "historico" | "planos" | "perfil";
type ModalPosition = "bottom" | "center" | "fullscreen";

interface SelectionState {
  unit: any | null;
  barber: any | null;
  service: Service | null;
  date: Date | null;
  time: string | null;
  isFromCreditRedemption?: boolean;
}

// ============================================================
// HELPERS
// ============================================================
function formatPhone(value: string): string {
  const v = value.replace(/\D/g, "").substring(0, 11);
  if (v.length <= 2) return v.length > 0 ? `(${v}` : "";
  if (v.length <= 3) return `(${v.substring(0, 2)}) ${v.substring(2)}`;
  if (v.length <= 7) return `(${v.substring(0, 2)}) ${v.substring(2, 3)} ${v.substring(3)}`;
  return `(${v.substring(0, 2)}) ${v.substring(2, 3)} ${v.substring(3, 7)}-${v.substring(7)}`;
}

function formatBirthdate(value: string): string {
  let v = value.replace(/\D/g, "").substring(0, 8);
  if (v.length > 2) v = `${v.substring(0, 2)}/${v.substring(2)}`;
  if (v.length > 5) v = `${v.substring(0, 5)}/${v.substring(5, 9)}`;
  return v;
}

// Smart capitalize: capitalize first letter of each word,
// except Portuguese prepositions/articles (de, do, dos, da, das, e, etc.)
const _lowercaseWords = new Set(["de", "do", "dos", "da", "das", "e", "em", "no", "na", "nos", "nas", "por", "para", "com"]);
function smartCapitalize(value: string): string {
  return value.replace(/\S+/g, (word, index) => {
    if (index > 0 && _lowercaseWords.has(word.toLowerCase())) {
      return word.toLowerCase();
    }
    if (word.length === 0) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

// Scroll-aware fade: only shows fade on edges with hidden content
function ScrollFadeList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mask, setMask] = useState("none");
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const canScroll = scrollHeight > clientHeight + 2;
      setOverflows(canScroll);
      if (!canScroll) { setMask("none"); return; }
      const top = scrollTop > 4;
      const bottom = scrollTop + clientHeight < scrollHeight - 4;
      if (top && bottom) setMask("linear-gradient(to bottom, transparent, black 32px, black calc(100% - 32px), transparent)");
      else if (top) setMask("linear-gradient(to bottom, transparent, black 32px)");
      else if (bottom) setMask("linear-gradient(to bottom, black calc(100% - 32px), transparent)");
      else setMask("none");
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [children]);

  return <div ref={ref} className={className} style={{ WebkitMaskImage: mask, maskImage: mask, paddingRight: overflows ? "0.75rem" : undefined }}>{children}</div>;
}

function generateTimeSlots(start: string, end: string, interval: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let totalMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (totalMin < endMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    totalMin += interval;
  }
  return slots;
}

function isInBreak(slot: string, breakStart?: string, breakEnd?: string): boolean {
  if (!breakStart || !breakEnd) return false;
  return slot >= breakStart && slot < breakEnd;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function copyToClipboard(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// ============================================================
// MAIN APP COMPONENT
// ============================================================
function PublicSiteApp() {
  const g = useStoreSettings();
  const isPreview = typeof window !== "undefined" && window.parent !== window;

  // Reveal root (hidden via index.html to prevent admin flash)
  useEffect(() => { document.getElementById("root")?.classList.add("app-ready"); }, []);

  // --- Theme from StoreCustomizer ---
  const primary = g("theme.primary_color", "#00BF62");
  const bgColor = g("theme.bg_color", "#111111");
  const cardBg = g("theme.card_bg_color", "#222222");
  const textColor = g("theme.text_color", "#ffffff");
  const fontFamily = g("theme.font_family", "Inter, sans-serif");
  const headingFont = g("theme.heading_font", "") || fontFamily;
  const btnRadius = g("theme.btn_radius", "8");
  const btnBg = g("theme.btn_bg_color", "") || primary;
  const btnText = g("theme.btn_text_color", "") || bgColor;
  const cardRadius = g("theme.card_radius", "12");
  const cardShadow = g("theme.card_shadow", "true") !== "false";
  const navbarBgColor = g("navbar.bg_color", "");
  const navbarActiveColor = g("navbar.active_color", "") || primary;
  const navbarShowLabels = g("navbar.show_labels", "true") !== "false";

  // --- Navbar tab configuration ---
  const defaultTab = g("navbar.default_tab", "agendar") as ViewName;
  const tabDefs = useMemo(() => {
    const raw = [
      { key: "agendar" as ViewName, icon: Calendar, defaultLabel: "Agendar" },
      { key: "historico" as ViewName, icon: History, defaultLabel: "Histórico" },
      { key: "planos" as ViewName, icon: Star, defaultLabel: "Planos" },
      { key: "perfil" as ViewName, icon: User, defaultLabel: "Perfil" },
    ];
    // Apply visibility, labels, and order
    let tabs = raw
      .filter(t => g(`navbar.tab_${t.key}_visible`, "true") !== "false")
      .map(t => ({ ...t, label: g(`navbar.tab_${t.key}_label`, "") || t.defaultLabel }));
    // Apply custom order
    const orderStr = g("navbar.tab_order", "");
    if (orderStr) {
      try {
        const order: string[] = JSON.parse(orderStr);
        tabs.sort((a, b) => {
          const ai = order.indexOf(a.key); const bi = order.indexOf(b.key);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
      } catch { /* use default order */ }
    }
    // Ensure at least 1 tab is visible
    if (tabs.length === 0) tabs = [{ ...raw[0], label: raw[0].defaultLabel }];
    return tabs;
  }, [g]);

  // --- State ---
  const [activeView, setActiveView] = useState<ViewName>(defaultTab);
  const [showLoading, setShowLoading] = useState(true);
  const [loadingFading, setLoadingFading] = useState(false);
  const [animateReady, setAnimateReady] = useState(false);

  // Auth
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [clientProfile, setClientProfile] = useState<any>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Data
  const [units, setUnits] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [availabilityEvents, setAvailabilityEvents] = useState<any[]>([]); // ALL events for slot conflict check
  const [clientSubscription, setClientSubscription] = useState<Subscription | null>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [needsReview, setNeedsReview] = useState(false);

  // Selection
  const [selection, setSelection] = useState<SelectionState>({
    unit: null, barber: null, service: null, date: null, time: null,
  });

  // Modal
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [modalPosition, setModalPosition] = useState<ModalPosition>("bottom");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalIsAuth, setModalIsAuth] = useState(false);

  // Pending booking (auto-resume after login)
  const [pendingBooking, setPendingBooking] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  // ═══ PWA INSTALL PROMPT ═══
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installBannerExiting, setInstallBannerExiting] = useState(false);
  const { isStandalone, isIOS, isAndroid, navbarPlatformClass } = usePlatform();
  const isIOSSafari = isIOS && /safari/i.test(navigator.userAgent) && !/crios|fxios|opios|edgios/i.test(navigator.userAgent);

  useEffect(() => {
    if (isStandalone) return;
    if (g("pwa.install_prompt_enabled", "true") === "false") return;
    const dismissed = localStorage.getItem("vinnx_install_dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Pick up prompt captured at module level (before React mounted)
    if (_deferredInstallPrompt) {
      setDeferredPrompt(_deferredInstallPrompt);
      _deferredInstallPrompt = null;
    }

    // Also listen for future events (e.g. after SW registers)
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);

    // Show after 10s (non-intrusive)
    const timer = setTimeout(() => setShowInstallBanner(true), 10000);
    return () => { window.removeEventListener("beforeinstallprompt", handler); clearTimeout(timer); };
  }, [isStandalone]);

  const dismissInstallBanner = useCallback(() => {
    setInstallBannerExiting(true);
    setTimeout(() => { setShowInstallBanner(false); localStorage.setItem("vinnx_install_dismissed", String(Date.now())); }, 350);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") dismissInstallBanner();
      setDeferredPrompt(null);
    } else {
      // Fallback: browser doesn't support beforeinstallprompt or PWA criteria not met
      showToast("Use o menu do navegador (⋮) > \"Instalar app\" para adicionar à tela inicial");
      dismissInstallBanner();
    }
  }, [deferredPrompt, dismissInstallBanner, showToast]);

  // ═══ PUSH NOTIFICATIONS ═══
  const [pushSupported] = useState(() => typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'default'>('default');
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [pushBannerExiting, setPushBannerExiting] = useState(false);

  // Helper: convert VAPID key from base64url to Uint8Array
  const urlBase64ToUint8Array = useCallback((base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }, []);

  // Sync subscription on app-load (replaces pushsubscriptionchange in SW)
  useEffect(() => {
    if (!pushSupported || !authUser || !clientProfile?.id) return;
    setPushPermission(Notification.permission);
    
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const j = sub.toJSON();
        await supabase.from('push_subscriptions').upsert({
          clientId: clientProfile.id,
          authUserId: authUser.id,
          endpoint: j.endpoint,
          keys: j.keys,
          updatedAt: new Date().toISOString(),
        }, { onConflict: 'endpoint' });
        setPushSubscribed(true);
      }
    }).catch(() => {});
  }, [pushSupported, authUser, clientProfile]);

  const dismissPushBanner = useCallback(() => {
    setPushBannerExiting(true);
    setTimeout(() => { setShowPushBanner(false); localStorage.setItem('vinnx_push_dismissed', String(Date.now())); }, 350);
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!pushSupported || !clientProfile?.id || !authUser) return;
    try {
      // VAPID public key (public, not a secret — generated for this project)
      const vapidKey = 'BC5Yy_ldhetSkjkSbNWdKydHhfRRPIP9tfHT2YhAfq-GUykUF4UL6tssmP7ovARdvlq3lUUfMC4DxbpFKbbcLPQ';
      if (!vapidKey) { showToast('Push não configurado', 'error'); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
        userVisibleOnly: true,
      });

      const j = sub.toJSON();
      await supabase.from('push_subscriptions').upsert({
        clientId: clientProfile.id,
        authUserId: authUser.id,
        endpoint: j.endpoint,
        keys: j.keys,
        userAgent: navigator.userAgent,
        updatedAt: new Date().toISOString(),
      }, { onConflict: 'endpoint' });

      setPushSubscribed(true);
      setPushPermission('granted');
      showToast('Notificações ativadas! 🔔');
      dismissPushBanner();
    } catch (err: any) {
      console.error('[Push] Subscribe error:', err);
      if (Notification.permission === 'denied') {
        setPushPermission('denied');
        showToast('Notificações bloqueadas. Ative nas configurações do navegador.', 'error');
      } else {
        showToast('Erro ao ativar notificações', 'error');
      }
      dismissPushBanner();
    }
  }, [pushSupported, clientProfile, authUser, urlBase64ToUint8Array, showToast, dismissPushBanner]);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
      setPushSubscribed(false);
      showToast('Notificações desativadas');
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
    }
  }, [showToast]);

  // Show push modal immediately when user is logged in and not subscribed
  useEffect(() => {
    if (!pushSupported || pushSubscribed || !authUser) return;
    if (Notification.permission === 'denied') return;
    // If already granted but not subscribed, auto-subscribe silently
    if (Notification.permission === 'granted') {
      subscribeToPush();
      return;
    }
    // Re-show after 7 days if dismissed
    const dismissed = localStorage.getItem('vinnx_push_dismissed');
    if (dismissed) {
      const diff = Date.now() - Number(dismissed);
      if (diff < 7 * 24 * 60 * 60 * 1000) return; // 7 days
    }
    // Small delay to let page settle (1.5s)
    const timer = setTimeout(() => setShowPushBanner(true), 1500);
    return () => clearTimeout(timer);
  }, [pushSupported, pushSubscribed, authUser, subscribeToPush]);

  // Navbar
  const navRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  // -------- CSS Custom Properties --------
  const cssVars = {
    "--booking-primary": primary,
    "--booking-bg": bgColor,
    "--booking-card": cardBg,
    "--booking-text": textColor,
    "--booking-btn-radius": `${btnRadius}px`,
    "--booking-btn-bg": btnBg,
    "--booking-btn-text": btnText,
    "--booking-card-radius": `${cardRadius}px`,
    "--booking-navbar-bg": navbarBgColor || undefined,
  } as React.CSSProperties;

  // -------- SEO --------
  useEffect(() => {
    const seoTitle = g("seo.title", "");
    if (seoTitle) document.title = seoTitle;
    const seoDesc = g("seo.description", "");
    if (seoDesc) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
      meta.content = seoDesc;
    }
  }, [g]);

  // -------- PWA DYNAMIC MANIFEST --------
  const pwaManifestUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const pwaName = g("pwa_store_name", "");
    const pwaShortName = g("pwa_store_short_name", "");
    const storeName = g("store_name", "");  // Fallback from StoreCustomizer general name
    const pwaThemeColor = g("pwa_store_theme_color", "");
    const pwaBgColor = g("pwa_store_bg_color", "");
    const pwaIcon = g("pwa_store_icon", "");

    // Always inject dynamic manifest so it overrides the static Vite manifest.
    // This ensures custom names from StoreCustomizer are used when adding to home screen.

    const supabaseIconBase = "https://enjyflztvyomrlzddavk.supabase.co/storage/v1/object/public/avatars/public";
    const defaultIcons = [
      { src: `${supabaseIconBase}/pwa_icon_192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${supabaseIconBase}/pwa_icon_512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${supabaseIconBase}/pwa_icon_maskable_192.png`, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: `${supabaseIconBase}/pwa_icon_maskable_512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ];

    const origin = window.location.origin;
    const manifest = {
      name: pwaName || storeName || "VINNX BARBER",
      short_name: pwaShortName || storeName || "VINNX",
      description: "Agende seu horário na melhor barbearia",
      start_url: `${origin}/#/site`,
      scope: `${origin}/`,
      display: "standalone" as const,
      background_color: pwaBgColor || "#0f172a",
      theme_color: pwaThemeColor || "#10b981",
      orientation: "portrait-primary",
      icons: pwaIcon
        ? [
            { src: pwaIcon, sizes: "512x512", type: "image/png" },
            { src: pwaIcon, sizes: "512x512", type: "image/png", purpose: "maskable" },
          ]
        : defaultIcons,
    };

    // Inject manifest via blob URL
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.rel = "manifest"; document.head.appendChild(link); }
    link.href = url;

    // Update theme-color meta
    let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!themeMeta) { themeMeta = document.createElement("meta"); themeMeta.name = "theme-color"; document.head.appendChild(themeMeta); }
    themeMeta.content = manifest.theme_color;

    // Update apple-touch-icon
    if (manifest.icons[0]?.src) {
      let ati = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
      if (!ati) { ati = document.createElement("link"); ati.rel = "apple-touch-icon"; document.head.appendChild(ati); }
      ati.href = manifest.icons[0].src;
    }

    // Update apple-mobile-web-app-title
    let appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    if (!appTitle) { appTitle = document.createElement("meta"); appTitle.name = "apple-mobile-web-app-title"; document.head.appendChild(appTitle); }
    appTitle.content = manifest.short_name;

    // Also update <title> for iOS fallback
    document.title = manifest.short_name;

    // Persist to localStorage so index.html can read synchronously on next load
    // (iOS Safari reads meta tags before JS modules execute)
    try {
      localStorage.setItem("vinnx_pwa_name", manifest.name);
      localStorage.setItem("vinnx_pwa_short_name", manifest.short_name);
    } catch {}

    // Revoke previous blob URL
    if (pwaManifestUrlRef.current) URL.revokeObjectURL(pwaManifestUrlRef.current);
    pwaManifestUrlRef.current = url;
  }, [g]);

  // ============================================================
  // AUTH LISTENER + SESSION PERSISTENCE
  // We manage auth completely outside the SDK:
  // - _psAccessToken (module-level) → injected in REST calls via custom fetch
  // - localStorage backup with refresh_token → survives page refresh + token expiry
  // ============================================================
  const lastSignInRef = useRef<number>(0);
  const PS_BACKUP_KEY = "vinnx_ps_user";

  // Save auth + tokens to localStorage
  const saveAuthBackup = useCallback((
    user: { id: string; email: string } | null,
    accessToken?: string | null,
    refreshToken?: string | null
  ) => {
    if (user && accessToken) {
      const backup: any = { ...user, token: accessToken };
      if (refreshToken) backup.refreshToken = refreshToken;
      else {
        // Preserve existing refreshToken
        try {
          const existing = localStorage.getItem(PS_BACKUP_KEY);
          if (existing) {
            const prev = JSON.parse(existing);
            if (prev.refreshToken) backup.refreshToken = prev.refreshToken;
          }
        } catch {}
      }
      localStorage.setItem(PS_BACKUP_KEY, JSON.stringify(backup));
      _psAccessToken = accessToken;
    } else if (!user) {
      localStorage.removeItem(PS_BACKUP_KEY);
      _psAccessToken = null;
    }
  }, []);

  // Direct setter for LoginForm/SignupForm — receives both tokens
  const setAuthDirect = useCallback((
    user: { id: string; email: string },
    accessToken: string,
    refreshToken?: string
  ) => {
    lastSignInRef.current = Date.now();
    _psAccessToken = accessToken;
    setAuthUser(user);
    saveAuthBackup(user, accessToken, refreshToken);
    loadClientProfile(user.id);
  }, []);

  useEffect(() => {
    if (isPreview) return;

    // Restore from localStorage backup with token refresh if needed
    (async () => {
      try {
        const backup = localStorage.getItem(PS_BACKUP_KEY);
        if (!backup) return;
        const parsed = JSON.parse(backup);
        if (!parsed?.id || !parsed?.email) return;

        const user = { id: parsed.id, email: parsed.email };

        if (parsed.token && !isTokenExpired(parsed.token)) {
          // Token still valid — use directly
          _psAccessToken = parsed.token;
          setAuthUser(user);
          loadClientProfile(user.id);
        } else if (parsed.refreshToken) {
          // Token expired — try silent refresh
          const newTokens = await silentRefresh(parsed.refreshToken);
          if (newTokens) {
            _psAccessToken = newTokens.access_token;
            saveAuthBackup(user, newTokens.access_token, newTokens.refresh_token);
            setAuthUser(user);
            loadClientProfile(user.id);
          } else {
            // Refresh failed — session is dead
            localStorage.removeItem(PS_BACKUP_KEY);
          }
        } else {
          // No refresh token and access expired — clear
          localStorage.removeItem(PS_BACKUP_KEY);
        }
      } catch {}
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        if (session?.user) {
          setAuthUser({ id: session.user.id, email: session.user.email || "" });
          setTimeout(() => {
            openModal(<AlterarSenhaModal primary={primary} bgColor={bgColor} onClose={() => closeModal()} />, "center");
          }, 500);
        }
        return;
      }
      if (event === "SIGNED_IN" && session?.user) {
        lastSignInRef.current = Date.now();
        const u = { id: session.user.id, email: session.user.email || "" };
        _psAccessToken = session.access_token;
        setAuthUser(u);
        saveAuthBackup(u, session.access_token, session.refresh_token);
        loadClientProfile(u.id);
        return;
      }
      if (event === "SIGNED_OUT") {
        // Ignore spurious SIGNED_OUT that arrives right after SIGNED_IN
        const elapsed = Date.now() - lastSignInRef.current;
        if (elapsed < 10000) {
          return; // Suppress — token preserved in _psAccessToken
        }
        // Real logout
        _psAccessToken = null;
        setAuthUser(null);
        setClientProfile(null);
        setClientSubscription(null);
        setAllEvents([]);
        sessionStorage.removeItem("vinnx_reminder_dismissed");
        saveAuthBackup(null);
        return;
      }
    });
    return () => subscription.unsubscribe();
  }, [isPreview]);

  async function loadClientProfile(authId: string) {
    const { data, error: profileErr } = await supabase.from("clients").select("*").eq("authUserId", authId).single();
    if (data) {
      setClientProfile(data);
      // Load subscription
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans(*)")
        .eq("clientId", data.id)
        .eq("status", "active")
        .limit(1);
      if (subs && subs.length > 0) {
        const s = subs[0];
        setClientSubscription({
          ...s,
          plan: s.subscription_plans ? { ...s.subscription_plans, price: Number(s.subscription_plans.price) || 0 } : undefined,
        });
      }
      // Load client events
      loadClientEvents(data.name, data.id);
    } else {
      // If migration claim is in progress, wait and retry instead of auto-creating
      if (_migrationClaimInProgress) {
        setTimeout(() => loadClientProfile(authId), 2000);
        return;
      }
      // Auto-create client record if missing (e.g. previous signup insert failed)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userName = user.user_metadata?.name || user.email?.split("@")[0] || "Cliente";
        const referralCode = userName.split(" ")[0].toUpperCase().substring(0, 4) + Math.floor(1000 + Math.random() * 9000);
        const newClient = {
          id: crypto.randomUUID(),
          name: userName,
          email: user.email || "",
          phone: user.user_metadata?.phone || "",
          company: "",
          status: "ACTIVE",
          monthlyValue: 0, setupValue: 0, totalValue: 0, monthsActive: 0,
          authUserId: user.id,
          referralCode,
          referralCredits: 0,
          referralsMade: 0,
          updatedAt: new Date().toISOString(),
        };
        const { error: insertErr } = await supabase.from("clients").insert(newClient);
        if (!insertErr) {
          setClientProfile(newClient);
          loadClientEvents(userName, newClient.id);
        } else {
          console.error("Auto-create client failed:", insertErr);
        }
      }
    }
  }

  async function loadClientEvents(clientName: string, clientId?: string) {
    const cId = clientId || clientProfile?.id;
    let query = supabase.from("calendar_events").select("*");
    if (cId) {
      // Prioritize clientId for accurate scoping (no cross-client data leak)
      query = query.eq("clientId", cId);
    } else if (clientName) {
      // Fallback for legacy events without clientId
      query = query.eq("clientName", clientName);
    }
    const { data } = await query.order("date", { ascending: false });
    if (data) {
      const mapped = data.map((row: any) => {
        const d = row.date ? new Date(row.date) : new Date();
        return {
          ...row,
          client: row.clientName,
          date: d.getDate(),
          month: d.getMonth(),
          year: d.getFullYear(),
        };
      });
      setAllEvents(mapped);
      // Check for pending reviews
      const hasPending = mapped.some((e: any) => {
        const eventDate = new Date(e.year, e.month, e.date);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return eventDate < today && !e.rating && e.status !== "cancelled";
      });
      setNeedsReview(hasPending);
    }
  }

  // ============================================================
  // DATA FETCHING
  // ============================================================
  useEffect(() => {
    (async () => {
      const [unitsRes, barbersRes, servicesRes, plansRes, schedulesRes, goalsRes] = await Promise.all([
        supabase.from("units").select("*").eq("status", "active").is("deletedAt", null),
        supabase.from("users").select("id, name, email, avatar, role").eq("role", "BARBER"),
        supabase.from("services").select("*").eq("active", true),
        supabase.from("subscription_plans").select("*").eq("active", true),
        supabase.from("work_schedules").select("*"),
        supabase.from("referral_goals").select("*").eq("active", true),
      ]);
      if (unitsRes.data) setUnits(unitsRes.data);
      if (barbersRes.data) {
        // Enrich barbers with unit membership
        // NOTE: specialties/station are on team_members (no anon access), so not fetched here
        const { data: unitMembers } = await supabase.from("unit_members").select("userId, unitId");
        const barberData = barbersRes.data.map((b: any) => {
          const memberOf = (unitMembers || []).filter((um: any) => um.userId === b.id).map((um: any) => um.unitId);
          return { ...b, unitIds: memberOf.length > 0 ? memberOf : null };
        });
        setBarbers(barberData);
      }
      if (servicesRes.data) setServices(servicesRes.data.map((s: any) => ({ ...s, price: Number(s.price) || 0, duration: Number(s.duration) || 30 })));
      if (plansRes.data) setPlans(plansRes.data.map((p: any) => ({ ...p, price: Number(p.price) || 0, benefits: p.benefits || [] })));
      if (schedulesRes.data) setSchedules(schedulesRes.data);
      if (goalsRes.data) setGoals(goalsRes.data);
      else if (goalsRes.error) console.warn("referral_goals table may not exist yet:", goalsRes.error.message);

      // Load ALL events for availability checking (not just client's)
      const { data: allEvData } = await supabase.from("calendar_events").select("id, date, startTime, endTime, barberId, unitId, status, duration").neq("status", "cancelled");
      if (allEvData) {
        const mapped = allEvData.map((row: any) => {
          const d = row.date ? new Date(row.date) : new Date();
          return { ...row, date: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
        });
        setAvailabilityEvents(mapped);
      }
    })();
  }, []);

  // ============================================================
  // LOADING SCREEN
  // ============================================================
  useEffect(() => {
    const dur = parseInt(g("loading.duration", "2000"), 10) || 2000;
    const t1 = setTimeout(() => setLoadingFading(true), dur);
    const t2 = setTimeout(() => {
      setShowLoading(false);
      // Trigger view animations only AFTER loading screen is gone
      requestAnimationFrame(() => setAnimateReady(true));
    }, dur + 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ============================================================
  // MODAL SYSTEM
  // ============================================================
  const [modalExiting, setModalExiting] = useState(false);

  const openModal = useCallback((content: React.ReactNode, pos: ModalPosition = "bottom", isAuth = false) => {
    setModalExiting(false);
    setModalContent(content);
    setModalPosition(pos);
    setModalIsAuth(isAuth);
    setModalVisible(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setModalVisible(true)));
  }, []);

  const closeModal = useCallback((callback?: () => void) => {
    setModalExiting(true);
    setModalVisible(false);
    setTimeout(() => {
      setModalExiting(false);
      setModalContent(null);
      setModalIsAuth(false);
      if (callback) callback();
    }, 280);
  }, []);

  // ============================================================
  // NAVBAR INDICATOR
  // ============================================================
  const updateIndicator = useCallback(() => {
    if (!navRef.current || !indicatorRef.current) return;
    const active = navRef.current.querySelector(".active") as HTMLElement;
    if (!active) return;
    const pad = 7; // Match navbar CSS padding
    let left = active.offsetLeft;
    let width = active.offsetWidth;
    const navInner = navRef.current.clientWidth; // excludes border
    // Clamp edges so indicator respects the pill curvature
    if (left < pad) { width -= (pad - left); left = pad; }
    if (left + width > navInner - pad) { width = navInner - pad - left; }
    indicatorRef.current.style.left = `${left}px`;
    indicatorRef.current.style.width = `${width}px`;
  }, []);

  useEffect(() => {
    // RAF ensures DOM layout is computed before measuring
    requestAnimationFrame(() => updateIndicator());
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeView, tabDefs.length, updateIndicator]);

  // ============================================================
  // AUTH MODALS
  // ============================================================
  function showLoginModal(onSuccess?: () => void) {
    openModal(<LoginForm g={g} primary={primary} onClose={closeModal} onSwitch={(v: string) => { closeModal(() => { if (v === "signup") showSignupModal(onSuccess); else if (v === "migration") showMigrationModal(onSuccess); else showForgotModal(); }); }} onSuccess={onSuccess} showToast={showToast} setAuthDirect={setAuthDirect} />, "center", true);
  }

  function showSignupModal(onSuccess?: () => void) {
    openModal(<SignupForm g={g} primary={primary} onClose={closeModal} onSwitch={() => { closeModal(() => showLoginModal(onSuccess)); }} onSuccess={onSuccess} showToast={showToast} setAuthDirect={setAuthDirect} />, "center", true);
  }

  function showForgotModal() {
    openModal(<ForgotForm g={g} primary={primary} onClose={closeModal} onSwitch={() => { closeModal(() => showLoginModal()); }} />, "center", true);
  }

  function showMigrationModal(onSuccess?: () => void) {
    openModal(<MigrationForm g={g} primary={primary} onClose={closeModal} onSwitch={() => { closeModal(() => showLoginModal(onSuccess)); }} onSuccess={onSuccess} showToast={showToast} setAuthDirect={setAuthDirect} />, "center", true);
  }

  // ============================================================
  // BOOKING FLOW
  // ============================================================
  const maxAdvDays = parseInt(g("booking.max_advance_days", "30"), 10);
  const maxOpenAppts = parseInt(g("booking.max_open_appointments", "2"), 10);
  const slotInterval = parseInt(g("booking.slot_interval", "30"), 10);
  const closedDays = g("booking.closed_days", "0").split(",").map(Number);
  const showPrices = g("booking.show_prices", "true") !== "false";
  const showDuration = g("booking.show_duration", "true") !== "false";
  const allowNoPref = g("booking.allow_no_preference", "true") !== "false";
  const minAdvanceHours = parseInt(g("booking.min_advance_hours", "0"), 10);
  const blockSameDay = g("booking.block_same_day", "false") === "true";
  const maxPerBarberDay = parseInt(g("booking.max_per_barber_day", "0"), 10);
  const cancellationHours = parseInt(g("booking.cancellation_hours", "0"), 10);
  const rescheduleHours = parseInt(g("booking.reschedule_hours", "0"), 10);
  const defaultStartTime = g("booking.default_start_time", "08:00");
  const defaultEndTime = g("booking.default_end_time", "19:00");
  const defaultBreakStart = g("booking.default_break_start", "12:00");
  const defaultBreakEnd = g("booking.default_break_end", "13:00");
  const confirmationMessage = g("booking.confirmation_message", "");

  function updateSelection(patch: Partial<SelectionState>) {
    setSelection((s) => ({ ...s, ...patch }));
  }

  function resetSelection() {
    setSelection({ unit: null, barber: null, service: null, date: null, time: null });
  }

  // === Unit modal ===
  function showUnitModal() {
    openModal(
      <div className="booking-modal-sheet p-5 pb-8">
        <h3 className="booking-modal-title" style={{ color: primary }}>{g("booking.modal_title_unit", "Escolha uma unidade")}</h3>
        <ScrollFadeList className="space-y-3 max-h-[60vh] overflow-y-auto booking-scrollbar px-1 pb-2">
          {units.map((u) => (
            <div key={u.id} onClick={() => { updateSelection({ unit: u, barber: null, service: null, date: null, time: null }); closeModal(); }}
              className={`booking-modal-item ${selection.unit?.id === u.id ? "active" : ""}`}>
              {u.image ? <img src={u.image} alt={u.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" /> : <div className="booking-modal-avatar w-16 h-16 rounded-lg"><Store className="w-6 h-6 text-gray-500" /></div>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{u.name}</p>
                <p className="text-xs text-gray-400 truncate"><MapPin className="w-3 h-3 inline mr-1" style={{ color: primary }} />{[u.address, u.city, u.state].filter(Boolean).join(", ")}</p>
              </div>
            </div>
          ))}
        </ScrollFadeList>
      </div>
    );
  }

  // === Barber modal ===
  function showBarberModal() {
    if (!selection.unit) return;
    // Filter barbers by unit membership
    const unitBarbers = barbers.filter((b: any) => {
      // If unitIds is an array (unit_members data exists), filter strictly
      if (Array.isArray(b.unitIds)) {
        return b.unitIds.includes(selection.unit.id);
      }
      // Fallback: unitIds is null = no unit_members data at all (single-unit setup)
      // Show all barbers in this case
      return true;
    });
    const barberList = allowNoPref
      ? [{ id: "__no_pref__", name: "Sem preferência", specialties: ["Será atribuído um profissional disponível"], avatar: null }, ...unitBarbers]
      : unitBarbers;
    openModal(
      <div className="booking-modal-sheet p-5 pb-8">
        <h3 className="booking-modal-title" style={{ color: primary }}>{g("booking.modal_title_barber", "Escolha um profissional")}</h3>
        <ScrollFadeList className="space-y-3 max-h-[60vh] overflow-y-auto booking-scrollbar px-1 pb-2">
          {barberList.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum profissional disponível nesta unidade.</p>
          ) : barberList.map((b: any) => (
            <div key={b.id} onClick={() => { updateSelection({ barber: b, service: selection.isFromCreditRedemption ? selection.service : null, date: null, time: null }); closeModal(); }}
              className={`booking-modal-item ${selection.barber?.id === b.id ? "active" : ""}`}>
              {b.avatar ? <img src={b.avatar} alt={b.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                : <div className="booking-modal-avatar w-12 h-12 rounded-full"><User className="w-5 h-5 text-gray-500" /></div>}
              <div className="flex-1">
                <p className="font-semibold text-white">{b.name}</p>
                <p className="text-xs text-gray-400">{b.specialties?.join(", ") || "Barbeiro"}</p>
              </div>
            </div>
          ))}
        </ScrollFadeList>
      </div>
    );
  }

  // === Service modal ===
  function showServiceModal() {
    if (!selection.barber) return;
    if (selection.isFromCreditRedemption) return; // Lock during redemption
    // Filter: online booking + unit scope (null unitId = global, matching unitId = unit-specific)
    const filtered = services.filter((s) =>
      s.allowsOnlineBooking !== false &&
      (!s.unitId || s.unitId === selection.unit?.id)
    );
    openModal(
      <div className="booking-modal-sheet p-5 pb-8">
        <h3 className="booking-modal-title" style={{ color: primary }}>{g("booking.modal_title_service", "Escolha um serviço")}</h3>
        <ScrollFadeList className="space-y-3 max-h-[60vh] overflow-y-auto booking-scrollbar px-1 pb-2">
          {filtered.map((s) => (
            <div key={s.id} onClick={() => { updateSelection({ service: s, date: null, time: null }); closeModal(); }}
              className={`booking-modal-item ${selection.service?.id === s.id ? "active" : ""}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {s.image ? <img src={s.image} alt={s.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  : <div className="booking-modal-avatar w-12 h-12 rounded-lg"><Scissors className="w-5 h-5" style={{ color: primary }} /></div>}
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{s.name}</p>
                  <div className="flex gap-3 text-xs text-gray-400">
                    {showDuration && <span><Clock className="w-3 h-3 inline mr-1" style={{ color: primary }} />{s.duration || 30} min</span>}
                  </div>
                </div>
              </div>
              {showPrices && <span className="font-bold text-lg flex-shrink-0" style={{ color: primary }}>R$ {s.price.toFixed(2)}</span>}
            </div>
          ))}
        </ScrollFadeList>
      </div>
    );
  }

  // === Calendar+time modal ===
  function showDateModal() {
    if (!selection.service) return;
    openModal(<CalendarModal
      primary={primary} cardBg={cardBg} barber={selection.barber}
      unitId={selection.unit?.id}
      schedules={schedules} events={availabilityEvents} maxDays={maxAdvDays}
      closedDays={closedDays} slotInterval={slotInterval} g={g}
      onSelect={(date: Date, time: string) => { updateSelection({ date, time }); closeModal(); }}
    />, "fullscreen");
  }

  // Auto-resume booking after login (avoids stale closure bug)
  useEffect(() => {
    if (pendingBooking && authUser && clientProfile) {
      setPendingBooking(false);
      // Small delay to ensure modal is closed and UI is stable
      setTimeout(() => showResumoModal(), 400);
    }
  }, [pendingBooking, authUser, clientProfile]);

  // Reset pendingBooking if user closes auth modal without logging in
  useEffect(() => {
    if (pendingBooking && !modalContent && !authUser) {
      setPendingBooking(false);
    }
  }, [modalContent]);

  // === Confirm booking ===
  async function handleAgendarClick() {
    if (!selection.unit || !selection.barber || !selection.service || !selection.date || !selection.time) return;

    if (!authUser) {
      setPendingBooking(true);
      showLoginModal();
      return;
    }

    // Check max open
    const openAppts = allEvents.filter((e) => e.status !== "cancelled" && e.status !== "completed");
    if (openAppts.length >= maxOpenAppts) {
      openModal(
        <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: "#eab308" }} />
          <h3 className="text-xl font-bold mb-3" style={{ color: primary }}>Limite Atingido</h3>
          <p className="text-gray-300 mb-6">Você já possui o máximo de {maxOpenAppts} agendamentos em aberto.</p>
          <button onClick={() => closeModal()} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Entendido</button>
        </div>, "center"
      );
      return;
    }

    // Show summary
    showResumoModal();
  }

  function showResumoModal() {
    openModal(<ResumoModal
      selection={selection} primary={primary} bgColor={bgColor} cardBg={cardBg}
      clientSubscription={clientSubscription} onClose={closeModal}
      onConfirm={async ({ couponCode: cpCode, couponDiscount: cpDisc, finalPrice: fp }: any) => {
        const d = selection.date!;
        const now = new Date().toISOString();
        const isoDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const newEvent = {
          id: crypto.randomUUID(),
          title: `${clientProfile?.name || "Cliente"} - ${selection.service!.name}`,
          type: "APPOINTMENT",
          startTime: selection.time,
          endTime: addMinutesToTime(selection.time!, selection.service!.duration || 30),
          date: isoDate,
          clientName: clientProfile?.name || "Cliente",
          clientId: clientProfile?.id || null,
          barberId: selection.barber.id === "__no_pref__" ? null : selection.barber.id,
          barberName: selection.barber.name,
          serviceId: selection.service!.id,
          serviceName: selection.service!.name,
          serviceIds: JSON.stringify([selection.service!.id]),
          duration: selection.service!.duration || 30,
          unitId: selection.unit.id,
          source: "app",
          status: "confirmed",
          finalPrice: fp ?? (selection.isFromCreditRedemption ? 0 : selection.service!.price),
          couponCode: cpCode || null,
          usedReferralCredit: !!selection.isFromCreditRedemption,
          updatedAt: now,
        };
        const { error } = await supabase.from("calendar_events").insert(newEvent);
        if (error) {
          console.error("Error saving event:", error);
          showToast(`Erro ao agendar: ${error.message}`, "error");
          return;
        }
        // Deduct referral credits after successful booking
        if (selection.isFromCreditRedemption && clientProfile) {
          const minRedemption = parseInt(g("referral.min_redemption", "50"), 10) || 50;
          const newCredits = Math.max(0, (clientProfile.referralCredits || 0) - minRedemption);
          await supabase.from("clients").update({ referralCredits: newCredits, updatedAt: new Date().toISOString() }).eq("id", clientProfile.id);
          setClientProfile((prev: any) => prev ? { ...prev, referralCredits: newCredits } : prev);
        }
        // Increment coupon used_count if coupon was used
        if (cpCode && cpDisc > 0) {
          const { data: cpData } = await supabase.from("coupons").select("used_count").eq("code", cpCode.toUpperCase()).single();
          await supabase.from("coupons").update({ used_count: (cpData?.used_count || 0) + 1 }).eq("code", cpCode.toUpperCase());
        }
        // Show success
        closeModal(() => {
          const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
          const unitObj = selection.unit;
          openModal(
            <div className="p-6 text-center booking-zoom-in" style={{ borderRadius: "1rem" }}>
              <Check className="w-16 h-16 mx-auto mb-4" style={{ color: primary }} />
              <h3 className="text-2xl font-bold mb-6" style={{ color: primary }}>{g("booking.success_title", "Agendamento Confirmado!")}</h3>
              <div className="text-left space-y-4 text-sm mb-8">
                <div>
                  <p><strong className="text-gray-400">Unidade:</strong> <span className="text-white">{unitObj.name}</span></p>
                  {unitObj.address && <p className="text-gray-500 text-xs mt-0.5">{unitObj.address}{unitObj.city ? `, ${unitObj.city}` : ""}{unitObj.state ? ` - ${unitObj.state}` : ""}</p>}
                  {unitObj.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${unitObj.address}, ${unitObj.city || ""} - ${unitObj.state || ""}`)}`} target="_blank" rel="noopener noreferrer" className="block w-full text-center mt-2 py-2 px-4 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: "#0b0b0a" }}>Ver localização</a>}
                </div>
                <p><strong className="text-gray-400">Barbeiro:</strong> <span className="text-white">{selection.barber.name}</span></p>
                <p><strong className="text-gray-400">Serviço:</strong> <span className="text-white">{selection.service!.name}</span></p>
                <p><strong className="text-gray-400">Data:</strong> <span className="text-white">{dateStr}</span></p>
                <p><strong className="text-gray-400">Horário:</strong> <span className="text-white">Às {selection.time}</span></p>
              </div>
              {confirmationMessage && (
                <p className="text-sm text-gray-300 mb-6 italic">{confirmationMessage}</p>
              )}
              <button onClick={() => { closeModal(); resetSelection(); setActiveView("historico"); refreshEvents(); }}
                className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Ver Meus Agendamentos</button>
            </div>, "center"
          );
        });
      }}
    />, "center");
  }

  // Refresh events after action
  const skipNextRealtimeRef = useRef(false);
  async function refreshEvents() {
    // Flag to skip the next realtime event (our own action will trigger it)
    skipNextRealtimeRef.current = true;
    if (clientProfile) loadClientEvents(clientProfile.name, clientProfile.id);
    // Also refresh availability events
    const { data: allEvData } = await supabase.from("calendar_events").select("id, date, startTime, endTime, barberId, unitId, status, duration").neq("status", "cancelled");
    if (allEvData) {
      const mapped = allEvData.map((row: any) => {
        const d = row.date ? new Date(row.date) : new Date();
        return { ...row, date: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
      });
      setAvailabilityEvents(mapped);
    }
  }

  // ═══ REALTIME: calendar_events ═══
  // Listen for external changes (barber cancel, reschedule, new bookings)
  // and refresh the client's view automatically
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('public-site-appointments')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'calendar_events' },
        () => {
          // Skip if this was triggered by our own action
          if (skipNextRealtimeRef.current) {
            skipNextRealtimeRef.current = false;
            return;
          }
          // Debounce to batch rapid changes
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            refreshEvents();
          }, 800);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🟢 PublicSite Realtime: connected to calendar_events');
        }
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [clientProfile]);

  const uiScale = parseFloat(g("theme.ui_scale", "1")) || 1;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ ...cssVars, fontFamily, backgroundColor: "#000", color: textColor, minHeight: "100vh", zoom: uiScale, paddingTop: "env(safe-area-inset-top)" } as any}>
      {/* Loading Screen */}
      {showLoading && (
        <div className={`fixed inset-0 flex flex-col items-center justify-center p-8 z-[60] ${loadingFading ? "booking-loading-fadeout" : ""}`}
          style={{ backgroundColor: g("loading.bg_color", "#000000") }}>
          <div className="flex flex-col items-center text-center">
            {g("loading.logo") && <img src={g("loading.logo")} alt="Logo" className="w-32 h-32 mb-16 booking-fade-in object-contain" />}
            <div className="w-10 h-10 border-4 rounded-full mb-16 booking-spin" style={{ borderColor: "#444", borderTopColor: primary }} />
            <div className="booking-fade-in-delay">
              <h1 className="text-lg font-bold text-white">{g("loading.title", "Elevando a sua experiência")}</h1>
              <p className="text-gray-400 mt-2 text-xs max-w-[220px] mx-auto">{g("loading.subtitle", "Estilo e precisão em cada corte.")}</p>
            </div>
            <div className="booking-vinnx-fast mt-24">
            <svg xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 13929.2 2791.21" className="w-36 h-auto" style={{ shapeRendering: 'geometricPrecision', fillRule: 'evenodd', clipRule: 'evenodd' }}>
              <g fill="white">
                <path className="svg-elem-1" d="M10575.96 2770.97c1.81,-67.93 -6.84,-759.75 0.71,-1074.33 -0.71,-312.44 187.28,-481.99 567.14,-481.99l0.12 -419.71c-284.82,0 -393.93,-2.07 -524.85,182.93 -6.84,-10.88 -90.08,-171.34 -95.66,-182.93l-406.52 0 0 1976.03 459.07 0z" />
                <path className="svg-elem-2" d="M986.96 822.41c538.09,0 974.29,436.2 974.29,974.28 0,538.09 -436.2,974.29 -974.29,974.29 -194.4,0 -363.1,-73.47 -515.13,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.28,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
                <path className="svg-elem-3" d="M3159.77 822.38c224.55,0 442.51,58.83 607.26,186.46 230.04,178.2 367.02,474.29 367.02,787.82 0,327.08 -181.77,618.34 -429,795.04 -159.5,113.97 -334.27,179.25 -545.29,179.25 -538.08,0 -974.28,-436.2 -974.28,-974.29 0,-538.08 436.2,-974.28 974.28,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
                <path className="svg-elem-4" d="M-0 232.77l0 2539.65 445.84 -191.06 0.04 -2581.37c0,0 -437.87,229.95 -445.88,232.77z" />
                <path className="svg-elem-5" d="M4168.33 794.94l0 1975.96 -445.74 -192.01 0 -1462.39 0 -139.54c0,0 437.73,-184.83 445.74,-182.03z" />
                <path className="svg-elem-6" d="M4932.59 2770.97c1.81,-67.93 -6.84,-759.75 0.71,-1074.33 -0.71,-312.44 187.28,-481.99 567.14,-481.99l0.12 -419.71c-284.82,0 -393.93,-2.07 -524.85,182.93 -6.84,-10.88 -90.08,-171.34 -95.66,-182.93l-406.52 0 0 1976.03 459.07 0z" />
                <path className="svg-elem-7" d="M6694.19 822.41c538.08,0 974.28,436.2 974.28,974.28 0,538.09 -436.2,974.29 -974.28,974.29 -194.41,0 -363.11,-73.47 -515.14,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.29,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
                <path className="svg-elem-8" d="M5707.22 232.77l0 2539.65 445.84 -191.06 0.05 -2581.37c0,0 -437.87,229.95 -445.89,232.77z" />
                <path className="svg-elem-9" d="M8883.2 822.41c436.12,0 805.27,286.55 929.53,681.63 29.06,92.38 44.76,190.69 44.76,292.65 0,52.14 -4.14,103.3 -12.02,153.22l-1336.29 0.02c0,0 229.95,-437.87 232.76,-445.89l592.44 0c-95.88,-147.51 -262.12,-245.09 -451.18,-245.09 -296.99,0 -537.74,240.75 -537.74,537.74 0,296.99 240.75,537.74 537.74,537.74 205.64,0 384.29,-115.44 474.74,-285.05l322.19 307.78c-176.33,250.29 -467.49,413.82 -796.93,413.82 -194.4,0 -363.1,-73.47 -515.13,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.28,-974.28z" />
                <path className="svg-elem-10" d="M12954.05 2473.8l-974.83 -1678.86 -369.05 0 1159.51 1996.27 184.37 -317.41zm-184.39 -953.1c140.47,-241.94 280.97,-483.86 421.46,-725.77l-842.93 0 421.47 725.77zm184.51 317.77c61.48,105.87 122.94,211.74 184.42,317.62l790.61 -1361.15 -369.08 0c-201.91,347.88 -403.96,695.69 -605.94,1043.53z" />
              </g>
            </svg>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic theme styles — cascades btn/card/heading settings */}
      <style>{`
        html, body {
          background-color: ${bgColor} !important;
          overflow: hidden;
          height: 100%;
        }
        .booking-app-container button[style*="background-color"] {
          border-radius: ${btnRadius}px !important;
        }
        .booking-app-container .rounded-xl {
          border-radius: ${cardRadius}px !important;
        }
        .booking-app-container .rounded-lg {
          border-radius: ${Math.min(parseInt(cardRadius), 12)}px !important;
        }
        ${cardShadow ? '' : `.booking-app-container .rounded-xl { box-shadow: none !important; }`}
        .booking-app-container h1, .booking-app-container h2, .booking-app-container h3 {
          font-family: ${headingFont} !important;
        }
      `}</style>

      {/* App Container */}
      <div className="booking-app-container w-full flex flex-col h-screen overflow-hidden" style={{ backgroundColor: bgColor, maxWidth: 500, margin: "0 auto" }}>

        {/* Announcement Banner */}
        {g("announcement.enabled", "false") === "true" && g("announcement.text", "") && !announcementDismissed && (
          <div className="relative px-4 py-2.5 text-center text-sm font-medium booking-fade-in" style={{
            backgroundColor: g("announcement.bg_color", "") || (g("announcement.type", "info") === "promo" ? primary : g("announcement.type", "info") === "alert" ? "#dc2626" : "#1e3a5f"),
            color: g("announcement.text_color", "#ffffff"),
          }}>
            <span>{g("announcement.text", "")}</span>
            {g("announcement.link_label", "") && g("announcement.link_url", "") && (
              <a href={g("announcement.link_url", "")} target="_blank" rel="noopener noreferrer" className="underline font-bold ml-2">{g("announcement.link_label", "")}</a>
            )}
            {g("announcement.dismissible", "true") !== "false" && (
              <button onClick={() => setAnnouncementDismissed(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/20 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className={`flex-grow ${activeView === "agendar" ? "overflow-hidden" : "overflow-y-auto"} booking-hide-scrollbar ${modalContent ? "booking-content-blur" : ""}`} style={{ overscrollBehaviorY: "contain" }}>
          {activeView === "agendar" && <AgendarView
            g={g} primary={primary} bgColor={bgColor} cardBg={cardBg}
            btnBg={btnBg} btnText={btnText} animateReady={animateReady}
            selection={selection} allEvents={allEvents}
            onUnitClick={showUnitModal} onBarberClick={showBarberModal}
            onServiceClick={showServiceModal} onDateClick={showDateModal}
            onAgendarClick={handleAgendarClick}
            showPrices={showPrices} showDuration={showDuration}
            maxOpenAppts={maxOpenAppts}
            showInstallBanner={showInstallBanner} isStandalone={isStandalone} isIOS={isIOS} isIOSSafari={isIOSSafari}
            deferredPrompt={deferredPrompt} installBannerExiting={installBannerExiting}
            onInstallClick={handleInstallClick} onInstallDismiss={dismissInstallBanner}
            showPushBanner={showPushBanner} pushBannerExiting={pushBannerExiting}
            pushSubscribed={pushSubscribed} pushPermission={pushPermission}
            onPushSubscribe={subscribeToPush} onPushDismiss={dismissPushBanner}
          />}
          {activeView === "historico" && <HistoricoView
            g={g} primary={primary} bgColor={bgColor} cardBg={cardBg}
            btnBg={btnBg} btnText={btnText}
            authUser={authUser} clientProfile={clientProfile}
            events={allEvents} availabilityEvents={availabilityEvents}
            units={units} barbers={barbers} services={services}
            schedules={schedules} closedDays={closedDays} maxAdvDays={maxAdvDays}
            slotInterval={slotInterval}
            onLogin={() => showLoginModal()} openModal={openModal} closeModal={closeModal}
            onRefresh={refreshEvents}
            setActiveView={setActiveView} updateSelection={updateSelection}
            resetSelection={resetSelection}
          />}
          {activeView === "planos" && <PlanosView
            g={g} primary={primary} bgColor={bgColor} cardBg={cardBg}
            btnBg={btnBg} btnText={btnText}
            plans={plans} subscription={clientSubscription} services={services}
            authUser={authUser} clientProfile={clientProfile}
            onLogin={() => showLoginModal()} openModal={openModal} closeModal={closeModal}
            onRefresh={refreshEvents} setActiveView={setActiveView}
          />}
          {activeView === "perfil" && <PerfilView
            g={g} primary={primary} bgColor={bgColor} cardBg={cardBg}
            btnBg={btnBg} btnText={btnText}
            authUser={authUser} clientProfile={clientProfile}
            goals={goals} services={services}
            onLogin={() => showLoginModal()} openModal={openModal} closeModal={closeModal}
            onLogout={async () => { lastSignInRef.current = 0; _psAccessToken = null; localStorage.removeItem("vinnx_ps_user"); sessionStorage.removeItem("vinnx_reminder_dismissed"); await supabase.auth.signOut(); setAuthUser(null); setClientProfile(null); setClientSubscription(null); setAllEvents([]); resetSelection(); }}
            onProfileUpdate={(p: any) => setClientProfile(p)}
            setActiveView={setActiveView} updateSelection={updateSelection}
            resetSelection={resetSelection}
          />}
          {/* Footer — only on Perfil */}
          {activeView === "perfil" && (() => {
            const ftText = g("footer.text", "");
            const ftLogo = g("footer.logo", "");
            const ftInsta = g("footer.instagram", "");
            const ftFb = g("footer.facebook", "");
            const ftTiktok = g("footer.tiktok", "");
            const ftWa = g("footer.whatsapp", "");
            const ftBgColor = g("footer.bg_color", "") || "transparent";
            const ftTextColor = g("footer.text_color", "") || "#9ca3af";
            const hasSocial = ftInsta || ftFb || ftTiktok || ftWa;
            const hasFooter = ftText || ftLogo || hasSocial;
            if (!hasFooter) return null;
            return (
              <div className="booking-footer" style={{ backgroundColor: ftBgColor, color: ftTextColor }}>
                {ftLogo && <img src={ftLogo} alt="Logo" className="w-12 h-12 mx-auto mb-3 object-contain" />}
                {hasSocial && (
                  <div className="flex justify-center gap-3 mb-3">
                    {ftInsta && <a href={ftInsta} target="_blank" rel="noopener noreferrer" title="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>}
                    {ftFb && <a href={ftFb} target="_blank" rel="noopener noreferrer" title="Facebook"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>}
                    {ftTiktok && <a href={ftTiktok} target="_blank" rel="noopener noreferrer" title="TikTok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg></a>}
                    {ftWa && <a href={`https://wa.me/${ftWa.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"><MessageCircle className="w-5 h-5" /></a>}
                  </div>
                )}
                {ftText && <p className="text-xs" style={{ color: ftTextColor }}>{ftText}</p>}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Gradient Fade — pointer-events:none ensures Agendar button is clickable */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "7rem", pointerEvents: "none", zIndex: 40, background: `linear-gradient(to top, ${bgColor} 0%, ${bgColor}99 60%, transparent 100%)` }} />

      {/* WhatsApp Floating Button */}
      {g("extras.whatsapp_float", "false") === "true" && g("extras.whatsapp_number", "") && (
        <a
          href={`https://wa.me/${g("extras.whatsapp_number", "").replace(/\D/g, "")}?text=${encodeURIComponent(g("extras.whatsapp_message", "Olá! Gostaria de agendar um horário."))}`}
          target="_blank" rel="noopener noreferrer"
          className="booking-whatsapp-float"
        >
          <MessageCircle />
        </a>
      )}

      {/* Floating Pill Navbar */}
      <div ref={navRef} className={`booking-navbar ${navbarPlatformClass} ${modalContent ? "booking-content-blur" : ""}`}>
        <div ref={indicatorRef} className="booking-nav-indicator" style={{ backgroundColor: `${navbarActiveColor}20` }} />
        {tabDefs.map((item) => (
          <div key={item.key}
            className={`booking-nav-item ${activeView === item.key ? "active" : ""}`}
            style={{ color: activeView === item.key ? navbarActiveColor : "#94a3b8" }}
            onClick={() => setActiveView(item.key)}>
            <div className="relative">
              <item.icon style={{ width: 18, height: 18 }} />
              {item.key === "historico" && needsReview && g("review.enabled", "true") !== "false" && g("review.show_badge", "true") !== "false" && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }} />
              )}
            </div>
            {navbarShowLabels && <span>{item.label}</span>}
          </div>
        ))}
      </div>

      {/* Modal Overlay — Bottom Sheet / Center Dialog / Fullscreen */}
      {modalContent && (
        <div className={`fixed inset-0 z-50 flex justify-center booking-modal-backdrop ${modalVisible ? "backdrop-visible" : ""}`}
          style={{
            alignItems: modalPosition !== "bottom" ? "center" : "flex-end",
            padding: modalPosition === "fullscreen" ? 0 : modalPosition === "center" ? "1rem" : 0,
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !modalIsAuth) closeModal(); }}>
          <div className={`w-full booking-modal-enter booking-hide-scrollbar ${modalVisible ? "booking-modal-enter-active" : ""} ${modalExiting ? "booking-modal-exit" : ""}`}
            style={{
              maxWidth: modalPosition === "fullscreen" ? "100%" : 420,
              maxHeight: modalPosition === "fullscreen" ? "100dvh" : "85vh",
              height: modalPosition === "fullscreen" ? "100dvh" : undefined,
              overflowY: "auto",
              ...(modalPosition === "fullscreen"
                ? { backgroundColor: "transparent", borderRadius: 0, color: textColor }
                : modalPosition === "bottom"
                  ? { backgroundColor: "#1a1a1a", borderTopLeftRadius: "1.25rem", borderTopRightRadius: "1.25rem", color: textColor, paddingBottom: "env(safe-area-inset-bottom)" }
                  : { backgroundColor: "#1a1a1a", borderRadius: "1rem", color: textColor }),
            }}>
            {modalContent}
          </div>
        </div>
      )}

      {/* ═══ Push Notifications Modal ═══ */}
      {showPushBanner && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            opacity: pushBannerExiting ? 0 : 1,
            transition: 'opacity 0.35s ease',
          }}
          onClick={dismissPushBanner}
        >
          <div
            className="w-full max-w-sm rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              transform: pushBannerExiting ? 'scale(0.95) translateY(20px)' : 'scale(1) translateY(0)',
              transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with glow */}
            <div className="relative pt-8 pb-4 px-6 text-center">
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${primary}30 0%, transparent 70%)`,
                  filter: 'blur(20px)',
                }}
              />
              <div
                className="relative w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${primary}, ${primary}cc)`,
                  boxShadow: `0 8px 24px ${primary}40`,
                }}
              >
                <span className="text-3xl">🔔</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Ative as Notificações</h3>
              <p className="text-sm text-gray-400">Fique por dentro de tudo</p>
            </div>

            {/* Benefits */}
            <div className="px-6 pb-4 space-y-3">
              {[
                { icon: '📅', text: 'Lembretes de agendamentos' },
                { icon: '🎁', text: 'Promoções e descontos exclusivos' },
                { icon: '🎂', text: 'Surpresas no seu aniversário' },
                { icon: '⭐', text: 'Avalie e ajude a melhorar nosso serviço' },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-lg flex-shrink-0">{b.icon}</span>
                  <span className="text-sm text-gray-300">{b.text}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 pt-2 space-y-2">
              <button
                onClick={subscribeToPush}
                className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${primary}, ${primary}dd)`,
                  color: bgColor,
                  boxShadow: `0 4px 16px ${primary}40`,
                }}
              >
                Ativar Notificações
              </button>
              <button
                onClick={dismissPushBanner}
                className="w-full py-3 rounded-xl text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed", top: "calc(24px + env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)",
          zIndex: 100, padding: "12px 24px", borderRadius: 12,
          backgroundColor: toast.type === "success" ? "#16a34a" : "#dc2626",
          color: "#fff", fontWeight: 600, fontSize: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "toastIn 0.3s ease-out",
          maxWidth: 360, textAlign: "center",
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ============================================================
// AGENDAR VIEW
// ============================================================
function AgendarView({ g, primary, bgColor, cardBg, animateReady, selection, allEvents, onUnitClick, onBarberClick, onServiceClick, onDateClick, onAgendarClick, showPrices, showDuration, maxOpenAppts, showInstallBanner, isStandalone, isIOS, isIOSSafari, deferredPrompt, installBannerExiting, onInstallClick, onInstallDismiss, showPushBanner, pushBannerExiting, pushSubscribed, pushPermission, onPushSubscribe, onPushDismiss }: any) {
  const heroVideo = g("hero.bg_video", "");
  const heroImage = g("hero.bg_image", "");
  const heroTitle = g("hero.title", "Agende seu horário");
  const heroSubtitle = g("hero.subtitle", "Escolha os serviços e agende com facilidade.");
  const heroLogo = g("hero.logo", "") || g("loading.logo", "");
  const showLogo = g("hero.show_logo", "true") !== "false";
  const allSelected = selection.unit && selection.barber && selection.service && selection.date && selection.time;

  const openAppts = allEvents.filter((e: CalendarEvent) => e.status !== "cancelled" && e.status !== "completed");
  const isMaxed = openAppts.length >= maxOpenAppts;

  // Today's appointment reminder
  const today = new Date();
  const todaysAppt = allEvents.find((e: CalendarEvent) => {
    if (e.status === "cancelled" || e.status === "completed") return false;
    return e.date === today.getDate() && e.month === today.getMonth() && e.year === today.getFullYear();
  });
  const [reminderDismissed, setReminderDismissed] = useState(() => sessionStorage.getItem("vinnx_reminder_dismissed") === "true");
  const [reminderExiting, setReminderExiting] = useState(false);
  const dismissReminder = () => { setReminderExiting(true); setTimeout(() => { setReminderDismissed(true); sessionStorage.setItem("vinnx_reminder_dismissed", "true"); }, 350); };

  // Accordion animation for install banner steps
  const [installStepsExpanded, setInstallStepsExpanded] = useState(false);
  useEffect(() => {
    if (showInstallBanner && !isStandalone) {
      const timer = setTimeout(() => setInstallStepsExpanded(true), 1800);
      return () => clearTimeout(timer);
    } else {
      setInstallStepsExpanded(false);
    }
  }, [showInstallBanner, isStandalone]);

  return (
    <div className={`relative flex flex-col ${animateReady ? "" : "booking-anim-paused"}`} style={{ height: "100%" }}>
      {/* Hero Background */}
      <div className="booking-video-bg">
        {heroVideo ? (
          <video autoPlay muted loop playsInline poster={heroImage || undefined}><source src={heroVideo} type="video/mp4" /></video>
        ) : heroImage ? (
          <img src={heroImage} alt="Hero" />
        ) : null}
        <div className="booking-video-overlay" style={{ background: g("hero.overlay_color", "rgba(0,0,0,0.7)") }} />
      </div>

      {/* Reminder */}
      {todaysAppt && !reminderDismissed && g("reminder.enabled", "true") !== "false" && (
        <div className={`relative z-10 m-6 p-4 rounded-xl flex items-center gap-3 booking-fade-in ${reminderExiting ? "booking-reminder-exit" : ""}`} style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: `1px solid rgba(255,255,255,0.12)`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: primary }}>{g("reminder.title", "Lembrete")}</p>
            <p className="text-sm text-gray-300">Seu horário é hoje às <strong className="text-white">{todaysAppt.startTime}</strong>.</p>
          </div>
          <button onClick={dismissReminder} className="flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-white/10" style={{ color: "rgba(255,255,255,0.5)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && !isStandalone && (
        <div className={`relative z-10 mx-6 ${todaysAppt && !reminderDismissed ? "mt-2" : "mt-6"} p-4 rounded-xl booking-fade-in ${installBannerExiting ? "booking-reminder-exit" : ""}`} style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
        }}>
          <div className="flex items-center gap-3 mb-3">
            {/* App Icon Preview */}
            <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0" style={{
              backgroundColor: g("pwa_store_icon_bg", primary),
              border: "1.5px solid rgba(255,255,255,0.15)",
            }}>
              {g("pwa_store_icon", "") ? (
                <img src={g("pwa_store_icon", "")} alt="App" className="w-full h-full object-cover" />
              ) : g("loading.logo", "") ? (
                <div className="w-full h-full flex items-center justify-center p-1.5">
                  <img src={g("loading.logo", "")} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white">{g("pwa_store_name", g("store_name", "VINNX BARBER"))}</p>
              <p className="text-[11px] text-gray-400">{isIOS && !deferredPrompt ? "Adicione nosso app à sua tela inicial" : "Acesse mais rápido pela tela inicial"}</p>
            </div>
            <button onClick={onInstallDismiss} className="flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-white/10" style={{ color: "rgba(255,255,255,0.5)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Accordion — CSS Grid 0fr→1fr for pixel-perfect smooth expansion */}
          <div style={{
            display: "grid",
            gridTemplateRows: installStepsExpanded ? "1fr" : "0fr",
            transition: "grid-template-rows 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <div style={{ overflow: "hidden", minHeight: 0 }}>
              <div className="pt-1">

          {isIOS && !deferredPrompt ? (
            isIOSSafari ? (
              /* Safari on iOS — show step-by-step instructions */
              <div className="space-y-1.5">
                {[
                  { step: 1, verb: "Toque em", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>, label: "Menu" },
                  { step: 2, verb: "Escolha", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>, label: "Compartilhar" },
                  { step: 3, verb: "Toque em", icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>, label: "Ver Mais" },
                  { step: 4, verb: "Escolha", icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, label: "Adicionar à Tela de Início" },
                ].map(({ step, verb, icon, label }) => (
                  <div key={step}
                    className="flex items-center gap-2.5 py-2 px-3 rounded-lg"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      opacity: installStepsExpanded ? 1 : 0,
                      transform: installStepsExpanded ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
                      transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + step * 0.3}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + step * 0.3}s`,
                    }}>
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: `${primary}25`, color: primary }}>{step}</span>
                    <span className="text-[12px] text-gray-300">{verb}</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium text-white" style={{ background: "rgba(255,255,255,0.1)" }}>
                      {icon}
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              /* Chrome/Firefox on iOS — share button is in the address bar */
              <div className="space-y-1.5"
                style={{
                  opacity: installStepsExpanded ? 1 : 0,
                  transform: installStepsExpanded ? "translateY(0)" : "translateY(10px)",
                  transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s",
                }}>
                {[
                  { step: 1, verb: "Toque em", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>, label: "Compartilhar (na barra de endereço)" },
                  { step: 2, verb: "Escolha", icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, label: "Adicionar à Tela de Início" },
                ].map(({ step, verb, icon, label }) => (
                  <div key={step}
                    className="flex items-center gap-2.5 py-2 px-3 rounded-lg"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      opacity: installStepsExpanded ? 1 : 0,
                      transform: installStepsExpanded ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
                      transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + step * 0.3}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + step * 0.3}s`,
                    }}>
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: `${primary}25`, color: primary }}>{step}</span>
                    <span className="text-[12px] text-gray-300">{verb}</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium text-white" style={{ background: "rgba(255,255,255,0.1)" }}>
                      {icon}
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex gap-2"
              style={{
                opacity: installStepsExpanded ? 1 : 0,
                transform: installStepsExpanded ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
                transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s",
              }}>
              <button onClick={onInstallClick}
                className="flex-1 py-2 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-1.5"
                style={{ backgroundColor: primary, color: bgColor }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Instalar App
              </button>
              <button onClick={onInstallDismiss}
                className="px-3 py-2 rounded-lg text-[12px] text-gray-400 transition-colors hover:bg-white/5">
                Agora não
              </button>
            </div>
          )}

              </div>
            </div>
          </div>
        </div>
      )}


      {/* Hero Content */}
      <div className="relative z-10 flex-grow flex flex-col justify-end p-6 pb-4 min-h-0 overflow-hidden">
        <div className="text-center mb-4">
          {showLogo && heroLogo && <img src={heroLogo} alt="Logo" className="w-32 h-32 mb-4 mx-auto object-contain booking-fade-in" />}
          <h1 className="text-2xl font-bold text-white booking-fade-in-delay">{heroTitle}</h1>
          <div className="w-20 h-1 mx-auto my-2 rounded booking-underline" style={{ backgroundColor: primary }} />
          <p className="text-sm text-gray-200 booking-fade-in-delay">{heroSubtitle}</p>
        </div>
      </div>

      {/* Selection Cards */}
      <div className="relative z-10 px-6 pt-0 space-y-3 flex-shrink-0" style={{ background: `linear-gradient(to top, ${bgColor}, transparent)`, paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
        <SelectionCard delay="100" icon={<Store className="w-5 h-5" style={{ color: primary }} />}
          text={selection.unit?.name || g("booking.label_unit", "Selecionar unidade")} selected={!!selection.unit}
          disabled={false} onClick={onUnitClick} cardBg={cardBg} />
        <SelectionCard delay="200" icon={<User className="w-5 h-5" style={{ color: primary }} />}
          text={selection.barber?.name || g("booking.label_barber", "Selecionar barbeiro")} selected={!!selection.barber}
          disabled={!selection.unit} onClick={onBarberClick} cardBg={cardBg} />

        {/* Service card — locked during redemption */}
        {selection.isFromCreditRedemption && selection.service ? (
          <div className="booking-selection-item flex items-center justify-between p-3.5 rounded-lg booking-slide-up booking-delay-300"
            style={{ backgroundColor: cardBg, borderColor: primary, borderWidth: 2 }}>
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5" style={{ color: primary }} />
              <div>
                <span className="text-white font-bold">{selection.service.name}</span>
                <p className="text-xs text-gray-400">Recompensa de indicação!</p>
              </div>
            </div>
            <Lock className="w-4 h-4 text-gray-500" />
          </div>
        ) : (
          <SelectionCard delay="300" icon={<Scissors className="w-5 h-5" style={{ color: primary }} />}
            text={selection.service ? `${selection.service.name}${showPrices ? ` — R$ ${selection.service.price.toFixed(2)}` : ""}` : g("booking.label_service", "Selecionar serviço")}
            selected={!!selection.service} disabled={!selection.barber} onClick={onServiceClick} cardBg={cardBg} />
        )}

        <SelectionCard delay="400" icon={<Calendar className="w-5 h-5" style={{ color: primary }} />}
          text={selection.date && selection.time ? `${selection.time} — ${WEEKDAYS_FULL[selection.date.getDay()]}, ${selection.date.getDate()} de ${MONTHS_PT[selection.date.getMonth()]}` : g("booking.label_datetime", "Selecionar data e hora")}
          selected={!!selection.time} disabled={!selection.service} onClick={onDateClick} cardBg={cardBg} />

        <button onClick={onAgendarClick} disabled={!allSelected || isMaxed}
          className={`w-full py-3 mt-3 rounded-xl font-bold text-sm tracking-wide booking-slide-up booking-delay-500 ${allSelected && !isMaxed ? "booking-btn-active" : "booking-btn-inactive"}`}
          style={allSelected && !isMaxed ? { backgroundColor: primary, color: bgColor, boxShadow: `0 0 24px ${primary}40` } : undefined}>
          {isMaxed ? `Máximo de ${maxOpenAppts} agendamentos em aberto` : g("booking.label_submit", "Agendar")}
        </button>
      </div>
    </div>
  );
}

function SelectionCard({ delay, icon, text, selected, disabled, onClick, cardBg }: any) {
  return (
    <div onClick={disabled ? undefined : onClick}
      className={`booking-selection-item flex items-center justify-between p-3.5 rounded-lg booking-slide-up booking-delay-${delay} ${disabled ? "disabled" : ""} ${selected ? "selected" : ""}`}
      style={disabled ? { pointerEvents: "none" as const } : undefined}>
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <span className={`truncate ${selected ? "text-white font-semibold" : "text-gray-400"}`}>{text}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
    </div>
  );
}

// ============================================================
// CALENDAR MODAL
// ============================================================
function CalendarModal({ primary, cardBg, barber, unitId, schedules, events, maxDays, closedDays, slotInterval, g, onSelect }: any) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [periodo, setPeriodo] = useState<"manha" | "tarde">("manha");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + maxDays);

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Auto-select first available date on mount
  useEffect(() => {
    for (let i = 0; i <= maxDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      if (!closedDays.includes(d.getDay())) {
        if (barber && barber.id !== "__no_pref__") {
          const ws = schedules.find((s: WorkSchedule) => s.memberId === barber.id && s.dayOfWeek === d.getDay());
          if (ws && ws.isOff) continue;
        }
        setSelectedDate(d);
        break;
      }
    }
  }, []);

  function isDayAvailable(day: number): boolean {
    const d = new Date(year, month, day);
    if (d < today || d > maxDate) return false;
    if (closedDays.includes(d.getDay())) return false;
    if (barber && barber.id !== "__no_pref__") {
      const ws = schedules.find((s: WorkSchedule) => s.memberId === barber.id && s.dayOfWeek === d.getDay());
      if (ws && ws.isOff) return false;
    }
    return true;
  }

  function getAvailableSlots(): string[] {
    if (!selectedDate) return [];
    const barberId = barber?.id === "__no_pref__" ? null : barber?.id;
    // Use store_settings defaults when barber has no individual schedule
    const defStart = g("booking.default_start_time", "08:00");
    const defEnd = g("booking.default_end_time", "19:00");
    const defBreakS = g("booking.default_break_start", "12:00");
    const defBreakE = g("booking.default_break_end", "13:00");
    let startTime = defStart, endTime = defEnd, breakStart = defBreakS, breakEnd = defBreakE;
    if (barberId) {
      const ws = schedules.find((s: WorkSchedule) => s.memberId === barberId && s.dayOfWeek === selectedDate.getDay());
      if (ws) {
        startTime = ws.startTime || defStart;
        endTime = ws.endTime || defEnd;
        breakStart = ws.breakStart || "";
        breakEnd = ws.breakEnd || "";
      }
    }
    let slots = generateTimeSlots(startTime, endTime, slotInterval);
    slots = slots.filter((s) => !isInBreak(s, breakStart, breakEnd));

    const dayEvents = events.filter((e: any) =>
      e.date === selectedDate.getDate() && e.month === selectedDate.getMonth() && e.year === selectedDate.getFullYear()
      && e.status !== "cancelled" && (!barberId || e.barberId === barberId)
      && (!unitId || e.unitId === unitId)
    );

    // Max per barber per day
    const maxPerDay = parseInt(g("booking.max_per_barber_day", "0"), 10);
    if (maxPerDay > 0 && barberId) {
      const barberDayCount = dayEvents.length;
      if (barberDayCount >= maxPerDay) return []; // No slots — barber is full for the day
    }

    // Filter out slots that would overlap with existing events (considering duration)
    slots = slots.filter((slot) => {
      const [sh, sm] = slot.split(":").map(Number);
      const slotStart = sh * 60 + sm;
      return !dayEvents.some((e: any) => {
        const [eH, eM] = (e.startTime || "00:00").split(":").map(Number);
        const eventStart = eH * 60 + eM;
        const eventEnd = eventStart + (e.duration || slotInterval);
        return slotStart >= eventStart && slotStart < eventEnd;
      });
    });

    // Filter by min advance hours and block same day
    const now = new Date();
    const minAdvHours = parseInt(g("booking.min_advance_hours", "0"), 10);
    const blockToday = g("booking.block_same_day", "false") === "true";
    const isToday = selectedDate.toDateString() === now.toDateString();

    if (isToday && blockToday) return []; // Block same-day bookings entirely

    if (isToday || minAdvHours > 0) {
      const cutoff = now.getHours() * 60 + now.getMinutes() + (isToday ? Math.max(minAdvHours * 60, 0) : 0);
      slots = slots.filter((s) => {
        const [h, m] = s.split(":").map(Number);
        if (isToday && h * 60 + m <= cutoff) return false;
        // For future days, min_advance_hours is checked at booking time, not slot level
        return true;
      });
    }

    return slots;
  }

  const slots = getAvailableSlots();
  const morningSlots = slots.filter((s) => parseInt(s) < 12);
  const afternoonSlots = slots.filter((s) => parseInt(s) >= 12);
  const displaySlots = periodo === "manha" ? morningSlots : afternoonSlots;

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", width: "100%", padding: "1rem 0.75rem", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <h3 className="text-lg font-bold mb-3 text-center" style={{ color: primary }}>{g("booking.modal_title_calendar", "Data do agendamento")}</h3>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-3 px-2">
          <button onClick={() => { const prev = new Date(year, month - 1); if (prev >= new Date(today.getFullYear(), today.getMonth())) setViewDate(prev); }} className="p-1"><ChevronLeft className="w-5 h-5 text-white" /></button>
          <span className="font-bold text-base text-white">{MONTHS_PT[month]} {year}</span>
          <button onClick={() => { const next = new Date(year, month + 1); if (next <= new Date(maxDate.getFullYear(), maxDate.getMonth())) setViewDate(next); }} className="p-1"><ChevronRight className="w-5 h-5 text-white" /></button>
        </div>

        {/* Day headers */}
        <div className="booking-calendar-grid mb-1">
          {WEEKDAYS_PT.map((d) => <span key={d} className="text-xs font-semibold" style={{ color: primary }}>{d}</span>)}
        </div>

        {/* Calendar days */}
        <div className="booking-calendar-grid mb-4">
          {Array.from({ length: firstDay }).map((_, i) => <span key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const available = isDayAvailable(day);
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = selectedDate && day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
            return (
              <div key={day}
                onClick={() => { if (available) { setSelectedDate(new Date(year, month, day)); setPeriodo("manha"); } }}
                className={`booking-calendar-day ${available ? "" : "unavailable"} ${isToday ? "today" : ""}`}
                style={{
                  backgroundColor: isSelected ? primary : available ? "#374151" : "transparent",
                  color: isSelected ? "#111" : available ? "#fff" : "#6b7280",
                  fontWeight: isSelected ? 700 : 500, cursor: available ? "pointer" : "not-allowed",
                  borderColor: isToday && !isSelected ? primary : "transparent",
                  width: 34, height: 34, fontSize: "0.875rem",
                }}>
                {day}
              </div>
            );
          })}
        </div>

        {/* Time period section */}
        <div className="mt-1 mb-2">
          <h3 className="font-bold text-center mb-3 text-white text-sm tracking-wide" style={{ letterSpacing: "0.05em" }}>Escolha o melhor horário</h3>
          
          {/* Elegant pill toggle */}
          <div className="relative flex mb-4 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)", padding: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
            {/* Sliding indicator with glow */}
            <div
              className="absolute top-[3px] bottom-[3px] rounded-full transition-all duration-300"
              style={{
                width: "calc(50% - 3px)",
                left: periodo === "manha" ? 3 : "calc(50%)",
                backgroundColor: primary,
                boxShadow: `0 0 16px ${primary}44, 0 2px 8px rgba(0,0,0,0.3)`,
                transitionTimingFunction: "cubic-bezier(0.25, 0.8, 0.25, 1)",
              }}
            />
            {(["manha", "tarde"] as const).map((p) => (
              <button key={p} onClick={() => setPeriodo(p)}
                className="relative z-10 flex-1 py-2 rounded-full font-semibold text-sm transition-all duration-250"
                style={{
                  color: periodo === p ? "#111" : "rgba(255,255,255,0.45)",
                  background: "transparent",
                  letterSpacing: "0.02em",
                }}>
                {p === "manha" ? "Manhã" : "Tarde"}
              </button>
            ))}
          </div>
        </div>

        {/* Time slots */}
        <div
          key={periodo}
          className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto booking-scrollbar"
          style={{ animation: "slotsFadeIn 0.25s ease-out both" }}
        >
          {selectedDate ? (displaySlots.length > 0 ? displaySlots.map((t, i) => (
            <div key={t} onClick={() => onSelect(selectedDate, t)}
              className="booking-time-slot-elegant p-2.5 rounded-xl text-center text-sm font-medium cursor-pointer"
              style={{ animationDelay: `${i * 30}ms` }}>
              {t}
            </div>
          )) : (
            <p className="col-span-4 text-gray-500 text-sm text-center py-4" style={{ fontStyle: "italic" }}>Não há horários disponíveis para este período.</p>
          )) : (
            <p className="col-span-4 text-gray-500 text-sm text-center py-4" style={{ fontStyle: "italic" }}>Selecione uma data para ver os horários</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RESUMO MODAL (with coupon, subscription coverage, credit)
// ============================================================
function ResumoModal({ selection, primary, bgColor, cardBg, clientSubscription, onClose, onConfirm }: any) {
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const price = selection.service?.price || 0;
  const dateStr = selection.date?.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

  const isCreditRedemption = !!selection.isFromCreditRedemption;
  // TODO: Check subscription coverage when subscription system is fully wired
  const isCovered = false;

  let finalPrice = price;
  let creditHtml = null;
  let planHtml = null;

  if (isCreditRedemption) {
    finalPrice = 0;
    creditHtml = (
      <>
        <div className="flex justify-between text-green-400 text-sm">
          <span>Resgate de Crédito</span>
          <span>- R$ {price.toFixed(2)}</span>
        </div>
        <div className="p-3 rounded-r-lg text-sm mt-3 border-l-4" style={{ backgroundColor: `${primary}15`, borderColor: primary, color: primary }}>
          <p className="font-bold">Serviço resgatado com seus créditos de indicação!</p>
        </div>
      </>
    );
  } else if (isCovered) {
    finalPrice = 0;
    planHtml = (
      <>
        <div className="flex justify-between text-green-400 text-sm">
          <span>Incluso no seu plano</span>
          <span>- R$ {price.toFixed(2)}</span>
        </div>
        <div className="p-3 rounded-r-lg text-sm mt-3 border-l-4" style={{ backgroundColor: `${primary}15`, borderColor: primary, color: primary }}>
          <p className="font-bold">Este serviço será abatido do seu plano.</p>
        </div>
      </>
    );
  } else {
    finalPrice = price * (1 - couponDiscount);
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    // Check coupon in DB
    const { data } = await supabase.from("coupons").select("*").eq("code", couponCode.toUpperCase()).eq("active", true).limit(1);
    setTimeout(() => {
      if (data && data.length > 0) {
        const c = data[0];
        // Validate expiry dates
        const now = new Date().toISOString();
        if (c.valid_until && now > c.valid_until) {
          setCouponDiscount(0);
          setCouponMsg({ text: "Cupom expirado.", ok: false });
          setCouponLoading(false);
          return;
        }
        if (c.valid_from && now < c.valid_from) {
          setCouponDiscount(0);
          setCouponMsg({ text: "Cupom ainda não está válido.", ok: false });
          setCouponLoading(false);
          return;
        }
        // Validate usage limit
        if (c.max_uses && c.used_count >= c.max_uses) {
          setCouponDiscount(0);
          setCouponMsg({ text: "Cupom esgotado.", ok: false });
          setCouponLoading(false);
          return;
        }
        // Validate min amount
        if (c.min_amount && price < c.min_amount) {
          setCouponDiscount(0);
          setCouponMsg({ text: `Valor mínimo: R$ ${Number(c.min_amount).toFixed(2)}`, ok: false });
          setCouponLoading(false);
          return;
        }
        const discVal = c.discount_value || 10;
        const disc = (c.discount_type === 'fixed') ? discVal / price : discVal / 100;
        setCouponDiscount(disc);
        setCouponMsg({ text: c.discount_type === 'fixed' ? `Cupom de R$${discVal.toFixed(2)} aplicado!` : `Cupom de ${discVal}% aplicado!`, ok: true });
      } else {
        setCouponDiscount(0);
        setCouponMsg({ text: "Cupom inválido.", ok: false });
      }
      setCouponLoading(false);
    }, 800);
  }

  return (
    <div className="p-6 booking-auth" style={{ borderRadius: "1rem" }}>
      <h3 className="text-2xl font-bold text-center mb-6" style={{ color: primary }}>Resumo do Agendamento</h3>
      <div className="text-left space-y-3 text-sm mb-6">
        <p><strong className="text-gray-400">Unidade:</strong><br /><span className="text-white">{selection.unit?.name}</span></p>
        <p><strong className="text-gray-400">Data:</strong><br /><span className="text-white">{dateStr} às {selection.time}</span></p>
        <p><strong className="text-gray-400">Profissional:</strong><br /><span className="text-white">{selection.barber?.name}</span></p>
        <p><strong className="text-gray-400">Serviço:</strong><br /><span className="text-white">{selection.service?.name}</span></p>
      </div>

      <div className="border-t border-gray-700 pt-4">
        {/* Coupon section - hidden if covered or credit redemption */}
        {!isCovered && !isCreditRedemption && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Cupom de desconto" className="flex-1 p-2 rounded-lg bg-[#333] border border-[#555] text-white text-sm" />
              <button onClick={applyCoupon} disabled={couponLoading} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ backgroundColor: primary, color: bgColor }}>
                {couponLoading ? <Loader2 className="w-4 h-4 booking-spin" /> : "Aplicar"}
              </button>
            </div>
            {couponMsg && <p className={`text-sm ${couponMsg.ok ? "text-green-400" : "text-red-400"}`}>{couponMsg.text}</p>}
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Subtotal</span>
            <span className="text-white">R$ {price.toFixed(2)}</span>
          </div>
          {creditHtml}
          {planHtml}
          {couponDiscount > 0 && !isCovered && !isCreditRedemption && (
            <div className="flex justify-between text-green-400">
              <span>Desconto Cupom</span>
              <span>- R$ {(price * couponDiscount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg border-t border-gray-700 pt-2 mt-2">
            <span className="text-white">Total</span>
            <span style={{ color: primary }}>R$ {finalPrice.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <button onClick={() => onClose()} className="w-full py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        <button onClick={async () => {
          setLoading(true);
          try {
            await onConfirm({ couponCode, couponDiscount, finalPrice });
          } catch (e) {
            console.error("Booking error:", e);
          } finally {
            setLoading(false);
          }
        }} disabled={loading}
          className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>
          {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : "Confirmar"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// HISTORICO VIEW (with details, reschedule, cancel, rate)
// ============================================================
function HistoricoView({ g, primary, bgColor, cardBg, authUser, clientProfile, events, availabilityEvents, units, barbers, services, schedules, closedDays, maxAdvDays, slotInterval, onLogin, openModal, closeModal, onRefresh, setActiveView, updateSelection, resetSelection }: any) {
  if (!authUser) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center min-h-[80vh]">
        <History className="w-16 h-16 text-gray-600 mb-4" />
        <h1 className="text-2xl font-bold" style={{ color: primary }}>Histórico de Serviços</h1>
        <p className="text-gray-400 mt-2 mb-6">{g("auth.historico_prompt", "Crie uma conta ou faça login para ver seus agendamentos.")}</p>
        <button onClick={onLogin} className="py-3 px-8 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>{g("auth.login_button", "Entrar ou Cadastrar")}</button>
      </div>
    );
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const abertos = events.filter((e: CalendarEvent) => {
    if (e.status === "cancelled" || e.status === "completed") return false;
    const eventDate = new Date(e.year, e.month, e.date);
    return eventDate >= todayStart;
  });
  const historico = events.filter((e: CalendarEvent) => {
    if (e.status === "cancelled") return false;
    const eventDate = new Date(e.year, e.month, e.date);
    return eventDate < todayStart || e.status === "completed";
  });

  // Resolve barber name — fallback to barbers array if barberName looks like a UUID
  const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s || "");
  const resolveBarberName = (e: CalendarEvent) =>
    e.barberName && !isUUID(e.barberName)
      ? e.barberName
      : barbers.find((b: any) => b.id === e.barberId)?.name || e.barberName || "A definir";

  // Show appointment details
  function showDetalhes(ev: CalendarEvent) {
    const eventDate = new Date(ev.year, ev.month, ev.date);
    const dateStr = eventDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const isOpen = eventDate >= todayStart && ev.status !== "completed";
    const unit = units.find((u: any) => u.id === ev.unitId);

    // Use the shared resolveBarberName helper (defined in HistoricoView scope)
    const resolvedBarber = resolveBarberName(ev);

    const svc = services.find((s: any) => s.id === ev.serviceId);
    const price = ev.finalPrice != null ? Number(ev.finalPrice) : (svc?.price ?? null);

    openModal(
      <div className="p-6" style={{ borderRadius: "1rem" }}>
        <h3 className="text-xl font-bold mb-6 text-center italic" style={{ color: primary }}>Detalhes do Agendamento</h3>

        <div className="space-y-5 text-sm mb-6">
          {unit && (
            <div>
              <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Unidade:</p>
              <p className="text-white font-medium">{unit.tradeName || unit.name}</p>
              {unit.address && <p className="text-gray-500 text-xs mt-0.5">{unit.address}{unit.city ? `, ${unit.city}` : ""}{unit.state ? ` - ${unit.state}` : ""}</p>}
              {unit.address && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${unit.address}, ${unit.city || ""} - ${unit.state || ""}`)}`} target="_blank" rel="noopener noreferrer"
                  className="mt-2 block w-full text-center py-2 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: "#1a1a1a", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>
                  Ver localização
                </a>
              )}
            </div>
          )}
          <div>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Data:</p>
            <p className="text-white capitalize">{dateStr}</p>
          </div>
          <div>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Horário:</p>
            <p className="text-white">{ev.startTime}</p>
          </div>
          <div>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Barbeiro:</p>
            <p className="text-white">{resolvedBarber}</p>
          </div>
          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-white">{ev.serviceName || ev.title}</p>
              {price != null && <p className="text-white font-bold">R$ {price.toFixed(2)}</p>}
            </div>
          </div>
          {price != null && (
            <div className="flex items-center justify-between border-t border-gray-700 pt-3">
              <p className="text-white font-bold text-base">Total</p>
              <p className="font-bold text-base" style={{ color: primary }}>R$ {price.toFixed(2)}</p>
            </div>
          )}
          {ev.usedReferralCredit && (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primary}20`, color: primary }}>Crédito de indicação</span>
          )}
        </div>

        {(() => {
          const evDate = new Date(ev.year, ev.month, ev.date);
          const [evH, evM] = (ev.startTime || "00:00").split(":").map(Number);
          evDate.setHours(evH, evM, 0, 0);
          const hoursUntil = (evDate.getTime() - Date.now()) / (1000 * 60 * 60);
          const cancelMin = parseInt(g("booking.cancellation_hours", "0"), 10);
          const reschedMin = parseInt(g("booking.reschedule_hours", "0"), 10);
          const canCancel = cancelMin <= 0 || hoursUntil >= cancelMin;
          const canReschedule = reschedMin <= 0 || hoursUntil >= reschedMin;

          if (isOpen) {
            return (
              <div className="space-y-3">
                <button onClick={() => { if (canReschedule) closeModal(() => showRemarcarModal(ev)); }}
                  className="w-full py-3 font-bold rounded-lg"
                  style={{ backgroundColor: primary, color: bgColor, opacity: canReschedule ? 1 : 0.4 }}
                  disabled={!canReschedule}>Remarcar</button>
                <button onClick={() => { if (canCancel) closeModal(() => showCancelConfirm(ev)); }}
                  className="w-full py-3 font-bold rounded-lg"
                  style={{ backgroundColor: "transparent", color: primary, border: `2px solid ${primary}`, opacity: canCancel ? 1 : 0.4 }}
                  disabled={!canCancel}>Cancelar agendamento</button>
                <button onClick={closeModal}
                  className="w-full py-3 font-semibold rounded-lg"
                  style={{ backgroundColor: "#1a1a1a", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>Voltar</button>
                {(!canCancel || !canReschedule) && (
                  <p className="text-xs text-gray-500 text-center">
                    {!canCancel && `Cancelamento requer ${cancelMin}h de antecedência. `}
                    {!canReschedule && `Remarcação requer ${reschedMin}h de antecedência.`}
                  </p>
                )}
              </div>
            );
          }
          return (
            <div className="space-y-3">
              <button onClick={() => {
                closeModal(() => {
                  resetSelection();
                  const u2 = units.find((u: any) => u.id === ev.unitId);
                  const b2 = barbers.find((b: any) => b.id === ev.barberId);
                  const s2 = services.find((s: any) => s.id === ev.serviceId);
                  updateSelection({ unit: u2, barber: b2, service: s2 });
                  setActiveView("agendar");
                });
              }} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>
                Agendar Novamente
              </button>
              {!ev.rating && g("review.enabled", "true") !== "false" && (
                <button onClick={() => closeModal(() => showAvaliacaoModal(ev))} className="w-full py-3 font-bold rounded-lg"
                  style={{ backgroundColor: "transparent", color: primary, border: `2px solid ${primary}` }}>
                  <Star className="w-4 h-4 inline mr-1" />Avaliar
                </button>
              )}
              {ev.rating && (
                <div className="py-3 text-center">
                  <div className="flex justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => <Star key={s} className="w-4 h-4" style={{ color: s <= ev.rating ? "#fbbf24" : "#6b7280", fill: s <= ev.rating ? "#fbbf24" : "none" }} />)}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Sua avaliação</p>
                </div>
              )}
              <button onClick={closeModal}
                className="w-full py-3 font-semibold rounded-lg"
                style={{ backgroundColor: "#1a1a1a", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>Voltar</button>
            </div>
          );
        })()}
      </div>, "center"
    );
  }

  function showCancelConfirm(ev: CalendarEvent) {
    openModal(
      <CancelConfirmModal ev={ev} primary={primary} bgColor={bgColor} onBack={() => closeModal(() => showDetalhes(ev))}
        onConfirm={async () => {
          await supabase.from("calendar_events").update({ status: "cancelled", updatedAt: new Date().toISOString() }).eq("id", ev.id);
          closeModal(() => {
            openModal(
              <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
                <Check className="w-12 h-12 mx-auto mb-4" style={{ color: primary }} />
                <h3 className="text-xl font-bold mb-3" style={{ color: primary }}>Agendamento Cancelado</h3>
                <p className="text-gray-300 mb-6">Seu agendamento foi cancelado com sucesso.</p>
                <button onClick={() => { closeModal(); onRefresh(); }} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Fechar</button>
              </div>, "center"
            );
          });
        }}
      />, "center"
    );
  }

  function showRemarcarModal(ev: CalendarEvent) {
    openModal(
      <RemarcarModal ev={ev} primary={primary} bgColor={bgColor} cardBg={cardBg}
        barbers={barbers} schedules={schedules} events={availabilityEvents} maxDays={maxAdvDays}
        closedDays={closedDays} slotInterval={slotInterval}
        onBack={() => closeModal(() => showDetalhes(ev))}
        onConfirm={async (newDate: Date, newTime: string) => {
          const isoDate = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate()).toISOString();
          await supabase.from("calendar_events").update({
            date: isoDate,
            startTime: newTime,
            endTime: addMinutesToTime(newTime, ev.duration || 30),
            updatedAt: new Date().toISOString(),
          }).eq("id", ev.id);
          closeModal(() => {
            openModal(
              <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
                <Check className="w-12 h-12 mx-auto mb-4" style={{ color: primary }} />
                <h3 className="text-xl font-bold mb-3" style={{ color: primary }}>Agendamento Remarcado!</h3>
                <p className="text-gray-300 mb-6">Seu horário foi atualizado com sucesso.</p>
                <button onClick={() => { closeModal(); onRefresh(); }} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Fechar</button>
              </div>, "center"
            );
          });
        }}
      />, "center"
    );
  }

  function showAvaliacaoModal(ev: CalendarEvent) {
    openModal(
      <AvaliacaoModal ev={ev} primary={primary} bgColor={bgColor} g={g}
        onClose={() => closeModal()}
        onSubmit={async (rating: number, comment: string) => {
          await supabase.from("calendar_events").update({ rating, ratingComment: comment, updatedAt: new Date().toISOString() }).eq("id", ev.id);
          // Also save to client_reviews for structured review data
          try {
            await supabase.from("client_reviews").insert({
              id: crypto.randomUUID(),
              clientId: clientProfile?.id,
              calendarEventId: ev.id,
              barberId: ev.barberId,
              rating,
              comment,
              createdAt: new Date().toISOString(),
            });
          } catch {}
          closeModal(() => {
            openModal(
              <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
                <Check className="w-12 h-12 mx-auto mb-4" style={{ color: primary }} />
                <h3 className="text-xl font-bold mb-3" style={{ color: primary }}>{g("review.success_title", "Avaliação Enviada!")}</h3>
                <p className="text-gray-300 mb-6">{g("review.success_message", "Obrigado pelo seu feedback!")}</p>
                <button onClick={() => { closeModal(); onRefresh(); }} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Fechar</button>
              </div>, "center"
            );
          });
        }}
      />, "center"
    );
  }


  return (
    <div className="p-6" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
      <div className="text-center mb-8 pt-4">
        <h2 className="text-3xl font-bold text-white">Meus <span style={{ color: primary }}>Agendamentos</span></h2>
        <div className="w-20 h-1 mx-auto mt-2 rounded-full booking-underline" style={{ backgroundColor: primary }} />
      </div>

      {abertos.length > 0 && (
        <>
          <h3 className="text-xl font-semibold mb-4" style={{ color: primary }}>Agendamento em aberto</h3>
          <div className="space-y-4 mb-8">
            {abertos.map((e: CalendarEvent) => {
              const eventDate = new Date(e.year, e.month, e.date);
              const dateStr = eventDate.toLocaleDateString("pt-BR");
              const unit = units.find((u: any) => u.id === e.unitId);
              const tagHtml = e.usedInPlan
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>Plano</span>
                : e.usedReferralCredit
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.2)", color: "#4ade80" }}>Crédito</span>
                : null;
              return (
                <div key={e.id} className="booking-history-card cursor-pointer hover:opacity-90 transition-opacity" style={{ backgroundColor: cardBg }}
                  onClick={() => showDetalhes(e)}>
                  <div className="pb-3">
                    <div className="flex items-start">
                      <h4 className="font-bold text-lg text-white flex-grow">{unit?.name || e.serviceName || e.title}</h4>
                      {tagHtml}
                    </div>
                    <div className="flex justify-between text-sm mt-2 mb-4" style={{ color: "#d1d5db" }}>
                      <span><Calendar className="w-3 h-3 inline mr-2" style={{ color: primary }} />{dateStr}</span>
                      <span><Clock className="w-3 h-3 inline mr-2" style={{ color: primary }} />{e.startTime}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full mr-4 flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#374151", color: primary }}>
                        {resolveBarberName(e).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Barbeiro</p>
                        <p className="font-semibold text-white">{resolveBarberName(e)}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-sm text-gray-400">Serviço</p>
                        <p className="font-semibold text-white">{e.serviceName || e.title}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-700 mt-3 pt-3 text-center">
                    <span className="font-semibold text-sm" style={{ color: primary }}>Ver detalhes</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {historico.length > 0 && (
        <>
          <h3 className="text-xl font-semibold mb-4" style={{ color: primary }}>Histórico de serviços</h3>
          <div className="space-y-4">
            {historico.map((e: CalendarEvent) => {
              const eventDate = new Date(e.year, e.month, e.date);
              const dateStr = eventDate.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
              const unit = units.find((u: any) => u.id === e.unitId);
              const tagHtml = e.usedInPlan
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>Plano</span>
                : e.usedReferralCredit
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.2)", color: "#4ade80" }}>Crédito</span>
                : null;
              return (
                <div key={e.id} className="booking-history-card" style={{ backgroundColor: cardBg }}>
                  <p className="text-sm text-gray-400 mb-2"><Calendar className="w-3 h-3 inline mr-2" style={{ color: primary }} />{dateStr}</p>
                  <p className="text-sm text-gray-400 mb-4"><Clock className="w-3 h-3 inline mr-2" style={{ color: primary }} />{e.startTime}</p>
                  <div className="border-t border-gray-700 pt-3">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-white mb-2">{unit?.name || e.serviceName || e.title}</p>
                      {tagHtml}
                    </div>
                    <div className="flex justify-between text-sm">
                      <div>
                        <p className="text-gray-400">Barbeiro</p>
                        <p className="text-white">{resolveBarberName(e)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Serviço</p>
                        <p className="text-white">{e.serviceName || e.title}</p>
                      </div>
                    </div>
                  </div>
                  {e.rating ? (
                    <div className="flex justify-center items-center mt-3 pt-3 border-t border-gray-700">
                      {[1, 2, 3, 4, 5].map((s) => <Star key={s} className="w-4 h-4" style={{ color: s <= e.rating! ? "#fbbf24" : "#6b7280", fill: s <= e.rating! ? "#fbbf24" : "none" }} />)}
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-3">
                      <button onClick={() => showDetalhes(e)} className="py-2 text-sm font-bold rounded-lg border-2 transition-colors" style={{ borderColor: primary, color: primary, backgroundColor: "transparent" }}>Avaliar</button>
                      <button onClick={() => {
                        const svc = services.find((s: Service) => s.id === e.serviceId);
                        const barber = barbers.find((b: any) => b.id === e.barberId);
                        resetSelection();
                        if (unit) updateSelection({ unit });
                        if (barber) updateSelection({ barber });
                        if (svc) updateSelection({ service: svc });
                        setActiveView("agendar");
                      }} className="py-2 text-sm font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Agendar Novamente</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {abertos.length === 0 && historico.length === 0 && (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">Nenhum agendamento encontrado.</p>
        </div>
      )}
    </div>
  );
}

// --- Cancel Confirm Modal ---
function CancelConfirmModal({ ev, primary, bgColor, onBack, onConfirm }: any) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
      <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
      <h3 className="text-xl font-bold mb-3 text-white">Confirmar Cancelamento</h3>
      <p className="text-gray-300 mb-6">Você tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.</p>
      <div className="grid grid-cols-2 gap-4">
        <button onClick={onBack} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        <button onClick={async () => { setLoading(true); await onConfirm(); }} disabled={loading}
          className="py-3 font-bold rounded-lg bg-red-600 text-white">
          {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : "Cancelar"}
        </button>
      </div>
    </div>
  );
}

// --- Remarcar Modal ---
function RemarcarModal({ ev, primary, bgColor, cardBg, barbers, schedules, events, maxDays, closedDays, slotInterval, onBack, onConfirm }: any) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [periodo, setPeriodo] = useState<"manha" | "tarde">("manha");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 7); // Remarcar limited to 7 days

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const barber = barbers.find((b: any) => b.id === ev.barberId);

  function isDayAvailable(day: number): boolean {
    const d = new Date(year, month, day);
    if (d < today || d > maxDate) return false;
    if (closedDays.includes(d.getDay())) return false;
    if (barber) {
      const ws = schedules.find((s: WorkSchedule) => s.memberId === barber.id && s.dayOfWeek === d.getDay());
      if (ws && ws.isOff) return false;
    }
    return true;
  }

  function getSlots(): string[] {
    if (!selectedDate) return [];
    const barberId = barber?.id;
    let st = "08:00", et = "19:00", bs = "", be = "";
    if (barberId) {
      const ws = schedules.find((s: WorkSchedule) => s.memberId === barberId && s.dayOfWeek === selectedDate.getDay());
      if (ws) { st = ws.startTime || st; et = ws.endTime || et; bs = ws.breakStart || ""; be = ws.breakEnd || ""; }
    }
    let slots = generateTimeSlots(st, et, slotInterval);
    slots = slots.filter((s) => !isInBreak(s, bs, be));
    const dayEvts = events.filter((e: any) => e.date === selectedDate.getDate() && e.month === selectedDate.getMonth() && e.year === selectedDate.getFullYear() && e.status !== "cancelled" && e.id !== ev.id && (!barberId || e.barberId === barberId) && (!ev.unitId || e.unitId === ev.unitId));
    // Duration-aware overlap check
    slots = slots.filter((slot) => {
      const [sh, sm] = slot.split(":").map(Number);
      const slotStart = sh * 60 + sm;
      return !dayEvts.some((e: any) => {
        const [eH, eM] = (e.startTime || "00:00").split(":").map(Number);
        const eventStart = eH * 60 + eM;
        const eventEnd = eventStart + (e.duration || slotInterval);
        return slotStart >= eventStart && slotStart < eventEnd;
      });
    });
    if (selectedDate.toDateString() === new Date().toDateString()) {
      const now = new Date();
      slots = slots.filter((s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m > now.getHours() * 60 + now.getMinutes(); });
    }
    return slots;
  }

  const slots = getSlots();
  const morningSlots = slots.filter((s) => parseInt(s) < 12);
  const afternoonSlots = slots.filter((s) => parseInt(s) >= 12);
  const displaySlots = periodo === "manha" ? morningSlots : afternoonSlots;

  return (
    <div className="p-6" style={{ borderRadius: "1rem" }}>
      <h3 className="text-xl font-bold mb-4 text-center" style={{ color: primary }}>Remarcar Horário</h3>

      <div className="flex items-center justify-between mb-4 px-2">
        <button onClick={() => { const prev = new Date(year, month - 1); if (prev >= new Date(today.getFullYear(), today.getMonth())) setViewDate(prev); }} className="p-1"><ChevronLeft className="w-5 h-5 text-white" /></button>
        <span className="font-bold text-lg text-white">{MONTHS_PT[month]} {year}</span>
        <button onClick={() => { const next = new Date(year, month + 1); if (next <= new Date(maxDate.getFullYear(), maxDate.getMonth())) setViewDate(next); }} className="p-1"><ChevronRight className="w-5 h-5 text-white" /></button>
      </div>

      <div className="booking-calendar-grid mb-2">
        {WEEKDAYS_PT.map((d) => <span key={d} className="text-xs font-semibold" style={{ color: primary }}>{d}</span>)}
      </div>
      <div className="booking-calendar-grid mb-6">
        {Array.from({ length: firstDay }).map((_, i) => <span key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const available = isDayAvailable(day);
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isSelected = selectedDate && day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
          return (
            <div key={day}
              onClick={() => { if (available) { setSelectedDate(new Date(year, month, day)); setSelectedTime(null); setPeriodo("manha"); } }}
              className={`booking-calendar-day ${available ? "" : "unavailable"} ${isToday ? "today" : ""}`}
              style={{
                backgroundColor: isSelected ? primary : available ? "#374151" : "transparent",
                color: isSelected ? "#111" : available ? "#fff" : "#6b7280",
                fontWeight: isSelected ? 700 : 500, cursor: available ? "pointer" : "not-allowed",
              }}>
              {day}
            </div>
          );
        })}
      </div>

      <h3 className="font-bold text-center mb-4 text-white">Escolha o novo horário</h3>
      <div className="flex gap-2 mb-4">
        {(["manha", "tarde"] as const).map((p) => (
          <button key={p} onClick={() => setPeriodo(p)} className="flex-1 py-2 rounded-lg font-semibold text-sm"
            style={{ backgroundColor: periodo === p ? primary : "#4a4a4a", color: periodo === p ? "#111" : "#ccc" }}>
            {p === "manha" ? "Manhã" : "Tarde"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-6">
        {selectedDate ? (displaySlots.length > 0 ? displaySlots.map((t) => (
          <div key={t} onClick={() => setSelectedTime(t)}
            className="booking-time-slot p-3 rounded-lg text-center text-sm font-medium cursor-pointer"
            style={{ backgroundColor: selectedTime === t ? primary : "#374151", color: selectedTime === t ? "#111" : "#fff" }}>
            {t}
          </div>
        )) : <p className="col-span-4 text-gray-400 text-sm text-center">Sem horários disponíveis.</p>
        ) : <p className="col-span-4 text-gray-400 text-sm text-center">Selecione uma data.</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={onBack} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        <button onClick={() => { if (selectedDate && selectedTime) onConfirm(selectedDate, selectedTime); }}
          disabled={!selectedDate || !selectedTime}
          className={`py-3 font-bold rounded-lg ${selectedDate && selectedTime ? "" : "opacity-50"}`}
          style={{ backgroundColor: primary, color: bgColor }}>
          Confirmar
        </button>
      </div>
    </div>
  );
}

// --- Avaliação Modal ---
function AvaliacaoModal({ ev, primary, bgColor, onClose, onSubmit, g }: any) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const commentLabel = rating > 0 && rating < 3 ? (g ? g("review.comment_label_negative", "Algo em que podemos melhorar?") : "Algo em que podemos melhorar?") : (g ? g("review.comment_label", "Deixar um comentário (opcional)") : "Deixar um comentário (opcional)");

  return (
    <div className="p-6 booking-auth" style={{ borderRadius: "1rem" }}>
      <h3 className="text-2xl font-bold text-center mb-6" style={{ color: primary }}>{g ? g("review.modal_title", "Avaliar atendimento") : "Avaliar atendimento"}</h3>
      <div className="text-left space-y-3 text-sm mb-6">
        <p><strong className="text-gray-400">Profissional:</strong><br /><span className="text-white">{ev.barberName}</span></p>
        <p><strong className="text-gray-400">Serviço:</strong><br /><span className="text-white">{ev.serviceName || ev.title}</span></p>
      </div>
      <div className="border-t border-b border-gray-700 py-6">
        <p className="text-center font-semibold mb-4 text-white">{g ? g("review.question_text", "Como foi seu atendimento?") : "Como foi seu atendimento?"}</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setRating(s)} className="booking-star text-4xl transition-transform hover:scale-110"
              style={{ color: s <= rating ? "#fbbf24" : "#6b7280" }}>
              ★
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <p className="font-semibold mb-2 text-white transition-opacity">{commentLabel}</p>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Deixe seu comentário aqui..."
          className="w-full p-3 rounded-lg" />
      </div>
      <button onClick={async () => { setLoading(true); await onSubmit(rating, comment); }} disabled={rating === 0 || loading}
        className={`w-full py-3 mt-6 font-bold rounded-lg ${rating > 0 ? "" : "opacity-50"}`}
        style={{ backgroundColor: primary, color: bgColor }}>
        {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : (g ? g("review.submit_label", "Avaliar") : "Avaliar")}
      </button>
    </div>
  );
}

// ============================================================
// PLANOS VIEW
// ============================================================
function PlanosView({ g, primary, bgColor, cardBg, plans, subscription, services, authUser, clientProfile, onLogin, openModal, closeModal, onRefresh, setActiveView }: any) {

  function showBeneficiosModal() {
    openModal(
      <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
        <Award className="w-12 h-12 mx-auto mb-4" style={{ color: primary }} />
        <h3 className="text-2xl font-bold mb-2" style={{ color: primary }}>Benefícios Exclusivos</h3>
        <p className="text-gray-400 mb-8">Veja as vantagens de ser um assinante.</p>
        <div className="text-left space-y-5">
          {[
            { icon: "⚡", title: "Agilidade e Conveniência", desc: "Agende seus horários de forma rápida e fácil." },
            { icon: "🏷️", title: "Descontos em Produtos", desc: "Preços especiais em nossa linha de produtos para cabelo e barba." },
            { icon: "➕", title: "Serviços Adicionais com Desconto", desc: "Descontos exclusivos em serviços como hidratação e pigmentação." },
            { icon: "⭐", title: "Prioridade e Exclusividade", desc: "Seja o primeiro a saber de novidades e eventos especiais." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-start gap-4">
              <span className="text-xl">{icon}</span>
              <div>
                <h4 className="font-bold text-white">{title}</h4>
                <p className="text-sm text-gray-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => closeModal()} className="w-full mt-8 py-3 font-semibold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Entendido</button>
      </div>, "center"
    );
  }

  function showGerenciarModal() {
    if (!subscription?.plan) return;
    openModal(
      <div className="p-6" style={{ borderRadius: "1rem" }}>
        <h3 className="text-2xl font-bold text-center mb-8" style={{ color: primary }}>Gerenciar Assinatura</h3>
        <div className="p-5 rounded-lg mb-6" style={{ backgroundColor: "#2a2a2a" }}>
          <h4 className="font-bold text-lg mb-3 text-white">Meu Plano</h4>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{subscription.plan.name}</span>
            <span className="font-bold text-white">R$ {Number(subscription.plan.price).toFixed(2)}/mês</span>
          </div>
        </div>
        <div className="space-y-3">
          <button onClick={() => closeModal(() => showBeneficiosModal())} className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
            <span className="flex items-center gap-3"><Award className="w-5 h-5" style={{ color: primary }} />Ver benefícios</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
          <button className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
            <span className="flex items-center gap-3"><Pause className="w-5 h-5" style={{ color: primary }} />Pausar assinatura</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
          <button className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
            <span className="flex items-center gap-3 text-red-500"><XCircle className="w-5 h-5" />Cancelar assinatura</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-700">
          <button onClick={() => closeModal()} className="w-full py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        </div>
      </div>, "center"
    );
  }

  return (
    <div className="p-6" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
      {subscription && subscription.plan && (
        <div className="pt-4 mb-8">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white">Plano <span style={{ color: primary }}>Atual</span></h2>
            <div className="w-20 h-1 mx-auto mt-2 rounded-full booking-underline" style={{ backgroundColor: primary }} />
          </div>
          <div className="p-5 rounded-2xl border border-gray-800" style={{ backgroundColor: "#1e1e1e" }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-white text-lg">{subscription.plan.name}</h3>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#22c55e33", color: "#4ade80" }}>Ativo</span>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: subscription.plan.maxUsesPerMonth || 4 }).map((_: any, i: number) => {
                  const isUsed = i < (subscription.usesThisMonth || 0);
                  return (
                    <div key={i} className="booking-service-icon" style={{
                      backgroundColor: isUsed ? "#374151" : "#1e1e1e",
                      color: isUsed ? "#9ca3af" : primary,
                      border: isUsed ? "none" : `1px solid ${primary}`,
                    }}>
                      <Scissors className="w-5 h-5" />
                      <span className="text-xs mt-1">{isUsed ? "Usado" : "Livre"}</span>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="flex justify-between mb-1 text-xs font-medium" style={{ color: "#d1d5db" }}>
                  <span>Progresso</span>
                  <span>{subscription.usesThisMonth || 0} de {subscription.plan.maxUsesPerMonth || 4}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full booking-progress-bar" style={{ backgroundColor: primary, width: `${Math.min(100, ((subscription.usesThisMonth || 0) / (subscription.plan.maxUsesPerMonth || 4)) * 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="border-t border-gray-700 my-5" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={showGerenciarModal} className="py-2 text-sm font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Gerenciar</button>
              <button onClick={showBeneficiosModal} className="py-2 text-sm font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Benefícios</button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white">Nossos <span style={{ color: primary }}>Planos</span></h2>
        <div className="w-20 h-1 mx-auto mt-2 rounded-full booking-underline" style={{ backgroundColor: primary }} />
        <p className="text-gray-300 mt-4 text-sm">Economize com nossos planos e aproveite serviços de qualidade.</p>
      </div>

      <div className="space-y-6">
        {plans.filter((p: SubscriptionPlan) => p.availableForSale !== false).map((plan: SubscriptionPlan) => {
          const isCurrent = subscription?.planId === plan.id;
          return (
            <div key={plan.id} className="booking-plan-card rounded-xl overflow-hidden" style={{ backgroundColor: "#000", borderColor: isCurrent ? primary : "#444" }}>
              {isCurrent && <div className="text-center py-1.5 font-bold text-sm" style={{ backgroundColor: primary, color: bgColor }}>SEU PLANO ATUAL</div>}
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 text-white">{plan.name}</h3>
                <div className="flex items-baseline mb-6">
                  <span className="text-4xl font-bold" style={{ color: primary }}>R${plan.price.toFixed(2)}</span>
                  <span className="text-gray-400 ml-1">/{plan.recurrence === "monthly" ? "mês" : plan.recurrence}</span>
                </div>
                <ul className="space-y-3 mb-8 text-gray-300 text-sm">
                  {(plan.benefits || []).map((b: string, i: number) => (
                    <li key={i} className="flex items-start"><Check className="w-4 h-4 mr-3 mt-0.5 flex-shrink-0" style={{ color: primary }} /><span>{b}</span></li>
                  ))}
                </ul>
                <button disabled={isCurrent}
                  onClick={() => { if (!authUser) onLogin(); }}
                  className="w-full py-3 font-bold rounded-lg transition-colors"
                  style={{ backgroundColor: isCurrent ? "#4a4a4a" : primary, color: isCurrent ? "#888" : bgColor, cursor: isCurrent ? "not-allowed" : "pointer" }}>
                  {isCurrent ? "Seu Plano Atual" : "Assinar Plano"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div className="text-center mt-10 pt-6 border-t border-gray-700">
        <p className="text-gray-400 mb-6">Não tem certeza de qual plano escolher? Entre em contato conosco.</p>
        <div className="space-y-4">
          <button onClick={() => setActiveView("agendar")} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Agendar Horário</button>
          <button onClick={() => {
            const whatsapp = g("contact.whatsapp", "");
            if (whatsapp) window.open(`https://wa.me/${whatsapp.replace(/\D/g, "")}`, "_blank");
          }} className="w-full py-3 font-bold rounded-lg border-2 transition-colors" style={{ borderColor: primary, color: primary, backgroundColor: "transparent" }}>Fale Conosco</button>
          <button className="w-full py-2.5 text-sm font-medium rounded-lg transition-colors" style={{ backgroundColor: "#222", color: "#9ca3af" }}>Termos e Serviços</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PERFIL VIEW (complete)
// ============================================================
function PerfilView({ g, primary, bgColor, cardBg, authUser, clientProfile, goals, services, onLogin, openModal, closeModal, onLogout, onProfileUpdate, setActiveView, updateSelection, resetSelection }: any) {
  const [creditsExpanded, setCreditsExpanded] = useState(false);

  if (!authUser) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center min-h-[80vh]">
        <User className="w-16 h-16 text-gray-600 mb-4" />
        <h1 className="text-2xl font-bold" style={{ color: primary }}>Meu Perfil</h1>
        <p className="text-gray-400 mt-2 mb-6">{g("auth.perfil_prompt", "Faça login para acessar seu perfil e gerenciar sua conta.")}</p>
        <button onClick={onLogin} className="py-3 px-8 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>{g("auth.login_button", "Entrar ou Cadastrar")}</button>
      </div>
    );
  }

  const firstName = clientProfile?.name?.split(" ")[0] || "Visitante";
  const credits = clientProfile?.referralCredits || 0;
  const referrals = clientProfile?.referralsMade || 0;

  function showEditarPerfilModal() {
    openModal(
      <EditarPerfilModal primary={primary} bgColor={bgColor} clientProfile={clientProfile}
        onClose={() => closeModal()} onSave={async (data: any) => {
          // Convert birthday from DD/MM/AAAA to YYYY-MM-DD if present
          const saveData = { ...data };
          if (saveData.birthday && saveData.birthday.includes('/')) {
            const parts = saveData.birthday.split('/');
            if (parts.length === 3 && parts[2].length === 4) {
              saveData.birthday = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
          await supabase.from("clients").update({ ...saveData, updatedAt: new Date().toISOString() }).eq("id", clientProfile.id);
          onProfileUpdate({ ...clientProfile, ...saveData });
          closeModal(() => {
            openModal(
              <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
                <Check className="w-12 h-12 mx-auto mb-4" style={{ color: primary }} />
                <h3 className="text-xl font-bold mb-3" style={{ color: primary }}>Perfil Atualizado!</h3>
                <p className="text-gray-300 mb-6">Suas informações foram salvas com sucesso.</p>
                <button onClick={() => closeModal()} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Fechar</button>
              </div>, "center"
            );
          });
        }}
      />, "center"
    );
  }

  function showIndiqueAmigoModal() {
    const code = clientProfile?.referralCode || "VINNX10";
    const defaultMsg = `Fala, mestre! ✂️ Estou te dando um desconto no seu primeiro serviço. Use meu código *${code}* no agendamento.`;
    const customMsg = g("referral.invite_message", "");
    const msg = customMsg ? customMsg.replace(/\{code\}/g, code) : defaultMsg;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;

    openModal(
      <IndiqueAmigoModal primary={primary} bgColor={bgColor} code={code} waUrl={waUrl} g={g} onClose={() => closeModal()} />, "center"
    );
  }

  function showCashbackModal() {
    openModal(
      <div className="p-6" style={{ borderRadius: "1rem" }}>
        <div className="text-center mb-6">
          <CreditCard className="w-12 h-12 mx-auto mb-3" style={{ color: primary }} />
          <h3 className="text-2xl font-bold" style={{ color: primary }}>{g("referral.cashback_title", "Programa de Cashback")}</h3>
          <p className="text-gray-400 text-sm">Acumule créditos e troque por benefícios!</p>
        </div>
        <div className="space-y-6">
          <div className="p-4 rounded-lg" style={{ backgroundColor: "#2a2a2a" }}>
            <h4 className="font-bold mb-3 text-center" style={{ color: primary }}>Como Acumular Créditos</h4>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <span className="font-bold w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: primary, color: bgColor }}><Scissors className="w-4 h-4" /></span>
                <div><p className="font-bold text-white">{g("referral.credit_per_service_label", "R$ 2 por Serviço")}</p><p className="text-gray-400">{g("referral.credit_per_service_desc", "A cada serviço concluído, você ganha R$ 2,00 de cashback.")}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-bold w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: primary, color: bgColor }}><Share2 className="w-4 h-4" /></span>
                <div><p className="font-bold text-white">{g("referral.credit_per_referral_label", "R$ 10 por Indicação")}</p><p className="text-gray-400">{g("referral.credit_per_referral_desc", "Quando um amigo usa seu código, você ganha R$ 10,00.")}</p></div>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg text-center" style={{ backgroundColor: "#2a2a2a" }}>
            <h4 className="font-bold mb-3" style={{ color: primary }}>Como Usar seu Crédito</h4>
            <p className="text-gray-400 text-sm">Seu saldo pode ser usado para resgatar serviços na barbearia ou descontos em produtos exclusivos.</p>
            <Gift className="w-8 h-8 mx-auto mt-4" style={{ color: primary }} />
          </div>
        </div>
        <button onClick={() => closeModal()} className="w-full mt-6 py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Entendi!</button>
      </div>, "center"
    );
  }

  function showNotificacoesModal() {
    openModal(<NotificacoesModal primary={primary} bgColor={bgColor} clientProfile={clientProfile} onClose={() => closeModal()} onSave={(p: any) => onProfileUpdate(p)} />, "center");
  }

  function showAlterarSenhaModal() {
    openModal(<AlterarSenhaModal primary={primary} bgColor={bgColor} onClose={() => closeModal()} />, "center");
  }

  function showFaleConoscoModal() {
    const whatsapp = g("contact.whatsapp", "");
    openModal(
      <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
        <MessageCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
        <h3 className="text-xl font-bold mb-3" style={{ color: primary }}>Fale Conosco</h3>
        <p className="text-gray-300 mb-6">Deseja abrir uma conversa no WhatsApp para tirar suas dúvidas?</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => closeModal()} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
          <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
            className="py-3 font-bold rounded-lg bg-green-600 text-white flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" />WhatsApp
          </a>
        </div>
      </div>, "center"
    );
  }

  function handleResgateCredito() {
    if (credits < (parseInt(g("referral.min_redemption", "50"), 10) || 50)) return;
    const minRedemption = parseInt(g("referral.min_redemption", "50"), 10) || 50;
    openModal(
      <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
        <Gift className="w-12 h-12 mx-auto mb-4" style={{ color: primary }} />
        <h3 className="text-xl font-bold mb-3" style={{ color: primary }}>Resgatar Crédito</h3>
        <p className="text-gray-300 mb-6">Você está prestes a usar R$ {minRedemption.toFixed(2)} dos seus créditos para resgatar um serviço. Deseja continuar?</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => closeModal()} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Cancelar</button>
          <button onClick={async () => {
            // Don't deduct credits yet — deduct after booking is confirmed
            // Just set up selection for booking with credit flag
            resetSelection();
            const firstService = services[0];
            if (firstService) updateSelection({ service: firstService, isFromCreditRedemption: true });
            closeModal(() => setActiveView("agendar"));
          }} className="py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Sim, Resgatar</button>
        </div>
      </div>, "center"
    );
  }

  return (
    <div className="p-6" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
      {/* Avatar + Name */}
      <div className="text-center pt-8 mb-8">
        <div className="relative inline-block">
          {clientProfile?.profilePic || clientProfile?.avatar ? (
            <img src={clientProfile.profilePic || clientProfile.avatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover mx-auto border-4" style={{ borderColor: primary }} />
          ) : (
            <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-3xl font-bold" style={{ backgroundColor: "#374151", color: primary }}>
              {firstName.charAt(0).toUpperCase()}
            </div>
          )}
          <button onClick={showEditarPerfilModal} className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-gray-800" style={{ backgroundColor: "#374151" }}>
            <Camera className="w-4 h-4 text-white" />
          </button>
        </div>
        <h2 className="text-2xl font-bold mt-4 text-white">{clientProfile?.name || "Visitante"}</h2>
        <p className="text-gray-400 text-sm">{authUser.email}</p>
      </div>

      {/* Credits card */}
      {g("referral.enabled", "true") !== "false" && (
      <div className="p-5 rounded-2xl border border-gray-800 mb-6" style={{ background: "linear-gradient(to bottom, #2a2a2a, #1e1e1e)" }}>
        <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setCreditsExpanded(!creditsExpanded)}>
          <h3 className="font-bold text-white">{g("referral.credits_title", "Créditos de Indicação")}</h3>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5" style={{ color: primary }} />
            {creditsExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
        <div className="text-3xl font-bold mb-2" style={{ color: primary }}>R$ {credits.toFixed(2)}</div>
        <p className="text-xs text-gray-400">{referrals} indicações realizadas</p>

        {/* Congrats card when credits >= 50 */}
        {credits >= (parseInt(g("referral.min_redemption", "50"), 10) || 50) && (
          <div className="mt-4 p-5 rounded-2xl text-center relative overflow-hidden booking-zoom-in" style={{ background: "linear-gradient(135deg, #2a2a2a, #111111)", border: `2px solid ${primary}` }}>
            <div className="relative z-10">
              <Gift className="w-12 h-12 mx-auto mb-3 booking-tada" style={{ color: primary }} />
              <p className="font-bold text-xl text-white">{g("referral.congrats_title", "Parabéns! Você conseguiu!")}</p>
              <p className="text-5xl font-black my-2" style={{ color: primary }}>R$ {credits.toFixed(2).replace(".", ",")}</p>
              <p className="text-base font-semibold mb-5 text-gray-300">em créditos para usar</p>
              <button onClick={handleResgateCredito} className="w-full py-3 font-bold rounded-lg transition-all shadow-xl" style={{ backgroundColor: primary, color: bgColor }}>{g("referral.redeem_button", "Resgatar Corte Grátis")}</button>
            </div>
          </div>
        )}

        {/* Expandable details */}
        <div className={`booking-credit-details ${creditsExpanded ? "expanded" : ""}`}>
          {clientProfile?.referralCode && (
            <div className="mt-4 p-3 rounded-lg text-center" style={{ backgroundColor: "#111", border: "2px dashed #666" }}>
              <p className="text-xs text-gray-400 mb-1">Seu código de indicação</p>
              <p className="font-bold text-white tracking-wider text-lg">{clientProfile.referralCode}</p>
              <button onClick={() => {
                copyToClipboard(clientProfile.referralCode);
              }} className="mt-2 px-4 py-1.5 rounded-md text-sm font-bold" style={{ backgroundColor: primary, color: bgColor }}>
                <Copy className="w-3 h-3 inline mr-1" />COPIAR
              </button>
            </div>
          )}

          <button onClick={() => showCashbackModal()} className="w-full mt-3 text-left p-3 rounded-lg flex items-center gap-3 hover:opacity-80" style={{ backgroundColor: "#2a2a2a" }}>
            <CreditCard className="w-5 h-5" style={{ color: primary }} />
            <span className="text-sm text-gray-300">Como funciona o cashback?</span>
          </button>
        </div>
      </div>
      )}

      {/* Referral goals */}
      {goals.length > 0 && g("referral.enabled", "true") !== "false" && (
        <div className="p-5 rounded-2xl border border-gray-800 mb-6" style={{ backgroundColor: "#1e1e1e" }}>
          <h3 className="font-semibold mb-4 text-center" style={{ color: primary }}>{g("referral.goals_title", "Metas de Indicação")}</h3>
          <div className="space-y-6">
            {goals.map((goal: any) => {
              const progress = Math.min(referrals / goal.target, 1);
              const reached = referrals >= goal.target;
              const redeemed = clientProfile?.redeemedGoals?.includes(goal.id);
              return (
                <div key={goal.id} className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${reached ? "shadow-lg" : "border-2 border-gray-600"}`}
                    style={{ backgroundColor: reached ? primary : "rgba(75,85,99,0.5)" }}>
                    <Gift className="w-5 h-5" style={{ color: reached ? bgColor : primary }} />
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className={`font-bold text-sm ${reached ? "" : "text-white"}`} style={reached ? { color: primary } : {}}>{goal.prize}</p>
                      <p className={`text-xs ${reached ? "font-bold" : ""}`} style={{ color: reached ? primary : "#d1d5db" }}>{reached ? "Concluído!" : `${referrals}/${goal.target}`}</p>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="h-2 rounded-full booking-progress-bar" style={{ backgroundColor: reached ? primary : primary, width: `${progress * 100}%` }} />
                    </div>
                    {reached && !redeemed && (
                      <div className="pt-2">
                        <button className="text-xs font-bold py-1.5 px-3 rounded-full transition-all" style={{ backgroundColor: primary, color: bgColor }}>Resgatar</button>
                      </div>
                    )}
                    {redeemed && (
                      <div className="pt-2">
                        <span className="text-xs font-bold py-1.5 px-3 rounded-full" style={{ backgroundColor: "#374151", color: "#d1d5db" }}>Resgatado</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-5 rounded-2xl border border-gray-800 mb-6" style={{ backgroundColor: "#1e1e1e" }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-white">Informações Pessoais</h3>
          <button onClick={showEditarPerfilModal}><Edit3 className="w-4 h-4" style={{ color: primary }} /></button>
        </div>
        <div className="space-y-4 text-sm">
          <div>
            <div className="flex items-center gap-2 text-gray-400 mb-1"><Phone className="w-3 h-3" /><span>Telefone</span></div>
            <p className="text-white font-medium pl-5">{clientProfile?.phone || "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-400 mb-1"><Mail className="w-3 h-3" /><span>Email</span></div>
            <p className="text-white font-medium pl-5 truncate">{authUser.email}</p>
          </div>
          {clientProfile?.birthday && (
            <div>
              <div className="flex items-center gap-2 text-gray-400 mb-1"><Gift className="w-3 h-3" /><span>Aniversário</span></div>
              <p className="text-white font-medium pl-5">{clientProfile.birthday.includes('-') ? clientProfile.birthday.split('-').reverse().join('/') : clientProfile.birthday}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 mb-8">
        {[
          ...(g("referral.enabled", "true") !== "false" ? [
            { icon: Share2, label: "Indique um Amigo", onClick: showIndiqueAmigoModal },
            { icon: CreditCard, label: "Cashback", onClick: showCashbackModal },
          ] : []),
          { icon: Bell, label: "Notificações", onClick: showNotificacoesModal },
          { icon: Lock, label: "Alterar Senha", onClick: showAlterarSenhaModal },
          { icon: MessageCircle, label: "Fale Conosco", onClick: showFaleConoscoModal },
        ].map(({ icon: Icon, label, onClick }) => (
          <button key={label} onClick={onClick} className="w-full text-left p-4 rounded-xl border border-gray-800 flex items-center justify-between hover:border-gray-700 transition-colors"
            style={{ backgroundColor: "#1e1e1e" }}>
            <span className="flex items-center gap-3"><Icon className="w-5 h-5" style={{ color: primary }} />{label}</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        ))}
      </div>

      {/* Logout */}
      <button onClick={() => {
        openModal(
          <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
            <LogOut className="w-12 h-12 mx-auto mb-4" style={{ color: primary }} />
            <h3 className="text-xl font-bold mb-3" style={{ color: primary }}>Confirmar Saída</h3>
            <p className="text-gray-300 mb-6">Você tem certeza que deseja sair da sua conta?</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => closeModal()} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Ficar</button>
              <button onClick={() => { closeModal(); onLogout(); }} className="py-3 font-bold rounded-lg bg-red-600 text-white">Sair</button>
            </div>
          </div>, "center"
        );
      }} className="w-full py-3 font-semibold rounded-lg border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors">
        <LogOut className="w-4 h-4 inline mr-2" />Sair da Conta
      </button>

      {/* Criado por */}
      {g("branding.show_powered_by", "true") !== "false" && (
      <div className="mt-16 mb-8 text-center flex flex-col items-center gap-2">
        <p className="text-sm text-gray-500">Criado por</p>
        <svg xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 13929.2 2791.21" className="w-28 h-auto" style={{ shapeRendering: 'geometricPrecision', fillRule: 'evenodd', clipRule: 'evenodd' }}>
          <g>
            <path className="svg-elem-1" fill="#9ca3af" d="M10575.96 2770.97c1.81,-67.93 -6.84,-759.75 0.71,-1074.33 -0.71,-312.44 187.28,-481.99 567.14,-481.99l0.12 -419.71c-284.82,0 -393.93,-2.07 -524.85,182.93 -6.84,-10.88 -90.08,-171.34 -95.66,-182.93l-406.52 0 0 1976.03 459.07 0z" />
            <path className="svg-elem-2" fill="#9ca3af" d="M986.96 822.41c538.09,0 974.29,436.2 974.29,974.28 0,538.09 -436.2,974.29 -974.29,974.29 -194.4,0 -363.1,-73.47 -515.13,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.28,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
            <path className="svg-elem-3" fill="#9ca3af" d="M3159.77 822.38c224.55,0 442.51,58.83 607.26,186.46 230.04,178.2 367.02,474.29 367.02,787.82 0,327.08 -181.77,618.34 -429,795.04 -159.5,113.97 -334.27,179.25 -545.29,179.25 -538.08,0 -974.28,-436.2 -974.28,-974.29 0,-538.08 436.2,-974.28 974.28,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
            <path className="svg-elem-4" fill="#9ca3af" d="M-0 232.77l0 2539.65 445.84 -191.06 0.04 -2581.37c0,0 -437.87,229.95 -445.88,232.77z" />
            <path className="svg-elem-5" fill="#9ca3af" d="M4168.33 794.94l0 1975.96 -445.74 -192.01 0 -1462.39 0 -139.54c0,0 437.73,-184.83 445.74,-182.03z" />
            <path className="svg-elem-6" fill="#9ca3af" d="M4932.59 2770.97c1.81,-67.93 -6.84,-759.75 0.71,-1074.33 -0.71,-312.44 187.28,-481.99 567.14,-481.99l0.12 -419.71c-284.82,0 -393.93,-2.07 -524.85,182.93 -6.84,-10.88 -90.08,-171.34 -95.66,-182.93l-406.52 0 0 1976.03 459.07 0z" />
            <path className="svg-elem-7" fill="#9ca3af" d="M6694.19 822.41c538.08,0 974.28,436.2 974.28,974.28 0,538.09 -436.2,974.29 -974.28,974.29 -194.41,0 -363.11,-73.47 -515.14,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.29,-974.28zm0 436.54c296.99,0 537.74,240.75 537.74,537.74 0,296.99 -240.75,537.74 -537.74,537.74 -296.99,0 -537.74,-240.75 -537.74,-537.74 0,-296.99 240.75,-537.74 537.74,-537.74z" />
            <path className="svg-elem-8" fill="#9ca3af" d="M5707.22 232.77l0 2539.65 445.84 -191.06 0.05 -2581.37c0,0 -437.87,229.95 -445.89,232.77z" />
            <path className="svg-elem-9" fill="#9ca3af" d="M8883.2 822.41c436.12,0 805.27,286.55 929.53,681.63 29.06,92.38 44.76,190.69 44.76,292.65 0,52.14 -4.14,103.3 -12.02,153.22l-1336.29 0.02c0,0 229.95,-437.87 232.76,-445.89l592.44 0c-95.88,-147.51 -262.12,-245.09 -451.18,-245.09 -296.99,0 -537.74,240.75 -537.74,537.74 0,296.99 240.75,537.74 537.74,537.74 205.64,0 384.29,-115.44 474.74,-285.05l322.19 307.78c-176.33,250.29 -467.49,413.82 -796.93,413.82 -194.4,0 -363.1,-73.47 -515.13,-171.57 -268.78,-173.43 -459.15,-459.04 -459.15,-802.72 0,-538.08 436.2,-974.28 974.28,-974.28z" />
            <path className="svg-elem-10" fill="#9ca3af" d="M12954.05 2473.8l-974.83 -1678.86 -369.05 0 1159.51 1996.27 184.37 -317.41zm-184.39 -953.1c140.47,-241.94 280.97,-483.86 421.46,-725.77l-842.93 0 421.47 725.77zm184.51 317.77c61.48,105.87 122.94,211.74 184.42,317.62l790.61 -1361.15 -369.08 0c-201.91,347.88 -403.96,695.69 -605.94,1043.53z" />
          </g>
        </svg>
      </div>
      )}
    </div>
  );
}

// --- Editar Perfil Modal ---
function EditarPerfilModal({ primary, bgColor, clientProfile, onClose, onSave }: any) {
  const [name, setName] = useState(clientProfile?.name || "");
  const [phone, setPhone] = useState(clientProfile?.phone || "");
  const [email, setEmail] = useState(clientProfile?.email || "");
  const bdRaw = clientProfile?.birthday || "";
  const bdDisplay = bdRaw.includes('-') ? bdRaw.split('-').reverse().join('/') : bdRaw;
  const [birthday, setBirthday] = useState(bdDisplay);
  const [loading, setLoading] = useState(false);

  const hasChanged = name !== (clientProfile?.name || "") || phone !== (clientProfile?.phone || "") || email !== (clientProfile?.email || "") || birthday !== bdDisplay;
  const valid = name.trim().length > 0 && hasChanged;

  return (
    <div className="p-6 booking-auth" style={{ borderRadius: "1rem" }}>
      <h3 className="text-2xl font-bold text-center mb-6" style={{ color: primary }}>Editar Perfil</h3>
      <div className="space-y-4">
        <input type="text" value={name} onChange={(e) => setName(smartCapitalize(e.target.value))} placeholder="Nome" className="w-full p-3 rounded-lg" />
        <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="Telefone (celular)" className="w-full p-3 rounded-lg" inputMode="numeric" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="w-full p-3 rounded-lg" />
        <div>
          <input type="text" value={birthday} onChange={(e) => setBirthday(formatBirthdate(e.target.value))} placeholder="Data de aniversário (DD/MM/AAAA)" className="w-full p-3 rounded-lg" maxLength={10} autoComplete="one-time-code" />
          <p className="text-xs text-gray-400 mt-2 text-center"><Gift className="w-3 h-3 inline mr-1" style={{ color: primary }} />Informe seu aniversário para mimos e descontos especiais!</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <button onClick={onClose} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        <button onClick={async () => { setLoading(true); await onSave({ name, phone: phone.replace(/\D/g, ""), email, birthday }); }}
          disabled={!valid || loading} className={`py-3 font-bold rounded-lg ${valid ? "" : "opacity-50"}`}
          style={{ backgroundColor: primary, color: bgColor }}>
          {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// --- Indique Amigo Modal ---
function IndiqueAmigoModal({ primary, bgColor, code, waUrl, onClose, g }: any) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="p-6" style={{ borderRadius: "1rem" }}>
      <div className="text-center mb-6">
        <Gift className="w-12 h-12 mx-auto mb-3" style={{ color: primary }} />
        <h3 className="text-2xl font-bold" style={{ color: primary }}>{g ? g("referral.invite_title", "Indique e Ganhe!") : "Indique e Ganhe!"}</h3>
        <p className="text-gray-400 text-sm">Convide seus amigos e ganhem benefícios juntos.</p>
      </div>
      <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: "#2a2a2a" }}>
        <h4 className="font-bold mb-3 text-center" style={{ color: primary }}>Como funciona?</h4>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="font-bold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 text-xs" style={{ backgroundColor: primary, color: bgColor }}>1</span>
            <p className="text-gray-400">Seu amigo usa seu código e ganha <strong className="text-white">{g ? g("referral.friend_discount_text", "20% OFF") : "20% OFF"}</strong> no primeiro serviço.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-bold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 text-xs" style={{ backgroundColor: primary, color: bgColor }}>2</span>
            <p className="text-gray-400">Após o primeiro serviço dele, você ganha <strong className="text-white">{g ? g("referral.referrer_credit_text", "R$10 de crédito") : "R$10 de crédito"}</strong>.</p>
          </div>
        </div>
      </div>
      <div className="text-center mb-6">
        <p className="text-sm text-gray-400 mb-2">Compartilhe seu código de indicação</p>
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: "#111", border: "2px dashed #666" }}>
          <span className="font-bold tracking-wider text-white text-lg">{code}</span>
          <button onClick={() => { copyToClipboard(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="px-4 py-2 rounded-md text-sm font-bold" style={{ backgroundColor: primary, color: bgColor }}>
            {copied ? "COPIADO!" : "COPIAR"}
          </button>
        </div>
      </div>
      <div className="space-y-3">
        <a href={waUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 font-bold rounded-lg bg-green-500 text-white">
          <MessageCircle className="w-5 h-5" />Compartilhar via WhatsApp
        </a>
        <button onClick={onClose} className="w-full py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
      </div>
    </div>
  );
}

// --- Notificações Modal ---
function NotificacoesModal({ primary, bgColor, clientProfile, onClose, onSave }: any) {
  const prefs = clientProfile?.notificationPreferences || {};
  const [emailNotif, setEmailNotif] = useState(prefs.email !== false);
  const [whatsappNotif, setWhatsappNotif] = useState(prefs.whatsapp !== false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const notificationPreferences = { email: emailNotif, whatsapp: whatsappNotif };
    if (clientProfile?.id) {
      await supabase.from("clients").update({ notificationPreferences, updatedAt: new Date().toISOString() }).eq("id", clientProfile.id);
      if (onSave) onSave({ ...clientProfile, notificationPreferences });
    }
    setLoading(false);
    onClose();
  }

  return (
    <div className="p-6" style={{ borderRadius: "1rem" }}>
      <h3 className="text-2xl font-bold text-center mb-2" style={{ color: primary }}>Notificações</h3>
      <p className="text-center text-gray-400 text-sm mb-8">Defina suas preferências de notificação.</p>
      <div className="space-y-4">
        {[
          { label: "Notificações por e-mail", value: emailNotif, toggle: () => setEmailNotif(!emailNotif) },
          { label: "Notificações por WhatsApp", value: whatsappNotif, toggle: () => setWhatsappNotif(!whatsappNotif) },
        ].map(({ label, value, toggle }) => (
          <div key={label} onClick={toggle} className="flex justify-between items-center p-4 rounded-lg cursor-pointer" style={{ backgroundColor: "#2a2a2a" }}>
            <span className="text-white font-medium">{label}</span>
            <div className="relative w-11 h-6 rounded-full transition-colors" style={{ backgroundColor: value ? primary : "#6b7280" }}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${value ? "left-6" : "left-1"}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <button onClick={onClose} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        <button onClick={handleSave} disabled={loading} className="py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>
          {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// --- Alterar Senha Modal ---
function AlterarSenhaModal({ primary, bgColor, onClose }: any) {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const valid = current.length >= 6 && newPw.length >= 6 && newPw === confirm && newPw !== current;

  async function handleChange() {
    setLoading(true); setError("");
    // Re-authenticate with current password first
    const { data: session } = await supabase.auth.getSession();
    const userEmail = session?.session?.user?.email;
    if (!userEmail) { setError("Sessão expirada. Faça login novamente."); setLoading(false); return; }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: current });
    if (signInErr) { setError("Senha atual incorreta."); setLoading(false); return; }
    // Now update
    const { error: err } = await supabase.auth.updateUser({ password: newPw });
    if (err) { setError(err.message); setLoading(false); return; }
    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
        <Lock className="w-12 h-12 mx-auto mb-4" style={{ color: primary }} />
        <h3 className="text-xl font-bold mb-3" style={{ color: primary }}>Senha Alterada!</h3>
        <p className="text-gray-300 mb-6">Sua senha foi atualizada com sucesso.</p>
        <button onClick={onClose} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Fechar</button>
      </div>
    );
  }

  return (
    <div className="p-6 booking-auth" style={{ borderRadius: "1rem" }}>
      <h3 className="text-2xl font-bold text-center mb-6" style={{ color: primary }}>Alterar Senha</h3>
      <div className="space-y-4">
        <div className="relative">
          <label className="text-sm font-semibold text-gray-400 mb-1 block">Senha Atual</label>
          <input type={showPw ? "text" : "password"} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••" className="w-full p-3 rounded-lg" />
        </div>
        <div className="relative">
          <label className="text-sm font-semibold text-gray-400 mb-1 block">Nova Senha</label>
          <input type={showPw ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••" className="w-full p-3 rounded-lg" />
        </div>
        <div className="relative">
          <label className="text-sm font-semibold text-gray-400 mb-1 block">Confirmar Nova Senha</label>
          <input type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••" className="w-full p-3 rounded-lg" />
        </div>
        <button type="button" onClick={() => setShowPw(!showPw)} className="text-xs flex items-center gap-1" style={{ color: primary }}>
          {showPw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}{showPw ? "Ocultar" : "Mostrar"} senhas
        </button>
        {newPw && confirm && newPw !== confirm && <p className="text-red-400 text-sm">As senhas não conferem.</p>}
        {newPw && current && newPw === current && <p className="text-red-400 text-sm">A nova senha não pode ser igual à atual.</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <button onClick={onClose} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        <button onClick={handleChange} disabled={!valid || loading} className={`py-3 font-bold rounded-lg ${valid ? "" : "opacity-50"}`}
          style={{ backgroundColor: primary, color: bgColor }}>
          {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// AUTH FORMS
// ============================================================

function translateSupabaseError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Email ou senha inválidos.";
  if (msg.includes("Email not confirmed")) return "Email não confirmado. Verifique sua caixa de entrada.";
  if (msg.includes("already registered") || msg.includes("User already registered")) return "Este email já está cadastrado. Faça login.";
  if (msg.includes("rate limit") || msg.includes("too many requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (msg.includes("email rate limit exceeded")) return "Muitas tentativas de cadastro. Aguarde 10 minutos.";
  if (msg.includes("Password should be")) return "A senha deve ter pelo menos 6 caracteres.";
  if (msg.includes("Unable to validate email")) return "Email inválido.";
  if (msg.includes("Signup is disabled")) return "Cadastro temporariamente desabilitado.";
  return msg;
}
// ============================================================
// MIGRATION FORM — Legacy clients claim their account
// ============================================================
function MigrationForm({ g, primary, onClose, onSwitch, onSuccess, showToast, setAuthDirect }: any) {
  const [step, setStep] = useState<"phone" | "found" | "notfound">("phone");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [genderOpen, setGenderOpen] = useState(false);
  const genderTriggerRef = useRef<HTMLButtonElement>(null);
  const genderMenuRef = useRef<HTMLDivElement>(null);
  const genderOptions = [{ value: "Masculino", label: "Masculino" }, { value: "Feminino", label: "Feminino" }, { value: "Outro", label: "Outro" }];

  useEffect(() => {
    if (!genderOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (genderTriggerRef.current?.contains(t) || genderMenuRef.current?.contains(t)) return;
      setGenderOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [genderOpen]);

  const phoneDigits = phone.replace(/\D/g, "");
  const pwValid = password.length >= 6 && password === confirmPw;
  const formValid = email.includes("@") && pwValid;

  // Step 1: Lookup phone
  async function handleLookup() {
    if (phoneDigits.length < 10) { setError("Digite seu telefone completo (DDD + número)."); return; }
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase.rpc("lookup_legacy_client", { p_phone: phoneDigits });
      if (err) { setError("Erro ao buscar. Tente novamente."); setLoading(false); return; }
      if (data?.found) { setFirstName(data.firstName); setStep("found"); }
      else { setStep("notfound"); }
    } catch { setError("Erro de conexão."); }
    setLoading(false);
  }

  // Step 2: Create account + claim
  async function handleMigrate() {
    if (!formValid) return;
    setLoading(true); setError("");
    try {
      // 1. Set migration flag BEFORE signUp (prevents loadClientProfile auto-create race)
      _migrationClaimInProgress = true;

      // 2. Create auth user
      const { data, error: signupErr } = await supabase.auth.signUp({
        email, password,
        options: { data: { name: firstName, phone: phoneDigits } },
      });
      if (signupErr) { _migrationClaimInProgress = false; setError(translateSupabaseError(signupErr.message)); setLoading(false); return; }
      if (!data.user || (data.user.identities?.length === 0)) {
        _migrationClaimInProgress = false;
        setError("Este email já está cadastrado. Faça login normalmente.");
        setLoading(false); return;
      }

      // 3. Convert birthday DD/MM/YYYY → YYYY-MM-DD (BUG 9 fix + BUG 13 validation)
      let birthdayISO = "";
      if (birthday && birthday.includes("/")) {
        const parts = birthday.split("/");
        if (parts.length === 3) {
          const candidate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) birthdayISO = candidate;
        }
      }

      // 4. Claim BEFORE setAuthDirect (BUG 7 fix — prevents loadClientProfile race)
      const { data: claimResult, error: claimErr } = await supabase.rpc("claim_legacy_client", {
        p_phone: phoneDigits,
        p_email: email,
        p_birthday: birthdayISO || null,
        p_gender: gender || null,
      });

      // 5. Clear migration flag
      _migrationClaimInProgress = false;

      if (claimErr || !claimResult?.success) {
        setError("Erro ao vincular conta. Tente novamente ou faça cadastro normal.");
        setLoading(false); return;
      }

      // 4. NOW set auth state (loadClientProfile will find the claimed record)
      setAuthDirect(
        { id: data.user.id, email: data.user.email || email },
        data.session?.access_token || "",
        data.session?.refresh_token
      );
      if (showToast) showToast(`Bem-vindo de volta, ${firstName}! 🎉`);
      onClose(() => { if (onSuccess) onSuccess(); });
    } catch (e: any) {
      setError(translateSupabaseError(e.message || "Erro inesperado."));
      setLoading(false);
    }
  }

  return (
    <div className="booking-auth-modal booking-auth" style={{ position: "relative", padding: "2.5rem 1.75rem 2rem" }}>
      {/* Back arrow → login */}
      <button onClick={() => onSwitch("login")} style={{ position: "absolute", top: "1rem", left: "1rem", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <ChevronLeft className="w-5 h-5" style={{ color: "rgba(255,255,255,0.4)" }} />
      </button>
      {/* Close X */}
      <button onClick={() => onClose()} style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <X className="w-5 h-5" style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>

      {/* Header */}
      {g("loading.logo") && <img src={g("loading.logo")} alt="Logo" className="w-28 h-28 mb-4 mx-auto object-contain" />}
      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", marginBottom: "0.25rem" }}>Ative sua conta</h2>
      <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", marginBottom: "1.5rem" }}>Para clientes que já frequentam a barbearia</p>

      {step === "phone" && (
        <>
          <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", marginBottom: "1rem" }}>Digite o telefone cadastrado:</p>
          <div className="booking-auth-input-wrap">
            <Phone className="auth-icon" />
            <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(37) 9 9999-9999" className="w-full p-3.5" inputMode="tel" autoFocus maxLength={18} />
          </div>
          {error && <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "0.75rem", textAlign: "center" }}>{error}</p>}
          <button onClick={handleLookup} disabled={phoneDigits.length < 10 || loading} className="booking-auth-btn"
            style={{ backgroundColor: primary, color: "#111" }}>
            {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : "Buscar"}
          </button>
        </>
      )}

      {step === "found" && (
        <>
          <div style={{ marginBottom: "1rem", padding: "1rem", borderRadius: "0.875rem", backgroundColor: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.15)", textAlign: "left" }}>
            <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#4ade80" }}>✓ Encontramos seu cadastro!</p>
            <p style={{ fontSize: "0.85rem", color: "#fff", marginTop: "0.25rem" }}>Olá, <strong>{firstName}</strong>! Complete os dados abaixo.</p>
          </div>
          <div className="booking-auth-input-wrap">
            <Mail className="auth-icon" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail"
              className="w-full p-3.5" autoComplete="email" autoFocus />
          </div>
          <div className="booking-auth-input-wrap">
            <Lock className="auth-icon" />
            <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Crie uma senha (mín. 6)" className="w-full p-3.5 pr-11" autoComplete="new-password" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute inset-y-0 right-0 flex items-center pr-3.5" style={{ zIndex: 1 }}>
              {showPw ? <EyeOff className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} /> : <Eye className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}
            </button>
          </div>
          <div className="booking-auth-input-wrap">
            <Lock className="auth-icon" />
            <input type={showPw ? "text" : "password"} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Confirme a senha" className="w-full p-3.5" autoComplete="new-password" />
          </div>
          {password && confirmPw && password !== confirmPw && <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: "0.5rem" }}>Senhas não coincidem</p>}
          <div className="booking-auth-input-wrap">
            <Calendar className="auth-icon" />
            <input type="text" value={birthday} onChange={(e) => setBirthday(formatBirthdate(e.target.value))}
              placeholder="Aniversário (DD/MM/AAAA)" className="w-full p-3.5" maxLength={10} autoComplete="one-time-code" />
          </div>
          <div className="relative mb-4">
            <button ref={genderTriggerRef} type="button" onClick={() => setGenderOpen(p => !p)}
              className="w-full flex items-center gap-2 px-3 py-3.5 rounded-xl text-sm font-medium transition-all text-left"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${genderOpen ? "var(--booking-primary, #00BF62)" : "rgba(255,255,255,0.12)"}`,
              }}>
              <User className="w-4 h-4 shrink-0" style={{ color: genderOpen ? "var(--booking-primary)" : "rgba(255,255,255,0.25)" }} />
              <span className="flex-1 truncate" style={{ color: gender ? "#e2e8f0" : "rgba(255,255,255,0.35)" }}>{gender || "Gênero (opcional)"}</span>
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${genderOpen ? "rotate-180" : ""}`} style={{ color: "rgba(255,255,255,0.3)" }} />
            </button>
            {genderOpen && (
              <div ref={genderMenuRef} className="absolute z-[9999] left-0 right-0 bottom-full mb-1.5 rounded-xl shadow-2xl py-1.5 max-h-[240px] overflow-y-auto"
                style={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}>
                {genderOptions.map(opt => (
                  <button key={opt.value} type="button" onClick={() => { setGender(opt.value === gender ? "" : opt.value); setGenderOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                      opt.value === gender ? "font-semibold" : "hover:bg-white/5"
                    }`} style={{ color: opt.value === gender ? primary : "rgba(255,255,255,0.7)" }}>
                    <span className="flex-1">{opt.label}</span>
                    {opt.value === gender && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: primary }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "0.75rem", textAlign: "center" }}>{error}</p>}
          <button onClick={handleMigrate} disabled={!formValid || loading} className="booking-auth-btn"
            style={{ backgroundColor: primary, color: "#111" }}>
            {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : "Ativar minha conta"}
          </button>
        </>
      )}

      {step === "notfound" && (
        <>
          <div style={{ marginBottom: "1rem", padding: "1rem", borderRadius: "0.875rem", backgroundColor: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.15)", textAlign: "left" }}>
            <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#facc15" }}>Telefone não encontrado</p>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)", marginTop: "0.25rem" }}>Não encontramos ({phone}) nos registros.</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={() => { setStep("phone"); setError(""); }} style={{
              flex: 1, padding: "0.75rem", fontWeight: 600, fontSize: "0.9rem",
              borderRadius: "0.75rem", cursor: "pointer",
              background: "transparent", border: "1.5px solid rgba(255,255,255,0.15)", color: "#fff",
            }}>Tentar outro</button>
            <button onClick={() => onSwitch("signup")} className="booking-auth-btn" style={{ flex: 1, backgroundColor: primary, color: "#111" }}>
              Cadastrar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function LoginForm({ g, primary, onClose, onSwitch, onSuccess, showToast, setAuthDirect }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const valid = email.includes("@") && password.length >= 6;

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!valid || loading) return;
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(translateSupabaseError(err.message));
        setLoading(false);
        return;
      }
      if (!data.session) {
        setError("Não foi possível iniciar a sessão. Verifique se seu email está confirmado.");
        setLoading(false);
        return;
      }
      // Directly set auth state + token for API calls
      const user = data.session.user;
      setAuthDirect({ id: user.id, email: user.email || email }, data.session.access_token, data.session.refresh_token);
      const userName = user.user_metadata?.name || email.split("@")[0];
      if (showToast) showToast(`Bem-vindo, ${userName}!`);
      onClose(() => { if (onSuccess) onSuccess(); });
    } catch (e: any) {
      setError(translateSupabaseError(e.message || "Erro inesperado."));
      setLoading(false);
    }
  }

  return (
    <div className="booking-auth-modal booking-auth" style={{ position: "relative", padding: "2.5rem 1.75rem 2rem" }}>
      {/* Close X */}
      <button onClick={() => onClose()} style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <X className="w-5 h-5" style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>

      {/* Header */}
      {g("loading.logo") && <img src={g("loading.logo")} alt="Logo" className="w-28 h-28 mb-4 mx-auto object-contain" />}
      <h2 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", marginBottom: "0.25rem" }}>Bem-vindo de volta</h2>
      <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", marginBottom: "1.75rem" }}>Faça login para continuar</p>

      {/* Form */}
      <form onSubmit={handleLogin}>
        <div className="booking-auth-input-wrap">
          <Mail className="auth-icon" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail"
            className="w-full p-3.5" autoComplete="email" autoFocus />
        </div>
        <div className="booking-auth-input-wrap">
          <Lock className="auth-icon" />
          <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha" className="w-full p-3.5 pr-11" autoComplete="current-password" />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute inset-y-0 right-0 flex items-center pr-3.5" style={{ zIndex: 1 }}>
            {showPw ? <EyeOff className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} /> : <Eye className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}
          </button>
        </div>

        {/* Forgot — right-aligned above button */}
        <div style={{ textAlign: "right", marginBottom: "1rem", marginTop: "-0.25rem" }}>
          <button type="button" onClick={() => onSwitch("forgot")} style={{ background: "none", border: "none", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Esqueceu a senha?</button>
        </div>

        {error && <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "0.75rem", textAlign: "center" }}>{error}</p>}

        <button type="submit" disabled={!valid || loading} className="booking-auth-btn"
          style={{ backgroundColor: primary, color: "#111" }}>
          {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : "Entrar"}
        </button>
      </form>

      {/* Divider */}
      <div className="booking-auth-or"><hr /><span>ou</span><hr /></div>

      {/* Secondary — Criar conta */}
      <button onClick={() => onSwitch("signup")} style={{
        width: "100%", padding: "0.75rem", fontWeight: 600, fontSize: "0.95rem",
        borderRadius: "0.75rem", cursor: "pointer",
        background: "transparent", border: `1.5px solid rgba(255,255,255,0.15)`,
        color: "#fff", transition: "all 0.2s ease",
      }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.background = "transparent"; }}>
        Criar conta
      </button>

      {/* Migration link — very subtle, bottom */}
      {g("auth.legacy_migration_enabled", "true") !== "false" && (
        <button onClick={() => onSwitch("migration")} style={{
          display: "block", width: "100%", marginTop: "1.25rem",
          background: "none", border: "none", fontSize: "0.8rem",
          color: "rgba(255,255,255,0.35)", cursor: "pointer", textAlign: "center",
        }}>
          Já é cliente da barbearia? <span style={{ color: primary, fontWeight: 600 }}>Ative sua conta</span>
        </button>
      )}
    </div>
  );
}

function SignupForm({ g, primary, onClose, onSwitch, onSuccess, showToast, setAuthDirect }: any) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [genderOpen, setGenderOpen] = useState(false);
  const genderTriggerRef = useRef<HTMLButtonElement>(null);
  const genderMenuRef = useRef<HTMLDivElement>(null);
  const genderOptions = [{ value: "Masculino", label: "Masculino" }, { value: "Feminino", label: "Feminino" }, { value: "Outro", label: "Outro" }];
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!genderOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (genderTriggerRef.current?.contains(t) || genderMenuRef.current?.contains(t)) return;
      setGenderOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [genderOpen]);

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const pwStrong = password.length >= 6 && hasLetter && hasNumber;
  const valid = name.trim().split(" ").length >= 2 && phone.replace(/\D/g, "").length === 11 && email.includes("@") && pwStrong && password === confirmPw;

  async function handleSignup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!valid || loading) return;
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email, password,
        options: { data: { name, phone: phone.replace(/\D/g, "") } }
      });
      if (err) {
        setError(translateSupabaseError(err.message));
        setLoading(false);
        return;
      }
      if (data.user) {
        // Check if email already exists (Supabase returns empty identities)
        if (data.user.identities && data.user.identities.length === 0) {
          setError("Este email já está cadastrado. Tente fazer login.");
          setLoading(false);
          return;
        }
        // DB trigger auto-creates client record — but try frontend insert as fallback
        const referralCode = name.split(" ")[0].toUpperCase().substring(0, 4) + Math.floor(1000 + Math.random() * 9000);
        // Convert birthday DD/MM/YYYY → YYYY-MM-DD for DB
        let birthdayISO = "";
        if (birthday && birthday.includes("/")) {
          const parts = birthday.split("/");
          if (parts.length === 3) {
            const candidate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) birthdayISO = candidate;
          }
        }
        await supabase.from("clients").insert({
          id: crypto.randomUUID(),
          name, email, phone: phone.replace(/\D/g, ""),
          company: "",
          status: "ACTIVE",
          monthlyValue: 0, setupValue: 0, totalValue: 0, monthsActive: 0,
          authUserId: data.user.id,
          referralCode,
          referralCredits: 0,
          referralsMade: 0,
          birthday: birthdayISO || null,
          gender: gender || null,
          updatedAt: new Date().toISOString(),
        }).then(({ error: insertErr }) => {
          if (insertErr) console.log("Client insert fallback (trigger may have handled):", insertErr.message);
        });
        // Directly set auth state + token for API calls
        setAuthDirect({ id: data.user.id, email: data.user.email || email }, data.session?.access_token || "", data.session?.refresh_token);
        if (showToast) showToast("Conta criada com sucesso!");
      }
      onClose(() => { if (onSuccess) onSuccess(); });
    } catch (e: any) {
      setError(translateSupabaseError(e.message || "Erro inesperado."));
      setLoading(false);
    }
  }

  // Password strength indicator
  const pwIndicator = password.length === 0 ? null
    : !pwStrong ? { color: "#ef4444", text: "Fraca — use letras e números" }
    : password.length >= 8 ? { color: "#16a34a", text: "Forte ✓" }
    : { color: "#eab308", text: "Razoável" };

  return (
    <div className="booking-auth-modal booking-auth" style={{ position: "relative", padding: "2.5rem 1.75rem 2rem" }}>
      {/* Back arrow */}
      <button onClick={() => onSwitch()} style={{ position: "absolute", top: "1rem", left: "1rem", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <ChevronLeft className="w-5 h-5" style={{ color: "rgba(255,255,255,0.4)" }} />
      </button>

      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", marginBottom: "0.25rem" }}>Criar conta</h2>
      <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", marginBottom: "1.5rem" }}>Preencha seus dados para começar</p>

      <form onSubmit={handleSignup}>
        <div className="booking-auth-input-wrap">
          <User className="auth-icon" />
          <input type="text" value={name} onChange={(e) => setName(smartCapitalize(e.target.value))} placeholder="Nome e Sobrenome"
            className="w-full p-3.5" autoComplete="name" autoFocus />
        </div>
        <div className="booking-auth-input-wrap">
          <Phone className="auth-icon" />
          <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="Telefone (celular)"
            className="w-full p-3.5" inputMode="numeric" autoComplete="tel" />
        </div>
        <div className="booking-auth-input-wrap">
          <Mail className="auth-icon" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail"
            className="w-full p-3.5" autoComplete="email" />
        </div>
        <div className="booking-auth-input-wrap">
          <Lock className="auth-icon" />
          <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha" className="w-full p-3.5 pr-11" autoComplete="new-password" />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute inset-y-0 right-0 flex items-center pr-3.5" style={{ zIndex: 1 }}>
            {showPw ? <EyeOff className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} /> : <Eye className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}
          </button>
        </div>
        {pwIndicator && (
          <p style={{ fontSize: "0.7rem", marginTop: "-0.5rem", marginBottom: "0.5rem", textAlign: "left", paddingLeft: "2.75rem", color: pwIndicator.color }}>{pwIndicator.text}</p>
        )}
        <div className="booking-auth-input-wrap">
          <Lock className="auth-icon" />
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirme a senha"
            className="w-full p-3.5" autoComplete="new-password" />
        </div>
        {password && confirmPw && password !== confirmPw && <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "0.5rem" }}>As senhas não conferem.</p>}

        {/* Birthday */}
        <div className="booking-auth-input-wrap">
          <Calendar className="auth-icon" />
          <input type="text" value={birthday} onChange={(e) => setBirthday(formatBirthdate(e.target.value))}
            placeholder="Aniversário" className="w-full p-3.5" maxLength={10} autoComplete="one-time-code" />
        </div>

        {/* Gender dropdown */}
        <div className="relative" style={{ marginBottom: "1rem" }}>
          <button ref={genderTriggerRef} type="button" onClick={() => setGenderOpen(p => !p)}
            className="w-full flex items-center gap-2 px-3 py-3.5 rounded-xl text-sm font-medium transition-all text-left"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${genderOpen ? "var(--booking-primary, #00BF62)" : "rgba(255,255,255,0.12)"}`,
            }}>
            <User className="w-4 h-4 shrink-0" style={{ color: genderOpen ? "var(--booking-primary)" : "rgba(255,255,255,0.25)" }} />
            <span className="flex-1 truncate" style={{ color: gender ? "#e2e8f0" : "rgba(255,255,255,0.35)" }}>{gender || "Gênero"}</span>
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${genderOpen ? "rotate-180" : ""}`} style={{ color: "rgba(255,255,255,0.3)" }} />
          </button>
          {genderOpen && (
            <div ref={genderMenuRef} className="absolute z-[9999] left-0 right-0 bottom-full mb-1.5 rounded-xl shadow-2xl py-1.5 max-h-[240px] overflow-y-auto"
              style={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}>
              {genderOptions.map(opt => (
                <button key={opt.value} type="button" onClick={() => { setGender(opt.value === gender ? "" : opt.value); setGenderOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                    opt.value === gender ? "font-semibold" : "hover:bg-white/5"
                  }`} style={{ color: opt.value === gender ? primary : "rgba(255,255,255,0.7)" }}>
                  <span className="flex-1">{opt.label}</span>
                  {opt.value === gender && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: primary }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "0.75rem", textAlign: "center" }}>{error}</p>}
        <button type="submit" disabled={!valid || loading} className="booking-auth-btn"
          style={{ backgroundColor: primary, color: "#111" }}>
          {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : "Criar conta"}
        </button>
      </form>

      <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", marginTop: "1.25rem", textAlign: "center" }}>Ao se cadastrar, você aceita os Termos de Uso e Política de Privacidade.</p>

      <button onClick={() => onSwitch()} style={{
        display: "block", width: "100%", marginTop: "1rem",
        background: "none", border: "none", fontSize: "0.85rem",
        color: "rgba(255,255,255,0.4)", cursor: "pointer", textAlign: "center",
      }}>
        Já tem conta? <span style={{ color: primary, fontWeight: 600 }}>Fazer login</span>
      </button>
    </div>
  );
}

function ForgotForm({ g, primary, onClose, onSwitch }: any) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReset(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/site`,
    });
    if (err) {
      setError(translateSupabaseError(err.message));
      setLoading(false);
      return;
    }
    setSent(true); setLoading(false);
  }

  return (
    <div className="booking-auth-modal booking-auth" style={{ position: "relative", padding: "2.5rem 1.75rem 2rem" }}>
      {/* Back arrow */}
      <button onClick={() => onSwitch()} style={{ position: "absolute", top: "1rem", left: "1rem", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
        <ChevronLeft className="w-5 h-5" style={{ color: "rgba(255,255,255,0.4)" }} />
      </button>

      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", marginBottom: "0.25rem" }}>Redefinir senha</h2>

      {sent ? (
        <>
          <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem", padding: "1.25rem", borderRadius: "0.875rem", backgroundColor: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.15)", textAlign: "center" }}>
            <Mail className="w-10 h-10 mx-auto mb-3" style={{ color: primary }} />
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>Link enviado para <strong style={{ color: "#fff" }}>{email}</strong>.<br />Verifique sua caixa de entrada e spam.</p>
          </div>
          <button onClick={() => onSwitch()} className="booking-auth-btn" style={{ backgroundColor: primary, color: "#111" }}>Voltar ao Login</button>
        </>
      ) : (
        <form onSubmit={handleReset}>
          <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", marginBottom: "1.5rem" }}>Informe seu e-mail para receber um link de redefinição.</p>
          <div className="booking-auth-input-wrap">
            <Mail className="auth-icon" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail"
              className="w-full p-3.5" autoComplete="email" autoFocus />
          </div>
          {error && <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "0.75rem", textAlign: "center" }}>{error}</p>}
          <button type="submit" disabled={!email.includes("@") || loading} className="booking-auth-btn"
            style={{ backgroundColor: primary, color: "#111" }}>
            {loading ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : "Enviar link"}
          </button>
        </form>
      )}
    </div>
  );
}
