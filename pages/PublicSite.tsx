import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Lottie from "lottie-react";
import { createClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Calendar, Clock, History, Star, User, ChevronRight, ChevronLeft,
  MapPin, Scissors, Store, Loader2, LogOut, Check, X, AlertTriangle,
  Gift, Share2, Bell, Edit3, Lock, Eye, EyeOff, Camera, CreditCard,
  Phone, Mail, Award, Heart, Settings, ChevronDown, ChevronUp,
  MessageCircle, Copy, ExternalLink, Pause, XCircle, RefreshCw, Crown, ImagePlus, Trash2,
  ArrowUpDown, Receipt, Infinity as InfinityIcon, Zap, Tag, ShieldCheck,
} from "lucide-react";
import type { CalendarEvent, WorkSchedule, Service, SubscriptionPlan, Subscription } from "../types";
import { usePlatform } from "../hooks/usePlatform";
import { safeParseJsonArray } from "../lib/utils";
import { subscribeToPlan, cancelMySubscription, pauseMySubscription, getMyPaymentHistory, updatePaymentMethod, reactivateSubscription, reactivateWithSavedCard, changePlan, cancelPendingPlanChange, retryPayment, setAsaasPublicTokenProvider, setAsaasPublicRefreshCallback, syncCustomerData, updateAuthEmail, changeUnit } from "../lib/asaasPublicService";

// ============================================================
// DEDICATED Supabase client for PublicSite
// - Custom fetch injects saved access_token for REST calls,
//   ensuring auth survives SDK's internal SIGNED_OUT wipes
// - autoRefreshToken: false → no token validation pings
// ============================================================

// Module-level token storage — outside SDK's control
let _psAccessToken: string | null = null;
// Wire the token into asaasPublicService so API calls use PS session
setAsaasPublicTokenProvider(() => _psAccessToken);
setAsaasPublicRefreshCallback(() => ensureFreshToken());
// Flag to prevent loadClientProfile auto-create during migration claim
let _migrationClaimInProgress = false;

// Pre-load Lottie animation for booking confirmation
let _lottieSuccessData: any = null;
fetch("/Quando.json").then(r => r.json()).then(d => { _lottieSuccessData = d; }).catch(() => {});
function LottieSuccess({ primary }: { primary: string }) {
  const [data, setData] = useState(_lottieSuccessData);
  useEffect(() => { if (!data && !_lottieSuccessData) { fetch("/Quando.json").then(r => r.json()).then(d => { _lottieSuccessData = d; setData(d); }).catch(() => {}); } else if (!data && _lottieSuccessData) { setData(_lottieSuccessData); } }, []);
  const colorized = useMemo(() => {
    if (!data) return null;
    // Convert hex color to normalized RGB [0-1]
    const hex = primary.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const json = JSON.parse(JSON.stringify(data));
    // Replace colors in all layers
    for (const layer of (json.layers || [])) {
      for (const shape of (layer.shapes || [])) {
        for (const it of (shape.it || [])) {
          // Stroke colors (white [1,1,1,1] → primary)
          if (it.ty === 'st' && it.c?.a === 0 && it.c.k?.[0] === 1 && it.c.k?.[1] === 1 && it.c.k?.[2] === 1) {
            it.c.k = [r, g, b, 1];
          }
          // Fill colors (gray dots → primary with slight transparency)
          if (it.ty === 'fl' && it.c?.a === 0) {
            it.c.k = [r, g, b, 1];
          }
        }
      }
    }
    return json;
  }, [data, primary]);
  return colorized ? <Lottie animationData={colorized} loop={false} style={{ width: 80, height: 80, margin: "0 auto 8px" }} /> : <Check className="w-12 h-12 mx-auto mb-4" style={{ color: primary }} />;
}

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

