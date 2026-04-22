import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { usePWA } from "../hooks/usePWA";
import { useMemo } from "react";

/**
 * PWAProvider — a renderless component that reads PWA-related
 * settings from Supabase and passes them to the usePWA hook.
 * Must be rendered inside QueryClientProvider.
 *
 * This component runs in the ERP path (not PublicSite, which has
 * its own isolated Supabase client). However, the usePWA hook
 * updates the <head> meta/link tags globally, so the manifest
 * will be correct regardless of which path loaded it.
 */
export function PWAProvider() {
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
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  const pwaSettings = useMemo(() => {
    const map: Record<string, string> = {};
    if (data) {
      for (const s of data) {
        if (s.value !== null && s.key.startsWith("pwa_")) {
          map[s.key] = s.value;
        }
      }
    }
    return map;
  }, [data]);

  usePWA(pwaSettings);

  return null; // renderless
}
