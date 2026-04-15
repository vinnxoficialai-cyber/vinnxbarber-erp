import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

// ============================================================
// TYPES
// ============================================================

export interface StoreSetting {
  id: string;
  key: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettingsMap {
  [key: string]: string;
}

// ============================================================
// QUERY: Fetch all store settings
// ============================================================

function useAllStoreSettings() {
  return useQuery({
    queryKey: ["store-customization"],
    queryFn: async (): Promise<StoreSetting[]> => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
  });
}

// ============================================================
// MUTATION: Upsert (create or update) settings
// ============================================================

function useUpsertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: { key: string; value: string }[]) => {
      const rows = entries.map(({ key, value }) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("store_settings")
        .upsert(rows, { onConflict: "key" });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-customization"] });
      qc.invalidateQueries({ queryKey: ["store-settings"] });
    },
  });
}

// ============================================================
// UPLOAD: Image to store-assets bucket
// ============================================================

export async function uploadStoreAsset(
  file: File,
  path: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const filePath = `${path}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("store-assets")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    if (error.message?.includes("Bucket not found") || error.message?.includes("bucket") || (error as any).statusCode === 400) {
      throw new Error(
        'Bucket "store-assets" não encontrado no Supabase Storage. ' +
        'Crie o bucket manualmente no Dashboard: Storage → New Bucket → Nome: store-assets → Public: SIM'
      );
    }
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from("store-assets")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// ============================================================
// COLOR PALETTE SUGGESTION
// ============================================================

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function suggestPalette(primaryHex: string) {
  try {
    const [h, s, l] = hexToHsl(primaryHex);
    return {
      complementary: hslToHex((h + 180) % 360, s, l),
      analogous1: hslToHex((h + 30) % 360, s, l),
      analogous2: hslToHex((h + 330) % 360, s, l),
      triadic1: hslToHex((h + 120) % 360, s, l),
      triadic2: hslToHex((h + 240) % 360, s, l),
      lighter: hslToHex(h, s, Math.min(l + 15, 95)),
      darker: hslToHex(h, s, Math.max(l - 15, 10)),
    };
  } catch {
    return null;
  }
}

// ============================================================
// MAIN HOOK (used by StoreCustomizer editor)
// ============================================================

export function useStoreCustomization() {
  const query = useAllStoreSettings();
  const upsert = useUpsertSettings();

  // Convert array to key-value map
  const settingsMap: SettingsMap = useMemo(() => {
    const map: SettingsMap = {};
    if (query.data) {
      for (const s of query.data) {
        if (s.value !== null) map[s.key] = s.value;
      }
    }
    return map;
  }, [query.data]);

  // Get a single setting with fallback
  const getSetting = useCallback(
    (key: string, fallback: string = ""): string => {
      return settingsMap[key] ?? fallback;
    },
    [settingsMap]
  );

  // Save multiple settings at once
  const saveSettings = useCallback(
    async (entries: { key: string; value: string }[]) => {
      await upsert.mutateAsync(entries);
    },
    [upsert]
  );

  return {
    settings: settingsMap,
    rawSettings: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    getSetting,
    saveSettings,
    isSaving: upsert.isPending,
  };
}

// ============================================================
// LIGHTWEIGHT HOOK FOR STOREFRONT COMPONENTS
// ============================================================

export function useStoreSetting(key: string, fallback: string = ""): string {
  const { data } = useQuery({
    queryKey: ["store-customization"],
    queryFn: async (): Promise<StoreSetting[]> => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  return useMemo(() => {
    const found = data?.find((s) => s.key === key);
    return found?.value ?? fallback;
  }, [data, key, fallback]);
}

// ============================================================
// MULTI-KEY HOOK FOR STOREFRONT (PublicSite)
// Listens for postMessage from StoreCustomizer for live preview.
// ============================================================

export function useStoreSettings(): (key: string, fallback?: string) => string {
  const { data } = useQuery({
    queryKey: ["store-customization"],
    queryFn: async (): Promise<StoreSetting[]> => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Preview overlay: listens for postMessage from StoreCustomizer
  const [preview, setPreview] = useState<Record<string, string>>({});

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        event.data &&
        event.data.type === "store-customizer-preview" &&
        typeof event.data.draft === "object"
      ) {
        setPreview(event.data.draft);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const map = useMemo(() => {
    const m: Record<string, string> = {};
    if (data) {
      for (const s of data) {
        if (s.value !== null) m[s.key] = s.value;
      }
    }
    return m;
  }, [data]);

  // Merge: preview overrides take priority over saved values
  const merged = useMemo(() => {
    const hasPreview = Object.keys(preview).length > 0;
    if (!hasPreview) return map;
    return { ...map, ...preview };
  }, [map, preview]);

  return useCallback(
    (key: string, fallback: string = ""): string => merged[key] ?? fallback,
    [merged]
  );
}