// Check if token expires within 60 seconds (proactive refresh)
function isTokenNearExpiry(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now() + 60_000; // 60s margin
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

// ── Proactive JWT refresh with mutex ──
let _refreshing: Promise<boolean> | null = null;
async function ensureFreshToken(): Promise<boolean> {
  // No token → nothing to refresh
  if (!_psAccessToken) return false;
  // Token still valid (>60s left) → no-op
  if (!isTokenNearExpiry(_psAccessToken)) return true;
  // Mutex: if already refreshing, wait for that result
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const stored = localStorage.getItem("vinnx_ps_user");
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      const rt = parsed.refreshToken || parsed.refresh_token;
      if (!rt) return false;
      const newTokens = await silentRefresh(rt);
      if (!newTokens) return false;
      // Update module-level token
      _psAccessToken = newTokens.access_token;
      // Persist new tokens back to the same backup key
      parsed.token = newTokens.access_token;
      parsed.refreshToken = newTokens.refresh_token;
      localStorage.setItem("vinnx_ps_user", JSON.stringify(parsed));
      console.log("[ensureFreshToken] Token refreshed silently");
      return true;
    } catch (e) {
      console.error("[ensureFreshToken] Refresh failed:", e);
      return false;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
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
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        // Proactively refresh token before RLS-protected calls
        if (_psAccessToken && typeof input === "string" && (input.includes("/rest/v1/") || input.includes("/storage/v1/"))) {
          await ensureFreshToken();
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
  services: Service[];
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
    unit: null, barber: null, services: [], date: null, time: null,
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

    // Pick up prompt captured at module level (before React mounted)
    if (_deferredInstallPrompt) {
      setDeferredPrompt(_deferredInstallPrompt);
      _deferredInstallPrompt = null;
    }

    // Also listen for future events (e.g. after SW registers)
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);

    // On iOS: always show banner (no API to detect if PWA is installed from browser)
    // On Android/Desktop: banner visibility is controlled by deferredPrompt
    // (beforeinstallprompt only fires when app is NOT installed — if user uninstalls, it fires again)
    if (isIOS) {
      const timer = setTimeout(() => setShowInstallBanner(true), 10000);
      return () => { window.removeEventListener("beforeinstallprompt", handler); clearTimeout(timer); };
    }

    return () => { window.removeEventListener("beforeinstallprompt", handler); };
  }, [isStandalone, isIOS]);

  // Android/Desktop: show install banner only when beforeinstallprompt fires (app NOT installed)
  useEffect(() => {
    if (isStandalone || isIOS) return;
    if (deferredPrompt) {
      const timer = setTimeout(() => setShowInstallBanner(true), 5000);
      return () => clearTimeout(timer);
    } else {
      // No prompt = app already installed or not installable → hide banner
      setShowInstallBanner(false);
    }
  }, [deferredPrompt, isStandalone, isIOS]);

  const dismissInstallBanner = useCallback(() => {
    setInstallBannerExiting(true);
    setTimeout(() => { setShowInstallBanner(false); }, 350);
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

  // Effect 1: Check local subscription state (NO DB call — just UI state)
  // Runs once on mount to prevent the push banner from flashing.
  useEffect(() => {
    if (!pushSupported) return;
    setPushPermission(Notification.permission);
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setPushSubscribed(true);
      } else if (Notification.permission === 'granted') {
        setPushSubscribed(true);
      }
    }).catch(() => {});
  }, [pushSupported]);

  // Effect 2: Sync subscription to DB ONLY when clientProfile is available
  // This prevents saving 'anonymous' as clientId (the old race condition).
  useEffect(() => {
    if (!pushSupported) return;
    if (!clientProfile?.id) return; // GUARD: wait for real profile to load

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      const j = sub.toJSON();
      try {
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: clientProfile.id,
            authUserId: authUser?.id || 'anonymous',
            endpoint: j.endpoint,
            keys: j.keys,
            userAgent: navigator.userAgent,
          }),
        });
      } catch (err) {
        console.warn('[Push] Sync error:', err);
      }
    }).catch(() => {});
  }, [pushSupported, clientProfile?.id, authUser?.id]);



  const dismissPushBanner = useCallback(() => {
    setPushBannerExiting(true);
    setTimeout(() => { setShowPushBanner(false); }, 350);
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!pushSupported) return;
    if (!clientProfile?.id) {
      showToast('Faça login para ativar notificações', 'error');
      return;
    }
    try {
      // VAPID public key (public, not a secret — generated for this project)
      const vapidKey = 'BKX_TR3Ik7Vor8CEU8mtbdNMcT5Mk0TXaEyjW0cPCu2PNnFMWR-sZgEcuOOi3GXPM1y4MQxp8e-xP1hzLfKS_ew';

      const reg = await navigator.serviceWorker.ready;
      
      // Unsubscribe any existing subscription (may have old VAPID key)
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const sub = await reg.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
        userVisibleOnly: true,
      });

      // Always save subscription to DB (bypass RLS by using service role via API)
      const j = sub.toJSON();
      const saveRes = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientProfile.id,
          authUserId: authUser?.id || 'anonymous',
          endpoint: j.endpoint,
          keys: j.keys,
          userAgent: navigator.userAgent,
        }),
      });
      
      if (!saveRes.ok) {
        console.error('[Push] Failed to save subscription:', await saveRes.text());
      }

      setPushSubscribed(true);
      setPushPermission('granted');
      showToast('Notificações ativadas!');
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
        // Use API with service_role to bypass RLS
        await fetch('/api/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
      setPushSubscribed(false);
      showToast('Notificações desativadas');
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
    }
  }, [showToast]);

  // Effect: Auto re-subscribe when Service Worker reports subscription expired
  useEffect(() => {
    if (!pushSupported) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'push-subscription-expired' && clientProfile?.id) {
        subscribeToPush();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [pushSupported, clientProfile?.id, subscribeToPush]);

  // Show push banner only for LOGGED-IN users who haven't subscribed
  useEffect(() => {
    if (!pushSupported || pushSubscribed) return;
    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'granted') return;
    if (!authUser) return; // Only show for logged-in users
    const timer = setTimeout(() => setShowPushBanner(true), 1500);
    return () => clearTimeout(timer);
  }, [pushSupported, pushSubscribed, authUser]);



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
        // Push subscription sync is handled by Effect 2 (reacts to clientProfile.id)
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
        .in("status", ["active", "pending_payment", "overdue", "paused", "cancelled"])
        .order("createdAt", { ascending: false })
        .limit(5);
      // Filter: keep active/paused/overdue/pending OR cancelled-but-still-in-paid-period
      const now = new Date();
      const validSub = subs?.find((s: any) => {
        if (s.status !== 'cancelled') return true;
        // Cancelled: only show if endDate is in the future (benefits still valid)
        if (s.endDate && new Date(s.endDate) > now) return true;
        return false;
      });
      if (validSub) {
        setClientSubscription({
          ...validSub,
          plan: validSub.subscription_plans ? { ...validSub.subscription_plans, price: Number(validSub.subscription_plans.price) || 0 } : undefined,
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
          serviceSlots: row.serviceSlots ? (typeof row.serviceSlots === 'string' ? JSON.parse(row.serviceSlots) : row.serviceSlots) : undefined,
          groupId: row.groupId || undefined,
        };
      });
      setAllEvents(mapped);
      // Check for pending reviews
      const hasPending = mapped.some((e: any) => {
        const eventDate = new Date(e.year, e.month, e.date);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return eventDate < today && !e.rating && e.status !== "cancelled" && e.status !== "no_show";
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
    setSelection({ unit: null, barber: null, services: [], date: null, time: null });
  }

  // === Unit modal ===
  function showUnitModal() {
    openModal(
      <div className="booking-modal-sheet p-5 pb-8">
        <h3 className="booking-modal-title" style={{ color: primary }}>{g("booking.modal_title_unit", "Escolha uma unidade")}</h3>
        <ScrollFadeList className="space-y-3 max-h-[60vh] overflow-y-auto booking-scrollbar px-1 pb-2">
          {units.map((u) => (
            <div key={u.id} onClick={() => { updateSelection({ unit: u, barber: null, services: [], date: null, time: null }); closeModal(); }}
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
            <div key={b.id} onClick={() => { updateSelection({ barber: b, services: selection.isFromCreditRedemption ? selection.services : [], date: null, time: null }); closeModal(); }}
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
    const MultiServicePicker = () => {
      const [selected, setSelected] = useState<Service[]>([...selection.services]);
      const toggle = (s: Service) => {
        setSelected(prev => prev.some(x => x.id === s.id) ? prev.filter(x => x.id !== s.id) : [...prev, s]);
      };
      const totalDuration = selected.reduce((sum, s) => sum + (s.duration || 30), 0);
      const totalPrice = selected.reduce((sum, s) => sum + (s.price || 0), 0);
      return (
      <div className="booking-modal-sheet p-5 pb-8">
        <h3 className="booking-modal-title" style={{ color: primary }}>{g("booking.modal_title_service", "Escolha os serviços")}</h3>
        <ScrollFadeList className="space-y-3 max-h-[50vh] overflow-y-auto booking-scrollbar px-1 pb-2">
          {filtered.map((s) => {
            const isChecked = selected.some(x => x.id === s.id);
            return (
            <div key={s.id} onClick={() => toggle(s)}
              className={`booking-modal-item ${isChecked ? "active" : ""}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: isChecked ? primary : '#555', backgroundColor: isChecked ? primary : 'transparent' }}>
                  {isChecked && <Check className="w-3 h-3 text-black" />}
                </div>
                {s.image ? <img src={s.image} alt={s.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  : <div className="booking-modal-avatar w-12 h-12 rounded-lg"><Scissors className="w-5 h-5" style={{ color: primary }} /></div>}
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{s.name}</p>
                  <div className="flex gap-3 text-xs text-gray-400">
                    {showDuration && <span><Clock className="w-3 h-3 inline mr-1" style={{ color: primary }} />{s.duration || 30} min</span>}
                  </div>
                </div>
              </div>
              {showPrices && <span className="font-bold text-lg flex-shrink-0" style={{ color: isChecked ? primary : '#888' }}>R$ {s.price.toFixed(2)}</span>}
            </div>
          );
          })}
        </ScrollFadeList>
        {/* Footer with totals and confirm */}
        {selected.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #333' }}>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-400">{selected.length} serviço{selected.length !== 1 ? 's' : ''} • {totalDuration} min</span>
              {showPrices && <span className="font-bold" style={{ color: primary }}>R$ {totalPrice.toFixed(2)}</span>}
            </div>
            <button onClick={() => { updateSelection({ services: selected, date: null, time: null }); closeModal(); }}
              className="w-full py-3 font-bold rounded-lg text-sm" style={{ backgroundColor: primary, color: bgColor }}>
              Confirmar {selected.length} serviço{selected.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
      );
    };
    openModal(<MultiServicePicker />, "bottom");
  }

  // === Calendar+time modal ===
  function showDateModal() {
    if (selection.services.length === 0) return;
    const totalDur = selection.services.reduce((sum, s) => sum + (s.duration || 30), 0);
    openModal(<CalendarModal
      primary={primary} cardBg={cardBg} barber={selection.barber}
      unitId={selection.unit?.id}
      allBarbers={barbers.filter(b => b.id !== "__no_pref__")}
      schedules={schedules} events={availabilityEvents} maxDays={maxAdvDays}
      closedDays={closedDays} slotInterval={slotInterval} g={g}
      serviceDuration={totalDur}
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
    if (!selection.unit || !selection.barber || selection.services.length === 0 || !selection.date || !selection.time) return;

    if (!authUser) {
      setPendingBooking(true);
      showLoginModal();
      return;
    }

    // Check max open
    const openAppts = allEvents.filter((e) => e.status !== "cancelled" && e.status !== "completed" && e.status !== "no_show");
    // Deduplicate by groupId: grouped events count as 1 appointment
    const seenGroups = new Set<string>();
    const uniqueOpenCount = openAppts.filter((e: any) => {
      if (e.groupId) {
        if (seenGroups.has(e.groupId)) return false;
        seenGroups.add(e.groupId);
      }
      return true;
    }).length;
    if (uniqueOpenCount >= maxOpenAppts) {
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
      onConfirm={async ({ couponCode: cpCode, couponDiscount: cpDisc, finalPrice: fp, subscriptionDiscount: subDisc, quotaIncrement: qInc }: any) => {
        const d = selection.date!;
        const now = new Date().toISOString();
        const isoDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const totalDuration = selection.services.reduce((sum, s) => sum + (s.duration || 30), 0);
        const totalPrice = selection.services.reduce((sum, s) => sum + (s.price || 0), 0);
        const serviceNames = selection.services.map(s => s.name).join(' + ');
        // F1: Generate serviceSlots for compound appointments
        let serviceSlots: any[] | null = null;
        if (selection.services.length > 1) {
          let cumTime = selection.time!;
          serviceSlots = selection.services.map((svc: any) => {
            const dur = svc.duration || 30;
            const slot = {
              serviceId: svc.id,
              serviceName: svc.name,
              barberId: selection.barber.id === "__no_pref__" ? null : selection.barber.id,
              barberName: selection.barber.name,
              startTime: cumTime,
              endTime: addMinutesToTime(cumTime, dur),
              duration: dur,
              status: "confirmed",
            };
            cumTime = slot.endTime;
            return slot;
          });
        }
        const newEvent = {
          id: crypto.randomUUID(),
          title: `${clientProfile?.name || "Cliente"} - ${serviceNames}`,
          type: "APPOINTMENT",
          startTime: selection.time,
          endTime: addMinutesToTime(selection.time!, totalDuration),
          date: isoDate,
          clientName: clientProfile?.name || "Cliente",
          clientId: clientProfile?.id || null,
          barberId: selection.barber.id === "__no_pref__" ? null : selection.barber.id,
          barberName: selection.barber.name,
          serviceId: selection.services[0]?.id,
          serviceName: serviceNames,
          serviceIds: JSON.stringify(selection.services.map(s => s.id)),
          ...(serviceSlots ? { serviceSlots: JSON.stringify(serviceSlots) } : {}),
          duration: totalDuration,
          unitId: selection.unit.id,
          source: "app",
          status: "confirmed",
          finalPrice: fp ?? (selection.isFromCreditRedemption ? 0 : totalPrice),
          couponCode: cpCode || null,
          usedReferralCredit: !!selection.isFromCreditRedemption,
          usedInPlan: (subDisc || 0) > 0,
          updatedAt: now,
        };
        const { error } = await (async () => { await ensureFreshToken(); return supabase.from("calendar_events").insert(newEvent); })();
        if (error) {
          console.error("Error saving event:", error);
          showToast(`Erro ao agendar: ${error.message}`, "error");
          return;
        }
        // Push notification is handled by DB trigger (trg_push_on_calendar_event)
        // ── Increment subscription usage counter when plan discount was applied ──
        if ((subDisc || 0) > 0 && clientSubscription?.id) {
          try {
            const increment = qInc ?? 1;
            const newUses = Math.round(((clientSubscription.usesThisMonth || 0) + increment) * 10) / 10;
            const { error: updErr } = await supabase.from("subscriptions").update({
              usesThisMonth: newUses,
              updatedAt: new Date().toISOString(),
            }).eq("id", clientSubscription.id);
            if (updErr) {
              console.error('[Booking] Subscription usage update error:', updErr);
            } else {
              // Update local state so next booking in same session sees updated quota
              setClientSubscription((prev: any) => prev ? { ...prev, usesThisMonth: newUses } : prev);
            }
          } catch (e) {
            console.error('[Booking] Failed to increment subscription uses:', e);
          }
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
              <LottieSuccess primary={primary} />
              <h3 className="text-2xl font-bold mb-6" style={{ color: primary }}>{g("booking.success_title", "Agendamento Confirmado!")}</h3>
              <div className="text-left space-y-4 text-sm mb-8">
                <div>
                  <p><strong className="text-gray-400">Unidade:</strong> <span className="text-white">{unitObj.name}</span></p>
                  {unitObj.address && <p className="text-gray-500 text-xs mt-0.5">{unitObj.address}{unitObj.city ? `, ${unitObj.city}` : ""}{unitObj.state ? ` - ${unitObj.state}` : ""}</p>}
                  {unitObj.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${unitObj.address}, ${unitObj.city || ""} - ${unitObj.state || ""}`)}`} target="_blank" rel="noopener noreferrer" className="block w-full text-center mt-2 py-2 px-4 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: "#0b0b0a" }}>Ver localização</a>}
                </div>
                <p><strong className="text-gray-400">Barbeiro:</strong> <span className="text-white">{selection.barber.name}</span></p>
                <p><strong className="text-gray-400">Serviço:</strong> <span className="text-white">{selection.services.map(s => s.name).join(' + ')}</span></p>
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
          console.log('[Realtime] PublicSite connected');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] calendar_events channel error — tables may not be published. Disabling reconnect.');
          supabase.removeChannel(channel);
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
            clientSubscription={clientSubscription} setClientSubscription={setClientSubscription}
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
            authUser={authUser} clientProfile={clientProfile} units={units}
            onLogin={() => showLoginModal()} openModal={openModal} closeModal={closeModal}
            onRefresh={refreshEvents} setActiveView={setActiveView}
            onSubscriptionChange={setClientSubscription}
          />}
          {activeView === "perfil" && <PerfilView
            g={g} primary={primary} bgColor={bgColor} cardBg={cardBg}
            btnBg={btnBg} btnText={btnText}
            authUser={authUser} clientProfile={clientProfile}
            clientSubscription={clientSubscription}
            allEvents={allEvents} barbers={barbers} units={units}
            goals={goals} services={services}
            onLogin={() => showLoginModal()} openModal={openModal} closeModal={closeModal}
            onLogout={async () => { lastSignInRef.current = 0; _psAccessToken = null; localStorage.removeItem("vinnx_ps_user"); sessionStorage.removeItem("vinnx_reminder_dismissed"); await supabase.auth.signOut(); setAuthUser(null); setClientProfile(null); setClientSubscription(null); setAllEvents([]); resetSelection(); }}
            onProfileUpdate={(p: any) => setClientProfile(p)}
            setActiveView={setActiveView} updateSelection={updateSelection}
            resetSelection={resetSelection}
            pushSubscribed={pushSubscribed} pushSupported={pushSupported}
            onPushSubscribe={subscribeToPush} onPushUnsubscribe={unsubscribeFromPush}
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
                {g("branding.show_powered_by", "true") !== "false" && (
                  <div className="mt-8 flex flex-col items-center gap-2">
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
              {item.key === "planos" && clientSubscription && (clientSubscription.status === 'overdue' || clientSubscription.status === 'cancelled') && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: clientSubscription.status === 'overdue' ? "#ef4444" : "#f59e0b" }} />
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
  const allSelected = selection.unit && selection.barber && selection.services.length > 0 && selection.date && selection.time;

  const openAppts = allEvents.filter((e: CalendarEvent) => {
    if (e.status === "cancelled" || e.status === "completed" || e.status === "no_show") return false;
    // Exclude past appointments (date already passed) — they are no longer "open"
    const evDate = new Date(e.year, e.month, e.date);
    evDate.setHours(23, 59, 59, 999);
    if (evDate < new Date()) return false;
    return true;
  });
  // Deduplicate by groupId: grouped events count as 1 appointment
  const seenGroupsView = new Set<string>();
  const uniqueOpenAppts = openAppts.filter((e: any) => {
    if (e.groupId) {
      if (seenGroupsView.has(e.groupId)) return false;
      seenGroupsView.add(e.groupId);
    }
    return true;
  });
  const isMaxed = uniqueOpenAppts.length >= maxOpenAppts;

  // Today's appointment reminder
  const today = new Date();
  const todaysAppt = allEvents.find((e: CalendarEvent) => {
    if (e.status === "cancelled" || e.status === "completed" || e.status === "no_show") return false;
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

  // Accordion animation for push notification banner
  const [pushStepsExpanded, setPushStepsExpanded] = useState(false);
  useEffect(() => {
    if (showPushBanner) {
      const timer = setTimeout(() => setPushStepsExpanded(true), 1200);
      return () => clearTimeout(timer);
    } else {
      setPushStepsExpanded(false);
    }
  }, [showPushBanner]);

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
            <>
              {/* Benefits section — iOS only */}
              <div className="space-y-1.5 mb-3"
                style={{
                  opacity: installStepsExpanded ? 1 : 0,
                  transform: installStepsExpanded ? "translateY(0)" : "translateY(8px)",
                  transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
                }}>
                <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Por que instalar?</p>
                {[
                  { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label: "Receba notificações de agendamentos", highlight: true },
                  { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, label: "Acesso rápido pela tela inicial" },
                  { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, label: "Promoções e surpresas exclusivas" },
                ].map(({ icon, label, highlight }, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg" style={{
                    background: highlight ? `${primary}15` : "rgba(255,255,255,0.03)",
                    border: highlight ? `1px solid ${primary}30` : "1px solid transparent",
                  }}>
                    <span className="flex-shrink-0" style={{ color: highlight ? primary : "rgba(255,255,255,0.5)" }}>{icon}</span>
                    <span className={`text-[11px] ${highlight ? "font-semibold text-white" : "text-gray-400"}`}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="h-px mb-3" style={{
                background: "rgba(255,255,255,0.08)",
                opacity: installStepsExpanded ? 1 : 0,
                transition: "opacity 0.5s ease 0.5s",
              }} />

              {/* Steps label */}
              <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5" style={{
                opacity: installStepsExpanded ? 1 : 0,
                transition: "opacity 0.5s ease 0.6s",
              }}>Como instalar</p>

              {isIOSSafari ? (
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
                        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.6 + step * 0.25}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.6 + step * 0.25}s`,
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
                <div className="space-y-1.5">
                  {[
                    { step: 1, verb: "Toque em", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>, label: "Compartilhar (na barra de endereço)" },
                    { step: 2, verb: "Toque em", icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>, label: "Ver Mais" },
                    { step: 3, verb: "Escolha", icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, label: "Adicionar à Tela de Início" },
                  ].map(({ step, verb, icon, label }) => (
                    <div key={step}
                      className="flex items-center gap-2.5 py-2 px-3 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        opacity: installStepsExpanded ? 1 : 0,
                        transform: installStepsExpanded ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
                        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.6 + step * 0.25}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.6 + step * 0.25}s`,
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
              )}
            </>
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

      {/* Push Notifications Banner — same format as PWA install */}
      {showPushBanner && (
        <div className={`relative z-10 mx-6 ${(showInstallBanner && !isStandalone) || (todaysAppt && !reminderDismissed) ? "mt-2" : "mt-6"} p-4 rounded-xl booking-fade-in ${pushBannerExiting ? "booking-reminder-exit" : ""}`} style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
        }}>
          <div className="flex items-center gap-3 mb-3">
            {/* Bell Icon */}
            <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{
              backgroundColor: `${primary}20`,
              border: "1.5px solid rgba(255,255,255,0.15)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white">Ative as notificações</p>
              <p className="text-[11px] text-gray-400">Fique por dentro dos seus agendamentos</p>
            </div>
            <button onClick={onPushDismiss} className="flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-white/10" style={{ color: "rgba(255,255,255,0.5)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Accordion — CSS Grid 0fr→1fr for pixel-perfect smooth expansion */}
          <div style={{
            display: "grid",
            gridTemplateRows: pushStepsExpanded ? "1fr" : "0fr",
            transition: "grid-template-rows 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <div style={{ overflow: "hidden", minHeight: 0 }}>
              <div className="pt-1">

                {/* Benefits list with stagger animation */}
                <div className="space-y-1.5">
                  {[
                    { step: 1, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, label: "Lembretes antes dos agendamentos" },
                    { step: 2, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>, label: "Promoções e descontos exclusivos" },
                    { step: 3, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, label: "Surpresas especiais no aniversário" },
                  ].map(({ step, icon, label }) => (
                    <div key={step}
                      className="flex items-center gap-2.5 py-2 px-3 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        opacity: pushStepsExpanded ? 1 : 0,
                        transform: pushStepsExpanded ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
                        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + step * 0.3}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + step * 0.3}s`,
                      }}>
                      <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${primary}25`, color: primary }}>
                        {icon}
                      </span>
                      <span className="text-[12px] text-gray-300">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Note */}
                <p className="text-[10px] text-gray-500 mt-2 mb-3" style={{
                  opacity: pushStepsExpanded ? 1 : 0,
                  transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) 1.5s",
                }}>Você pode desativar a qualquer momento nas configurações.</p>

                {/* Actions */}
                <div className="flex gap-2"
                  style={{
                    opacity: pushStepsExpanded ? 1 : 0,
                    transform: pushStepsExpanded ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
                    transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) 1.6s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) 1.6s",
                  }}>
                  <button onClick={onPushSubscribe}
                    className="flex-1 py-2 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: primary, color: bgColor }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    Ativar Notificações
                  </button>
                  <button onClick={onPushDismiss}
                    className="px-3 py-2 rounded-lg text-[12px] text-gray-400 transition-colors hover:bg-white/5">
                    Agora não
                  </button>
                </div>

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
        {selection.isFromCreditRedemption && selection.services.length > 0 ? (
          <div className="booking-selection-item flex items-center justify-between p-3.5 rounded-lg booking-slide-up booking-delay-300"
            style={{ backgroundColor: cardBg, borderColor: primary, borderWidth: 2 }}>
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5" style={{ color: primary }} />
              <div>
                <span className="text-white font-bold">{selection.services.map(s => s.name).join(' + ')}</span>
                <p className="text-xs text-gray-400">Recompensa de indicação!</p>
              </div>
            </div>
            <Lock className="w-4 h-4 text-gray-500" />
          </div>
        ) : (
          <SelectionCard delay="300" icon={<Scissors className="w-5 h-5" style={{ color: primary }} />}
            text={selection.services.length > 0 ? `${selection.services.map(s => s.name).join(' + ')}${showPrices ? ` — R$ ${selection.services.reduce((sum, s) => sum + s.price, 0).toFixed(2)}` : ""}` : g("booking.label_service", "Selecionar serviço")}
            selected={selection.services.length > 0} disabled={!selection.barber} onClick={onServiceClick} cardBg={cardBg} />
        )}

        <SelectionCard delay="400" icon={<Calendar className="w-5 h-5" style={{ color: primary }} />}
          text={selection.date && selection.time ? `${selection.time} — ${WEEKDAYS_FULL[selection.date.getDay()]}, ${selection.date.getDate()} de ${MONTHS_PT[selection.date.getMonth()]}` : g("booking.label_datetime", "Selecionar data e hora")}
          selected={!!selection.time} disabled={selection.services.length === 0} onClick={onDateClick} cardBg={cardBg} />

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
function CalendarModal({ primary, cardBg, barber, unitId, allBarbers, schedules, events, maxDays, closedDays, slotInterval, g, serviceDuration, onSelect }: any) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [periodo, setPeriodo] = useState<"manha" | "tarde">("manha");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + maxDays);

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Helper: which barbers work on a given date?
  function getWorkingBarbers(d: Date): any[] {
    if (!allBarbers || allBarbers.length === 0) return [];
    return allBarbers.filter((b: any) => {
      const ws = schedules.find((s: WorkSchedule) => s.memberId === b.id && s.dayOfWeek === d.getDay());
      return !ws?.isOff;
    });
  }

  // Auto-select first available date on mount
  useEffect(() => {
    for (let i = 0; i <= maxDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      if (closedDays.includes(d.getDay())) continue;
      if (barber && barber.id !== "__no_pref__") {
        const ws = schedules.find((s: WorkSchedule) => s.memberId === barber.id && s.dayOfWeek === d.getDay());
        if (ws && ws.isOff) continue;
      } else {
        // __no_pref__: skip days where NO barber works (C3)
        if (getWorkingBarbers(d).length === 0) continue;
      }
      setSelectedDate(d);
      break;
    }
  }, []);

  function isDayAvailable(day: number): boolean {
    const d = new Date(year, month, day);
    if (d < today || d > maxDate) return false;
    if (closedDays.includes(d.getDay())) return false;
    if (barber && barber.id !== "__no_pref__") {
      const ws = schedules.find((s: WorkSchedule) => s.memberId === barber.id && s.dayOfWeek === d.getDay());
      if (ws && ws.isOff) return false;
    } else {
      // __no_pref__: day unavailable if NO barber works (C2)
      if (getWorkingBarbers(d).length === 0) return false;
    }
    return true;
  }

  function getAvailableSlots(): { time: string; isEncaixe: boolean }[] {
    if (!selectedDate) return [];
    const isNoPref = barber?.id === "__no_pref__";
    const barberId = isNoPref ? null : barber?.id;
    // Use store_settings defaults when barber has no individual schedule
    const defStart = g("booking.default_start_time", "08:00");
    const defEnd = g("booking.default_end_time", "19:00");
    const defBreakS = g("booking.default_break_start", "12:00");
    const defBreakE = g("booking.default_break_end", "13:00");
    let startTime = defStart, endTime = defEnd, breakStart = defBreakS, breakEnd = defBreakE;

    if (barberId) {
      // Specific barber: use their schedule
      const ws = schedules.find((s: WorkSchedule) => s.memberId === barberId && s.dayOfWeek === selectedDate.getDay());
      if (ws) {
        startTime = ws.startTime || defStart;
        endTime = ws.endTime || defEnd;
        breakStart = ws.breakStart || "";
        breakEnd = ws.breakEnd || "";
      }
    } else if (isNoPref) {
      // __no_pref__: use UNION of all active barbers' schedules for widest window (C4)
      const workingBarbers = getWorkingBarbers(selectedDate);
      if (workingBarbers.length === 0) return [];
      let earliestStart = 24 * 60, latestEnd = 0;
      for (const b of workingBarbers) {
        const ws = schedules.find((s: WorkSchedule) => s.memberId === b.id && s.dayOfWeek === selectedDate.getDay());
        const bStart = ws?.startTime || defStart;
        const bEnd = ws?.endTime || defEnd;
        const [bsH, bsM] = bStart.split(":").map(Number);
        const [beH, beM] = bEnd.split(":").map(Number);
        earliestStart = Math.min(earliestStart, bsH * 60 + bsM);
        latestEnd = Math.max(latestEnd, beH * 60 + beM);
      }
      startTime = `${String(Math.floor(earliestStart / 60)).padStart(2, "0")}:${String(earliestStart % 60).padStart(2, "0")}`;
      endTime = `${String(Math.floor(latestEnd / 60)).padStart(2, "0")}:${String(latestEnd % 60).padStart(2, "0")}`;
      // For no_pref, we don't apply a single break — individual barber breaks are handled in the overlap check below
      breakStart = ""; breakEnd = "";
    }
    let slots = generateTimeSlots(startTime, endTime, slotInterval);

    // Duration-aware break overlap check (B2)
    const svcDur = serviceDuration || slotInterval;
    if (breakStart && breakEnd) {
      const [bsH, bsM] = breakStart.split(":").map(Number);
      const [beH, beM] = breakEnd.split(":").map(Number);
      const breakS = bsH * 60 + bsM;
      const breakE = beH * 60 + beM;
      slots = slots.filter((s) => {
        const [sh, sm] = s.split(":").map(Number);
        const slotStart = sh * 60 + sm;
        const slotEnd = slotStart + svcDur;
        return !(slotStart < breakE && slotEnd > breakS);
      });
    }

    // End-of-day overflow check (B1)
    const [etH, etM] = endTime.split(":").map(Number);
    const endTimeMin = etH * 60 + etM;
    slots = slots.filter((s) => {
      const [sh, sm] = s.split(":").map(Number);
      return (sh * 60 + sm) + svcDur <= endTimeMin;
    });

    if (isNoPref) {
      // __no_pref__ (C4): a slot is available if ANY barber is free at that time
      const workingBarbers = getWorkingBarbers(selectedDate);
      const dayEventsAll = events.filter((e: any) =>
        e.date === selectedDate.getDate() && e.month === selectedDate.getMonth() && e.year === selectedDate.getFullYear()
        && e.status !== "cancelled" && e.status !== "no_show"
        && (!unitId || e.unitId === unitId)
      );
      slots = slots.filter((slot) => {
        const [sh, sm] = slot.split(":").map(Number);
        const slotStart = sh * 60 + sm;
        const slotEnd = slotStart + svcDur;
        // Check if at least ONE barber is free AND working during this slot
        return workingBarbers.some((b: any) => {
          // Barber must be working at this hour
          const ws = schedules.find((s: WorkSchedule) => s.memberId === b.id && s.dayOfWeek === selectedDate.getDay());
          const bStart = ws?.startTime || defStart;
          const bEnd = ws?.endTime || defEnd;
          const [bsH2, bsM2] = bStart.split(":").map(Number);
          const [beH2, beM2] = bEnd.split(":").map(Number);
          if (slotStart < bsH2 * 60 + bsM2 || slotEnd > beH2 * 60 + beM2) return false;
          // Check barber's break
          const bBreakS = ws?.breakStart, bBreakE = ws?.breakEnd;
          if (bBreakS && bBreakE) {
            const [bbsH, bbsM] = bBreakS.split(":").map(Number);
            const [bbeH, bbeM] = bBreakE.split(":").map(Number);
            if (slotStart < bbeH * 60 + bbeM && slotEnd > bbsH * 60 + bbsM) return false;
          }
          // Check if this barber has a conflicting event
          const barberEvents = dayEventsAll.filter((e: any) => e.barberId === b.id);
          const hasConflict = barberEvents.some((e: any) => {
            const [eH, eM] = (e.startTime || "00:00").split(":").map(Number);
            const eventStart = eH * 60 + eM;
            const eventEnd = eventStart + (e.duration || slotInterval);
            return slotStart < eventEnd && slotEnd > eventStart;
          });
          return !hasConflict;
        });
      });
    } else {
      // Specific barber: existing logic
      const dayEvents = events.filter((e: any) =>
        e.date === selectedDate.getDate() && e.month === selectedDate.getMonth() && e.year === selectedDate.getFullYear()
        && e.status !== "cancelled" && e.status !== "no_show" && (!barberId || e.barberId === barberId)
        && (!unitId || e.unitId === unitId)
      );

      // Max per barber per day
      const maxPerDay = parseInt(g("booking.max_per_barber_day", "0"), 10);
      if (maxPerDay > 0 && barberId) {
        const barberDayCount = dayEvents.length;
        if (barberDayCount >= maxPerDay) return [];
      }

      // Bidirectional overlap check with existing events
      slots = slots.filter((slot) => {
        const [sh, sm] = slot.split(":").map(Number);
        const slotStart = sh * 60 + sm;
        const slotEnd = slotStart + svcDur;
        return !dayEvents.some((e: any) => {
          const [eH, eM] = (e.startTime || "00:00").split(":").map(Number);
          const eventStart = eH * 60 + eM;
          const eventEnd = eventStart + (e.duration || slotInterval);
          return slotStart < eventEnd && slotEnd > eventStart;
        });
      });
    }

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

    return slots.map(s => ({ time: s, isEncaixe: false }));
  }

  // ── Gap slot (encaixe) generation for specific barber ──
  function getEncaixeSlots(): { time: string; isEncaixe: boolean }[] {
    if (!selectedDate || barber?.id === "__no_pref__" || !barber?.id) return [];
    const barberId = barber.id;
    const svcDur = serviceDuration || slotInterval;

    // Get barber's work schedule for this day
    const defStart = g("booking.default_start_time", "08:00");
    const defEnd = g("booking.default_end_time", "19:00");
    const ws = schedules.find((s: WorkSchedule) => s.memberId === barberId && s.dayOfWeek === selectedDate.getDay());
    const startTime = ws?.startTime || defStart;
    const endTime = ws?.endTime || defEnd;
    const [stH, stM] = startTime.split(":").map(Number);
    const [etH2, etM2] = endTime.split(":").map(Number);
    const dayStartMin = stH * 60 + stM;
    const dayEndMin = etH2 * 60 + etM2;
    const breakS = ws?.breakStart, breakE = ws?.breakEnd;
    let breakStartMin = 0, breakEndMin = 0;
    if (breakS && breakE) {
      const [bsH, bsM] = breakS.split(":").map(Number);
      const [beH, beM] = breakE.split(":").map(Number);
      breakStartMin = bsH * 60 + bsM;
      breakEndMin = beH * 60 + beM;
    }

    // Get this barber's events for the day, sorted
    const dayEvents = events.filter((e: any) =>
      e.date === selectedDate.getDate() && e.month === selectedDate.getMonth() && e.year === selectedDate.getFullYear()
      && e.status !== "cancelled" && e.status !== "no_show" && e.barberId === barberId
      && (!unitId || e.unitId === unitId)
    ).sort((a: any, b: any) => {
      const [aH, aM] = (a.startTime || "00:00").split(":").map(Number);
      const [bH2, bM2] = (b.startTime || "00:00").split(":").map(Number);
      return (aH * 60 + aM) - (bH2 * 60 + bM2);
    });

    if (dayEvents.length === 0) return []; // No events = no gaps to detect

    // Build list of occupied intervals
    const occupied: { start: number; end: number }[] = dayEvents.map((e: any) => {
      const [eH, eM] = (e.startTime || "00:00").split(":").map(Number);
      return { start: eH * 60 + eM, end: eH * 60 + eM + (e.duration || slotInterval) };
    });

    // Add break as occupied if exists
    if (breakStartMin > 0) occupied.push({ start: breakStartMin, end: breakEndMin });
    occupied.sort((a, b) => a.start - b.start);

    // Regular slot times (to avoid duplicating)
    const regularSlots = generateTimeSlots(startTime, endTime, slotInterval);
    const regularSet = new Set(regularSlots);

    // Detect gaps and generate encaixe slots
    const encaixeSlots: { time: string; isEncaixe: boolean }[] = [];
    let cursor = dayStartMin;
    for (const occ of occupied) {
      if (occ.start > cursor) {
        // Gap from cursor to occ.start
        const gapSize = occ.start - cursor;
        if (gapSize >= svcDur) {
          const gapTime = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
          // Only add if it's NOT already a regular slot and passes all checks
          if (!regularSet.has(gapTime) && cursor + svcDur <= dayEndMin) {
            // Check break overlap
            const noBreakConflict = !breakStartMin || !(cursor < breakEndMin && cursor + svcDur > breakStartMin);
            if (noBreakConflict) encaixeSlots.push({ time: gapTime, isEncaixe: true });
          }
        }
      }
      cursor = Math.max(cursor, occ.end);
    }
    // Gap after last event until end of day
    if (cursor < dayEndMin && (dayEndMin - cursor) >= svcDur) {
      const gapTime = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
      if (!regularSet.has(gapTime)) {
        const noBreakConflict = !breakStartMin || !(cursor < breakEndMin && cursor + svcDur > breakStartMin);
        if (noBreakConflict) encaixeSlots.push({ time: gapTime, isEncaixe: true });
      }
    }

    // Filter past slots if today
    const now = new Date();
    if (selectedDate.toDateString() === now.toDateString()) {
      const cutoff = now.getHours() * 60 + now.getMinutes();
      return encaixeSlots.filter(s => {
        const [h, m] = s.time.split(":").map(Number);
        return h * 60 + m > cutoff;
      });
    }
    return encaixeSlots;
  }

  const regularSlots = getAvailableSlots();
  const encaixeSlots = getEncaixeSlots();
  const allSlots = [...regularSlots, ...encaixeSlots].sort((a, b) => {
    const [aH, aM] = a.time.split(":").map(Number);
    const [bH, bM] = b.time.split(":").map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });
  const morningSlots = allSlots.filter((s) => parseInt(s.time) < 12);
  const afternoonSlots = allSlots.filter((s) => parseInt(s.time) >= 12);
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
          <h3 className="font-bold text-center mb-1 text-white text-sm tracking-wide" style={{ letterSpacing: "0.05em" }}>Escolha o melhor horário</h3>
          {serviceDuration > slotInterval && (
            <p className="text-center text-xs mb-3 flex items-center justify-center gap-1.5" style={{ color: primary }}>
              <Clock className="w-3.5 h-3.5" /> Duração total: {serviceDuration} min
            </p>
          )}
          
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
          {selectedDate ? (displaySlots.length > 0 ? displaySlots.map((slot, i) => (
            <div key={slot.time} onClick={() => onSelect(selectedDate, slot.time)}
              className={`booking-time-slot-elegant p-2.5 rounded-xl text-center cursor-pointer ${slot.isEncaixe ? 'border border-dashed' : ''}`}
              style={{ animationDelay: `${i * 30}ms`, ...(slot.isEncaixe ? { borderColor: primary + '50' } : {}) }}>
              <span className="text-sm font-medium">{slot.time}</span>
              {slot.isEncaixe && <div className="text-[9px] mt-0.5 opacity-70" style={{ color: primary }}>⚡ Encaixe</div>}
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

  const price = selection.services.reduce((sum, s) => sum + (s.price || 0), 0);
  const dateStr = selection.date?.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

  const isCreditRedemption = !!selection.isFromCreditRedemption;

  // ── Subscription discount calculation (defensive — JSONB may arrive as string) ──
  let subscriptionDiscount = 0; // 0-100 percentage
  let quotaExceeded = false; // true when monthly usage limit reached
  let quotaMax = 0; // max uses per month
  let quotaUsed = 0; // uses this month
  let quotaIncrement = 1; // combo full = 1, partial = 0.5
  try {
    if (!isCreditRedemption && clientSubscription?.plan) {
      const isActive = clientSubscription.status === 'active';
      const isCancelledButValid = clientSubscription.status === 'cancelled'
        && clientSubscription.endDate && new Date(clientSubscription.endDate) > new Date();
      if ((isActive || isCancelledButValid) && clientSubscription.plan) {
      const plan = clientSubscription.plan;

      // Safely parse any JSONB field that might arrive as a JSON string
      const planServices = safeParseJsonArray(plan.planServices);
      const allowedUnitIds = safeParseJsonArray(plan.allowedUnitIds);
      const excludedProfessionals = safeParseJsonArray(plan.excludedProfessionals);
      const disabledDays = safeParseJsonArray(plan.disabledDays);

      // Check unit scope
      const unitOk = plan.unitScope === 'all' || allowedUnitIds.length === 0 ||
        allowedUnitIds.includes(selection.unit?.id);
      // Check excluded professionals
      const barberOk = excludedProfessionals.length === 0 ||
        !excludedProfessionals.includes(selection.barber?.id);
      // Check disabled days
      const selDay = selection.date instanceof Date ? selection.date.getDay() : -1;
      const dayOk = disabledDays.length === 0 || !disabledDays.includes(selDay);

      if (unitOk && barberOk && dayOk) {
        // Multi-service: compute weighted average discount and combo quota
        let totalDiscount = 0;
        let coveredPrice = 0;
        let matchedCount = 0;
        const comboMode = !!plan.comboMode;
        const comboServiceIds: string[] = safeParseJsonArray(plan.comboServiceIds);

        for (const svc of (selection.services || [])) {
          const rule = planServices.find((r: any) => r.serviceId === svc.id);
          if (rule && Number(rule.discount) > 0) {
            matchedCount++;
            const svcDisc = Number(rule.discount);
            coveredPrice += (svc.price || 0) * svcDisc / 100;
          }
        }

        if (matchedCount > 0 && price > 0) {
          // Weighted average discount based on actual price coverage
          const weightedDiscount = Math.round((coveredPrice / price) * 100);

          // Quota check
          const usesThisMonth = clientSubscription.usesThisMonth || 0;
          const maxUses = plan.maxUsesPerMonth || 0;

          // Compute fractional increment for combo mode
          if (comboMode && comboServiceIds.length > 0) {
            const selectedIds = (selection.services || []).map((s: any) => s.id);
            const comboMatches = comboServiceIds.filter((id: string) => selectedIds.includes(id)).length;
            const isFullCombo = comboMatches === comboServiceIds.length;
            quotaIncrement = isFullCombo ? 1 : 0.5;
          }

          if (!maxUses) {
            subscriptionDiscount = weightedDiscount;
          } else if (usesThisMonth + quotaIncrement <= maxUses) {
            subscriptionDiscount = weightedDiscount;
          } else {
            quotaExceeded = true;
            quotaMax = maxUses;
            quotaUsed = usesThisMonth;
          }
        }
      }
      }
    }
  } catch (e) {
    // Never let discount calc crash the booking flow
    console.error('[ResumoModal] discount calc error:', e);
    subscriptionDiscount = 0;
  }


  const isCovered = subscriptionDiscount === 100;
  const hasPartialDiscount = subscriptionDiscount > 0 && subscriptionDiscount < 100;
  const planDiscountAmount = +(price * subscriptionDiscount / 100).toFixed(2);
  const priceAfterPlan = +(price - planDiscountAmount).toFixed(2);

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
        <div className="flex justify-between text-sm">
          <span className="flex items-center gap-2">
            <Crown className="w-4 h-4" style={{ color: primary }} />
            <span style={{ color: primary }}>Incluso no seu plano</span>
          </span>
          <span className="text-green-400">- R$ {price.toFixed(2)}</span>
        </div>

      </>
    );
  } else if (hasPartialDiscount) {
    finalPrice = +(priceAfterPlan * (1 - couponDiscount)).toFixed(2);
    planHtml = (
      <>
        <div className="flex justify-between text-sm">
          <span className="flex items-center gap-2">
            <Crown className="w-4 h-4" style={{ color: primary }} />
            <span style={{ color: primary }}>Desc. do plano ({subscriptionDiscount}%)</span>
          </span>
          <span className="text-green-400">- R$ {planDiscountAmount.toFixed(2)}</span>
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
        // Validate min amount (against price after plan discount)
        const baseForCoupon = hasPartialDiscount ? priceAfterPlan : price;
        if (c.min_amount && baseForCoupon < c.min_amount) {
          setCouponDiscount(0);
          setCouponMsg({ text: `Valor mínimo: R$ ${Number(c.min_amount).toFixed(2)}`, ok: false });
          setCouponLoading(false);
          return;
        }
        const discVal = c.discount_value || 10;
        const disc = (c.discount_type === 'fixed') ? discVal / baseForCoupon : discVal / 100;
        setCouponDiscount(disc);
        setCouponMsg({ text: c.discount_type === 'fixed' ? `Cupom de R$${discVal.toFixed(2)} aplicado!` : `Cupom de ${discVal}% aplicado!`, ok: true });
      } else {
        setCouponDiscount(0);
        setCouponMsg({ text: "Cupom inválido.", ok: false });
      }
      setCouponLoading(false);
    }, 800);
  }

  // Recalculate final when coupon changes for partial discount
  const computedFinal = isCreditRedemption ? 0 : isCovered ? 0 : hasPartialDiscount
    ? +(priceAfterPlan * (1 - couponDiscount)).toFixed(2)
    : +(price * (1 - couponDiscount)).toFixed(2);

  return (
    <div className="p-6 booking-auth" style={{ borderRadius: "1rem" }}>
      <h3 className="text-2xl font-bold text-center mb-6" style={{ color: primary }}>Resumo do Agendamento</h3>
      <div className="text-left space-y-3 text-sm mb-6">
        <p><strong className="text-gray-400">Unidade:</strong><br /><span className="text-white">{selection.unit?.name}</span></p>
        <p><strong className="text-gray-400">Data:</strong><br /><span className="text-white">{dateStr} às {selection.time}</span></p>
        <p><strong className="text-gray-400">Profissional:</strong><br /><span className="text-white">{selection.barber?.name}</span></p>
        <p><strong className="text-gray-400">Serviço:</strong><br /><span className="text-white">{selection.services?.map((s: any) => s.name).join(' + ') || '—'}</span></p>
      </div>

      {/* ═══ Informational banners for overdue / quota exceeded ═══ */}
      {clientSubscription?.status === 'overdue' && (
        <div className="p-3 rounded-xl mb-4 flex items-start gap-3"
          style={{ backgroundColor: '#ef444412', border: '1px solid #ef444430' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
          <div className="flex-1">
            <p className="text-xs font-bold" style={{ color: '#f87171' }}>Benefícios suspensos</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Seu pagamento foi recusado e os benefícios do seu plano foram pausados até a regularização.</p>
          </div>
        </div>
      )}
      {quotaExceeded && (clientSubscription?.status === 'active' || (clientSubscription?.status === 'cancelled' && clientSubscription?.endDate && new Date(clientSubscription.endDate) > new Date())) && (
        <div className="p-3 rounded-xl mb-4 flex items-start gap-3"
          style={{ backgroundColor: '#eab30812', border: '1px solid #eab30830' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
          <div className="flex-1">
            <p className="text-xs font-bold" style={{ color: '#fbbf24' }}>Cota mensal atingida</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Você já utilizou {Number(quotaUsed) % 1 === 0 ? quotaUsed : Number(quotaUsed).toFixed(1)} de {quotaMax} usos do seu plano este mês. Sua cota será renovada no próximo mês.</p>
          </div>
        </div>
      )}

      <div className="border-t border-gray-700 pt-4">
        {/* Coupon section - hidden if fully covered or credit redemption */}
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
            <span className={`text-white ${hasPartialDiscount || isCovered ? "line-through opacity-50" : ""}`}>R$ {price.toFixed(2)}</span>
          </div>
          {creditHtml}
          {planHtml}
          {couponDiscount > 0 && !isCovered && !isCreditRedemption && (
            <div className="flex justify-between text-green-400">
              <span>Desconto Cupom</span>
              <span>- R$ {((hasPartialDiscount ? priceAfterPlan : price) * couponDiscount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg border-t border-gray-700 pt-2 mt-2">
            <span className="text-white">Total</span>
            <span style={{ color: primary }}>R$ {computedFinal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <button onClick={() => onClose()} className="w-full py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        <button onClick={async () => {
          setLoading(true);
          try {
            await onConfirm({ couponCode, couponDiscount, finalPrice: computedFinal, subscriptionDiscount, quotaIncrement });
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
function HistoricoView({ g, primary, bgColor, cardBg, authUser, clientProfile, clientSubscription, setClientSubscription, events, availabilityEvents, units, barbers, services, schedules, closedDays, maxAdvDays, slotInterval, onLogin, openModal, closeModal, onRefresh, setActiveView, updateSelection, resetSelection }: any) {
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
    if (e.status === "cancelled" || e.status === "completed" || e.status === "no_show") return false;
    const eventDate = new Date(e.year, e.month, e.date);
    return eventDate >= todayStart;
  });
  const historico = events.filter((e: CalendarEvent) => {
    if (e.status === "cancelled") return false;
    const eventDate = new Date(e.year, e.month, e.date);
    return eventDate < todayStart || e.status === "completed" || e.status === "no_show";
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
    const isOpen = eventDate >= todayStart && ev.status !== "completed" && ev.status !== "no_show";
    const unit = units.find((u: any) => u.id === ev.unitId);

    // Use the shared resolveBarberName helper (defined in HistoricoView scope)
    const resolvedBarber = resolveBarberName(ev);

    const svc = services.find((s: any) => s.id === ev.serviceId);
    const price = ev.finalPrice != null ? Number(ev.finalPrice) : (svc?.price ?? null);

    openModal(
      <div className="p-6" style={{ borderRadius: "1rem" }}>
        <h3 className="text-xl font-bold mb-6 text-center" style={{ color: primary }}>Detalhes do Agendamento</h3>

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
            <p className="text-white">{ev.startTime} - {ev.endTime}</p>
            {(ev.duration || 0) > 0 && <p className="text-gray-500 text-xs mt-0.5">{ev.duration} minutos</p>}
          </div>
          <div>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Barbeiro:</p>
            <p className="text-white">{resolvedBarber}</p>
          </div>
          <div className="border-t border-gray-700 pt-4">
            {ev.serviceSlots && ev.serviceSlots.length > 1 ? (
              <div className="space-y-2">
                {ev.serviceSlots.map((ss: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm">{ss.serviceName}</p>
                      <p className="text-gray-500 text-xs">{ss.startTime} - {ss.endTime} · {ss.duration}min</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-white">{ev.serviceName || ev.title}</p>
                {price != null && <p className="text-white font-bold">R$ {price.toFixed(2)}</p>}
              </div>
            )}
          </div>
          {price != null && (
            <div className="flex items-center justify-between border-t border-gray-700 pt-3">
              <p className="text-white font-bold text-base">Total</p>
              <p className="font-bold text-base" style={{ color: primary }}>R$ {price.toFixed(2)}</p>
            </div>
          )}
          {(ev as any).usedInPlan && (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>Desconto do plano</span>
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
                  className={`w-full py-3 font-bold rounded-lg bg-red-600 text-white ${canCancel ? "" : "opacity-40"}`}
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
              {!ev.rating && ev.status !== "no_show" && g("review.enabled", "true") !== "false" && (
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
          const now = new Date().toISOString();
          // F5: Cancel all events in the group if this is a split appointment
          if ((ev as any).groupId) {
            await supabase.from("calendar_events").update({ status: "cancelled", updatedAt: now }).eq("groupId", (ev as any).groupId);
          } else {
            await supabase.from("calendar_events").update({ status: "cancelled", updatedAt: now }).eq("id", ev.id);
          }
          // ── Decrement subscription usage if this booking used plan discount ──
          if ((ev as any).usedInPlan && clientSubscription?.id && (clientSubscription.usesThisMonth || 0) > 0) {
            try {
              // Compute fractional decrement matching the booking increment logic
              let decrement = 1;
              const plan = clientSubscription.plan;
              if (plan?.comboMode) {
                const comboIds: string[] = safeParseJsonArray(plan.comboServiceIds);
                if (comboIds.length > 0) {
                  // For grouped events (split), combine serviceIds from ALL group members
                  // to reconstruct the original booking's full service list
                  let evServiceIds: string[];
                  if ((ev as any).groupId) {
                    const { data: groupEvts } = await supabase.from("calendar_events")
                      .select("serviceIds").eq("groupId", (ev as any).groupId);
                    evServiceIds = (groupEvts || []).flatMap((ge: any) => safeParseJsonArray(ge.serviceIds));
                  } else {
                    evServiceIds = safeParseJsonArray((ev as any).serviceIds);
                  }
                  const comboMatches = comboIds.filter(id => evServiceIds.includes(id)).length;
                  decrement = comboMatches === comboIds.length ? 1 : 0.5;
                }
              }
              const newUses = Math.max(0, Math.round(((clientSubscription.usesThisMonth || 0) - decrement) * 10) / 10);
              const { error: updErr } = await supabase.from("subscriptions").update({
                usesThisMonth: newUses,
                updatedAt: new Date().toISOString(),
              }).eq("id", clientSubscription.id);
              if (!updErr) {
                setClientSubscription((prev: any) => prev ? { ...prev, usesThisMonth: newUses } : prev);
              } else {
                console.error('[Cancel] Subscription usage update error:', updErr);
              }
            } catch (e) {
              console.error('[Cancel] Failed to decrement subscription uses:', e);
            }
          }
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
          const now = new Date().toISOString();
          const newEnd = addMinutesToTime(newTime, ev.duration || 30);

          // G3: Recalculate serviceSlots with new start time
          let updatedSlots: any = undefined;
          if ((ev as any).serviceSlots && (ev as any).serviceSlots.length > 0) {
            let cumTime = newTime;
            updatedSlots = (ev as any).serviceSlots.map((ss: any) => {
              const dur = ss.duration || 30;
              const slot = { ...ss, startTime: cumTime, endTime: addMinutesToTime(cumTime, dur) };
              cumTime = slot.endTime;
              return slot;
            });
          }

          const basePayload: any = {
            date: isoDate,
            startTime: newTime,
            endTime: newEnd,
            updatedAt: now,
          };

          // F6: Propagate reschedule to all events in the group
          if ((ev as any).groupId) {
            // Fetch all group events to recalculate endTime per event (each has different duration)
            const { data: groupEvts } = await supabase.from("calendar_events")
              .select("id, duration").eq("groupId", (ev as any).groupId);
            if (groupEvts && groupEvts.length > 0) {
              for (const ge of groupEvts) {
                await supabase.from("calendar_events").update({
                  date: isoDate,
                  startTime: newTime,
                  endTime: addMinutesToTime(newTime, ge.duration || 30),
                  updatedAt: now,
                }).eq("id", ge.id);
              }
            }
            // Update serviceSlots only for THIS event (each split event has different slots)
            if (updatedSlots) {
              await supabase.from("calendar_events").update({ serviceSlots: JSON.stringify(updatedSlots) }).eq("id", ev.id);
            }
          } else {
            await supabase.from("calendar_events").update({
              ...basePayload,
              ...(updatedSlots ? { serviceSlots: JSON.stringify(updatedSlots) } : {}),
            }).eq("id", ev.id);
          }
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
                      <span><Clock className="w-3 h-3 inline mr-2" style={{ color: primary }} />{e.startTime} - {e.endTime || (() => { const [h, m] = (e.startTime || "00:00").split(":").map(Number); const end = h * 60 + m + (e.duration || 30); return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`; })()}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full mr-4 flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#374151", color: primary }}>
                        {resolveBarberName(e).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Barbeiro</p>
                        <p className="font-semibold text-white">{resolveBarberName(e)}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm text-gray-400 mb-1">Serviço</p>
                      <p className="font-semibold text-white">{e.serviceName || e.title}</p>
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
              // Badge priority: rating > no_show > usedInPlan > usedReferralCredit
              const topBadge = e.rating
                ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                    <Star className="w-3 h-3" style={{ fill: "#fbbf24" }} />{e.rating}
                  </span>
                : e.status === "no_show"
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171" }}>Não compareceu</span>
                : e.usedInPlan
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>Plano</span>
                : e.usedReferralCredit
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.2)", color: "#4ade80" }}>Crédito</span>
                : null;
              return (
                <div key={e.id} className="booking-history-card" style={{ backgroundColor: cardBg }}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm text-gray-400"><Calendar className="w-3 h-3 inline mr-2" style={{ color: primary }} />{dateStr}</p>
                    {topBadge}
                  </div>
                  <p className="text-sm text-gray-400 mb-4"><Clock className="w-3 h-3 inline mr-2" style={{ color: primary }} />{e.startTime} - {e.endTime}</p>
                  <div className="border-t border-gray-700 pt-3">
                    <p className="font-semibold text-white mb-2">{unit?.name || e.serviceName || e.title}</p>
                    <div className="text-sm">
                      <div>
                        <p className="text-gray-400">Barbeiro</p>
                        <p className="text-white">{resolveBarberName(e)}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-sm">
                      <p className="text-gray-400">Serviço</p>
                      <p className="text-white">{e.serviceName || e.title}</p>
                    </div>
                  </div>
                  {e.rating ? (
                    <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-3">
                      <button onClick={() => showDetalhes(e)} className="py-2 text-sm font-bold rounded-lg border-2 transition-colors" style={{ borderColor: primary, color: primary, backgroundColor: "transparent" }}>Ver detalhes</button>
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
                  ) : e.status === "no_show" ? (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <button onClick={() => {
                        const svc = services.find((s: Service) => s.id === e.serviceId);
                        const barber = barbers.find((b: any) => b.id === e.barberId);
                        resetSelection();
                        if (unit) updateSelection({ unit });
                        if (barber) updateSelection({ barber });
                        if (svc) updateSelection({ service: svc });
                        setActiveView("agendar");
                      }} className="w-full py-2 text-sm font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Agendar Novamente</button>
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
      <p className="text-gray-300 mb-4">Você tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.</p>
      {ev.groupId && (
        <p className="text-xs text-amber-400 mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(251,191,36,0.1)" }}>
          ⚠️ Este agendamento possui serviços vinculados. Todos serão cancelados juntos.
        </p>
      )}
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

  function getSlots(): { time: string; isEncaixe: boolean }[] {
    if (!selectedDate) return [];
    const barberId = barber?.id;
    let st = "08:00", et = "19:00", bs = "", be = "";
    if (barberId) {
      const ws = schedules.find((s: WorkSchedule) => s.memberId === barberId && s.dayOfWeek === selectedDate.getDay());
      if (ws) { st = ws.startTime || st; et = ws.endTime || et; bs = ws.breakStart || ""; be = ws.breakEnd || ""; }
    }
    let slots = generateTimeSlots(st, et, slotInterval);

    // Duration-aware break overlap check (B2)
    const evDur = ev.duration || slotInterval;
    if (bs && be) {
      const [bsH, bsM] = bs.split(":").map(Number);
      const [beH, beM] = be.split(":").map(Number);
      const breakS = bsH * 60 + bsM;
      const breakE = beH * 60 + beM;
      slots = slots.filter((s) => {
        const [sh, sm] = s.split(":").map(Number);
        const slotStart = sh * 60 + sm;
        const slotEnd = slotStart + evDur;
        return !(slotStart < breakE && slotEnd > breakS);
      });
    }

    // End-of-day overflow check (B1)
    const [retH, retM] = et.split(":").map(Number);
    const endTimeMinR = retH * 60 + retM;
    slots = slots.filter((s) => {
      const [sh, sm] = s.split(":").map(Number);
      return (sh * 60 + sm) + evDur <= endTimeMinR;
    });

    const dayEvts = events.filter((e: any) => e.date === selectedDate.getDate() && e.month === selectedDate.getMonth() && e.year === selectedDate.getFullYear() && e.status !== "cancelled" && e.status !== "no_show" && e.id !== ev.id && (!barberId || e.barberId === barberId) && (!ev.unitId || e.unitId === ev.unitId));
    // Bidirectional overlap check with existing events
    slots = slots.filter((slot) => {
      const [sh, sm] = slot.split(":").map(Number);
      const slotStart = sh * 60 + sm;
      const slotEnd = slotStart + evDur;
      return !dayEvts.some((e: any) => {
        const [eH, eM] = (e.startTime || "00:00").split(":").map(Number);
        const eventStart = eH * 60 + eM;
        const eventEnd = eventStart + (e.duration || slotInterval);
        return slotStart < eventEnd && slotEnd > eventStart;
      });
    });
    if (selectedDate.toDateString() === new Date().toDateString()) {
      const now = new Date();
      slots = slots.filter((s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m > now.getHours() * 60 + now.getMinutes(); });
    }
    return slots.map(s => ({ time: s, isEncaixe: false }));
  }

  // D2: Gap slot (encaixe) generation for RemarcarModal
  function getEncaixeSlotsR(): { time: string; isEncaixe: boolean }[] {
    if (!selectedDate || !barber?.id) return [];
    const barberId = barber.id;
    const evDur = ev.duration || slotInterval;
    let st = "08:00", et = "19:00", bs = "", be = "";
    const ws = schedules.find((s: WorkSchedule) => s.memberId === barberId && s.dayOfWeek === selectedDate.getDay());
    if (ws) { st = ws.startTime || st; et = ws.endTime || et; bs = ws.breakStart || ""; be = ws.breakEnd || ""; }
    const [stH, stM] = st.split(":").map(Number);
    const [etH2, etM2] = et.split(":").map(Number);
    const dayStartMin = stH * 60 + stM;
    const dayEndMin = etH2 * 60 + etM2;
    let breakStartMin = 0, breakEndMin = 0;
    if (bs && be) {
      const [bsH2, bsM2] = bs.split(":").map(Number);
      const [beH2, beM2] = be.split(":").map(Number);
      breakStartMin = bsH2 * 60 + bsM2;
      breakEndMin = beH2 * 60 + beM2;
    }
    const dayEvts = events.filter((e: any) =>
      e.date === selectedDate.getDate() && e.month === selectedDate.getMonth() && e.year === selectedDate.getFullYear()
      && e.status !== "cancelled" && e.status !== "no_show" && e.id !== ev.id && e.barberId === barberId
      && (!ev.unitId || e.unitId === ev.unitId)
    ).sort((a: any, b: any) => {
      const [aH, aM] = (a.startTime || "00:00").split(":").map(Number);
      const [bH2, bM2] = (b.startTime || "00:00").split(":").map(Number);
      return (aH * 60 + aM) - (bH2 * 60 + bM2);
    });
    if (dayEvts.length === 0) return [];
    const occupied: { start: number; end: number }[] = dayEvts.map((e: any) => {
      const [eH, eM] = (e.startTime || "00:00").split(":").map(Number);
      return { start: eH * 60 + eM, end: eH * 60 + eM + (e.duration || slotInterval) };
    });
    if (breakStartMin > 0) occupied.push({ start: breakStartMin, end: breakEndMin });
    occupied.sort((a, b) => a.start - b.start);
    const regularSet = new Set(generateTimeSlots(st, et, slotInterval));
    const encaixeSlots: { time: string; isEncaixe: boolean }[] = [];
    let cursor = dayStartMin;
    for (const occ of occupied) {
      if (occ.start > cursor && (occ.start - cursor) >= evDur) {
        const gapTime = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
        if (!regularSet.has(gapTime) && cursor + evDur <= dayEndMin) {
          const noBreakConflict = !breakStartMin || !(cursor < breakEndMin && cursor + evDur > breakStartMin);
          if (noBreakConflict) encaixeSlots.push({ time: gapTime, isEncaixe: true });
        }
      }
      cursor = Math.max(cursor, occ.end);
    }
    if (cursor < dayEndMin && (dayEndMin - cursor) >= evDur) {
      const gapTime = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
      if (!regularSet.has(gapTime)) {
        const noBreakConflict = !breakStartMin || !(cursor < breakEndMin && cursor + evDur > breakStartMin);
        if (noBreakConflict) encaixeSlots.push({ time: gapTime, isEncaixe: true });
      }
    }
    if (selectedDate.toDateString() === new Date().toDateString()) {
      const cutoff = new Date().getHours() * 60 + new Date().getMinutes();
      return encaixeSlots.filter(s => { const [h, m] = s.time.split(":").map(Number); return h * 60 + m > cutoff; });
    }
    return encaixeSlots;
  }

  const regularSlots = getSlots();
  const encaixeSlotsR = getEncaixeSlotsR();
  const allSlots = [...regularSlots, ...encaixeSlotsR].sort((a, b) => {
    const [aH, aM] = a.time.split(":").map(Number);
    const [bH, bM] = b.time.split(":").map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });
  const morningSlots = allSlots.filter((s) => parseInt(s.time) < 12);
  const afternoonSlots = allSlots.filter((s) => parseInt(s.time) >= 12);
  const displaySlots = periodo === "manha" ? morningSlots : afternoonSlots;

  return (
    <div className="p-6" style={{ borderRadius: "1rem" }}>
      <h3 className="text-xl font-bold mb-2 text-center" style={{ color: primary }}>Remarcar Horário</h3>
      <p className="text-center text-sm text-gray-400 mb-3">{ev.serviceName || ev.title}</p>
      {(ev as any).groupId && (
        <p className="text-xs text-amber-400 mb-3 px-3 py-2 rounded-lg text-center" style={{ backgroundColor: "rgba(251,191,36,0.1)" }}>
          ⚠️ Todos os serviços vinculados serão remarcados juntos.
        </p>
      )}
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

      <h3 className="font-bold text-center mb-1 text-white">Escolha o novo horário</h3>
      {(ev.duration || 30) > slotInterval && (
        <p className="text-center text-xs mb-3 flex items-center justify-center gap-1.5" style={{ color: primary }}>
          <Clock className="w-3.5 h-3.5" /> Duração: {ev.duration} min
        </p>
      )}
      <div className="flex gap-2 mb-4">
        {(["manha", "tarde"] as const).map((p) => (
          <button key={p} onClick={() => setPeriodo(p)} className="flex-1 py-2 rounded-lg font-semibold text-sm"
            style={{ backgroundColor: periodo === p ? primary : "#4a4a4a", color: periodo === p ? "#111" : "#ccc" }}>
            {p === "manha" ? "Manhã" : "Tarde"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-6">
        {selectedDate ? (displaySlots.length > 0 ? displaySlots.map((slot) => (
          <div key={slot.time} onClick={() => setSelectedTime(slot.time)}
            className={`booking-time-slot p-3 rounded-lg text-center cursor-pointer ${slot.isEncaixe ? 'border border-dashed' : ''}`}
            style={{ backgroundColor: selectedTime === slot.time ? primary : "#374151", color: selectedTime === slot.time ? "#111" : "#fff", ...(slot.isEncaixe ? { borderColor: primary + '50' } : {}) }}>
            <span className="text-sm font-medium">{slot.time}</span>
            {slot.isEncaixe && <div className="text-[9px] mt-0.5 opacity-70" style={{ color: selectedTime === slot.time ? "#111" : primary }}>⚡ Encaixe</div>}
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
// ASSINAR MODAL (Self-Service Subscription Activation)
// ============================================================
function AssinarModal({ plan, primary, bgColor, clientProfile, onClose, onSuccess, services, isReactivation, units, g, openTermosModal }: any) {
  const [step, setStep] = useState<'form' | 'processing' | 'result'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  // Unit selection
  const availableUnits = useMemo(() => {
    if (!units || units.length === 0) return [];
    const allowed = typeof plan.allowedUnitIds === 'string' ? (() => { try { return JSON.parse(plan.allowedUnitIds); } catch { return []; } })() : (plan.allowedUnitIds || []);
    if (plan.unitScope === 'specific' && Array.isArray(allowed) && allowed.length > 0) {
      return units.filter((u: any) => allowed.includes(u.id));
    }
    return units;
  }, [units, plan]);
  const needsUnitPick = !isReactivation && availableUnits.length > 1;
  const [selectedUnitId, setSelectedUnitId] = useState(() => {
    if (isReactivation) return '';
    if (availableUnits.length === 1) return availableUnits[0].id;
    return '';
  });

  // Dynamic form sections: unit step only when needed
  const SECTION_UNIT = needsUnitPick ? 0 : -1;
  const SECTION_PERSONAL = needsUnitPick ? 1 : 0;
  const SECTION_CARD = needsUnitPick ? 2 : 1;
  const SECTION_REVIEW = needsUnitPick ? 3 : 2;
  const sections = needsUnitPick ? ['Unidade', 'Seus Dados', 'Pagamento', 'Confirmar'] : ['Seus Dados', 'Pagamento', 'Confirmar'];
  const [formSection, setFormSection] = useState(needsUnitPick ? 0 : 0);

  // Personal data
  const [cpf, setCpf] = useState((clientProfile?.cpfCnpj || clientProfile?.cpf || '').replace(/\D/g, ''));
  const [email, setEmail] = useState(clientProfile?.email || '');
  const [phone, setPhone] = useState(clientProfile?.phone || '');
  // Card data
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [holderCpf, setHolderCpf] = useState('');
  const [cep, setCep] = useState('');
  const [addrNumber, setAddrNumber] = useState('');
  const [sameHolder, setSameHolder] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  // Processing messages
  const [processingMsg, setProcessingMsg] = useState('');

  function formatCardNumber(v: string) { return v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19); }
  function formatCpfInput(v: string) { let d = v.replace(/\D/g, '').slice(0, 11); if (d.length > 9) d = d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4'); else if (d.length > 6) d = d.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3'); else if (d.length > 3) d = d.replace(/(\d{3})(\d{0,3})/, '$1.$2'); return d; }
  function formatCep(v: string) { let d = v.replace(/\D/g, '').slice(0, 8); if (d.length > 5) d = d.replace(/(\d{5})(\d{0,3})/, '$1-$2'); return d; }
  function formatPhone(v: string) { let d = v.replace(/\D/g, '').slice(0, 11); if (d.length > 6) d = d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3'); else if (d.length > 2) d = d.replace(/(\d{2})(\d{0,5})/, '($1) $2'); return d; }

  // Resolve plan service names for display
  const planServiceDetails = useMemo(() => {
    const ps = typeof plan.planServices === 'string' ? JSON.parse(plan.planServices || '[]') : (plan.planServices || []);
    return ps.map((s: any) => {
      const svc = (services || []).find((sv: any) => sv.id === s.serviceId);
      return { name: svc?.name || 'Serviço', discount: s.discount, limit: s.monthlyLimit, price: svc?.price || 0 };
    });
  }, [plan, services]);
  const planBenefits = typeof plan.benefits === 'string' ? JSON.parse(plan.benefits || '[]') : (plan.benefits || []);
  const recLabelFull: Record<string, string> = { monthly: 'Mensal', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual' };

  const detectBrand = (n: string) => { const d = n.replace(/\s/g, ''); if (/^4/.test(d)) return 'Visa'; if (/^5[1-5]/.test(d)) return 'Mastercard'; if (/^(636|438|504|606|304)/.test(d)) return 'Elo'; if (/^3[47]/.test(d)) return 'Amex'; if (/^6(?:011|5)/.test(d)) return 'Discover'; return ''; };
  const cardBrand = detectBrand(cardNumber);
  const cardLast4 = cardNumber.replace(/\s/g, '').slice(-4);

  const canProceedUnit = !!selectedUnitId;
  const canProceedPersonal = cpf.replace(/\D/g, '').length >= 11 && email.includes('@') && phone.replace(/\D/g, '').length >= 10;
  const canProceedCard = cardNumber.replace(/\s/g, '').length >= 13 && cardName && cardMonth && cardYear && cardCvv.length >= 3 && (sameHolder || holderCpf.replace(/\D/g, '').length >= 11) && cep.replace(/\D/g, '').length >= 8 && addrNumber;
  const selectedUnit = availableUnits.find((u: any) => u.id === selectedUnitId);

  async function handleSubmit() {
    if (!acceptTerms || loading) return;
    setLoading(true);
    setStep('processing');
    setError('');
    try {
      setProcessingMsg('Validando dados...');
      await new Promise(r => setTimeout(r, 400));
      setProcessingMsg('Verificando cartão de crédito...');
      const apiPayload = {
        planId: plan.id,
        ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
        creditCard: { holderName: cardName, number: cardNumber.replace(/\s/g, ''), expiryMonth: cardMonth, expiryYear: cardYear, ccv: cardCvv },
        holderInfo: { cpfCnpj: (sameHolder ? cpf : holderCpf).replace(/\D/g, ''), postalCode: cep.replace(/\D/g, ''), addressNumber: addrNumber, phone: phone.replace(/\D/g, ''), email },
      };
      const res = isReactivation
        ? await reactivateSubscription(apiPayload)
        : await subscribeToPlan(apiPayload);
      setResult(res);
      setStep('result');
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar. Tente novamente.');
      setStep('form');
      setFormSection(SECTION_CARD); // back to card section
      setLoading(false);
    }
  }

  const planPrice = plan.creditPrice || plan.price || 0;
  const recLabel: Record<string, string> = { monthly: '/mês', quarterly: '/trimestre', semiannual: '/semestre', annual: '/ano' };

  // Processing screen
  if (step === 'processing') return (
    <div className="p-8 text-center" style={{ borderRadius: '1rem' }}>
      <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primary}20` }}>
        <Loader2 className="w-8 h-8 booking-spin" style={{ color: primary }} />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Processando...</h3>
      <p className="text-gray-400 text-sm">{processingMsg}</p>
      <div className="mt-6 w-48 mx-auto h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#333' }}>
        <div className="h-full rounded-full booking-progress-bar" style={{ backgroundColor: primary, width: '60%', animation: 'booking-shimmer 2s infinite' }} />
      </div>
    </div>
  );

  // Result screen
  if (step === 'result' && result) {
    const isActive = result.finalStatus === 'active';
    const isOverdue = result.finalStatus === 'overdue';
    const isPending = result.finalStatus === 'pending_payment';
    const statusColor = isActive ? '#4ade80' : isOverdue ? '#ef4444' : '#fbbf24';
    const statusBg = isActive ? '#22c55e20' : isOverdue ? '#ef444420' : '#eab30820';
    return (
      <div className="p-6 text-center" style={{ borderRadius: '1rem' }}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: statusBg }}>
          {isActive ? <Check className="w-8 h-8 text-green-400" /> : isOverdue ? <AlertTriangle className="w-8 h-8 text-red-400" /> : <Clock className="w-8 h-8 text-yellow-400" />}
        </div>
        <h3 className="text-2xl font-bold mb-2" style={{ color: statusColor }}>
          {isActive ? 'Assinatura Ativa!' : isOverdue ? 'Pagamento Recusado' : 'Pagamento em Processamento'}
        </h3>
        <p className="text-gray-400 text-sm mb-6">
          {isActive ? `Seu plano ${result.planName} está ativo. Aproveite seus benefícios!`
            : isOverdue ? 'O pagamento foi recusado pelo cartão. Verifique os dados e tente novamente.'
            : 'Seu pagamento está sendo processado. A assinatura será ativada automaticamente após confirmação.'}
        </p>
        <div className="p-4 rounded-xl mb-6" style={{ backgroundColor: '#1e1e1e' }}>
          <div className="flex justify-between text-sm mb-2"><span className="text-gray-400">Plano</span><span className="text-white font-semibold">{result.planName}</span></div>
          <div className="flex justify-between text-sm mb-2"><span className="text-gray-400">Valor</span><span className="font-bold" style={{ color: primary }}>R$ {Number(result.planPrice).toFixed(2)}{recLabel[plan.recurrence] || '/mês'}</span></div>
          {result.cardBrand && <div className="flex justify-between text-sm"><span className="text-gray-400">Cartão</span><span className="text-white">{result.cardBrand} •••• {result.cardLast4}</span></div>}
        </div>
        <div className="space-y-3">
          {isOverdue ? (
            <button onClick={() => { setStep('form'); setFormSection(SECTION_CARD); setError('Cartão recusado. Tente outro cartão.'); }} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>
              Tentar Novamente
            </button>
          ) : (
            <button onClick={() => { onSuccess(result); onClose(); }} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>
              {isActive ? 'Agendar Agora' : 'Entendido'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Form screen
  return (
    <div className="p-6" style={{ borderRadius: '1rem' }}>
      <h3 className="text-2xl font-bold text-center mb-6" style={{ color: primary }}>Assinar Plano</h3>

      {/* Plan summary */}
      <div className="mb-5 pb-5" style={{ borderBottom: '1px solid #333' }}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h4 className="font-bold text-lg text-white">{plan.name}</h4>
            <p className="text-xs text-gray-400">{recLabelFull[plan.recurrence] || plan.recurrence}</p>
          </div>
          <p className="font-bold text-xl" style={{ color: primary }}>R$ {planPrice.toFixed(2)}<span className="text-xs font-normal text-gray-400">{recLabel[plan.recurrence] || '/mês'}</span></p>
        </div>

        {/* Included services */}
        {planServiceDetails.length > 0 && (
          <div className="pt-3 mt-3" style={{ borderTop: '1px solid #333' }}>
            <p className="text-xs text-gray-500 font-semibold mb-2">Serviços inclusos</p>
            {planServiceDetails.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm mb-1.5">
                <span className="flex items-center gap-2 text-gray-300">
                  <Check className="w-3.5 h-3.5" style={{ color: primary }} />{s.name}
                </span>
                <span className="text-xs font-semibold" style={{ color: primary }}>{s.limit ? `${s.limit}x/mês` : 'Ilimitado'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Benefits */}
        {planBenefits.length > 0 && (
          <div className="pt-3 mt-3" style={{ borderTop: '1px solid #333' }}>
            <p className="text-xs text-gray-500 font-semibold mb-2">Benefícios</p>
            {planBenefits.map((b: string, i: number) => (
              <div key={`b-${i}`} className="flex items-center gap-2 text-sm text-gray-300 mb-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-500" />{b}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step indicators */}
      <div className="flex gap-1 mb-5">{sections.map((s, i) => {
        const canClick = i === 0
          || (i === SECTION_PERSONAL && (needsUnitPick ? canProceedUnit : true))
          || (i === SECTION_CARD && canProceedPersonal && (needsUnitPick ? canProceedUnit : true))
          || (i === SECTION_REVIEW && canProceedPersonal && canProceedCard && (needsUnitPick ? canProceedUnit : true));
        return (
          <button key={i} onClick={() => { if (canClick) setFormSection(i); }} className="flex-1 text-center">
            <div className="h-1 rounded-full mb-1" style={{ backgroundColor: formSection >= i ? primary : '#444' }} />
            <span className="text-[10px]" style={{ color: formSection >= i ? primary : '#666' }}>{s}</span>
          </button>
        );
      })}</div>

      {error && <div className="p-3 rounded-lg mb-4 text-sm text-red-400 border border-red-500/30" style={{ backgroundColor: '#ef444410' }}><AlertTriangle className="w-4 h-4 inline mr-2" />{error}</div>}

      {/* Section: Unit Selection */}
      {needsUnitPick && formSection === SECTION_UNIT && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4" style={{ color: primary }} />
            <p className="text-sm text-gray-300">Sua assinatura será válida apenas na unidade selecionada.</p>
          </div>
          <div className="space-y-3">
            {availableUnits.map((u: any) => (
              <button key={u.id} onClick={() => setSelectedUnitId(u.id)}
                className="w-full text-left p-4 rounded-xl flex items-center gap-4 transition-all"
                style={{
                  backgroundColor: selectedUnitId === u.id ? `${primary}15` : '#1e1e1e',
                  border: selectedUnitId === u.id ? `2px solid ${primary}` : '2px solid #333',
                }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: selectedUnitId === u.id ? `${primary}20` : '#2a2a2a' }}>
                  <Store className="w-5 h-5" style={{ color: selectedUnitId === u.id ? primary : '#666' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate">{u.tradeName || u.name}</p>
                  {u.address && <p className="text-xs text-gray-500 truncate">{u.address}{u.city ? `, ${u.city}` : ''}{u.state ? ` - ${u.state}` : ''}</p>}
                </div>
                {selectedUnitId === u.id && <Check className="w-5 h-5 ml-auto flex-shrink-0" style={{ color: primary }} />}
              </button>
            ))}
          </div>
          <button onClick={() => setFormSection(SECTION_PERSONAL)} disabled={!canProceedUnit}
            className={`w-full py-3 font-bold rounded-lg ${canProceedUnit ? '' : 'opacity-40'}`} style={{ backgroundColor: primary, color: bgColor }}>
            Continuar
          </button>
        </div>
      )}

      {/* Section: Personal */}
      {formSection === SECTION_PERSONAL && (
        <div className="space-y-4">
          <div><label className="text-xs text-gray-400 mb-1 block">CPF *</label>
            <input value={formatCpfInput(cpf)} onChange={e => setCpf(e.target.value.replace(/\D/g, ''))} placeholder="000.000.000-00" maxLength={14} inputMode="numeric"
              className="w-full p-3 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }} /></div>
          <div><label className="text-xs text-gray-400 mb-1 block">E-mail para cobrança *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
              className="w-full p-3 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }} /></div>
          <div><label className="text-xs text-gray-400 mb-1 block">Telefone *</label>
            <input value={formatPhone(phone)} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="(11) 99999-9999" maxLength={15} inputMode="tel"
              className="w-full p-3 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }} /></div>
          <button onClick={() => setFormSection(SECTION_CARD)} disabled={!canProceedPersonal}
            className={`w-full py-3 font-bold rounded-lg ${canProceedPersonal ? '' : 'opacity-40'}`} style={{ backgroundColor: primary, color: bgColor }}>Próximo</button>
        </div>
      )}

      {/* Section: Credit Card */}
      {formSection === SECTION_CARD && (
        <div className="space-y-3">
          <div><label className="text-xs text-gray-400 mb-1 block">Número do cartão *</label>
            <div className="relative">
              <input value={formatCardNumber(cardNumber)} onChange={e => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" maxLength={19}
                className="w-full p-3 pr-16 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }} />
              {cardBrand && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${primary}20`, color: primary }}>{cardBrand}</span>}
            </div></div>
          <div><label className="text-xs text-gray-400 mb-1 block">Nome no cartão *</label>
            <input value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())} placeholder="NOME COMO NO CARTÃO"
              className="w-full p-3 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-400 mb-1 block">Mês *</label>
              <select value={cardMonth} onChange={e => setCardMonth(e.target.value)} className="w-full p-3 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}>
                <option value="">MM</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{String(i + 1).padStart(2, '0')}</option>)}
              </select></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Ano *</label>
              <select value={cardYear} onChange={e => setCardYear(e.target.value)} className="w-full p-3 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}>
                <option value="">AAAA</option>{Array.from({ length: 15 }, (_, i) => { const y = new Date().getFullYear() + i; return <option key={y} value={String(y)}>{y}</option>; })}
              </select></div>
            <div><label className="text-xs text-gray-400 mb-1 block">CVV *</label>
              <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" maxLength={4}
                className="w-full p-3 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="checkbox" checked={sameHolder} onChange={e => setSameHolder(e.target.checked)} className="accent-primary w-4 h-4" />Titular é o mesmo do CPF informado</label>
          {!sameHolder && <div><label className="text-xs text-gray-400 mb-1 block">CPF do titular *</label>
            <input value={formatCpfInput(holderCpf)} onChange={e => setHolderCpf(e.target.value.replace(/\D/g, ''))} placeholder="000.000.000-00" maxLength={14}
              className="w-full p-3 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }} /></div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400 mb-1 block">CEP *</label>
              <input value={formatCep(cep)} onChange={e => setCep(e.target.value)} placeholder="00000-000" maxLength={9}
                className="w-full p-3 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }} /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Nº Endereço *</label>
              <input value={addrNumber} onChange={e => setAddrNumber(e.target.value)} placeholder="123"
                className="w-full p-3 rounded-lg text-white text-sm" style={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => setFormSection(SECTION_PERSONAL)} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Voltar</button>
            <button onClick={() => setFormSection(SECTION_REVIEW)} disabled={!canProceedCard}
              className={`py-3 font-bold rounded-lg ${canProceedCard ? '' : 'opacity-40'}`} style={{ backgroundColor: primary, color: bgColor }}>Próximo</button>
          </div>
        </div>
      )}

      {/* Section: Review & Confirm */}
      {formSection === SECTION_REVIEW && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#1e1e1e' }}>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3 font-semibold">Resumo da Assinatura</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Plano</span><span className="text-white font-semibold">{plan.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Valor</span><span className="font-bold" style={{ color: primary }}>R$ {planPrice.toFixed(2)}{recLabel[plan.recurrence] || '/mês'}</span></div>
              {selectedUnit && <div className="flex justify-between"><span className="text-gray-400">Unidade</span><span className="text-white">{selectedUnit.tradeName || selectedUnit.name}</span></div>}
              <div className="flex justify-between"><span className="text-gray-400">Cartão</span><span className="text-white">{cardBrand} •••• {cardLast4}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Titular</span><span className="text-white">{cardName}</span></div>
            </div>
          </div>
          <div className="p-3 rounded-lg text-xs text-gray-400" style={{ backgroundColor: '#1a1a1a' }}>
            <CreditCard className="w-4 h-4 inline mr-2" style={{ color: primary }} />
            A primeira cobrança será realizada imediatamente. As próximas cobranças serão feitas automaticamente a cada período.
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="accent-primary w-4 h-4 mt-0.5" />
            <span className="text-xs text-gray-400">Li e concordo com os{' '}
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (openTermosModal) openTermosModal(); }}
                className="underline font-semibold" style={{ color: primary }}>Termos e Condições de Uso</button>
              {' '}e autorizo a cobrança recorrente no meu cartão de crédito.
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setFormSection(SECTION_CARD)} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Voltar</button>
            <button onClick={handleSubmit} disabled={!acceptTerms || loading}
              className={`py-3 font-bold rounded-lg flex items-center justify-center gap-2 ${acceptTerms ? '' : 'opacity-40'}`} style={{ backgroundColor: primary, color: bgColor }}>
              {loading ? <Loader2 className="w-5 h-5 booking-spin" /> : <><CreditCard className="w-4 h-4" />Confirmar</>}
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-gray-600">
        <Lock className="w-3 h-3" />Ambiente seguro • Dados criptografados
      </div>
    </div>
  );
}

// ============================================================
// PLANOS VIEW
// ============================================================
function PlanosView({ g, primary, bgColor, cardBg, plans, subscription, services, authUser, clientProfile, onLogin, openModal, closeModal, onRefresh, setActiveView, onSubscriptionChange, units }: any) {

  function showBeneficiosModal() {
    const planBenefits = subscription?.plan?.benefits
      ? (typeof subscription.plan.benefits === 'string' ? JSON.parse(subscription.plan.benefits || '[]') : subscription.plan.benefits)
      : [];
    const planServicesList = subscription?.plan?.planServices
      ? safeParseJsonArray(subscription.plan.planServices)
      : [];
    const usedTotal = subscription.usesThisMonth || 0;
    const usedStr = Number(usedTotal) % 1 === 0 ? usedTotal : Number(usedTotal).toFixed(1);
    const usesInfo = subscription?.plan?.maxUsesPerMonth
      ? `${usedStr} de ${subscription.plan.maxUsesPerMonth} usos este mês`
      : 'Uso ilimitado';
    openModal(
      <div className="p-6" style={{ borderRadius: "1rem" }}>
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold" style={{ color: primary }}>Benefícios Exclusivos</h3>
          <p className="text-gray-400 text-sm mt-1">Vantagens do seu plano <strong className="text-white">{subscription?.plan?.name}</strong></p>
        </div>
        {/* Uso atual */}
        <div className="p-4 rounded-xl mb-5 flex items-center gap-3" style={{ backgroundColor: '#2a2a2a' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15` }}>
            <Scissors className="w-5 h-5" style={{ color: primary }} />
          </div>
          <div>
            <p className="text-xs text-gray-400">Utilização</p>
            <p className="text-sm font-bold text-white">{usesInfo}</p>
          </div>
        </div>
        {/* Benefícios dinâmicos do plano */}
        {planBenefits.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Benefícios do plano</p>
            <div className="space-y-3">
              {planBenefits.map((b: string, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${primary}15` }}>
                    <Check className="w-3.5 h-3.5" style={{ color: primary }} />
                  </div>
                  <p className="text-sm text-gray-300">{b}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Serviços com desconto */}
        {planServicesList.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Serviços com desconto</p>
            <div className="space-y-2">
              {planServicesList.map((s: any, i: number) => {
                const svc = (services || []).find((sv: any) => sv.id === s.serviceId);
                const disc = Number(s.discount) || 0;
                return svc ? (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#2a2a2a' }}>
                    <div className="flex items-center gap-2">
                      <Scissors className="w-3.5 h-3.5" style={{ color: primary }} />
                      <span className="text-sm text-white">{svc.name}</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: disc === 100 ? '#22c55e20' : `${primary}20`, color: disc === 100 ? '#4ade80' : primary }}>
                      {disc === 100 ? 'Incluso' : `${disc}% off`}
                    </span>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
        {/* Vantagens gerais */}
        <div className="mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Vantagens gerais</p>
          <div className="space-y-3">
            {[
              { Icon: Zap, title: "Agilidade e Conveniência", desc: "Agende seus horários de forma rápida e fácil." },
              { Icon: Tag, title: "Descontos Exclusivos", desc: "Preços especiais em produtos e serviços." },
              { Icon: Star, title: "Acesso Antecipado", desc: "Seja o primeiro a saber de novidades e eventos." },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15` }}>
                  <Icon className="w-4 h-4" style={{ color: primary }} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{title}</h4>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => closeModal()} className="w-full py-3 font-semibold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Entendido</button>
      </div>, "center"
    );
  }

  function showPausarModal() {
    // Calculate remaining period
    const startDate = subscription?.startDate ? new Date(subscription.startDate) : null;
    const recurrence = subscription?.plan?.recurrence || 'monthly';
    const recMonths: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
    let pauseNextDueStr = '';
    let pauseDaysRemaining = 0;
    if (startDate) {
      const start = new Date(startDate);
      const now = new Date();
      const months = recMonths[recurrence] || 1;
      while (start <= now) { start.setMonth(start.getMonth() + months); }
      pauseNextDueStr = start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      pauseDaysRemaining = Math.max(0, Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }
    const pauseMaxUses = subscription?.plan?.maxUsesPerMonth || 0;
    const pauseUsed = subscription?.usesThisMonth || 0;
    const pauseRemaining = pauseMaxUses ? Math.max(0, pauseMaxUses - pauseUsed) : 0;

    const PauseFlow = () => {
      const [pausing, setPausing] = useState(false);
      const [error, setError] = useState('');
      return (
      <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
        <Pause className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
        <h3 className="text-2xl font-bold mb-2 text-white">Pausar Assinatura?</h3>
        <p className="text-gray-400 mb-6">Seu plano será pausado e os benefícios ficarão suspensos até que você reative.</p>
        {error && <div className="p-3 rounded-lg mb-4 text-sm text-red-400 border border-red-500/30" style={{ backgroundColor: '#ef444410' }}><AlertTriangle className="w-4 h-4 inline mr-2" />{error}</div>}
        <div className="p-4 rounded-xl mb-4 text-left" style={{ backgroundColor: "#2a2a2a" }}>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Plano</span>
            <span className="text-white font-semibold">{subscription?.plan?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Valor</span>
            <span className="text-white">R$ {Number(subscription?.plan?.price || 0).toFixed(2)}/mês</span>
          </div>
        </div>
        {/* Período restante */}
        {pauseNextDueStr && (
          <div className="p-4 rounded-xl mb-4 text-left flex items-start gap-3" style={{ backgroundColor: '#22c55e10', border: '1px solid #22c55e25' }}>
            <Calendar className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
            <div>
              <p className="text-sm font-bold text-green-400">Ainda disponível</p>
              <p className="text-xs text-gray-300 mt-1">Seu plano está pago até <strong className="text-white">{pauseNextDueStr}</strong></p>
              {pauseDaysRemaining > 0 && <p className="text-xs text-gray-400 mt-0.5">{pauseDaysRemaining} dia{pauseDaysRemaining !== 1 ? 's' : ''} restante{pauseDaysRemaining !== 1 ? 's' : ''}</p>}
              {pauseMaxUses > 0 && (
                <p className="text-xs text-gray-300 mt-1">Ainda tem <strong className="text-white">{pauseRemaining} de {pauseMaxUses}</strong> usos disponíveis este mês</p>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => closeModal(() => showGerenciarModal())} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
          <button disabled={pausing} onClick={async () => {
            setPausing(true);
            setError('');
            try {
              await pauseMySubscription();
              if (onSubscriptionChange) onSubscriptionChange({ ...subscription, status: 'paused' });
              closeModal();
            } catch (err: any) {
              console.error('Pause error:', err);
              setError(err.message || 'Erro ao pausar. Tente novamente.');
              setPausing(false);
            }
          }} className="py-3 font-bold rounded-lg flex items-center justify-center" style={{ backgroundColor: "#eab308", color: "#000" }}>
            {pausing ? <Loader2 className="w-5 h-5 booking-spin" /> : 'Confirmar Pausa'}
          </button>
        </div>
      </div>
      );
    };
    openModal(<PauseFlow />, "center");
  }

  function showCancelarModal() {
    // Calculate remaining period
    const startDate = subscription?.startDate ? new Date(subscription.startDate) : null;
    const recurrence = subscription?.plan?.recurrence || 'monthly';
    const recMonths: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
    let nextDueStr = '';
    let daysRemaining = 0;
    if (startDate) {
      const start = new Date(startDate);
      const now = new Date();
      const months = recMonths[recurrence] || 1;
      // Find the next due date after start, rolling forward
      while (start <= now) { start.setMonth(start.getMonth() + months); }
      nextDueStr = start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      daysRemaining = Math.max(0, Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }
    const maxUses = subscription?.plan?.maxUsesPerMonth || 0;
    const usedThisMonth = subscription?.usesThisMonth || 0;
    const remainingUses = maxUses ? Math.max(0, maxUses - usedThisMonth) : 0;
    const planBenefitsList = subscription?.plan?.benefits
      ? (typeof subscription.plan.benefits === 'string' ? JSON.parse(subscription.plan.benefits || '[]') : subscription.plan.benefits)
      : [];

    const CancelFlow = () => {
      const [step, setStep] = useState(1);
      const [cancelling, setCancelling] = useState(false);
      const [cancelError, setCancelError] = useState('');
      return (
        <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-2xl font-bold mb-2 text-white">{step === 1 ? "Cancelar Assinatura?" : "Tem certeza absoluta?"}</h3>
          <p className="text-gray-400 mb-6">{step === 1
            ? "Revise o que você ainda tem disponível antes de cancelar."
            : "Esta ação cancelará a cobrança recorrente. Você precisará assinar novamente caso queira retornar."
          }</p>
          {cancelError && <div className="p-3 rounded-lg mb-4 text-sm text-red-400 border border-red-500/30" style={{ backgroundColor: '#ef444410' }}><AlertTriangle className="w-4 h-4 inline mr-2" />{cancelError}</div>}
          {step === 1 && (
            <>
              {/* Plano e valor */}
              <div className="p-4 rounded-xl mb-4 text-left" style={{ backgroundColor: "#2a2a2a" }}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Plano</span>
                  <span className="text-white font-semibold">{subscription?.plan?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Valor</span>
                  <span className="text-white">R$ {Number(subscription?.plan?.price || 0).toFixed(2)}/mês</span>
                </div>
              </div>
              {/* Período restante */}
              {nextDueStr && (
                <div className="p-4 rounded-xl mb-4 text-left flex items-start gap-3" style={{ backgroundColor: '#22c55e10', border: '1px solid #22c55e25' }}>
                  <Calendar className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
                  <div>
                    <p className="text-sm font-bold text-green-400">Ainda disponível</p>
                    <p className="text-[11px] text-gray-500 mb-1.5">Benefícios que você ainda pode usar</p>
                    <p className="text-xs text-gray-300">Seu plano está pago até <strong className="text-white">{nextDueStr}</strong></p>
                    {daysRemaining > 0 && <p className="text-xs text-gray-400 mt-0.5">{daysRemaining} dia{daysRemaining !== 1 ? 's' : ''} restante{daysRemaining !== 1 ? 's' : ''}</p>}
                    {maxUses > 0 && (
                      <p className="text-xs text-gray-300 mt-1">Ainda tem <strong className="text-white">{remainingUses} de {maxUses}</strong> usos disponíveis este mês</p>
                    )}
                  </div>
                </div>
              )}
              {/* Benefícios que serão perdidos */}
              {planBenefitsList.length > 0 && (
                <div className="p-4 rounded-xl mb-4 text-left flex items-start gap-3" style={{ backgroundColor: '#ef444410', border: '1px solid #ef444420' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <p className="text-sm font-bold text-red-400">Você perderá</p>
                    <p className="text-[11px] text-gray-500 mb-1.5">Ao cancelar, esses benefícios serão perdidos</p>
                    <ul className="space-y-1.5">
                      {planBenefitsList.slice(0, 4).map((b: string, i: number) => (
                        <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                          <X className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />{b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { if (step === 1) closeModal(() => showGerenciarModal()); else setStep(1); }} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
            <button disabled={cancelling} onClick={async () => {
              if (step === 1) { setStep(2); return; }
              setCancelling(true);
              setCancelError('');
              try {
                const result = await cancelMySubscription('Cancelado pelo cliente via site');
                // Keep subscription in state with cancelled status + endDate so UI shows remaining benefits
                if (onSubscriptionChange && subscription) {
                  onSubscriptionChange({
                    ...subscription,
                    status: 'cancelled',
                    cancelledAt: new Date().toISOString(),
                    endDate: result?.endDate || subscription.nextPaymentDate || subscription.endDate || new Date().toISOString(),
                  });
                }
                closeModal();
              } catch (err: any) {
                console.error('Cancel error:', err);
                setCancelError(err.message || 'Erro ao cancelar. Tente novamente.');
                setCancelling(false);
              }
            }} className="py-3 font-bold rounded-lg" style={{ backgroundColor: "#ef4444", color: "#fff" }}>
              {cancelling ? <Loader2 className="w-5 h-5 mx-auto booking-spin" /> : step === 1 ? "Continuar" : "Cancelar Assinatura"}
            </button>
          </div>
        </div>
      );
    };
    openModal(<CancelFlow />, "center");
  }

  function showTermosModal() {
    const storeName = g("store_name", "o Estabelecimento");
    const whatsapp = g("contact.whatsapp", "") || g("footer.whatsapp", "") || g("extras.whatsapp_number", "");
    openModal(
      <div className="p-6 max-h-[75vh] overflow-y-auto booking-scrollbar" style={{ borderRadius: '1rem' }}>
        <h3 className="text-xl font-bold text-center mb-6" style={{ color: primary }}>Termos e Condições de Uso</h3>
        <div className="space-y-5 text-sm text-gray-300 leading-relaxed">

          <div>
            <h4 className="text-white font-bold mb-2">1. OBJETIVO</h4>
            <p>Estabelecer as regras para o fornecimento de serviços de barbearia, promoções e conteúdo da <strong className="text-white">{storeName}</strong> através de assinatura recorrente.</p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-2">2. DEFINIÇÕES PRINCIPAIS</h4>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-white">Assinatura:</strong> Pagamento recorrente do assinante pelos serviços contratados.</li>
              <li><strong className="text-white">Produtos:</strong> Cosméticos (pomadas, cremes, óleos) fornecidos em kits, quando disponíveis.</li>
              <li><strong className="text-white">Cupons de Desconto:</strong> Oferecidos por parceiros para compra de produtos/serviços com desconto.</li>
              <li><strong className="text-white">Serviços:</strong> Conteúdo, consultoria e promoções oferecidas periodicamente ao assinante.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-2">3. ADESÃO E ACEITAÇÃO</h4>
            <p>Ao realizar o pagamento pela assinatura, o assinante declara ter lido e aceita integralmente estes Termos de Uso e a Política de Privacidade, em conformidade com o Marco Civil da Internet (Lei 12.965/2014) e o Código de Defesa do Consumidor (Lei 8.078/1990).</p>
            <p className="mt-2">O pagamento pode ser realizado via cartão de crédito, boleto bancário ou Pix, com renovação automática conforme a periodicidade do plano escolhido.</p>
            <p className="mt-2">A <strong className="text-white">{storeName}</strong> pode alterar estes termos com aviso prévio de 30 (trinta) dias, sendo responsabilidade do assinante revisar periodicamente as mudanças.</p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-2">4. PREÇO E CONDIÇÕES DE PAGAMENTO</h4>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-white">Pagamento Recorrente:</strong> Assinatura cobrada automaticamente conforme o meio de pagamento escolhido.</li>
              <li><strong className="text-white">Reajustes:</strong> Eventuais alterações de valor serão comunicadas com aviso prévio de 30 dias.</li>
              <li><strong className="text-white">Compras Avulsas:</strong> Produtos ou serviços adicionais podem ser cobrados separadamente, com autorização prévia.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-2">5. CANCELAMENTO E PAUSA</h4>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-white">Direito de Arrependimento (7 dias):</strong> Conforme o Art. 49 do CDC, o assinante pode cancelar em até 7 dias após a contratação, com reembolso integral, desde que nenhum serviço tenha sido utilizado.</li>
              <li><strong className="text-white">Pausa:</strong> O assinante pode solicitar pausa temporária da assinatura sem custos adicionais.</li>
              <li><strong className="text-white">Cancelamento Definitivo:</strong> Não haverá reembolso após utilização dos serviços ou se cancelado fora do prazo de arrependimento. Os benefícios permanecem ativos até o fim do período já pago.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-2">6. OBRIGAÇÕES</h4>
            <p className="font-semibold text-white mt-2">Da {storeName}:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Prestar serviços com qualidade e em conformidade com a legislação vigente.</li>
              <li>Garantir a proteção dos dados pessoais do assinante, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</li>
            </ul>
            <p className="font-semibold text-white mt-3">Do Assinante:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Em caso de inadimplência, o assinante não poderá utilizar os serviços como membro do clube até a regularização.</li>
              <li>O assinante inadimplente poderá utilizar serviços de forma avulsa ou regularizar a assinatura no momento do atendimento.</li>
              <li>Manter os dados cadastrais atualizados e realizar os pagamentos em dia.</li>
              <li>O não pagamento resultará na suspensão imediata dos benefícios da assinatura.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-2">7. VINCULAÇÃO À UNIDADE</h4>
            <p>A assinatura é válida exclusivamente na unidade selecionada no momento da contratação. A utilização dos benefícios em outras unidades não está contemplada, salvo disposição expressa em contrário pela {storeName}.</p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-2">8. LIMITAÇÕES DOS SERVIÇOS</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>É proibida a transferência de serviços para terceiros. A assinatura é pessoal e intransferível.</li>
              <li>As regras de uso (quantidade de serviços, periodicidade) variam conforme o plano contratado.</li>
              <li>Em caso de ausência sem aviso prévio a um agendamento confirmado, o serviço poderá ser considerado utilizado conforme políticas do estabelecimento.</li>
            </ul>
          </div>

          {whatsapp && (
            <div>
              <h4 className="text-white font-bold mb-2">9. ATENDIMENTO AO ASSINANTE</h4>
              <p>Suporte disponível via WhatsApp: <strong className="text-white">{whatsapp}</strong>, nos horários de funcionamento do estabelecimento.</p>
            </div>
          )}

          <div>
            <h4 className="text-white font-bold mb-2">{whatsapp ? '10' : '9'}. DADOS PESSOAIS</h4>
            <p>Os dados pessoais coletados serão tratados em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018), com finalidade exclusiva de prestação de serviço, cobrança e comunicação com o assinante.</p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-2">{whatsapp ? '11' : '10'}. DISPOSIÇÕES FINAIS</h4>
            <p>Fica eleito o foro da comarca do domicílio do consumidor para dirimir quaisquer questões oriundas deste contrato, conforme Art. 101, I do Código de Defesa do Consumidor.</p>
          </div>

        </div>
        <button onClick={() => closeModal()} className="w-full py-3 mt-6 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Entendi</button>
      </div>, "center"
    );
  }

  function showAssinarModal(plan: SubscriptionPlan) {
    openModal(
      <AssinarModal plan={plan} primary={primary} bgColor={bgColor} clientProfile={clientProfile} services={services}
        units={units} g={g} openTermosModal={showTermosModal}
        onClose={() => closeModal()}
        onSuccess={async (result: any) => {
          // Reload subscription data
          const { data: s } = await supabase.from("subscriptions").select("*, subscription_plans(*)").eq("clientId", clientProfile?.id).neq("status", "cancelled").order("createdAt", { ascending: false }).limit(1).single();
          if (s) {
            onSubscriptionChange({ ...s, plan: s.subscription_plans ? { ...s.subscription_plans, price: Number(s.subscription_plans.price) || 0 } : undefined });
          }
          if (result.finalStatus === 'active') setActiveView('agendar');
        }}
      />, "center"
    );
  }

  function showGerenciarModal() {
    if (!subscription?.plan) return;
    const isPaused = subscription.status === 'paused';
    const isOverdue = subscription.status === 'overdue';
    const canReactivate = isPaused || isOverdue;
    openModal(
      <div className="p-6" style={{ borderRadius: "1rem" }}>
        <h3 className="text-2xl font-bold text-center mb-6" style={{ color: primary }}>Gerenciar Assinatura</h3>
        <div className="p-4 rounded-lg mb-4 flex items-center justify-between" style={{ backgroundColor: "#2a2a2a" }}>
          <div>
            <p className="text-sm font-bold text-white">{subscription.plan.name}</p>
            {subscription.cardBrand && <p className="text-[11px] text-gray-500 mt-0.5">{subscription.cardBrand} ****{subscription.cardLast4}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-white">R$ {Number(subscription.plan.price).toFixed(2)}<span className="text-xs text-gray-500 font-normal">/mês</span></p>
            {isPaused && <span className="text-[10px] font-bold text-amber-400 flex items-center justify-end gap-1 mt-0.5"><Pause className="w-2.5 h-2.5" />Pausado</span>}
            {isOverdue && <span className="text-[10px] font-bold text-red-400 flex items-center justify-end gap-1 mt-0.5"><AlertTriangle className="w-2.5 h-2.5" />Inadimplente</span>}
            {subscription.nextPaymentDate && !isPaused && !isOverdue && (
              <p className="text-[10px] text-gray-500 mt-1 flex items-center justify-end gap-1">
                <Calendar className="w-2.5 h-2.5" />Próxima: {new Date(subscription.nextPaymentDate).toLocaleDateString('pt-BR')}
              </p>
            )}
            {subscription.pendingPlanId && <span className="text-[10px] font-bold text-blue-400 flex items-center justify-end gap-1 mt-0.5"><ArrowUpDown className="w-2.5 h-2.5" />Troca agendada → {subscription.pendingPlanName}</span>}
          </div>
        </div>
        <div className="space-y-3">
          {canReactivate && (
            <button onClick={() => closeModal(() => isOverdue ? showRegularizarModal() : showReativarModal())} className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
              <span className="flex items-center gap-3" style={{ color: '#22c55e' }}><RefreshCw className="w-5 h-5" />{isOverdue ? 'Regularizar assinatura' : 'Reativar assinatura'}</span>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <button onClick={() => closeModal(() => showBeneficiosModal())} className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
            <span className="flex items-center gap-3"><Award className="w-5 h-5" style={{ color: primary }} />Ver benefícios</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => closeModal(() => showHistoricoFaturasModal())} className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
            <span className="flex items-center gap-3"><Receipt className="w-5 h-5" style={{ color: primary }} />Histórico de faturas</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
          {!isPaused && !isOverdue && (
            <>
              <button onClick={() => closeModal(() => showTrocarCartaoModal())} className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
                <span className="flex items-center gap-3"><CreditCard className="w-5 h-5" style={{ color: primary }} />Trocar cartão</span>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
              <button onClick={() => closeModal(() => showTrocarPlanoModal())} className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
                <span className="flex items-center gap-3"><ArrowUpDown className="w-5 h-5" style={{ color: primary }} />Trocar plano</span>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
              {units.length > 1 && (
                <button onClick={() => closeModal(() => showTrocarUnidadeModal())} className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
                  <span className="flex items-center gap-3"><MapPin className="w-5 h-5" style={{ color: primary }} />Trocar unidade</span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              )}
              {subscription.pendingPlanId && (
                <button onClick={async () => { try { await cancelPendingPlanChange(); const { data: s } = await supabase.from("subscriptions").select("*, subscription_plans(*)").eq("clientId", clientProfile?.id).neq("status", "cancelled").order("createdAt", { ascending: false }).limit(1).single(); if (s && onSubscriptionChange) onSubscriptionChange({ ...s, plan: s.subscription_plans ? { ...s.subscription_plans, price: Number(s.subscription_plans.price) || 0 } : undefined }); closeModal(); } catch(e: any) { alert(e.message || 'Erro'); } }} className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
                  <span className="flex items-center gap-3 text-amber-400"><XCircle className="w-5 h-5" />Cancelar troca agendada ({subscription.pendingPlanName})</span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              )}
              <button onClick={() => closeModal(() => showPausarModal())} className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
                <span className="flex items-center gap-3"><Pause className="w-5 h-5" style={{ color: primary }} />Pausar assinatura</span>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </>
          )}
          <button onClick={() => closeModal(() => showCancelarModal())} className="w-full text-left p-4 rounded-lg flex items-center justify-between hover:opacity-80 transition-opacity" style={{ backgroundColor: "#2a2a2a" }}>
            <span className="flex items-center gap-3 text-red-500"><XCircle className="w-5 h-5" />Cancelar assinatura</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="mt-6">
          <button onClick={() => closeModal()} className="w-full py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        </div>
      </div>, "center"
    );
  }

  // ═══ HISTÓRICO DE FATURAS (F4) ═══
  function showHistoricoFaturasModal() {
    const HistoricoContent = () => {
      const [events, setEvents] = useState<any[]>([]);
      const [loading, setLoading] = useState(true);
      useEffect(() => {
        getMyPaymentHistory().then(e => { setEvents(e); setLoading(false); }).catch(() => setLoading(false));
      }, []);
      const statusMap: Record<string, { label: string; color: string }> = {
        CONFIRMED: { label: 'Pago', color: 'text-emerald-400' }, RECEIVED: { label: 'Recebido', color: 'text-emerald-400' },
        PENDING: { label: 'Pendente', color: 'text-amber-400' }, OVERDUE: { label: 'Atrasado', color: 'text-red-400' },
        REFUSED: { label: 'Recusado', color: 'text-red-400' }, REFUNDED: { label: 'Reembolsado', color: 'text-blue-400' },
      };
      return (
        <div className="p-6" style={{ borderRadius: "1rem" }}>
          <h3 className="text-2xl font-bold text-center mb-6" style={{ color: primary }}>Histórico de Faturas</h3>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 booking-spin" style={{ color: primary }} /></div>
          ) : events.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhuma fatura encontrada.</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {events.filter(e => ['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_CREATED','PAYMENT_OVERDUE','PAYMENT_REFUNDED'].includes(e.event)).map((ev, i) => {
                const st = statusMap[ev.status] || { label: ev.status, color: 'text-gray-400' };
                const date = ev.paymentDate || ev.dueDate || ev.processedAt;
                return (
                  <div key={i} className="p-4 rounded-lg flex items-center justify-between" style={{ backgroundColor: "#2a2a2a" }}>
                    <div>
                      <p className="text-white text-sm font-semibold">{date ? new Date(date).toLocaleDateString('pt-BR') : '—'}</p>
                      <p className={`text-xs font-bold ${st.color}`}>{st.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">R$ {Number(ev.amount || 0).toFixed(2)}</p>

                      <div className="flex gap-2 justify-end mt-1">
                        {ev.invoiceUrl && <a href={ev.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: primary }}>Fatura</a>}
                        {ev.transactionReceiptUrl && <a href={ev.transactionReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: primary }}>Comprovante</a>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-6">
            <button onClick={() => closeModal(() => showGerenciarModal())} className="w-full py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
          </div>
        </div>
      );
    };
    openModal(<HistoricoContent />, "center");
  }

  // ═══ TROCAR CARTÃO (F3) ═══
  function showTrocarCartaoModal() {
    const CardForm = () => {
      const [form, setForm] = useState({ holderName: '', number: '', expiry: '', ccv: '', cpf: '', cep: '', addressNumber: '' });
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const handleSubmit = async () => {
        if (!form.holderName || !form.number || !form.expiry || !form.ccv || !form.cpf || !form.cep) { setError('Preencha todos os campos.'); return; }
        setLoading(true); setError('');
        const [mm, yy] = form.expiry.split('/');
        try {
          const result = await updatePaymentMethod({
            creditCard: { holderName: form.holderName, number: form.number, expiryMonth: mm, expiryYear: yy?.length === 2 ? '20' + yy : yy, ccv: form.ccv },
            holderInfo: { cpfCnpj: form.cpf, email: clientProfile?.email, phone: clientProfile?.phone, postalCode: form.cep.replace(/\D/g, ''), addressNumber: form.addressNumber || '0' },
          });
          if (onSubscriptionChange && subscription) onSubscriptionChange({ ...subscription, cardBrand: result.cardBrand, cardLast4: result.cardLast4 });
          closeModal(() => openModal(
            <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
              <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#22c55e20' }}>
                <Check className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Cartão Atualizado!</h3>
              <p className="text-gray-400 text-sm mb-6">
                Agora usando <strong className="text-white">{result.cardBrand} •••• {result.cardLast4}</strong>
              </p>
              <button onClick={() => closeModal()} className="w-full py-3 font-bold rounded-lg"
                style={{ backgroundColor: primary, color: bgColor }}>Entendido</button>
            </div>, "center"
          ));
        } catch (err: any) { setError(err.message || 'Erro ao atualizar cartão.'); setLoading(false); }
      };
      return (
        <div className="p-6" style={{ borderRadius: "1rem" }}>
          <h3 className="text-2xl font-bold text-center mb-6" style={{ color: primary }}>Trocar Cartão</h3>
          {error && <div className="p-3 rounded-lg mb-4 text-sm text-red-400 border border-red-500/30" style={{ backgroundColor: '#ef444410' }}><AlertTriangle className="w-4 h-4 inline mr-2" />{error}</div>}
          <div className="space-y-4">
            <input placeholder="Nome no cartão" value={form.holderName} onChange={e => setForm(p => ({ ...p, holderName: e.target.value }))} className="w-full p-3 rounded-lg text-white placeholder-gray-500 border border-gray-700 outline-none focus:border-gray-500" style={{ backgroundColor: "#2a2a2a" }} />
            <input placeholder="Número do cartão" inputMode="numeric" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value.replace(/\D/g, '').substring(0, 16) }))} className="w-full p-3 rounded-lg text-white placeholder-gray-500 border border-gray-700 outline-none focus:border-gray-500" style={{ backgroundColor: "#2a2a2a" }} />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="MM/AA" value={form.expiry} onChange={e => { let v = e.target.value.replace(/\D/g, '').substring(0, 4); if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2); setForm(p => ({ ...p, expiry: v })); }} className="w-full p-3 rounded-lg text-white placeholder-gray-500 border border-gray-700 outline-none focus:border-gray-500" style={{ backgroundColor: "#2a2a2a" }} />
              <input placeholder="CVV" inputMode="numeric" value={form.ccv} onChange={e => setForm(p => ({ ...p, ccv: e.target.value.replace(/\D/g, '').substring(0, 4) }))} className="w-full p-3 rounded-lg text-white placeholder-gray-500 border border-gray-700 outline-none focus:border-gray-500" style={{ backgroundColor: "#2a2a2a" }} />
            </div>
            <input placeholder="CPF" inputMode="numeric" value={form.cpf} onChange={e => { let v = e.target.value.replace(/\D/g, '').substring(0, 11); if (v.length > 9) v = v.substring(0,3)+'.'+v.substring(3,6)+'.'+v.substring(6,9)+'-'+v.substring(9); else if (v.length > 6) v = v.substring(0,3)+'.'+v.substring(3,6)+'.'+v.substring(6); else if (v.length > 3) v = v.substring(0,3)+'.'+v.substring(3); setForm(p => ({ ...p, cpf: v })); }} className="w-full p-3 rounded-lg text-white placeholder-gray-500 border border-gray-700 outline-none focus:border-gray-500" style={{ backgroundColor: "#2a2a2a" }} />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="CEP" inputMode="numeric" value={form.cep} onChange={e => { let v = e.target.value.replace(/\D/g, '').substring(0, 8); if (v.length > 5) v = v.substring(0,5)+'-'+v.substring(5); setForm(p => ({ ...p, cep: v })); }} className="w-full p-3 rounded-lg text-white placeholder-gray-500 border border-gray-700 outline-none focus:border-gray-500" style={{ backgroundColor: "#2a2a2a" }} />
              <input placeholder="Nº Endereço" value={form.addressNumber} onChange={e => setForm(p => ({ ...p, addressNumber: e.target.value }))} className="w-full p-3 rounded-lg text-white placeholder-gray-500 border border-gray-700 outline-none focus:border-gray-500" style={{ backgroundColor: "#2a2a2a" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button onClick={() => closeModal(() => showGerenciarModal())} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
            <button disabled={loading} onClick={handleSubmit} className="py-3 font-bold rounded-lg flex items-center justify-center" style={{ backgroundColor: primary, color: bgColor }}>
              {loading ? <Loader2 className="w-5 h-5 booking-spin" /> : 'Atualizar'}
            </button>
          </div>
        </div>
      );
    };
    openModal(<CardForm />, "center");
  }

  // ═══ TROCAR UNIDADE (F8) ═══
  function showTrocarUnidadeModal() {
    const UnitSelector = () => {
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const [selectedUnit, setSelectedUnit] = useState('');
      const [success, setSuccess] = useState<any>(null);

      const currentUnitId = subscription?.unitId;
      const currentPlan = subscription?.plan;
      const allowedUnitIds = Array.isArray(currentPlan?.allowedUnitIds) ? currentPlan.allowedUnitIds : [];
      const availableUnits = (units || []).filter((u: any) => {
        if (u.id === currentUnitId) return false; // Exclude current
        if (currentPlan?.unitScope === 'specific' && allowedUnitIds.length > 0) {
          return allowedUnitIds.includes(u.id);
        }
        return true;
      });

      // Check if there are remaining benefits
      const endDate = subscription?.endDate || subscription?.nextPaymentDate;
      const benefitsRemaining = endDate ? new Date(endDate) > new Date() : false;

      const handleTransfer = async () => {
        if (!selectedUnit) return;
        setLoading(true); setError('');
        try {
          const result = await changeUnit(selectedUnit);
          setSuccess(result);
          // Reload subscription
          const { data: s } = await supabase.from("subscriptions").select("*, subscription_plans(*)").eq("clientId", clientProfile?.id).neq("status", "cancelled").order("createdAt", { ascending: false }).limit(1).single();
          if (s && onSubscriptionChange) {
            onSubscriptionChange({ ...s, plan: s.subscription_plans ? { ...s.subscription_plans, price: Number(s.subscription_plans.price) || 0 } : undefined });
          }
        } catch (err: any) { setError(err.message || 'Erro ao trocar unidade.'); setLoading(false); }
      };

      if (success) {
        const targetUnit = (units || []).find((u: any) => u.id === selectedUnit);
        return (
          <div className="p-6" style={{ borderRadius: "1rem" }}>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: `${primary}20` }}>
                <Check className="w-8 h-8" style={{ color: primary }} />
              </div>
              <h3 className="text-xl font-bold text-white">Transferência realizada!</h3>
              <p className="text-gray-400 text-sm">Sua assinatura foi transferida para <strong className="text-white">{targetUnit?.name || 'nova unidade'}</strong>.</p>
              {success.benefitsRemaining && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#2a2a2a' }}>
                  <p className="text-amber-400 text-xs">⚠️ Seus benefícios na unidade anterior continuam válidos até <strong>{new Date(success.benefitsEndDate).toLocaleDateString('pt-BR')}</strong>. A cobrança na nova unidade será feita somente após essa data.</p>
                </div>
              )}
              <button onClick={() => closeModal()} className="w-full py-3 font-semibold rounded-lg text-white" style={{ backgroundColor: primary }}>Entendi</button>
            </div>
          </div>
        );
      }

      return (
        <div className="p-6" style={{ borderRadius: "1rem" }}>
          <h3 className="text-2xl font-bold text-center mb-2" style={{ color: primary }}>Trocar Unidade</h3>
          <p className="text-gray-400 text-center text-sm mb-6">Selecione a unidade para onde deseja transferir sua assinatura.</p>
          {error && <div className="p-3 mb-4 rounded-lg bg-red-500/20 text-red-400 text-sm text-center">{error}</div>}
          {benefitsRemaining && (
            <div className="p-3 mb-4 rounded-lg" style={{ backgroundColor: '#332200' }}>
              <p className="text-amber-400 text-xs">⚠️ Você ainda possui benefícios até <strong>{endDate ? new Date(endDate).toLocaleDateString('pt-BR') : '—'}</strong>. Ao trocar, seus benefícios atuais continuarão válidos até essa data, e a cobrança na nova unidade será feita somente depois.</p>
            </div>
          )}
          {availableUnits.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Seu plano não está disponível em outras unidades.</p>
          ) : (
            <div className="space-y-3 max-h-[40vh] overflow-y-auto mb-6">
              {availableUnits.map((u: any) => (
                <button key={u.id} onClick={() => setSelectedUnit(u.id)}
                  className="w-full p-4 rounded-lg flex items-center gap-3 transition-all"
                  style={{ backgroundColor: selectedUnit === u.id ? `${primary}20` : '#2a2a2a', borderWidth: 2, borderColor: selectedUnit === u.id ? primary : 'transparent' }}
                >
                  <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: selectedUnit === u.id ? primary : '#888' }} />
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">{u.name}</p>
                    {u.address && <p className="text-gray-400 text-xs mt-0.5">{u.address}</p>}
                  </div>
                  {selectedUnit === u.id && <Check className="w-4 h-4 ml-auto" style={{ color: primary }} />}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => closeModal(() => showGerenciarModal())} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
            <button onClick={handleTransfer} disabled={!selectedUnit || loading}
              className="py-3 font-semibold rounded-lg text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: primary }}
            >
              {loading ? <Loader2 className="w-5 h-5 booking-spin mx-auto" /> : 'Transferir'}
            </button>
          </div>
        </div>
      );
    };
    openModal(<UnitSelector />, "center");
  }

  // ═══ TROCAR PLANO (F6) ═══
  function showTrocarPlanoModal() {
    const PlanSelector = () => {
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const [selectedPlanId, setSelectedPlanId] = useState('');
      const availablePlans = (plans || []).filter((p: SubscriptionPlan) => p.active && p.availableForSale && p.id !== subscription?.planId && p.id !== subscription?.pendingPlanId);
      const handleChange = async () => {
        if (!selectedPlanId) { setError('Selecione um plano.'); return; }
        setLoading(true); setError('');
        try {
          const result = await changePlan(selectedPlanId);
          // Reload subscription
          const { data: s } = await supabase.from("subscriptions").select("*, subscription_plans(*)").eq("clientId", clientProfile?.id).neq("status", "cancelled").order("createdAt", { ascending: false }).limit(1).single();
          if (s && onSubscriptionChange) onSubscriptionChange({ ...s, plan: s.subscription_plans ? { ...s.subscription_plans, price: Number(s.subscription_plans.price) || 0 } : undefined });
          const fmtDate = result.scheduledDate ? new Date(result.scheduledDate).toLocaleDateString('pt-BR') : '';
          closeModal(() => openModal(
            <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
              <Check className="w-14 h-14 mx-auto mb-4" style={{ color: primary }} />
              <h3 className="text-2xl font-bold mb-2" style={{ color: primary }}>Troca Agendada!</h3>
              <p className="text-gray-400 mb-6">Seu plano será alterado para <strong className="text-white">{result.newPlanName}</strong> a partir de <strong className="text-white">{fmtDate}</strong>.</p>
              <button onClick={() => closeModal()} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Entendido</button>
            </div>, "center"
          ));
        } catch (err: any) { setError(err.message || 'Erro ao trocar plano.'); setLoading(false); }
      };
      return (
        <div className="p-6" style={{ borderRadius: "1rem" }}>
          <h3 className="text-2xl font-bold text-center mb-2" style={{ color: primary }}>Trocar Plano</h3>
          <p className="text-gray-400 text-center text-sm mb-6">A alteração vale a partir da próxima cobrança</p>
          {error && <div className="p-3 rounded-lg mb-4 text-sm text-red-400 border border-red-500/30" style={{ backgroundColor: '#ef444410' }}><AlertTriangle className="w-4 h-4 inline mr-2" />{error}</div>}
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {availablePlans.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Nenhum outro plano disponível.</p>
            ) : availablePlans.map((p: SubscriptionPlan) => {
              const isSelected = selectedPlanId === p.id;
              const priceDirection = Number(p.price) > Number(subscription?.plan?.price || 0) ? '↑' : '↓';
              return (
                <button key={p.id} onClick={() => setSelectedPlanId(p.id)} className="w-full text-left p-4 rounded-lg border-2 transition-all" style={{ backgroundColor: "#2a2a2a", borderColor: isSelected ? primary : '#333' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">{p.name}</span>
                    <span className="font-bold" style={{ color: isSelected ? primary : '#fff' }}>{priceDirection} R$ {Number(p.price).toFixed(2)}/mês</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button onClick={() => closeModal(() => showGerenciarModal())} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
            <button disabled={loading || !selectedPlanId} onClick={handleChange} className="py-3 font-bold rounded-lg flex items-center justify-center" style={{ backgroundColor: primary, color: bgColor, opacity: selectedPlanId ? 1 : 0.5 }}>
              {loading ? <Loader2 className="w-5 h-5 booking-spin" /> : 'Confirmar'}
            </button>
          </div>
        </div>
      );
    };
    openModal(<PlanSelector />, "center");
  }

  // ═══ COMPARAR E TROCAR PLANO (modal dedicado por plano) ═══
  function showCompararPlanoModal(targetPlan: SubscriptionPlan) {
    const currentPlan = subscription?.plan;
    if (!currentPlan) return;
    const currentPrice = Number(currentPlan.price) || 0;
    const targetPrice = Number(targetPlan.price) || 0;
    const diff = targetPrice - currentPrice;
    const isUpgrade = diff > 0;
    const currentBenefits = typeof currentPlan.benefits === 'string' ? JSON.parse(currentPlan.benefits || '[]') : (currentPlan.benefits || []);
    const targetBenefits = typeof targetPlan.benefits === 'string' ? JSON.parse(targetPlan.benefits || '[]') : (targetPlan.benefits || []);
    const currentServices = safeParseJsonArray(currentPlan.planServices);
    const targetServices = safeParseJsonArray(targetPlan.planServices);

    const CompareFlow = () => {
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const [confirmed, setConfirmed] = useState(false);
      const [scheduledDate, setScheduledDate] = useState('');

      const handleSwitch = async () => {
        setLoading(true); setError('');
        try {
          const result = await changePlan(targetPlan.id);
          const { data: s } = await supabase.from("subscriptions").select("*, subscription_plans(*)").eq("clientId", clientProfile?.id).neq("status", "cancelled").order("createdAt", { ascending: false }).limit(1).single();
          if (s && onSubscriptionChange) onSubscriptionChange({ ...s, plan: s.subscription_plans ? { ...s.subscription_plans, price: Number(s.subscription_plans.price) || 0 } : undefined });
          setScheduledDate(result.scheduledDate || '');
          setConfirmed(true);
        } catch (err: any) { setError(err.message || 'Erro ao trocar plano.'); setLoading(false); }
      };

      if (confirmed) {
        const fmtDate = scheduledDate ? new Date(scheduledDate).toLocaleDateString('pt-BR') : '';
        return (
          <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
            <Check className="w-14 h-14 mx-auto mb-4" style={{ color: primary }} />
            <h3 className="text-2xl font-bold mb-2" style={{ color: primary }}>Troca Agendada!</h3>
            <p className="text-gray-400 mb-6">Seu plano será alterado para <strong className="text-white">{targetPlan.name}</strong> a partir de <strong className="text-white">{fmtDate}</strong>.</p>
            <button onClick={() => closeModal()} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Entendido</button>
          </div>
        );
      }

      return (
        <div className="p-6" style={{ borderRadius: "1rem" }}>
          <h3 className="text-2xl font-bold text-center mb-1" style={{ color: primary }}>Trocar de Plano</h3>
          <p className="text-gray-400 text-center text-sm mb-6">A alteração vale a partir da próxima cobrança</p>
          {error && <div className="p-3 rounded-lg mb-4 text-sm text-red-400 border border-red-500/30" style={{ backgroundColor: '#ef444410' }}><AlertTriangle className="w-4 h-4 inline mr-2" />{error}</div>}

          {/* Comparativo visual */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Plano atual */}
            <div className="p-4 rounded-xl border border-gray-700" style={{ backgroundColor: '#1a1a1a' }}>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Plano atual</p>
              <p className="text-sm font-bold text-white mb-1">{currentPlan.name}</p>
              <p className="text-lg font-bold text-gray-400">R$ {currentPrice.toFixed(2)}<span className="text-xs text-gray-500">/mês</span></p>
              {currentPlan.maxUsesPerMonth ? (
                <p className="text-[10px] text-gray-500 mt-1">{currentPlan.maxUsesPerMonth} usos/mês</p>
              ) : (
                <p className="text-[10px] text-gray-500 mt-1">Uso ilimitado</p>
              )}
            </div>
            {/* Novo plano */}
            <div className="p-4 rounded-xl border-2" style={{ backgroundColor: '#111', borderColor: primary }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: primary }}>Novo plano</p>
              <p className="text-sm font-bold text-white mb-1">{targetPlan.name}</p>
              <p className="text-lg font-bold" style={{ color: primary }}>R$ {targetPrice.toFixed(2)}<span className="text-xs text-gray-400">/mês</span></p>
              {targetPlan.maxUsesPerMonth ? (
                <p className="text-[10px] text-gray-400 mt-1">{targetPlan.maxUsesPerMonth} usos/mês</p>
              ) : (
                <p className="text-[10px] text-gray-400 mt-1">Uso ilimitado</p>
              )}
            </div>
          </div>

          {/* Diferença de preço */}
          <div className="p-3 rounded-xl mb-5 flex items-center justify-between" style={{ backgroundColor: isUpgrade ? '#22c55e10' : '#3b82f610', border: `1px solid ${isUpgrade ? '#22c55e25' : '#3b82f625'}` }}>
            <span className="text-xs text-gray-400">Diferença mensal</span>
            <span className="text-sm font-bold" style={{ color: isUpgrade ? '#4ade80' : '#60a5fa' }}>
              {diff > 0 ? '+' : ''}{diff === 0 ? 'Mesmo valor' : `R$ ${diff.toFixed(2)}/mês`}
            </span>
          </div>

          {/* Benefícios do novo plano */}
          {targetBenefits.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Benefícios inclusos</p>
              <div className="space-y-1.5">
                {targetBenefits.map((b: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: primary }} />
                    <span className="text-xs text-gray-300">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Serviços com desconto do novo plano */}
          {targetServices.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Serviços com desconto</p>
              <div className="space-y-1.5">
                {targetServices.map((s: any, i: number) => {
                  const svc = (services || []).find((sv: any) => sv.id === s.serviceId);
                  return svc ? (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">{svc.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${primary}20`, color: primary }}>{Number(s.discount)}% off</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => closeModal()} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
            <button disabled={loading} onClick={handleSwitch}
              className="py-3 font-bold rounded-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: primary, color: bgColor }}>
              {loading ? <Loader2 className="w-5 h-5 booking-spin" /> : <><ArrowUpDown className="w-4 h-4" />Trocar</>}
            </button>
          </div>
        </div>
      );
    };
    openModal(<CompareFlow />, "center");
  }

  // ═══ REGULARIZAR ASSINATURA (overdue) ═══
  function showRegularizarModal() {
    if (!subscription?.plan) return;
    const whatsappNumber = g("footer.whatsapp", "") || g("extras.whatsapp_number", "");

    const RegularizarFlow = () => {
      const [retrying, setRetrying] = useState(false);
      const [retryDone, setRetryDone] = useState(false);
      const [retryError, setRetryError] = useState('');

      const handleRetry = async () => {
        setRetrying(true); setRetryError('');
        try {
          await retryPayment();
          setRetryDone(true);
        } catch (err: any) {
          setRetryError(err.message || 'Erro ao solicitar nova cobrança.');
        } finally { setRetrying(false); }
      };

      if (retryDone) {
        return (
          <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
            <Check className="w-14 h-14 mx-auto mb-4 text-green-400" />
            <h3 className="text-xl font-bold mb-2 text-white">Cobrança solicitada!</h3>
            <p className="text-gray-400 text-sm mb-6">Solicitamos uma nova tentativa de cobrança no seu cartão. Você será notificado quando o pagamento for processado.</p>
            <button onClick={() => closeModal()} className="w-full py-2.5 text-sm font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Entendido</button>
          </div>
        );
      }

      return (
        <div className="p-6" style={{ borderRadius: "1rem" }}>
          <h3 className="text-xl font-bold text-center mb-1" style={{ color: primary }}>Regularizar Assinatura</h3>
          <p className="text-gray-400 text-center text-sm mb-6">Escolha como deseja resolver o pagamento pendente</p>
          {retryError && <div className="p-3 rounded-lg mb-4 text-sm text-red-400 border border-red-500/30" style={{ backgroundColor: '#ef444410' }}><AlertTriangle className="w-4 h-4 inline mr-2" />{retryError}</div>}
          <div className="space-y-3">
            {/* Option 1: Retry payment */}
            {subscription.gatewaySubscriptionId && (
              <button disabled={retrying} onClick={handleRetry} className="w-full text-left p-4 rounded-xl flex items-center gap-4 hover:opacity-80 transition-opacity" style={{ backgroundColor: '#22c55e15', border: '1px solid #22c55e30' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#22c55e25' }}>
                  {retrying ? <Loader2 className="w-5 h-5 text-green-400 booking-spin" /> : <RefreshCw className="w-5 h-5 text-green-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Tentar nova cobrança</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Solicitar nova tentativa no cartão cadastrado</p>
                </div>
              </button>
            )}
            {/* Option 2: Change card */}
            <button onClick={() => closeModal(() => showReativarModal())} className="w-full text-left p-4 rounded-xl flex items-center gap-4 hover:opacity-80 transition-opacity" style={{ backgroundColor: '#2a2a2a' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15` }}>
                <CreditCard className="w-5 h-5" style={{ color: primary }} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Trocar cartão e pagar</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Cadastrar novo cartão para regularizar</p>
              </div>
            </button>
            {/* Option 3: Contact */}
            {whatsappNumber ? (
              <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Preciso de ajuda para regularizar minha assinatura.")}`} target="_blank" rel="noopener noreferrer"
                className="w-full text-left p-4 rounded-xl flex items-center gap-4 hover:opacity-80 transition-opacity block" style={{ backgroundColor: '#2a2a2a' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#25D36615' }}>
                  <Phone className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Entrar em contato</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Falar com a barbearia via WhatsApp</p>
                </div>
              </a>
            ) : (
              <div className="w-full text-left p-4 rounded-xl flex items-center gap-4" style={{ backgroundColor: '#2a2a2a' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15` }}>
                  <Phone className="w-5 h-5" style={{ color: primary }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Entrar em contato</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Entre em contato com a barbearia para regularizar</p>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => closeModal()} className="w-full py-2.5 text-sm font-semibold rounded-lg border border-gray-600 mt-6" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        </div>
      );
    };
    openModal(<RegularizarFlow />, "center");
  }

  // ═══ REATIVAR ASSINATURA (F1) — Modal Dedicado ═══
  function showReativarModal() {
    if (!subscription?.plan) return;
    const hasSavedCard = !!(subscription.creditCardToken && subscription.cardBrand && subscription.cardLast4);
    const whatsappNumber = g("footer.whatsapp", "") || g("extras.whatsapp_number", "");
    const planPrice = Number((subscription.plan as SubscriptionPlan).creditPrice) || Number((subscription.plan as SubscriptionPlan).price) || 0;

    const ReativarFlow = () => {
      const [step, setStep] = useState<'options' | 'confirm' | 'processing' | 'result'>('options');
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const [result, setResult] = useState<any>(null);

      const handleSavedCard = async () => {
        setLoading(true);
        setError('');
        setStep('processing');
        try {
          const res = await reactivateWithSavedCard();
          setResult(res);
          setStep('result');
          // Refresh subscription state
          const { data: s } = await supabase.from("subscriptions").select("*, subscription_plans(*)").eq("clientId", clientProfile?.id).neq("status", "cancelled").order("createdAt", { ascending: false }).limit(1).single();
          if (s) onSubscriptionChange({ ...s, plan: s.subscription_plans ? { ...s.subscription_plans, price: Number(s.subscription_plans.price) || 0 } : undefined });
        } catch (err: any) {
          setError(err.message || 'Erro ao reativar.');
          // If saved card failed, go back to options
          setStep('options');
        } finally { setLoading(false); }
      };

      const handleNewCard = () => {
        closeModal(() => {
          openModal(
            <AssinarModal plan={subscription!.plan as SubscriptionPlan} primary={primary} bgColor={bgColor} clientProfile={clientProfile} services={services}
              units={units} g={g} openTermosModal={showTermosModal}
              onClose={() => closeModal()}
              isReactivation={true}
              onSuccess={async (result: any) => {
                const { data: s } = await supabase.from("subscriptions").select("*, subscription_plans(*)").eq("clientId", clientProfile?.id).neq("status", "cancelled").order("createdAt", { ascending: false }).limit(1).single();
                if (s) onSubscriptionChange({ ...s, plan: s.subscription_plans ? { ...s.subscription_plans, price: Number(s.subscription_plans.price) || 0 } : undefined });
                if (result.finalStatus === 'active') setActiveView('agendar');
              }}
            />, "center"
          );
        });
      };

      // Processing screen
      if (step === 'processing') return (
        <div className="p-8 text-center" style={{ borderRadius: '1rem' }}>
          <Loader2 className="w-10 h-10 mx-auto mb-4 booking-spin" style={{ color: primary }} />
          <h3 className="text-lg font-bold text-white mb-2">Processando reassinatura...</h3>
          <p className="text-sm text-gray-400">Estamos reativando seu plano com o cartão salvo.</p>
        </div>
      );

      // Result screen
      if (step === 'result' && result) return (
        <div className="p-6 text-center" style={{ borderRadius: '1rem' }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#22c55e20' }}>
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Plano Reativado!</h3>
          <p className="text-sm text-gray-400 mb-4">Sua assinatura foi reativada com sucesso.</p>
          <div className="p-4 rounded-xl mb-6" style={{ backgroundColor: '#2a2a2a' }}>
            <div className="flex justify-between text-sm mb-2"><span className="text-gray-400">Plano</span><span className="text-white font-semibold">{result.planName}</span></div>
            <div className="flex justify-between text-sm mb-2"><span className="text-gray-400">Valor</span><span className="text-white font-semibold">R$ {Number(result.planPrice).toFixed(2)}/mês</span></div>
            {result.cardBrand && <div className="flex justify-between text-sm"><span className="text-gray-400">Cartão</span><span className="text-white">{result.cardBrand} •••• {result.cardLast4}</span></div>}
          </div>
          <button onClick={() => { closeModal(); if (result.finalStatus === 'active') setActiveView('agendar'); }} className="w-full py-3 text-sm font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>
            {result.finalStatus === 'active' ? 'Agendar Agora' : 'Entendido'}
          </button>
        </div>
      );

      // Confirm screen (saved card)
      if (step === 'confirm') return (
        <div className="p-6" style={{ borderRadius: '1rem' }}>
          <h3 className="text-xl font-bold text-center mb-1" style={{ color: primary }}>Confirmar Reassinatura</h3>
          <p className="text-gray-400 text-center text-sm mb-6">Revise os dados antes de confirmar</p>
          <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: '#2a2a2a' }}>
            <div className="flex justify-between text-sm mb-3"><span className="text-gray-400">Plano</span><span className="text-white font-semibold">{subscription!.plan!.name}</span></div>
            <div className="flex justify-between text-sm mb-3"><span className="text-gray-400">Valor</span><span className="text-white font-semibold">R$ {planPrice.toFixed(2)}<span className="text-xs text-gray-500 font-normal">/mês</span></span></div>
            <div className="border-t border-gray-700 my-3" />
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-semibold text-white">{subscription!.cardBrand} •••• {subscription!.cardLast4}</p>
                <p className="text-[11px] text-gray-500">Cartão salvo</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center mb-4">
            <AlertTriangle className="w-3 h-3 inline mr-1" />A cobrança será realizada imediatamente
          </p>
          {error && <div className="p-3 rounded-lg mb-4 text-sm text-red-400 border border-red-500/30" style={{ backgroundColor: '#ef444410' }}><AlertTriangle className="w-4 h-4 inline mr-2" />{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setStep('options')} className="py-3 font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
            <button disabled={loading} onClick={handleSavedCard} className="py-3 font-bold rounded-lg flex items-center justify-center gap-2" style={{ backgroundColor: primary, color: bgColor }}>
              {loading ? <Loader2 className="w-5 h-5 booking-spin" /> : <><RefreshCw className="w-4 h-4" />Confirmar</>}
            </button>
          </div>
        </div>
      );

      // Options screen (main)
      return (
        <div className="p-6" style={{ borderRadius: '1rem' }}>
          <h3 className="text-2xl font-bold text-center mb-1" style={{ color: primary }}>Reassinar Plano</h3>
          <p className="text-gray-400 text-center text-sm mb-6">Escolha como deseja reativar sua assinatura</p>
          {/* Plan summary */}
          <div className="p-4 rounded-xl mb-5 flex items-center justify-between" style={{ backgroundColor: '#2a2a2a' }}>
            <div>
              <p className="text-sm font-bold text-white">{subscription!.plan!.name}</p>
              {hasSavedCard && <p className="text-[11px] text-gray-500 mt-0.5">{subscription!.cardBrand} •••• {subscription!.cardLast4}</p>}
            </div>
            <p className="text-sm font-bold text-white">R$ {planPrice.toFixed(2)}<span className="text-xs text-gray-500 font-normal">/mês</span></p>
          </div>
          {error && <div className="p-3 rounded-lg mb-4 text-sm text-red-400 border border-red-500/30" style={{ backgroundColor: '#ef444410' }}><AlertTriangle className="w-4 h-4 inline mr-2" />{error}</div>}
          <div className="space-y-3">
            {/* Option 1: Saved card (only if token exists) */}
            {hasSavedCard && (
              <button onClick={() => setStep('confirm')} className="w-full text-left p-4 rounded-xl flex items-center gap-4 hover:opacity-80 transition-opacity" style={{ backgroundColor: `${primary}10`, border: `1px solid ${primary}30` }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}20` }}>
                  <CreditCard className="w-5 h-5" style={{ color: primary }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Reassinar com cartão salvo</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{subscription!.cardBrand} •••• {subscription!.cardLast4} — reativar em 1 clique</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
              </button>
            )}
            {/* Option 2: New card */}
            <button onClick={handleNewCard} className="w-full text-left p-4 rounded-xl flex items-center gap-4 hover:opacity-80 transition-opacity" style={{ backgroundColor: '#2a2a2a' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15` }}>
                <RefreshCw className="w-5 h-5" style={{ color: primary }} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{hasSavedCard ? 'Usar outro cartão' : 'Cadastrar cartão'}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{hasSavedCard ? 'Cadastrar novo método de pagamento' : 'Informe os dados do cartão de crédito'}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
            </button>
            {/* Option 3: WhatsApp */}
            {whatsappNumber && (
              <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Gostaria de tirar dúvidas sobre minha assinatura.")}`} target="_blank" rel="noopener noreferrer"
                className="w-full text-left p-4 rounded-xl flex items-center gap-4 hover:opacity-80 transition-opacity block" style={{ backgroundColor: '#2a2a2a' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#25D36615' }}>
                  <Phone className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Tirar dúvidas</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Falar via WhatsApp</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
              </a>
            )}
          </div>
          <button onClick={() => closeModal()} className="w-full mt-4 py-2.5 text-sm font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Voltar</button>
        </div>
      );
    };

    openModal(<ReativarFlow />, "center");
  }

  const isSuspended = subscription?.status === 'overdue' || subscription?.status === 'paused';

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
              {(() => {
                const statusMap: Record<string, { bg: string; color: string; label: string }> = {
                  active: { bg: '#22c55e33', color: '#4ade80', label: 'Ativo' },
                  overdue: { bg: '#ef444433', color: '#f87171', label: 'Inadimplente' },
                  paused: { bg: '#eab30833', color: '#fbbf24', label: 'Pausado' },
                  pending_payment: { bg: '#3b82f633', color: '#60a5fa', label: 'Aguardando Pgto' },
                  cancelled: { bg: '#ef444433', color: '#f87171', label: 'Cancelado' },
                };
                const st = statusMap[subscription.status] || statusMap.pending_payment;
                return <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>;
              })()}
            </div>
            {/* ═══ Alert banner for overdue/paused/cancelled ═══ */}
            {subscription.status === 'cancelled' && subscription.endDate && (
              <div className="p-4 rounded-xl mt-4 flex items-start gap-3"
                style={{ backgroundColor: '#ef444415', border: '1px solid #ef444440' }}>
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: '#f87171' }}>Assinatura cancelada</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Seus benefícios continuam válidos até{' '}
                    <strong className="text-white">{new Date(subscription.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>.
                    Após essa data, os descontos do plano deixarão de ser aplicados.
                  </p>
                  {(() => {
                    const daysLeft = Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / 86400000);
                    return daysLeft > 0 ? (
                      <div className="mt-3 flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: '#ef444410' }}>
                        <span className="text-lg font-bold" style={{ color: primary }}>{daysLeft}</span>
                        <span className="text-xs text-gray-400">{daysLeft === 1 ? 'dia restante' : 'dias restantes'}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
            {(subscription.status === 'overdue' || subscription.status === 'paused') && (
              <div className="p-4 rounded-xl mt-4 flex items-start gap-3"
                style={{ backgroundColor: subscription.status === 'overdue' ? '#ef444415' : '#eab30815',
                         border: `1px solid ${subscription.status === 'overdue' ? '#ef444440' : '#eab30840'}` }}>
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5"
                  style={{ color: subscription.status === 'overdue' ? '#f87171' : '#fbbf24' }} />
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: subscription.status === 'overdue' ? '#f87171' : '#fbbf24' }}>
                    {subscription.status === 'overdue' ? 'Pagamento pendente' : 'Assinatura pausada'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {subscription.status === 'overdue'
                      ? 'Seus benefícios estão suspensos. Regularize para voltar a aproveitar seu plano.'
                      : 'Seus benefícios estão suspensos. Reative quando quiser voltar a aproveitar.'}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-4 space-y-4">
              {(() => {
                const planSvcs = safeParseJsonArray(subscription.plan.planServices);
                const hasPerServiceLimits = planSvcs.some((ps: any) => ps.monthlyLimit || ps.discount);
                const globalMax = subscription.plan.maxUsesPerMonth;
                const usedTotal = subscription.usesThisMonth || 0;

                if (hasPerServiceLimits && planSvcs.length > 0) {
                  // Per-service grid
                  return (
                    <>
                      <div className={`grid ${planSvcs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                        {planSvcs.map((ps: any) => {
                          const svc = (services || []).find((s: any) => s.id === ps.serviceId);
                          if (!svc) return null;
                          const limit = ps.monthlyLimit;
                          const disc = Number(ps.discount) || 0;
                          return (
                            <div key={ps.serviceId} className="p-3 rounded-xl" style={{ backgroundColor: '#2a2a2a', opacity: isSuspended ? 0.5 : 1 }}>
                              <div className="flex items-center gap-2 mb-2">
                                <Scissors className="w-3.5 h-3.5" style={{ color: primary }} />
                                <span className="text-xs font-semibold text-white truncate">{svc.name}</span>
                              </div>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: disc === 100 ? '#22c55e20' : `${primary}20`, color: disc === 100 ? '#4ade80' : primary }}>
                                {disc === 100 ? 'Incluso' : `${disc}% OFF`}
                              </span>
                              {limit ? (
                                <div className="mt-2">
                                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span>Limite</span>
                                    <span>{limit}x/mês</span>
                                  </div>
                                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full" style={{ backgroundColor: isSuspended ? '#555' : primary, width: `${Math.min(100, (usedTotal / limit) * 100)}%` }} />
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2 flex items-center gap-1">
                                  <InfinityIcon className="w-3 h-3 text-gray-500" />
                                  <span className="text-[10px] text-gray-500">Ilimitado</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Global progress bar */}
                      {globalMax ? (
                        <div>
                          <div className="flex justify-between mb-1 text-xs font-medium" style={{ color: "#d1d5db" }}>
                            <span>Uso total</span>
                            <span>{usedTotal} de {globalMax}</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div className="h-2.5 rounded-full booking-progress-bar" style={{ backgroundColor: isSuspended ? "#555" : primary, width: `${Math.min(100, (usedTotal / globalMax) * 100)}%` }} />
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                } else if (globalMax) {
                  // Legacy global-only view
                  return (
                    <>
                      <div className="grid grid-cols-4 gap-3">
                        {Array.from({ length: globalMax }).map((_: any, i: number) => {
                          const isUsed = i < usedTotal;
                          return (
                            <div key={i} className="booking-service-icon" style={{
                              backgroundColor: isSuspended ? "#2a2a2a" : (isUsed ? "#374151" : "#1e1e1e"),
                              color: isSuspended ? "#555" : (isUsed ? "#9ca3af" : primary),
                              border: isSuspended ? "1px solid #333" : (isUsed ? "none" : `1px solid ${primary}`),
                              opacity: isSuspended ? 0.5 : 1,
                            }}>
                              <Scissors className="w-5 h-5" />
                              <span className="text-xs mt-1">{isSuspended ? "—" : (isUsed ? "Usado" : "Livre")}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div>
                        <div className="flex justify-between mb-1 text-xs font-medium" style={{ color: "#d1d5db" }}>
                          <span>Progresso</span>
                          <span>{usedTotal} de {globalMax}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                          <div className="h-2.5 rounded-full booking-progress-bar" style={{ backgroundColor: isSuspended ? "#555" : primary, width: `${Math.min(100, (usedTotal / globalMax) * 100)}%` }} />
                        </div>
                      </div>
                    </>
                  );
                } else {
                  // Unlimited
                  return (
                    <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: '#2a2a2a' }}>
                      <InfinityIcon className="w-6 h-6" style={{ color: primary }} />
                      <div>
                        <p className="text-white font-semibold">Uso ilimitado</p>
                        <p className="text-xs text-gray-400">{usedTotal} utilizações este mês</p>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
            {/* Next payment date */}
            {subscription.nextPaymentDate && (subscription.status === 'active' || subscription.status === 'pending_payment') && (
              <div className="flex items-center gap-2 mt-4 p-3 rounded-lg" style={{ backgroundColor: '#2a2a2a' }}>
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">Próxima cobrança</span>
                <span className="ml-auto text-sm font-semibold text-white">
                  {new Date(subscription.nextPaymentDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            )}
            {/* Card on file info */}
            {subscription.cardBrand && (
              <div className="flex items-center gap-2 mt-4 p-3 rounded-lg" style={{ backgroundColor: '#2a2a2a' }}>
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">{subscription.cardBrand} •••• {subscription.cardLast4}</span>
                <span className="ml-auto text-xs" style={{ color: subscription.status === 'overdue' ? '#f87171' : '#6b7280' }}>
                  {subscription.status === 'overdue' ? 'Pgto recusado' : 'Cartão ativo'}
                </span>
              </div>
            )}
            {/* ═══ CTA direto para overdue/paused ═══ */}
            {subscription.status === 'paused' && (
              <button onClick={showReativarModal}
                className="w-full py-2.5 text-sm font-bold rounded-lg mt-4 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: primary, color: bgColor }}>
                <RefreshCw className="w-4 h-4" />
                Reativar Assinatura
              </button>
            )}
            {subscription.status === 'overdue' && (
              <button onClick={showRegularizarModal}
                className="w-full py-2.5 text-sm font-bold rounded-lg mt-4 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#22c55e', color: '#fff' }}>
                <RefreshCw className="w-4 h-4" />
                Regularizar Assinatura
              </button>
            )}
            {subscription.status === 'cancelled' && (
              <button onClick={showReativarModal}
                className="w-full py-2.5 text-sm font-bold rounded-lg mt-4 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: primary, color: bgColor }}>
                <RefreshCw className="w-4 h-4" />
                Reassinar Plano
              </button>
            )}
            <div className="border-t border-gray-700 my-5" />
            {subscription.startDate && subscription.status !== 'cancelled' && (
              <p className="text-[10px] text-gray-500 text-center mb-3">
                Membro desde {new Date(subscription.startDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            )}
            <div className={`grid ${subscription.status === 'cancelled' ? '' : 'grid-cols-2'} gap-3`}>
              {subscription.status !== 'cancelled' && (
                <button onClick={showGerenciarModal} className="py-2 text-sm font-semibold rounded-lg border border-gray-600" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>Gerenciar</button>
              )}
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
          const isPending = subscription?.pendingPlanId === plan.id;
          return (
            <div key={plan.id} className="booking-plan-card rounded-xl overflow-hidden" style={{ backgroundColor: "#000", borderColor: isCurrent ? primary : "#444" }}>
              {isCurrent && <div className="text-center py-1.5 font-bold text-sm" style={{ backgroundColor: primary, color: bgColor }}>SEU PLANO ATUAL</div>}
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 text-white">{plan.name}</h3>
                <div className="flex items-baseline mb-6">
                  <span className="text-4xl font-bold" style={{ color: primary }}>R${plan.price.toFixed(2)}</span>
                  <span className="text-gray-400 ml-1">/{plan.recurrence === "monthly" ? "mês" : plan.recurrence}</span>
                </div>
                <ul className="space-y-3 mb-4 text-gray-300 text-sm">
                  {(plan.benefits || []).map((b: string, i: number) => (
                    <li key={i} className="flex items-start"><Check className="w-4 h-4 mr-3 mt-0.5 flex-shrink-0" style={{ color: primary }} /><span>{b}</span></li>
                  ))}
                </ul>
                {/* Services with discount */}
                {(() => {
                  const psvcs = safeParseJsonArray(plan.planServices);
                  return psvcs.length > 0 ? (
                    <div className="space-y-2 mb-6">
                      {psvcs.map((ps: any, i: number) => {
                        const svc = (services || []).find((sv: any) => sv.id === ps.serviceId);
                        if (!svc) return null;
                        const disc = Number(ps.discount) || 0;
                        return (
                          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg" style={{ backgroundColor: '#1a1a1a' }}>
                            <div className="flex items-center gap-2">
                              <Scissors className="w-3.5 h-3.5" style={{ color: primary }} />
                              <span className="text-sm text-gray-300">{svc.name}</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: disc === 100 ? '#22c55e20' : `${primary}20`, color: disc === 100 ? '#4ade80' : primary }}>
                              {disc === 100 ? 'Incluso' : `${disc}% OFF`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div className="mb-6" />;
                })()}
                {isCurrent && (subscription?.status === 'overdue' || subscription?.status === 'paused' || subscription?.status === 'cancelled') ? (
                  <button onClick={() => subscription.status === 'cancelled' ? showReativarModal() : subscription.status === 'overdue' ? showRegularizarModal() : showReativarModal()}
                    className="w-full py-2.5 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                    style={{ backgroundColor: subscription.status === 'cancelled' ? primary : '#22c55e', color: subscription.status === 'cancelled' ? bgColor : '#fff' }}>
                    <RefreshCw className="w-4 h-4" />
                    {subscription.status === 'overdue' ? 'Regularizar' : subscription.status === 'cancelled' ? 'Reassinar Plano' : 'Reativar'}
                  </button>
                ) : (
                  <button disabled={(isCurrent && subscription?.status !== 'cancelled') || isPending}
                    onClick={() => {
                      if (!authUser) { onLogin(); return; }
                      if (subscription && subscription.status === 'overdue') {
                        showRegularizarModal();
                        return;
                      }
                      if (subscription && subscription.status !== 'cancelled') {
                        showCompararPlanoModal(plan);
                      } else {
                        showAssinarModal(plan);
                      }
                    }}
                    className="w-full py-3 font-bold rounded-lg transition-colors"
                    style={{ backgroundColor: (isCurrent && subscription?.status !== 'cancelled') || isPending ? "#4a4a4a" : primary, color: (isCurrent && subscription?.status !== 'cancelled') || isPending ? "#888" : bgColor, cursor: (isCurrent && subscription?.status !== 'cancelled') || isPending ? "not-allowed" : "pointer" }}>
                    {(isCurrent && subscription?.status !== 'cancelled') ? "Seu Plano Atual" : isPending ? "Troca Agendada ✓" : subscription?.status === 'overdue' ? "Regularize para trocar" : (subscription && subscription.status !== 'cancelled') ? "Trocar para este Plano" : "Assinar Plano"}
                  </button>
                )}
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
            const whatsapp = g("contact.whatsapp", "") || g("footer.whatsapp", "") || g("extras.whatsapp_number", "");
            if (whatsapp) window.open(`https://wa.me/${whatsapp.replace(/\D/g, "")}`, "_blank");
          }} className="w-full py-3 font-bold rounded-lg flex items-center justify-center gap-2 transition-colors" style={{ backgroundColor: '#25D366', color: '#fff' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            Fale Conosco
          </button>
          <button onClick={() => showTermosModal()} className="w-full py-3 font-bold rounded-lg transition-colors" style={{ backgroundColor: '#222', color: '#9ca3af', border: '1px solid #333' }}>Termos e Serviços</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PERFIL VIEW (complete)
// ============================================================
function PerfilView({ g, primary, bgColor, cardBg, authUser, clientProfile, clientSubscription, allEvents, barbers, units, goals, services, onLogin, openModal, closeModal, onLogout, onProfileUpdate, setActiveView, updateSelection, resetSelection, pushSubscribed, pushSupported, onPushSubscribe, onPushUnsubscribe }: any) {
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

  // Smart greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Member since
  const memberSince = clientProfile?.createdAt ? new Date(clientProfile.createdAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : null;

  // Client stats from events
  const myEvents = (allEvents || []).filter((e: any) => e.clientId === clientProfile?.id && e.status !== "cancelled" && e.status !== "no_show");
  const completedEvents = myEvents.filter((e: any) => { const d = new Date(e.year, e.month, e.date); return d < new Date(); });
  // Deduplicate by groupId for stats: grouped events count as 1 visit
  const seenGroupsStats = new Set<string>();
  const uniqueCompletedEvents = completedEvents.filter((e: any) => {
    if (e.groupId) {
      if (seenGroupsStats.has(e.groupId)) return false;
      seenGroupsStats.add(e.groupId);
    }
    return true;
  });
  const futureEvents = myEvents.filter((e: any) => {
    if (e.status === "completed" || e.status === "no_show") return false;
    const d = new Date(e.year, e.month, e.date);
    const [eH, eM] = (e.startTime || "23:59").split(":").map(Number);
    d.setHours(eH, eM, 0, 0);
    return d > new Date();
  }).sort((a: any, b: any) => {
    const da = new Date(a.year, a.month, a.date); const [aH, aM] = (a.startTime || "00:00").split(":").map(Number); da.setHours(aH, aM);
    const db = new Date(b.year, b.month, b.date); const [bH, bM] = (b.startTime || "00:00").split(":").map(Number); db.setHours(bH, bM);
    return da.getTime() - db.getTime();
  });
  const nextEvent = futureEvents[0];

  // Favorite barber (uses deduplicated visits)
  const barberCounts: Record<string, number> = {};
  uniqueCompletedEvents.forEach((e: any) => { if (e.barberId) barberCounts[e.barberId] = (barberCounts[e.barberId] || 0) + 1; });
  const favBarberId = Object.entries(barberCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const favBarber = favBarberId ? (barbers || []).find((b: any) => b.id === favBarberId) : null;
  const favBarberCount = favBarberId ? barberCounts[favBarberId] : 0;

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
          // Remove empty strings to avoid NOT NULL / constraint violations
          if (!saveData.email?.trim()) delete saveData.email;
          if (!saveData.birthday?.trim()) delete saveData.birthday;

          const { error: updateErr } = await supabase.from("clients").update({ ...saveData, updatedAt: new Date().toISOString() }).eq("id", clientProfile.id);

          // Sync clientName in subscriptions if name changed (prevents admin panel showing old names)
          if (!updateErr && saveData.name && saveData.name !== clientProfile.name) {
            await supabase.from("subscriptions").update({
              clientName: saveData.name,
              updatedAt: new Date().toISOString(),
            }).eq("clientId", clientProfile.id);
          }

          // N1c: Sync profile data to ASAAS gateway (fire-and-forget, only on success)
          if (!updateErr) {
            syncCustomerData({
              name: saveData.name || clientProfile.name,
              email: saveData.email || clientProfile.email,
              phone: saveData.phone || clientProfile.phone,
            }).catch(() => {}); // silent — don't block UI

            // Update Supabase Auth profile (email for login + user_metadata for name/phone)
            const authUpdates: Record<string, string> = {};
            if (saveData.email && saveData.email.trim().toLowerCase() !== clientProfile.email?.trim().toLowerCase()) {
              authUpdates.newEmail = saveData.email.trim();
            }
            if (saveData.name && saveData.name.trim() !== clientProfile.name?.trim()) {
              authUpdates.name = saveData.name.trim();
            }
            if (saveData.phone && saveData.phone.trim() !== clientProfile.phone?.trim()) {
              authUpdates.phone = saveData.phone.trim();
            }
            if (Object.keys(authUpdates).length > 0) {
              try {
                await updateAuthEmail(authUpdates);
                console.log('[Profile] Auth profile synced:', Object.keys(authUpdates));
              } catch (authErr: any) {
                console.warn('[Profile] Auth profile sync failed:', authErr.message);
              }
            }
          }

          if (updateErr) {
            console.error("[Profile Update] Error:", updateErr);
            closeModal(() => {
              openModal(
                <div className="p-6 text-center" style={{ borderRadius: "1rem" }}>
                  <X className="w-12 h-12 mx-auto mb-4 text-red-500" />
                  <h3 className="text-xl font-bold mb-3 text-red-400">Erro ao Salvar</h3>
                  <p className="text-gray-300 mb-6">{(() => { const m = updateErr.message || ""; if (m.includes("unique") || m.includes("duplicate")) { if (m.includes("email")) return "Este e-mail já está em uso por outro cliente."; if (m.includes("phone")) return "Este telefone já está em uso por outro cliente."; if (m.includes("cpf")) return "Este CPF/CNPJ já está em uso por outro cliente."; return "Este dado já está em uso por outro cliente."; } return "Não foi possível atualizar seu perfil. Tente novamente."; })()}</p>
                  <button onClick={() => closeModal()} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>Fechar</button>
                </div>, "center"
              );
            });
            return;
          }

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
    openModal(<NotificacoesModal primary={primary} bgColor={bgColor} clientProfile={clientProfile} onClose={() => closeModal()} onSave={(p: any) => onProfileUpdate(p)} pushSubscribed={pushSubscribed} pushSupported={pushSupported} onPushSubscribe={onPushSubscribe} onPushUnsubscribe={onPushUnsubscribe} />, "center");
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
      {/* Avatar + Name — Premium */}
      <div className="text-center pt-8 mb-8">
        <div className="relative inline-block">
          <div className="w-28 h-28 rounded-full p-[3px] mx-auto booking-avatar-ring" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}66, ${primary})` }}>
            {clientProfile?.profilePic || clientProfile?.avatar ? (
              <img src={clientProfile.profilePic || clientProfile.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center text-3xl font-bold" style={{ backgroundColor: "#1a1a1a", color: primary }}>
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <button onClick={() => {
            const hasPhoto = !!(clientProfile?.profilePic || clientProfile?.avatar);
            const doUpload = () => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = async (ev: any) => {
                const file = ev.target.files?.[0];
                if (!file || !clientProfile?.id) return;
                closeModal();
                // Show uploading state
                openModal(
                  <div className="p-6 text-center" style={{ borderRadius: '1rem' }}>
                    <Loader2 className="w-10 h-10 mx-auto mb-4 booking-spin" style={{ color: primary }} />
                    <p className="text-white font-semibold">Enviando foto...</p>
                  </div>, "center"
                );
                try {
                  const ext = file.name.split('.').pop() || 'jpg';
                  const path = `clients/${clientProfile.id}.${ext}`;
                  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
                  if (upErr) throw upErr;
                  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
                  const publicUrl = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : '';
                  if (publicUrl) {
                    await supabase.from('clients').update({ profilePic: publicUrl, updatedAt: new Date().toISOString() }).eq('id', clientProfile.id);
                    onProfileUpdate({ ...clientProfile, profilePic: publicUrl });
                  }
                  closeModal();
                } catch (err) {
                  console.error('Avatar upload error:', err);
                  closeModal();
                  openModal(
                    <div className="p-6 text-center" style={{ borderRadius: '1rem' }}>
                      <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-red-400" />
                      <p className="text-white font-semibold mb-2">Erro ao enviar foto</p>
                      <p className="text-gray-400 text-sm mb-4">Tente novamente com uma imagem menor.</p>
                      <button onClick={closeModal} className="w-full py-3 font-semibold rounded-lg" style={{ backgroundColor: primary, color: bgColor }}>OK</button>
                    </div>, "center"
                  );
                }
              };
              input.click();
            };
            const doRemove = async () => {
              closeModal();
              await supabase.from('clients').update({ profilePic: null, updatedAt: new Date().toISOString() }).eq('id', clientProfile.id);
              onProfileUpdate({ ...clientProfile, profilePic: null });
            };
            openModal(
              <div className="booking-modal-sheet p-5 pb-8">
                <h3 className="booking-modal-title" style={{ color: primary }}>Foto de perfil</h3>
                <div className="space-y-3 px-1">
                  <div onClick={() => { closeModal(); setTimeout(doUpload, 200); }} className="booking-modal-item">
                    <div className="booking-modal-avatar w-12 h-12 rounded-full"><ImagePlus className="w-5 h-5 text-gray-500" /></div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">Escolher foto</p>
                      <p className="text-xs text-gray-400">Selecione uma imagem da galeria</p>
                    </div>
                  </div>
                  {hasPhoto && (
                    <div onClick={() => { doRemove(); }} className="booking-modal-item">
                      <div className="booking-modal-avatar w-12 h-12 rounded-full"><Trash2 className="w-5 h-5 text-red-400" /></div>
                      <div className="flex-1">
                        <p className="font-semibold text-red-400">Remover foto</p>
                        <p className="text-xs text-gray-500">Voltar para a letra inicial</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }} className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: primary, color: bgColor }}>
            <Camera className="w-4 h-4" />
          </button>
        </div>
        <p className="text-gray-400 text-sm mt-4">{greeting},</p>
        <h2 className="text-2xl font-bold text-white">{clientProfile?.name || "Visitante"}</h2>
        <div className="flex items-center justify-center gap-2 mt-2">
          {clientSubscription && (() => {
            const badgeMap: Record<string, { label: string; color: string; bg: string }> = {
              active: { label: 'Assinante', color: primary, bg: `${primary}20` },
              overdue: { label: 'Inadimplente', color: '#f87171', bg: '#ef444420' },
              paused: { label: 'Pausado', color: '#fbbf24', bg: '#eab30820' },
              pending_payment: { label: 'Aguardando Pgto', color: '#60a5fa', bg: '#3b82f620' },
            };
            const b = badgeMap[clientSubscription.status] || badgeMap.active;
            return <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: b.bg, color: b.color, border: `1px solid ${b.color}40` }}><Crown className="w-3 h-3 inline mr-1" />{b.label}</span>;
          })()}
          {memberSince && <span className="text-xs text-gray-500">Cliente desde {memberSince}</span>}
        </div>
      </div>

      {/* Next appointment card */}
      {nextEvent && (() => {
        const nBarber = (barbers || []).find((b: any) => b.id === nextEvent.barberId);
        const nSvc = (services || []).find((s: any) => s.id === nextEvent.serviceId);
        const nDateStr = new Date(nextEvent.year, nextEvent.month, nextEvent.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" });
        return (
          <div className="mb-6 border border-gray-800 overflow-hidden" style={{ backgroundColor: "#1e1e1e", borderRadius: 16 }}>
            <button onClick={() => {
              const eventDate = new Date(nextEvent.year, nextEvent.month, nextEvent.date);
              const dateStrFull = eventDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
              const unit = (units || []).find((u: any) => u.id === nextEvent.unitId);
              const price = nextEvent.finalPrice != null ? Number(nextEvent.finalPrice) : (nSvc?.price ?? null);
              const isOpen = eventDate >= new Date(new Date().setHours(0,0,0,0)) && nextEvent.status !== "completed" && nextEvent.status !== "no_show";
              const evDate2 = new Date(nextEvent.year, nextEvent.month, nextEvent.date);
              const [evH, evM] = (nextEvent.startTime || "00:00").split(":").map(Number);
              evDate2.setHours(evH, evM, 0, 0);
              const hoursUntil = (evDate2.getTime() - Date.now()) / (1000 * 60 * 60);
              const cancelMin = parseInt(g("booking.cancellation_hours", "0"), 10);
              const reschedMin = parseInt(g("booking.reschedule_hours", "0"), 10);
              const canCancel = cancelMin <= 0 || hoursUntil >= cancelMin;
              const canReschedule = reschedMin <= 0 || hoursUntil >= reschedMin;
              const isUUID = (s: string) => /^[0-9a-f]{8}-/.test(s || "");
              const resolvedBarber = nBarber?.name || (nextEvent.barberName && !isUUID(nextEvent.barberName) ? nextEvent.barberName : null) || "A definir";
              openModal(
                <div className="p-6" style={{ borderRadius: "1rem", maxHeight: "85vh", overflowY: "auto" }}>
                  <h3 className="text-xl font-bold mb-6 text-center" style={{ color: primary }}>Detalhes do Agendamento</h3>
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
                    <div><p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Data:</p><p className="text-white capitalize">{dateStrFull}</p></div>
                    <div>
                      <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Horário:</p>
                      <p className="text-white">{nextEvent.startTime} - {nextEvent.endTime}</p>
                      {(nextEvent.duration || 0) > 0 && <p className="text-gray-500 text-xs mt-0.5">{nextEvent.duration} minutos</p>}
                    </div>
                    <div><p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Barbeiro:</p><p className="text-white">{resolvedBarber}</p></div>
                    <div className="border-t border-gray-700 pt-4">
                      {nextEvent.serviceSlots && nextEvent.serviceSlots.length > 1 ? (
                        <div className="space-y-2">
                          {nextEvent.serviceSlots.map((ss: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between">
                              <div>
                                <p className="text-white text-sm">{ss.serviceName}</p>
                                <p className="text-gray-500 text-xs">{ss.startTime} - {ss.endTime} · {ss.duration}min</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-white">{nextEvent.serviceName || nextEvent.title}</p>
                          {price != null && <p className="text-white font-bold">R$ {price.toFixed(2)}</p>}
                        </div>
                      )}
                    </div>
                    {price != null && (
                      <div className="flex items-center justify-between border-t border-gray-700 pt-3">
                        <p className="text-white font-bold text-base">Total</p>
                        <p className="font-bold text-base" style={{ color: primary }}>R$ {price.toFixed(2)}</p>
                      </div>
                    )}
                    {(nextEvent as any).usedInPlan && (
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>Desconto do plano</span>
                    )}
                    {nextEvent.usedReferralCredit && (
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primary}20`, color: primary }}>Crédito de indicação</span>
                    )}
                  </div>
                  {(nextEvent as any).groupId && (
                    <p className="text-xs text-amber-400 mb-4 px-3 py-2 rounded-lg text-center" style={{ backgroundColor: "rgba(251,191,36,0.1)" }}>
                      ⚠️ Este agendamento possui serviços vinculados.
                    </p>
                  )}
                  {isOpen ? (
                    <div className="space-y-3">
                      <button onClick={() => { if (canReschedule) { closeModal(); setActiveView("historico"); } }} className="w-full py-3 font-bold rounded-lg" style={{ backgroundColor: primary, color: bgColor, opacity: canReschedule ? 1 : 0.4 }} disabled={!canReschedule}>Remarcar</button>
                      <button onClick={() => { if (canCancel) { closeModal(); setActiveView("historico"); } }} className={`w-full py-3 font-bold rounded-lg bg-red-600 text-white ${canCancel ? "" : "opacity-40"}`} disabled={!canCancel}>Cancelar agendamento</button>
                      <button onClick={closeModal} className="w-full py-3 font-semibold rounded-lg" style={{ backgroundColor: "#1a1a1a", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>Voltar</button>
                      {(!canCancel || !canReschedule) && (
                        <p className="text-xs text-gray-500 text-center">
                          {!canCancel && `Cancelamento requer ${cancelMin}h de antecedência. `}
                          {!canReschedule && `Remarcação requer ${reschedMin}h de antecedência.`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button onClick={closeModal} className="w-full py-3 font-semibold rounded-lg" style={{ backgroundColor: "#1a1a1a", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>Fechar</button>
                  )}
                </div>, "center"
              );
            }} className="w-full p-4 flex items-center gap-4 text-left hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}15`, borderRadius: 6 }}>
                <Calendar className="w-5 h-5" style={{ color: primary }} />
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-[11px] text-gray-500 font-medium">Próximo agendamento</p>
                <p className="text-white text-sm font-bold truncate">{nDateStr.charAt(0).toUpperCase() + nDateStr.slice(1)} às {nextEvent.startTime} - {nextEvent.endTime}</p>
                <p className="text-[11px] text-gray-500 truncate">{nextEvent.serviceName || nextEvent.title} • {nBarber?.name || ""}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
            </button>
          </div>
        );
      })()}

      {/* Quick stats */}
      {uniqueCompletedEvents.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-lg text-center border border-gray-800" style={{ backgroundColor: "#1e1e1e" }}>
            <p className="text-xl font-bold" style={{ color: primary }}>{uniqueCompletedEvents.length}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Visitas</p>
          </div>
          <div className="p-3 rounded-lg text-center border border-gray-800" style={{ backgroundColor: "#1e1e1e" }}>
            <p className="text-xl font-bold" style={{ color: primary }}>{memberSince ? (() => { const m = Math.max(1, Math.floor((Date.now() - new Date(clientProfile.createdAt).getTime()) / (1000*60*60*24*30))); return m; })() : "—"}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Meses</p>
          </div>
          <div className="p-3 rounded-lg text-center border border-gray-800" style={{ backgroundColor: "#1e1e1e" }}>
            <p className="text-xl font-bold" style={{ color: primary }}>{favBarber ? favBarberCount : referrals}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{favBarber ? "Com favorito" : "Indicações"}</p>
          </div>
        </div>
      )}

      {/* Favorite barber */}
      {favBarber && (
        <div className="p-4 rounded-2xl border border-gray-800 mb-6 flex items-center gap-4" style={{ backgroundColor: "#1e1e1e" }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold" style={{ backgroundColor: "#374151", color: primary }}>
            {favBarber.name?.charAt(0) || "B"}
          </div>
          <div className="flex-grow min-w-0">
            <p className="text-xs text-gray-400">Seu barbeiro favorito</p>
            <p className="text-white font-bold truncate">{favBarber.name}</p>
            <p className="text-xs text-gray-500">{favBarberCount} {favBarberCount === 1 ? "visita" : "visitas"} juntos</p>
          </div>
          <button onClick={() => { resetSelection(); const favUnit = Array.isArray(favBarber.unitIds) && favBarber.unitIds.length > 0 ? (units || []).find((u: any) => u.id === favBarber.unitIds[0]) : (units || [])[0]; if (favUnit) updateSelection({ unit: favUnit, barber: favBarber }); else updateSelection({ barber: favBarber }); setActiveView("agendar"); }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0" style={{ backgroundColor: primary, color: bgColor }}>
            Agendar
          </button>
        </div>
      )}

      {/* Credits card */}
      {g("referral.enabled", "true") !== "false" && (
      <div className="p-5 rounded-2xl border border-gray-800 mb-6" style={{ backgroundColor: "#1e1e1e" }}>
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

      {/* Info — Row items style */}
      <div className="rounded-2xl border border-gray-800 mb-6 overflow-hidden" style={{ backgroundColor: "#1e1e1e" }}>
        <div className="flex justify-between items-center p-4 pb-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Informações Pessoais</h3>
          <button onClick={showEditarPerfilModal} className="text-xs font-bold px-3 py-1 rounded-full" style={{ color: primary, backgroundColor: `${primary}15` }}>Editar</button>
        </div>
        {[
          { icon: Phone, label: "Telefone", value: clientProfile?.phone ? formatPhone(clientProfile.phone) : "—" },
          { icon: Mail, label: "Email", value: authUser.email },
          ...(clientProfile?.birthday ? [{ icon: Gift, label: "Aniversário", value: (() => { const bd = clientProfile.birthday.split('T')[0]; return bd.includes('-') ? bd.split('-').reverse().join('/') : bd; })() }] : []),
        ].map(({ icon: Icon, label, value }, i) => (
          <button key={label} onClick={showEditarPerfilModal} className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/5 transition-colors" style={{ borderTop: i > 0 ? "1px solid #2a2a2a" : "none" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primary}12` }}>
              <Icon className="w-4 h-4" style={{ color: primary }} />
            </div>
            <div className="min-w-0 flex-grow">
              <p className="text-[11px] text-gray-500">{label}</p>
              <p className="text-white text-sm font-medium truncate">{value}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Actions — Grouped */}
      <div className="space-y-4 mb-8">
        {/* Group: Conta */}
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">Conta</p>
          <div className="rounded-2xl border border-gray-800 overflow-hidden" style={{ backgroundColor: "#1e1e1e" }}>
            {[
              { icon: Edit3, label: "Editar Perfil", onClick: showEditarPerfilModal },
              { icon: Lock, label: "Alterar Senha", onClick: showAlterarSenhaModal },
              { icon: Bell, label: "Notificações", onClick: showNotificacoesModal, badge: pushSubscribed ? "Ativo" : "Inativo", badgeColor: pushSubscribed ? "#22c55e" : "#6b7280" },
            ].map(({ icon: Icon, label, onClick, badge, badgeColor }, i) => (
              <button key={label} onClick={onClick} className="w-full text-left p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                style={{ borderTop: i > 0 ? "1px solid #2a2a2a" : "none" }}>
                <span className="flex items-center gap-3"><Icon className="w-5 h-5" style={{ color: primary }} /><span className="text-sm text-white">{label}</span></span>
                <span className="flex items-center gap-2">
                  {badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}>{badge}</span>}
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Group: Benefícios */}
        {g("referral.enabled", "true") !== "false" && (
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">Benefícios</p>
          <div className="rounded-2xl border border-gray-800 overflow-hidden" style={{ backgroundColor: "#1e1e1e" }}>
            {[
              { icon: Share2, label: "Indique um Amigo", onClick: showIndiqueAmigoModal, badge: referrals > 0 ? `${referrals} indicações` : undefined },
              { icon: CreditCard, label: "Cashback", onClick: showCashbackModal, badge: credits > 0 ? `R$ ${credits.toFixed(2)}` : undefined, badgeColor: primary },
            ].map(({ icon: Icon, label, onClick, badge, badgeColor }, i) => (
              <button key={label} onClick={onClick} className="w-full text-left p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                style={{ borderTop: i > 0 ? "1px solid #2a2a2a" : "none" }}>
                <span className="flex items-center gap-3"><Icon className="w-5 h-5" style={{ color: primary }} /><span className="text-sm text-white">{label}</span></span>
                <span className="flex items-center gap-2">
                  {badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${badgeColor || primary}20`, color: badgeColor || primary }}>{badge}</span>}
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </span>
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Group: Suporte */}
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">Suporte</p>
          <div className="rounded-2xl border border-gray-800 overflow-hidden" style={{ backgroundColor: "#1e1e1e" }}>
            <button onClick={showFaleConoscoModal} className="w-full text-left p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
              <span className="flex items-center gap-3"><MessageCircle className="w-5 h-5" style={{ color: primary }} /><span className="text-sm text-white">Fale Conosco</span></span>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
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
    </div>
  );
}

// --- Editar Perfil Modal ---
function EditarPerfilModal({ primary, bgColor, clientProfile, onClose, onSave }: any) {
  const [name, setName] = useState(clientProfile?.name || "");
  const phoneRaw = clientProfile?.phone || "";
  const [phone, setPhone] = useState(phoneRaw ? formatPhone(phoneRaw) : "");
  const [email, setEmail] = useState(clientProfile?.email || "");
  const bdRaw = (clientProfile?.birthday || "").split('T')[0];
  const bdDisplay = bdRaw.includes('-') ? bdRaw.split('-').reverse().join('/') : bdRaw;
  const [birthday, setBirthday] = useState(bdDisplay);
  const [loading, setLoading] = useState(false);

  const hasChanged = name !== (clientProfile?.name || "") || phone.replace(/\D/g, "") !== phoneRaw.replace(/\D/g, "") || email !== (clientProfile?.email || "") || birthday !== bdDisplay;
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
function NotificacoesModal({ primary, bgColor, clientProfile, onClose, onSave, pushSubscribed, pushSupported, onPushSubscribe, onPushUnsubscribe }: any) {
  const prefs = clientProfile?.notificationPreferences || {};
  const [emailNotif, setEmailNotif] = useState(prefs.email !== false);
  const [whatsappNotif, setWhatsappNotif] = useState(prefs.whatsapp !== false);
  const [pushToggling, setPushToggling] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const notificationPreferences = { email: emailNotif, whatsapp: whatsappNotif };
    if (clientProfile?.id) {
      const { error } = await supabase.from("clients").update({ notificationPreferences, updatedAt: new Date().toISOString() }).eq("id", clientProfile.id);
      if (!error && onSave) onSave({ ...clientProfile, notificationPreferences });
      if (error) console.error("[Notif Prefs] Save error:", error);
    }
    setLoading(false);
    onClose();
  }

  const handlePushToggle = async () => {
    setPushToggling(true);
    try {
      if (pushSubscribed) {
        await onPushUnsubscribe();
      } else {
        await onPushSubscribe();
      }
    } catch (e) {
      console.error('[Push] Toggle error:', e);
    }
    setPushToggling(false);
  };

  const pushDenied = typeof Notification !== 'undefined' && Notification.permission === 'denied';

  return (
    <div className="p-6" style={{ borderRadius: "1rem" }}>
      <h3 className="text-2xl font-bold text-center mb-2" style={{ color: primary }}>Notificações</h3>
      <p className="text-center text-gray-400 text-sm mb-8">Defina suas preferências de notificação.</p>
      <div className="space-y-4">
        {/* Push Notifications toggle */}
        {pushSupported && (
          <div onClick={!pushDenied && !pushToggling ? handlePushToggle : undefined} className={`flex justify-between items-center p-4 rounded-lg ${pushDenied ? 'opacity-50' : 'cursor-pointer'}`} style={{ backgroundColor: "#2a2a2a" }}>
            <div>
              <span className="text-white font-medium">Notificações Push</span>
              {pushDenied && <p className="text-xs text-red-400 mt-1">Bloqueado pelo navegador. Ative nas configurações.</p>}
            </div>
            {pushToggling ? (
              <Loader2 className="w-5 h-5 booking-spin" style={{ color: primary }} />
            ) : (
              <div className="relative w-11 h-6 rounded-full transition-colors" style={{ backgroundColor: pushSubscribed ? primary : "#6b7280" }}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${pushSubscribed ? "left-6" : "left-1"}`} />
              </div>
            )}
          </div>
        )}
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
