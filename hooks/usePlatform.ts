/**
 * usePlatform — Centralized platform & installation mode detection.
 * Shared by PublicSite navbar and Admin BottomNav for consistent positioning.
 */
export function usePlatform() {
  const isStandalone = typeof window !== "undefined" && (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  // CSS class for platform-specific navbar bottom positioning
  const navbarPlatformClass = isStandalone
    ? (isIOS ? "navbar-ios-standalone" : isAndroid ? "navbar-android-standalone" : "navbar-desktop-standalone")
    : (isIOS ? "navbar-ios-browser" : isAndroid ? "navbar-android-browser" : "navbar-desktop");

  return { isStandalone, isIOS, isAndroid, navbarPlatformClass };
}
