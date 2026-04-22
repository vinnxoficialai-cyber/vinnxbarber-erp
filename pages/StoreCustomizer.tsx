import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useStoreCustomization,
  uploadStoreAsset,
  suggestPalette,
} from "../hooks/useStoreCustomization";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { Switch } from "../components/ui/Switch";
import { Separator } from "../components/ui/Separator";
import { Select } from "../components/ui/Select";
import { CustomDropdown } from "../components/CustomDropdown";
import { useToast } from "../components/Toast";
import {
  ArrowLeft,
  Save,
  Loader2,
  Upload,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Monitor,
  Smartphone,
  Palette,
  Image as ImageIcon,
  Type,
  MapPin,
  Star,
  Megaphone,
  Navigation,
  Settings,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Info,
  Bell,
  ToggleRight,
  Copy,
  Trash2,
  Plus,
  Lock,
  Package,
  ShoppingBag,
  Calendar,
  Gift,
  Download,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

type PreviewMode = "desktop" | "mobile";

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ElementType;
  items: { key: string; label: string; icon: React.ElementType; panelType: "section" | "theme" }[];
}

interface SectionDef {
  key: string;
  label: string;
  icon: React.ElementType;
  fixed?: "top" | "bottom";
  duplicable?: boolean;
}

// ============================================================
// BARBERSHOP SECTIONS
// ============================================================

const SECTIONS: SectionDef[] = [
  { key: "loading", label: "Tela de Carregamento", icon: Loader2, fixed: "top" },
  { key: "hero", label: "Banner Principal", icon: ImageIcon },
  { key: "booking", label: "Fluxo de Agendamento", icon: Calendar },
  { key: "navbar", label: "Barra de Navegação", icon: Navigation, fixed: "bottom" },
  { key: "footer", label: "Rodapé", icon: Type, fixed: "bottom" },
  { key: "extras", label: "Funcionalidades Extras", icon: ToggleRight, fixed: "bottom" },
  { key: "review", label: "Avaliações", icon: Star, fixed: "bottom" },
  { key: "referral", label: "Indicação e Cashback", icon: Gift, fixed: "bottom" },
  { key: "announcement", label: "Banner de Anúncios", icon: Bell, fixed: "bottom" },
];

const FIXED_TOP = SECTIONS.filter((s) => s.fixed === "top");
const FIXED_BOTTOM = SECTIONS.filter((s) => s.fixed === "bottom");
const DEFAULT_REORDERABLE_KEYS = SECTIONS.filter((s) => !s.fixed).map((s) => s.key);
const DUPLICABLE_SECTIONS = SECTIONS.filter((s) => s.duplicable);

const SECTIONS_BY_KEY_LENGTH = [...SECTIONS].sort((a, b) => b.key.length - a.key.length);

function getBaseKey(key: string): string {
  for (const s of SECTIONS_BY_KEY_LENGTH) {
    if (key === s.key || key.startsWith(s.key + "_")) {
      if (key === s.key) return s.key;
      const rest = key.slice(s.key.length + 1);
      if (/^\d+$/.test(rest)) return s.key;
    }
  }
  return key;
}

function getSectionDef(key: string): SectionDef | undefined {
  const base = getBaseKey(key);
  const def = SECTIONS.find((s) => s.key === base);
  if (!def) return undefined;
  if (key === base) return def;
  const suffix = key.replace(base + "_", "#");
  return { ...def, key, label: `${def.label} ${suffix}` };
}

const THEME_ITEMS = [
  { key: "colors", label: "Cores", icon: Palette },
  { key: "typography", label: "Tipografia", icon: Type },
  { key: "buttons", label: "Visual e Botões", icon: ShoppingBag },
];

const CATEGORIES: CategoryDef[] = [
  {
    key: "appearance", label: "Aparência", icon: Palette,
    items: [
      { key: "colors", label: "Cores", icon: Palette, panelType: "theme" },
      { key: "typography", label: "Tipografia", icon: Type, panelType: "theme" },
      { key: "buttons", label: "Visual e Botões", icon: ShoppingBag, panelType: "theme" },
    ],
  },
  {
    key: "content", label: "Conteúdo", icon: ImageIcon,
    items: [
      { key: "hero", label: "Banner Principal", icon: ImageIcon, panelType: "section" },
      { key: "loading", label: "Tela de Loading", icon: Loader2, panelType: "section" },
    ],
  },
  {
    key: "scheduling", label: "Agendamento", icon: Calendar,
    items: [
      { key: "booking", label: "Fluxo e Mensagens", icon: Calendar, panelType: "section" },
    ],
  },
  {
    key: "navigation", label: "Navegação", icon: Navigation,
    items: [
      { key: "navbar", label: "Barra de Navegação", icon: Navigation, panelType: "section" },
      { key: "footer", label: "Rodapé", icon: MapPin, panelType: "section" },
    ],
  },
  {
    key: "engagement", label: "Engajamento", icon: Star,
    items: [
      { key: "review", label: "Avaliações", icon: Star, panelType: "section" },
      { key: "referral", label: "Indicação e Cashback", icon: Gift, panelType: "section" },
    ],
  },
  {
    key: "marketing", label: "Marketing", icon: Megaphone,
    items: [
      { key: "announcement", label: "Banner de Anúncios", icon: Bell, panelType: "section" },
    ],
  },
  {
    key: "advanced", label: "Avançado", icon: Settings,
    items: [
      { key: "extras", label: "SEO e Configurações", icon: Settings, panelType: "section" },
      { key: "pwa", label: "PWA / App da Loja", icon: Download, panelType: "section" },
    ],
  },
];

// ============================================================
// CSS NAMED COLORS
// ============================================================
const CSS_NAMED_COLORS: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff",
  orange: "#ffa500", yellow: "#ffff00", purple: "#800080", pink: "#ffc0cb", brown: "#a52a2a",
  gray: "#808080", grey: "#808080", gold: "#ffd700", silver: "#c0c0c0", navy: "#000080",
  coral: "#ff7f50", salmon: "#fa8072", tomato: "#ff6347", crimson: "#dc143c", maroon: "#800000",
  olive: "#808000", teal: "#008080", cyan: "#00ffff", lime: "#00ff00",
  indigo: "#4b0082", violet: "#ee82ee", magenta: "#ff00ff", beige: "#f5f5dc",
  lavender: "#e6e6fa", turquoise: "#40e0d0",
  preto: "#000000", branco: "#ffffff", vermelho: "#ff0000", verde: "#008000", azul: "#0000ff",
  laranja: "#ffa500", amarelo: "#ffff00", roxo: "#800080", rosa: "#ffc0cb", marrom: "#a52a2a",
  cinza: "#808080", dourado: "#ffd700", prata: "#c0c0c0", creme: "#fffdd0",
};

// ============================================================
// CURATED PALETTES
// ============================================================
const CURATED_PALETTES: { name: string; colors: { hex: string; name: string }[] }[] = [
  {
    name: "Barbearia",
    colors: [
      { hex: "#1A1A2E", name: "Midnight" }, { hex: "#16213E", name: "Navy" },
      { hex: "#C5A880", name: "Ouro Antigo" }, { hex: "#B8860B", name: "Dourado" },
      { hex: "#2C2C2C", name: "Carvão" }, { hex: "#8B4513", name: "Couro" },
      { hex: "#D4AF37", name: "Gold" }, { hex: "#F5F0E8", name: "Marfim" },
      { hex: "#00BF62", name: "Verde VINNX" }, { hex: "#FFFFFF", name: "Branco" },
    ],
  },
  {
    name: "Moderno",
    colors: [
      { hex: "#F97316", name: "Tangerina" }, { hex: "#EF4444", name: "Vermelho" },
      { hex: "#3B82F6", name: "Azul" }, { hex: "#10B981", name: "Verde" },
      { hex: "#8B5CF6", name: "Roxo" }, { hex: "#EC4899", name: "Rosa" },
      { hex: "#06B6D4", name: "Ciano" }, { hex: "#1F2937", name: "Cinza Lead" },
      { hex: "#F59E0B", name: "Amarelo" }, { hex: "#FFFFFF", name: "Branco" },
    ],
  },
  {
    name: "Clássico",
    colors: [
      { hex: "#0F3460", name: "Safira" }, { hex: "#E94560", name: "Ruby" },
      { hex: "#533483", name: "Ametista" }, { hex: "#A3B18A", name: "Sage" },
      { hex: "#588157", name: "Floresta" }, { hex: "#DAD7CD", name: "Areia" },
      { hex: "#B7B7A4", name: "Pedra" }, { hex: "#C99383", name: "Argila" },
      { hex: "#6B705C", name: "Musgo" }, { hex: "#F2E9E4", name: "Algodão" },
    ],
  },
  {
    name: "Neutro",
    colors: [
      { hex: "#FAFAFA", name: "Quase Branco" }, { hex: "#F5F5F5", name: "Cinza Claro" },
      { hex: "#E5E5E5", name: "Prata" }, { hex: "#D4D4D4", name: "Cinza Médio" },
      { hex: "#A3A3A3", name: "Cinza" }, { hex: "#737373", name: "Grafite" },
      { hex: "#525252", name: "Chumbo" }, { hex: "#404040", name: "Escuro" },
      { hex: "#262626", name: "Quase Preto" }, { hex: "#171717", name: "Noite" },
    ],
  },
];

// ============================================================
// REUSABLE FIELD COMPONENTS
// ============================================================

function ColorField({
  label, value, onChange, onSuggest, allSettings,
}: {
  label: string; value: string; onChange: (v: string) => void;
  onSuggest?: () => void; allSettings?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  const [paletteTab, setPaletteTab] = useState(0);
  const popRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popPos, setPopPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const documentColors = (() => {
    if (!allSettings) return [];
    const hexSet = new Set<string>();
    for (const v of Object.values(allSettings)) {
      if (v && /^#[0-9a-fA-F]{6}$/.test(v)) hexSet.add(v.toUpperCase());
    }
    return [...hexSet].slice(0, 12);
  })();

  const handleNameSearch = () => {
    const key = nameSearch.trim().toLowerCase();
    if (CSS_NAMED_COLORS[key]) {
      onChange(CSS_NAMED_COLORS[key]);
      setNameSearch("");
    }
  };

  return (
    <div className="relative py-2.5" ref={popRef}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-gray-400 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <Input
            value={value || ""} onChange={(e) => onChange(e.target.value)}
            placeholder="#000000" className="w-28 h-9 font-mono text-[11px] text-right bg-white/[0.03] border-white/[0.08] rounded-lg"
          />
          <button
            ref={triggerRef}
            onClick={() => {
              if (!open && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const popW = 300;
                let left = rect.right - popW;
                if (left < 8) left = 8;
                let top = rect.bottom + 8;
                if (top + 420 > window.innerHeight) top = rect.top - 420 - 8;
                setPopPos({ top, left });
              }
              setOpen(!open);
            }}
            className="w-9 h-9 rounded-lg border border-white/[0.08] cursor-pointer flex items-center justify-center shrink-0 transition-all hover:ring-2 hover:ring-orange-400/50"
            style={{ backgroundColor: value || "#000000" }}
            title="Abrir seletor de cores"
          />
          {onSuggest && (
            <button onClick={onSuggest} className="p-1 rounded hover:bg-muted transition-colors" title="Sugerir paleta">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div ref={popRef} className="fixed z-[9999] w-[300px] bg-[#1a1a1a] border border-white/[0.08] rounded-xl shadow-2xl p-4 space-y-3" style={{ top: popPos.top, left: popPos.left, animation: 'fadeZoomIn 150ms ease-out' }}>
          <input
            type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)}
            className="w-full h-[140px] rounded-lg border border-border cursor-pointer bg-transparent p-0 block"
          />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full shrink-0 border-2 border-border" style={{ backgroundColor: value || "#000000" }} />
            <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="h-8 font-mono text-xs flex-1" />
            <button
              onClick={async () => {
                try {
                  if ("EyeDropper" in window) {
                    const dropper = new (window as any).EyeDropper();
                    const result = await dropper.open();
                    onChange(result.sRGBHex);
                  }
                } catch { /* user cancelled */ }
              }}
              className="w-8 h-8 rounded-lg border border-border bg-muted/50 flex items-center justify-center shrink-0 hover:bg-muted transition-colors cursor-pointer"
              title="Conta-gotas"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 22l1-1h3l9-9" />
                <path d="M3 21v-3l9-9" />
                <path d="M14.5 5.5l4-4a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2l-4 4" />
                <path d="M12 8l4 4" />
              </svg>
            </button>
          </div>

          {documentColors.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Cores no documento</p>
              <div className="flex flex-wrap gap-2">
                {documentColors.map((hex) => (
                  <button key={hex} onClick={() => onChange(hex.toLowerCase())}
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${value?.toUpperCase() === hex ? "border-orange-400 ring-2 ring-orange-400/30" : "border-border/50"}`}
                    style={{ backgroundColor: hex }} title={hex}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex gap-0.5 mb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {CURATED_PALETTES.map((p, i) => (
                <button key={p.name} onClick={() => setPaletteTab(i)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors ${paletteTab === i ? "bg-orange-500/20 text-orange-400" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                >{p.name}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 justify-start">
              {CURATED_PALETTES[paletteTab].colors.map((c) => (
                <button key={c.hex + c.name} onClick={() => onChange(c.hex)} className="group flex flex-col items-center gap-0.5" title={`${c.name} (${c.hex})`}>
                  <div className={`w-8 h-8 rounded-full border-2 transition-all group-hover:scale-110 ${value?.toUpperCase() === c.hex.toUpperCase() ? "border-orange-400 ring-2 ring-orange-400/30" : "border-border/30"}`} style={{ backgroundColor: c.hex }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageUploadField({
  label, value, onChange, path,
}: {
  label: string; value: string; onChange: (url: string) => void; path: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadStoreAsset(file, path);
      onChange(url);
      toast.success("Sucesso", "Imagem enviada");
    } catch (err: any) {
      toast.error("Erro", err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="py-2.5">
      <Label className="text-[13px] text-gray-400 mb-2 block font-medium">{label}</Label>
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted flex-shrink-0">
            <img src={value} alt="" className="w-full h-full object-contain" />
            <button onClick={() => onChange("")}
              className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80"
            ><X className="w-2.5 h-2.5 text-white" /></button>
          </div>
        ) : (
          <div onClick={() => inputRef.current?.click()}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-orange-500/50 flex items-center justify-center cursor-pointer transition-colors bg-muted/30 flex-shrink-0"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
          </div>
        )}
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="URL ou clique para upload" className="h-10 text-sm flex-1 bg-white/[0.03] border-white/[0.08] rounded-lg" />
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
        />
      </div>
    </div>
  );
}

function VideoUploadField({
  label, value, onChange, path,
}: {
  label: string; value: string; onChange: (url: string) => void; path: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadStoreAsset(file, path);
      onChange(url);
      toast.success("Sucesso", "Vídeo enviado");
    } catch (err: any) {
      toast.error("Erro", err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="py-2.5">
      <Label className="text-[13px] text-gray-400 mb-2 block font-medium">{label}</Label>
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative w-24 h-16 rounded-lg border border-border overflow-hidden bg-black flex-shrink-0">
            <video src={value} className="w-full h-full object-cover" muted playsInline autoPlay loop />
            <button onClick={() => onChange("")}
              className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80"
            ><X className="w-2.5 h-2.5 text-white" /></button>
          </div>
        ) : (
          <div onClick={() => inputRef.current?.click()}
            className="w-24 h-16 rounded-lg border-2 border-dashed border-border hover:border-orange-500/50 flex items-center justify-center cursor-pointer transition-colors bg-muted/30 flex-shrink-0"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
          </div>
        )}
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="URL do vídeo ou clique para upload" className="h-10 text-sm flex-1 bg-white/[0.03] border-white/[0.08] rounded-lg" />
        <input ref={inputRef} type="file" accept="video/mp4,video/webm" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
        />
      </div>
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder, multiline, type,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; type?: string;
}) {
  return (
    <div className="py-2.5">
      <Label className="text-[13px] text-gray-400 mb-2 block font-medium">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="text-sm bg-white/[0.03] border-white/[0.08] focus:border-orange-500/40 rounded-lg" />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 text-sm bg-white/[0.03] border-white/[0.08] focus:border-orange-500/40 rounded-lg" type={type} />
      )}
    </div>
  );
}

function SectionHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="px-5 py-4 border-b border-border bg-card sticky top-0 z-10">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <h3 className="font-semibold text-base">{title}</h3>
    </div>
  );
}

function CollapsibleGroup({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/[0.06] rounded-xl bg-white/[0.01]">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-white/[0.03] transition-colors">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">{title}</span>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 space-y-1">{children}</div>}
    </div>
  );
}

// ============================================================
type PanelProps = { get: (k: string, f?: string) => string; set: (k: string, v: string) => void; allSettings?: Record<string, string> };

// SECTION EDIT PANELS
// ============================================================

function LoadingPanel({ get, set, allSettings }: PanelProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Identidade" defaultOpen={true}>
        <ImageUploadField label="Logo" value={get("loading.logo")} onChange={(v) => set("loading.logo", v)} path="logos" />
        <TextField label="Nome da Barbearia" value={get("store_name", "VINNX BARBER")} onChange={(v) => set("store_name", v)} />
      </CollapsibleGroup>
      <CollapsibleGroup title="Textos">
        <TextField label="Título" value={get("loading.title", "Elevando a sua experiência")} onChange={(v) => set("loading.title", v)} />
        <TextField label="Subtítulo" value={get("loading.subtitle", "Estilo e precisão em cada corte.")} onChange={(v) => set("loading.subtitle", v)} />
      </CollapsibleGroup>
      <CollapsibleGroup title="Configuração">
        <TextField label="Duração (ms)" value={get("loading.duration", "2000")} onChange={(v) => set("loading.duration", v)} type="number" />
        <ColorField label="Cor de fundo" value={get("loading.bg_color", "#000000")} onChange={(v) => set("loading.bg_color", v)} allSettings={allSettings} />
      </CollapsibleGroup>
    </div>
  );
}

function HeroPanel({ get, set, allSettings }: PanelProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Conteúdo" defaultOpen={true}>
        <TextField label="Título" value={get("hero.title", "Agende seu horário")} onChange={(v) => set("hero.title", v)} />
        <TextField label="Subtítulo" value={get("hero.subtitle", "Escolha os serviços e agende com facilidade.")} onChange={(v) => set("hero.subtitle", v)} multiline />
      </CollapsibleGroup>
      <CollapsibleGroup title="Fundo">
        <ImageUploadField label="Imagem de fundo" value={get("hero.bg_image")} onChange={(v) => set("hero.bg_image", v)} path="hero" />
        <VideoUploadField label="Vídeo de fundo (mp4)" value={get("hero.bg_video", "")} onChange={(v) => set("hero.bg_video", v)} path="hero" />
        <ColorField label="Overlay (escurecimento)" value={get("hero.overlay_color", "rgba(0,0,0,0.7)")} onChange={(v) => set("hero.overlay_color", v)} allSettings={allSettings} />
      </CollapsibleGroup>
      <CollapsibleGroup title="Logo no Banner">
        <ImageUploadField label="Logo" value={get("hero.logo")} onChange={(v) => set("hero.logo", v)} path="logos" />
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Mostrar logo no banner</span>
          <Switch checked={get("hero.show_logo", "true") !== "false"} onCheckedChange={(v) => set("hero.show_logo", v ? "true" : "false")} />
        </div>
      </CollapsibleGroup>
    </div>
  );
}

function BookingPanel({ get, set }: PanelProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Regras de Agendamento" defaultOpen={true}>
        <div className="py-2">
          <Label className="text-[13px] text-gray-400 mb-2 block font-medium">Dias máx. para agendar</Label>
          <CustomDropdown value={get("booking.max_advance_days", "30")} onChange={(v) => set("booking.max_advance_days", v)} isDarkMode options={[
            { value: "7", label: "7 dias" },
            { value: "14", label: "14 dias" },
            { value: "30", label: "30 dias" },
            { value: "60", label: "60 dias" },
          ]} />
        </div>
        <div className="py-2">
          <Label className="text-[13px] text-gray-400 mb-2 block font-medium">Máx. agendamentos abertos</Label>
          <CustomDropdown value={get("booking.max_open_appointments", "2")} onChange={(v) => set("booking.max_open_appointments", v)} isDarkMode options={[
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "5", label: "5" },
          ]} />
        </div>
        <div className="py-2">
          <Label className="text-[13px] text-gray-400 mb-2 block font-medium">Intervalo entre slots (min)</Label>
          <CustomDropdown value={get("booking.slot_interval", "30")} onChange={(v) => set("booking.slot_interval", v)} isDarkMode options={[
            { value: "15", label: "15 min" },
            { value: "20", label: "20 min" },
            { value: "30", label: "30 min" },
            { value: "40", label: "40 min" },
            { value: "60", label: "60 min" },
          ]} />
        </div>
      </CollapsibleGroup>
      <CollapsibleGroup title="Opções">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Mostrar preços</span>
          <Switch checked={get("booking.show_prices", "true") !== "false"} onCheckedChange={(v) => set("booking.show_prices", v ? "true" : "false")} />
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Mostrar duração</span>
          <Switch checked={get("booking.show_duration", "true") !== "false"} onCheckedChange={(v) => set("booking.show_duration", v ? "true" : "false")} />
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Opção "Sem preferência" de barbeiro</span>
          <Switch checked={get("booking.allow_no_preference", "true") !== "false"} onCheckedChange={(v) => set("booking.allow_no_preference", v ? "true" : "false")} />
        </div>
      </CollapsibleGroup>
      <CollapsibleGroup title="Cancelamento e Remarcação">
        <TextField label="Antecedência mín. para cancelar (horas)" value={get("booking.cancellation_hours", "0")} onChange={(v) => set("booking.cancellation_hours", v)} type="number" />
        <TextField label="Antecedência mín. para remarcar (horas)" value={get("booking.reschedule_hours", "0")} onChange={(v) => set("booking.reschedule_hours", v)} type="number" />
      </CollapsibleGroup>
      <CollapsibleGroup title="Dias Fechados">
        {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((day, i) => (
          <div key={i} className="flex items-center justify-between py-1">
            <span className="text-sm">{day}</span>
            <Switch
              checked={!(get("booking.closed_days", "0")).split(",").includes(String(i))}
              onCheckedChange={(v) => {
                const current = get("booking.closed_days", "0").split(",").filter(Boolean);
                const updated = v ? current.filter((d) => d !== String(i)) : [...current, String(i)];
                set("booking.closed_days", updated.join(","));
              }}
            />
          </div>
        ))}
      </CollapsibleGroup>
      <CollapsibleGroup title="Horário de Funcionamento Padrão">
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1">
            <Label className="text-[12px] text-gray-400 mb-1.5 block font-medium">Abertura</Label>
            <Input type="time" value={get("booking.default_start_time", "08:00")} onChange={(e) => set("booking.default_start_time", e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex-1">
            <Label className="text-[12px] text-gray-400 mb-1.5 block font-medium">Fechamento</Label>
            <Input type="time" value={get("booking.default_end_time", "19:00")} onChange={(e) => set("booking.default_end_time", e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1">
            <Label className="text-[12px] text-gray-400 mb-1.5 block font-medium">Início Intervalo</Label>
            <Input type="time" value={get("booking.default_break_start", "12:00")} onChange={(e) => set("booking.default_break_start", e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex-1">
            <Label className="text-[12px] text-gray-400 mb-1.5 block font-medium">Fim Intervalo</Label>
            <Input type="time" value={get("booking.default_break_end", "13:00")} onChange={(e) => set("booking.default_break_end", e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Info className="w-3 h-3" /> Usado quando o barbeiro não tem agenda individual.</p>
      </CollapsibleGroup>
      <CollapsibleGroup title="Restrições Avançadas">
        <TextField label="Antecedência mín. para agendar (horas)" value={get("booking.min_advance_hours", "0")} onChange={(v) => set("booking.min_advance_hours", v)} type="number" />
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Bloquear agendamento no mesmo dia</span>
          <Switch checked={get("booking.block_same_day", "false") === "true"} onCheckedChange={(v) => set("booking.block_same_day", v ? "true" : "false")} />
        </div>
        <TextField label="Máx. agendamentos por barbeiro/dia (0 = ilimitado)" value={get("booking.max_per_barber_day", "0")} onChange={(v) => set("booking.max_per_barber_day", v)} type="number" />
      </CollapsibleGroup>
      <CollapsibleGroup title="Textos dos Botões">
        <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Textos exibidos nos botões de seleção em cascata quando nenhum item está selecionado.</p>
        <TextField label="Botão de unidade" value={get("booking.label_unit", "")} onChange={(v) => set("booking.label_unit", v)} placeholder="Selecionar unidade" />
        <TextField label="Botão de profissional" value={get("booking.label_barber", "")} onChange={(v) => set("booking.label_barber", v)} placeholder="Selecionar barbeiro" />
        <TextField label="Botão de serviço" value={get("booking.label_service", "")} onChange={(v) => set("booking.label_service", v)} placeholder="Selecionar serviço" />
        <TextField label="Botão de data/hora" value={get("booking.label_datetime", "")} onChange={(v) => set("booking.label_datetime", v)} placeholder="Selecionar data e hora" />
        <TextField label="Botão de agendar" value={get("booking.label_submit", "")} onChange={(v) => set("booking.label_submit", v)} placeholder="Agendar" />
      </CollapsibleGroup>
      <CollapsibleGroup title="Títulos dos Modais">
        <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Títulos exibidos no topo de cada modal de seleção.</p>
        <TextField label="Modal de unidade" value={get("booking.modal_title_unit", "")} onChange={(v) => set("booking.modal_title_unit", v)} placeholder="Escolha uma unidade" />
        <TextField label="Modal de profissional" value={get("booking.modal_title_barber", "")} onChange={(v) => set("booking.modal_title_barber", v)} placeholder="Escolha um profissional" />
        <TextField label="Modal de serviço" value={get("booking.modal_title_service", "")} onChange={(v) => set("booking.modal_title_service", v)} placeholder="Escolha um serviço" />
        <TextField label="Modal de calendário" value={get("booking.modal_title_calendar", "")} onChange={(v) => set("booking.modal_title_calendar", v)} placeholder="Data do agendamento" />
      </CollapsibleGroup>
      <CollapsibleGroup title="Mensagens Personalizadas">
        <TextField label="Mensagem de confirmação" value={get("booking.confirmation_message", "")} onChange={(v) => set("booking.confirmation_message", v)} multiline placeholder="Ex: Obrigado por agendar! Chegar 10min antes." />
      </CollapsibleGroup>
      <CollapsibleGroup title="Contato">
        <TextField label="WhatsApp" value={get("contact.whatsapp", "")} onChange={(v) => set("contact.whatsapp", v)} placeholder="5511999999999" />
        <TextField label="Telefone" value={get("contact.phone", "")} onChange={(v) => set("contact.phone", v)} placeholder="(11) 3456-7890" />
        <TextField label="Instagram" value={get("contact.instagram", "")} onChange={(v) => set("contact.instagram", v)} placeholder="https://instagram.com/..." />
      </CollapsibleGroup>
      <CollapsibleGroup title="Confirmação e Sucesso">
        <TextField label="Título de sucesso" value={get("booking.success_title", "")} onChange={(v) => set("booking.success_title", v)} placeholder="Agendamento Confirmado!" />
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm">Lembrete de horário</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Aviso visual na tela de agendamento.</p>
          </div>
          <Switch checked={get("reminder.enabled", "true") !== "false"} onCheckedChange={(v) => set("reminder.enabled", v ? "true" : "false")} />
        </div>
        <TextField label="Texto do lembrete" value={get("reminder.title", "")} onChange={(v) => set("reminder.title", v)} placeholder="Lembrete: Você tem horário hoje!" />
        <ColorField label="Cor de fundo dos cards" value={get("theme.card_bg_color", "")} onChange={(v) => set("theme.card_bg_color", v)} />
      </CollapsibleGroup>
      <CollapsibleGroup title="Textos de Login">
        <TextField label="Prompt do Histórico" value={get("auth.historico_prompt", "")} onChange={(v) => set("auth.historico_prompt", v)} placeholder="Faça login para ver seu histórico" />
        <TextField label="Prompt do Perfil" value={get("auth.perfil_prompt", "")} onChange={(v) => set("auth.perfil_prompt", v)} placeholder="Faça login para acessar seu perfil" />
        <TextField label="Botão de login" value={get("auth.login_button", "")} onChange={(v) => set("auth.login_button", v)} placeholder="Entrar com Google" />
      </CollapsibleGroup>
    </div>
  );
}

function NavbarPanel({ get, set, allSettings }: PanelProps) {
  const TABS = [
    { key: "agendar", defaultLabel: "Agendar", icon: Calendar },
    { key: "historico", defaultLabel: "Histórico", icon: Navigation },
    { key: "planos", defaultLabel: "Planos", icon: Star },
    { key: "perfil", defaultLabel: "Perfil", icon: Settings },
  ];

  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Aparência" defaultOpen={true}>
        <ColorField label="Cor de fundo" value={get("navbar.bg_color", "")} onChange={(v) => set("navbar.bg_color", v)} allSettings={allSettings} />
        <ColorField label="Cor do item ativo" value={get("navbar.active_color", "")} onChange={(v) => set("navbar.active_color", v)} allSettings={allSettings} />
      </CollapsibleGroup>
      <CollapsibleGroup title="Opções">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Mostrar labels</span>
          <Switch checked={get("navbar.show_labels", "true") !== "false"} onCheckedChange={(v) => set("navbar.show_labels", v ? "true" : "false")} />
        </div>
      </CollapsibleGroup>
      <CollapsibleGroup title="Abas da Navegação" defaultOpen={true}>
        {TABS.map((tab) => {
          const visKey = `navbar.tab_${tab.key}_visible`;
          const labelKey = `navbar.tab_${tab.key}_label`;
          const isVisible = get(visKey, "true") !== "false";
          return (
            <div key={tab.key} className="py-2 border-b border-border/30 last:border-0">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <tab.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{tab.defaultLabel}</span>
                </div>
                <Switch checked={isVisible} onCheckedChange={(v) => set(visKey, v ? "true" : "false")} />
              </div>
              {isVisible && (
                <Input
                  value={get(labelKey, "")}
                  onChange={(e) => set(labelKey, e.target.value)}
                  placeholder={tab.defaultLabel}
                  className="h-7 text-xs mt-1"
                />
              )}
            </div>
          );
        })}
        <div className="py-2">
          <Label className="text-[13px] text-gray-400 mb-2 block font-medium">Aba padrão (abrir primeiro)</Label>
          <CustomDropdown value={get("navbar.default_tab", "agendar")} onChange={(v) => set("navbar.default_tab", v)} isDarkMode options={
            TABS.filter(t => get(`navbar.tab_${t.key}_visible`, "true") !== "false").map((t) => ({
              value: t.key, label: get(`navbar.tab_${t.key}_label`, "") || t.defaultLabel
            }))
          } />
        </div>
      </CollapsibleGroup>
    </div>
  );
}

function FooterPanel({ get, set, allSettings }: PanelProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Conteúdo" defaultOpen={true}>
        <TextField label="Texto do rodapé" value={get("footer.text", "© 2024 VINNX BARBER. Todos os direitos reservados.")} onChange={(v) => set("footer.text", v)} />
        <ImageUploadField label="Logo do rodapé" value={get("footer.logo")} onChange={(v) => set("footer.logo", v)} path="logos" />
      </CollapsibleGroup>
      <CollapsibleGroup title="Redes Sociais">
        <TextField label="Instagram" value={get("footer.instagram", "")} onChange={(v) => set("footer.instagram", v)} placeholder="https://instagram.com/..." />
        <TextField label="Facebook" value={get("footer.facebook", "")} onChange={(v) => set("footer.facebook", v)} placeholder="https://facebook.com/..." />
        <TextField label="TikTok" value={get("footer.tiktok", "")} onChange={(v) => set("footer.tiktok", v)} placeholder="https://tiktok.com/..." />
        <TextField label="WhatsApp" value={get("footer.whatsapp", "")} onChange={(v) => set("footer.whatsapp", v)} placeholder="5511999999999" />
      </CollapsibleGroup>
      <CollapsibleGroup title="Aparência">
        <ColorField label="Cor de fundo" value={get("footer.bg_color", "")} onChange={(v) => set("footer.bg_color", v)} allSettings={allSettings} />
        <ColorField label="Cor do texto" value={get("footer.text_color", "")} onChange={(v) => set("footer.text_color", v)} allSettings={allSettings} />
      </CollapsibleGroup>
    </div>
  );
}

function ExtrasPanel({ get, set }: PanelProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="WhatsApp Flutuante" defaultOpen={true}>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Mostrar botão flutuante</span>
          <Switch checked={get("extras.whatsapp_float", "true") !== "false"} onCheckedChange={(v) => set("extras.whatsapp_float", v ? "true" : "false")} />
        </div>
        <TextField label="Número do WhatsApp" value={get("extras.whatsapp_number", "")} onChange={(v) => set("extras.whatsapp_number", v)} placeholder="5511999999999" />
        <TextField label="Mensagem padrão" value={get("extras.whatsapp_message", "Olá! Gostaria de agendar um horário.")} onChange={(v) => set("extras.whatsapp_message", v)} />
      </CollapsibleGroup>
      <CollapsibleGroup title="SEO">
        <TextField label="Título da página" value={get("seo.title", "")} onChange={(v) => set("seo.title", v)} placeholder="VINNX BARBER — Barbearia Premium" />
        <TextField label="Meta description" value={get("seo.description", "")} onChange={(v) => set("seo.description", v)} multiline placeholder="A melhor barbearia da região..." />
      </CollapsibleGroup>
      <CollapsibleGroup title="Migração de Clientes">
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm">Migração de clientes legados</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Exibe "Já é cliente?" no login do site público.<br/>
              Desative quando a migração estiver concluída.
            </p>
          </div>
          <Switch checked={get("auth.legacy_migration_enabled", "true") !== "false"} onCheckedChange={(v) => set("auth.legacy_migration_enabled", v ? "true" : "false")} />
        </div>
      </CollapsibleGroup>
      <CollapsibleGroup title="Marca d'água">
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm">Powered by VINNX</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Exibe a marca VINNX no rodapé do perfil do cliente.
            </p>
          </div>
          <Switch checked={get("branding.show_powered_by", "true") !== "false"} onCheckedChange={(v) => set("branding.show_powered_by", v ? "true" : "false")} />
        </div>
      </CollapsibleGroup>
    </div>
  );
}

// ============================================================
// ENGAGEMENT & MARKETING PANELS
// ============================================================

function AnnouncementPanel({ get, set }: PanelProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Geral" defaultOpen={true}>
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm">Ativar banner</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Exibe uma faixa de anúncio no topo do site.
            </p>
          </div>
          <Switch checked={get("announcement.enabled", "false") === "true"} onCheckedChange={(v) => set("announcement.enabled", v ? "true" : "false")} />
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Permitir fechar</span>
          <Switch checked={get("announcement.dismissible", "true") !== "false"} onCheckedChange={(v) => set("announcement.dismissible", v ? "true" : "false")} />
        </div>
      </CollapsibleGroup>
      <CollapsibleGroup title="Conteúdo">
        <TextField label="Texto do anúncio" value={get("announcement.text", "")} onChange={(v) => set("announcement.text", v)} multiline placeholder="🔥 Promoção especial esta semana!" />
        <TextField label="Texto do botão (opcional)" value={get("announcement.link_label", "")} onChange={(v) => set("announcement.link_label", v)} placeholder="Saiba mais" />
        <TextField label="URL do botão (opcional)" value={get("announcement.link_url", "")} onChange={(v) => set("announcement.link_url", v)} placeholder="https://..." />
      </CollapsibleGroup>
      <CollapsibleGroup title="Aparência">
        <div className="py-2">
          <Label className="text-[13px] text-gray-400 mb-2 block font-medium">Tipo</Label>
          <CustomDropdown value={get("announcement.type", "info")} onChange={(v) => set("announcement.type", v)} isDarkMode options={[
            { value: "info", label: "Informação" },
            { value: "promo", label: "Promoção" },
            { value: "alert", label: "Alerta" },
          ]} />
        </div>
        <ColorField label="Cor de fundo" value={get("announcement.bg_color", "")} onChange={(v) => set("announcement.bg_color", v)} />
        <ColorField label="Cor do texto" value={get("announcement.text_color", "")} onChange={(v) => set("announcement.text_color", v)} />
      </CollapsibleGroup>
    </div>
  );
}

function ReviewPanel({ get, set }: PanelProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Geral" defaultOpen={true}>
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm">Ativar avaliações</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Permite que clientes avaliem após o serviço.
            </p>
          </div>
          <Switch checked={get("review.enabled", "true") !== "false"} onCheckedChange={(v) => set("review.enabled", v ? "true" : "false")} />
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm">Indicador no menu</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Bolinha vermelha no ícone Histórico quando há avaliação pendente.
            </p>
          </div>
          <Switch checked={get("review.show_badge", "true") !== "false"} onCheckedChange={(v) => set("review.show_badge", v ? "true" : "false")} />
        </div>
      </CollapsibleGroup>
      <CollapsibleGroup title="Textos do Modal">
        <TextField label="Título" value={get("review.modal_title", "")} onChange={(v) => set("review.modal_title", v)} placeholder="Avaliar atendimento" />
        <TextField label="Pergunta de avaliação" value={get("review.question_text", "")} onChange={(v) => set("review.question_text", v)} placeholder="Como foi sua experiência?" />
        <TextField label="Label comentário (positivo)" value={get("review.comment_label", "")} onChange={(v) => set("review.comment_label", v)} placeholder="O que você mais gostou?" />
        <TextField label="Label comentário (negativo)" value={get("review.comment_label_negative", "")} onChange={(v) => set("review.comment_label_negative", v)} placeholder="O que podemos melhorar?" />
        <TextField label="Botão de envio" value={get("review.submit_label", "")} onChange={(v) => set("review.submit_label", v)} placeholder="Enviar Avaliação" />
      </CollapsibleGroup>
      <CollapsibleGroup title="Mensagem de Sucesso">
        <TextField label="Título" value={get("review.success_title", "")} onChange={(v) => set("review.success_title", v)} placeholder="Obrigado!" />
        <TextField label="Mensagem" value={get("review.success_message", "")} onChange={(v) => set("review.success_message", v)} multiline placeholder="Sua avaliação foi enviada com sucesso." />
      </CollapsibleGroup>
    </div>
  );
}

function ReferralPanel({ get, set }: PanelProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Geral" defaultOpen={true}>
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm">Ativar programa de indicação</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Mostra seção de indicação e cashback no perfil do cliente.
            </p>
          </div>
          <Switch checked={get("referral.enabled", "true") !== "false"} onCheckedChange={(v) => set("referral.enabled", v ? "true" : "false")} />
        </div>
        <TextField label="Valor mínimo para resgate (R$)" value={get("referral.min_redemption", "50")} onChange={(v) => set("referral.min_redemption", v)} type="number" />
      </CollapsibleGroup>
      <CollapsibleGroup title="Textos do Cashback">
        <TextField label="Título do programa" value={get("referral.cashback_title", "")} onChange={(v) => set("referral.cashback_title", v)} placeholder="Programa de Cashback" />
        <TextField label="Crédito por serviço (título)" value={get("referral.credit_per_service_label", "")} onChange={(v) => set("referral.credit_per_service_label", v)} placeholder="R$ 2 por Serviço" />
        <TextField label="Crédito por serviço (descrição)" value={get("referral.credit_per_service_desc", "")} onChange={(v) => set("referral.credit_per_service_desc", v)} placeholder="A cada serviço concluído, você ganha R$ 2,00 de cashback." />
        <TextField label="Crédito por indicação (título)" value={get("referral.credit_per_referral_label", "")} onChange={(v) => set("referral.credit_per_referral_label", v)} placeholder="R$ 10 por Indicação" />
        <TextField label="Crédito por indicação (descrição)" value={get("referral.credit_per_referral_desc", "")} onChange={(v) => set("referral.credit_per_referral_desc", v)} placeholder="Quando um amigo usa seu código, você ganha R$ 10,00." />
      </CollapsibleGroup>
      <CollapsibleGroup title="Convite por WhatsApp">
        <TextField label="Título do modal" value={get("referral.invite_title", "")} onChange={(v) => set("referral.invite_title", v)} placeholder="Indique e Ganhe!" />
        <TextField label="Desconto para o amigo" value={get("referral.friend_discount_text", "")} onChange={(v) => set("referral.friend_discount_text", v)} placeholder="20% OFF" />
        <TextField label="Crédito para quem indica" value={get("referral.referrer_credit_text", "")} onChange={(v) => set("referral.referrer_credit_text", v)} placeholder="R$10 de crédito" />
        <TextField label="Mensagem do WhatsApp" value={get("referral.invite_message", "")} onChange={(v) => set("referral.invite_message", v)} multiline placeholder="Use {code} para inserir o código. Ex: Fala, mestre! Use meu código {code} e ganhe desconto!" />
      </CollapsibleGroup>
      <CollapsibleGroup title="Textos do Perfil">
        <TextField label="Título do card de créditos" value={get("referral.credits_title", "")} onChange={(v) => set("referral.credits_title", v)} placeholder="Créditos de Indicação" />
        <TextField label="Parabéns (meta atingida)" value={get("referral.congrats_title", "")} onChange={(v) => set("referral.congrats_title", v)} placeholder="Parabéns! Você conseguiu!" />
        <TextField label="Botão de resgate" value={get("referral.redeem_button", "")} onChange={(v) => set("referral.redeem_button", v)} placeholder="Resgatar Corte Grátis" />
        <TextField label="Título das metas" value={get("referral.goals_title", "")} onChange={(v) => set("referral.goals_title", v)} placeholder="Metas de Indicação" />
      </CollapsibleGroup>
    </div>
  );
}

// ============================================================
// THEME PANELS
// ============================================================

function ColorsPanel({ get, set, allSettings }: PanelProps) {
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestPalette>>(null);
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Cores Principais" defaultOpen={true}>
        <ColorField label="Cor primária" value={get("theme.primary_color", "#00BF62")} onChange={(v) => set("theme.primary_color", v)} allSettings={allSettings}
          onSuggest={() => setSuggestion(suggestPalette(get("theme.primary_color", "#00BF62")))}
        />
        <ColorField label="Cor secundária" value={get("theme.secondary_color", "#1A1A2E")} onChange={(v) => set("theme.secondary_color", v)} allSettings={allSettings} />
        <ColorField label="Cor de destaque" value={get("theme.accent_color", "#D4AF37")} onChange={(v) => set("theme.accent_color", v)} allSettings={allSettings} />
      </CollapsibleGroup>

      {suggestion && (
        <CollapsibleGroup title="Sugestões de Paleta" defaultOpen={true}>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(suggestion).map(([name, hex]) => (
              <button key={name} onClick={() => { set("theme.secondary_color", hex as string); }}
                className="flex flex-col items-center gap-1 group" title={`${name}: ${hex}`}
              >
                <div className="w-10 h-10 rounded-lg border border-border transition-all group-hover:scale-110" style={{ backgroundColor: hex }} />
                <span className="text-[9px] text-muted-foreground truncate w-full text-center">{name}</span>
              </button>
            ))}
          </div>
        </CollapsibleGroup>
      )}

      <CollapsibleGroup title="Fundo do Site">
        <ColorField label="Cor de fundo" value={get("theme.bg_color", "#ffffff")} onChange={(v) => set("theme.bg_color", v)} allSettings={allSettings} />
        <ColorField label="Cor do texto" value={get("theme.text_color", "#1a1a1a")} onChange={(v) => set("theme.text_color", v)} allSettings={allSettings} />
      </CollapsibleGroup>
    </div>
  );
}

function TypographyPanel({ get, set }: PanelProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Fonte" defaultOpen={true}>
        <div className="py-2">
          <Label className="text-[13px] text-gray-400 mb-2 block font-medium">Família de fonte</Label>
          <CustomDropdown value={get("theme.font_family", "Inter")} onChange={(v) => set("theme.font_family", v)} isDarkMode options={[
            { value: "Inter", label: "Inter" },
            { value: "Poppins", label: "Poppins" },
            { value: "Roboto", label: "Roboto" },
            { value: "Montserrat", label: "Montserrat" },
            { value: "Playfair Display", label: "Playfair Display" },
            { value: "Oswald", label: "Oswald" },
            { value: "Bebas Neue", label: "Bebas Neue" },
          ]} />
        </div>
        <div className="py-2">
          <Label className="text-[13px] text-gray-400 mb-2 block font-medium">Fonte dos títulos</Label>
          <CustomDropdown value={get("theme.heading_font", "Inter")} onChange={(v) => set("theme.heading_font", v)} isDarkMode options={[
            { value: "Inter", label: "Inter" },
            { value: "Poppins", label: "Poppins" },
            { value: "Montserrat", label: "Montserrat" },
            { value: "Playfair Display", label: "Playfair Display" },
            { value: "Oswald", label: "Oswald" },
            { value: "Bebas Neue", label: "Bebas Neue" },
          ]} />
        </div>
      </CollapsibleGroup>
    </div>
  );
}

function ButtonsPanel({ get, set, allSettings }: PanelProps) {
  return (
    <div className="px-5 py-5 space-y-4">
      <CollapsibleGroup title="Estilo dos Botões" defaultOpen={true}>
        <div className="py-2">
          <Label className="text-[13px] text-gray-400 mb-2 block font-medium">Formato</Label>
          <CustomDropdown value={get("theme.btn_radius", "8")} onChange={(v) => set("theme.btn_radius", v)} isDarkMode options={[
            { value: "0", label: "Quadrado" },
            { value: "4", label: "Levemente arredondado" },
            { value: "8", label: "Arredondado" },
            { value: "16", label: "Muito arredondado" },
            { value: "9999", label: "Pílula" },
          ]} />
        </div>
        <ColorField label="Cor de fundo dos botões" value={get("theme.btn_bg_color", "")} onChange={(v) => set("theme.btn_bg_color", v)} allSettings={allSettings} />
        <ColorField label="Cor do texto dos botões" value={get("theme.btn_text_color", "#ffffff")} onChange={(v) => set("theme.btn_text_color", v)} allSettings={allSettings} />
      </CollapsibleGroup>
      <CollapsibleGroup title="Cards">
        <div className="py-2">
          <Label className="text-[13px] text-gray-400 mb-2 block font-medium">Borda dos cards</Label>
          <CustomDropdown value={get("theme.card_radius", "12")} onChange={(v) => set("theme.card_radius", v)} isDarkMode options={[
            { value: "0", label: "Quadrado" },
            { value: "8", label: "Arredondado" },
            { value: "12", label: "Mais arredondado" },
            { value: "16", label: "Bem arredondado" },
          ]} />
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Sombra nos cards</span>
          <Switch checked={get("theme.card_shadow", "true") !== "false"} onCheckedChange={(v) => set("theme.card_shadow", v ? "true" : "false")} />
        </div>
      </CollapsibleGroup>
      <CollapsibleGroup title="Escala da Interface">
        <div className="py-2">
          <Label className="text-xs mb-2 block">Tamanho dos componentes</Label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">70%</span>
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.05"
              value={get("theme.ui_scale", "1")}
              onChange={(e) => set("theme.ui_scale", e.target.value)}
              className="flex-1 accent-primary h-1.5"
            />
            <span className="text-xs text-muted-foreground w-8">130%</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-medium">{Math.round(parseFloat(get("theme.ui_scale", "1")) * 100)}%</span>
            <button
              onClick={() => set("theme.ui_scale", "1")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >Resetar</button>
          </div>
        </div>
      </CollapsibleGroup>
    </div>
  );
}

// ============================================================
// PWA PANEL
// ============================================================

function PWAPanel({ get, set, allSettings }: PanelProps) {
  const [generatingIcon, setGeneratingIcon] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const currentIcon = get("pwa_store_icon", "");
  const bgColor = get("pwa_store_icon_bg", "#10b981");

  const generateIconFromLogo = async () => {
    setGeneratingIcon(true);
    try {
      // Try loading logo, then hero logo, then company logo from settings
      const logoUrl = get("loading.logo", "") || get("hero.logo", "");
      if (!logoUrl) throw new Error("Nenhum logo encontrado. Configure um logo primeiro.");

      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas não suportado");

      // Draw background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, 512, 512);

      // Load logo
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Erro ao carregar logo"));
        img.src = logoUrl;
      });

      // Draw logo centered with padding
      const pad = 64;
      const maxW = 512 - pad * 2;
      const maxH = 512 - pad * 2;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h);

      // Convert to blob and upload
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Erro ao gerar imagem"))), "image/png");
      });

      const file = new File([blob], `pwa-store-icon-${Date.now()}.png`, { type: "image/png" });
      const url = await uploadStoreAsset(file, "pwa-icons");
      set("pwa_store_icon", url);
      toast.success("Sucesso", "Ícone da loja gerado com sucesso");
    } catch (err: any) {
      toast.error("Erro", err?.message || "Erro ao gerar ícone");
    } finally {
      setGeneratingIcon(false);
    }
  };

  const handleCustomUpload = async (file: File) => {
    try {
      const url = await uploadStoreAsset(file, "pwa-icons");
      set("pwa_store_icon", url);
      toast.success("Sucesso", "Ícone da loja enviado");
    } catch (err: any) {
      toast.error("Erro", err?.message || "Erro ao enviar");
    }
  };

  return (
    <div className="px-5 py-5 space-y-4">
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Configure o app instalável da loja. Quando o cliente "instala" o site no celular,
        essas configurações definem o ícone, nome e cor tema.
      </p>

      {/* Name */}
      <CollapsibleGroup title="Identidade do App" defaultOpen={true}>
        <TextField label="Nome do App" value={get("pwa_store_name", "VINNX BARBER")} onChange={(v) => set("pwa_store_name", v)} placeholder="VINNX BARBER" />
        <TextField label="Nome curto" value={get("pwa_store_short_name", "VINNX")} onChange={(v) => set("pwa_store_short_name", v)} placeholder="VINNX" />
      </CollapsibleGroup>

      {/* Icon */}
      <CollapsibleGroup title="Ícone do App" defaultOpen={true}>
        {/* Current icon preview */}
        <div className="flex items-center gap-4 py-3">
          <div
            className="w-16 h-16 rounded-xl border-2 border-white/10 overflow-hidden flex items-center justify-center shrink-0"
            style={{ backgroundColor: currentIcon ? "transparent" : bgColor }}
          >
            {currentIcon ? (
              <img src={currentIcon} alt="PWA Icon" className="w-full h-full object-cover" />
            ) : (
              <Download className="w-6 h-6 text-gray-500" />
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="text-xs text-gray-400">
              {currentIcon ? "Ícone personalizado ativo" : "Nenhum ícone definido"}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="gap-1.5 h-7 text-[11px] px-2.5 border-white/10"
              >
                <Upload className="w-3 h-3" />
                Enviar
              </Button>
              {currentIcon && (
                <button
                  onClick={() => set("pwa_store_icon", "")}
                  className="h-7 px-2 text-[11px] text-red-400 hover:text-red-300 rounded-md hover:bg-red-500/10 transition-colors"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCustomUpload(f);
            e.target.value = "";
          }}
        />

        <p className="text-[10px] text-gray-500 pt-1">Recomendado: 512×512px, PNG com fundo sólido.</p>

        {/* Generate from logo — separated from nested card to avoid ColorField popup clipping */}
        <div className="border-t border-white/[0.04] mt-3 pt-3 space-y-2">
          <p className="text-xs font-medium text-gray-300">Gerar a partir do logo</p>
          <p className="text-[10px] text-gray-500">
            Usa o logo da tela de loading sobre a cor de fundo abaixo.
          </p>
          <ColorField
            label="Cor de fundo do ícone"
            value={bgColor}
            onChange={(v) => set("pwa_store_icon_bg", v)}
            allSettings={allSettings}
          />
          <Button
            onClick={generateIconFromLogo}
            disabled={generatingIcon}
            variant="outline"
            className="w-full gap-2 h-8 text-[11px] border-white/10 hover:border-orange-500/30"
          >
            {generatingIcon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generatingIcon ? "Gerando..." : "Gerar ícone do logo"}
          </Button>
        </div>
      </CollapsibleGroup>

      {/* Browser Colors */}
      <CollapsibleGroup title="Prompt de Instalação">
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm">Banner "Instalar App"</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Exibe um banner sugerindo a instalação do app.<br/>
              Aparece após 10s e some por 7 dias após fechar.
            </p>
          </div>
          <Switch checked={get("pwa.install_prompt_enabled", "true") !== "false"} onCheckedChange={(v) => set("pwa.install_prompt_enabled", v ? "true" : "false")} />
        </div>
      </CollapsibleGroup>

      <CollapsibleGroup title="Cores do Navegador">
        <p className="text-[10px] text-gray-500 mb-1">
          A cor tema aparece na barra do navegador mobile e na splash screen ao abrir o app.
        </p>
        <ColorField
          label="Cor tema (barra do navegador)"
          value={get("pwa_store_theme_color", "#10b981")}
          onChange={(v) => set("pwa_store_theme_color", v)}
          allSettings={allSettings}
        />
        <ColorField
          label="Cor de fundo (splash screen)"
          value={get("pwa_store_bg_color", "#0f172a")}
          onChange={(v) => set("pwa_store_bg_color", v)}
          allSettings={allSettings}
        />
      </CollapsibleGroup>

      <canvas ref={canvasRef} width={512} height={512} className="hidden" />
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function StoreCustomizer({ isDarkMode, currentUser }: { isDarkMode?: boolean; currentUser?: any }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { settings, getSetting, saveSettings, isLoading, isSaving } = useStoreCustomization();
  const [activeCategory, setActiveCategory] = useState("appearance");
  const [activePanel, setActivePanel] = useState<{ key: string; type: "section" | "theme" } | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Section order state
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_REORDERABLE_KEYS);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close add menu on outside click
  useEffect(() => {
    if (!showAddMenu) return;
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAddMenu]);

  useEffect(() => {
    if (!initialized && !isLoading) {
      // Initialize draft even if store_settings table is empty (first use)
      if (settings && Object.keys(settings).length > 0) {
        setDraft({ ...settings });
        if (settings["sections.order"]) {
          try {
            const saved = JSON.parse(settings["sections.order"]);
            if (Array.isArray(saved) && saved.length > 0) setSectionOrder(saved);
          } catch { /* use default */ }
        }
      }
      setInitialized(true);
    }
  }, [settings, initialized, isLoading]);

  const updateSectionOrder = useCallback((newOrder: string[]) => {
    setSectionOrder(newOrder);
    setDraft((prev) => ({ ...prev, "sections.order": JSON.stringify(newOrder) }));
    setHasChanges(true);
  }, []);

  const handleDuplicateSection = useCallback((key: string) => {
    const base = getBaseKey(key);
    let maxNum = 1;
    for (const k of sectionOrder) {
      if (k === base) continue;
      if (k.startsWith(base + "_")) {
        const num = parseInt(k.slice(base.length + 1), 10);
        if (!isNaN(num) && num >= maxNum) maxNum = num;
      }
    }
    const newKey = `${base}_${maxNum + 1}`;
    setDraft((prev) => {
      const copy = { ...prev };
      const sourcePrefix = key + ".";
      for (const [k, v] of Object.entries(prev)) {
        if (k.startsWith(sourcePrefix)) {
          copy[newKey + "." + k.slice(sourcePrefix.length)] = v;
        }
      }
      return copy;
    });
    const idx = sectionOrder.indexOf(key);
    const newOrder = [...sectionOrder];
    newOrder.splice(idx + 1, 0, newKey);
    updateSectionOrder(newOrder);
    setHasChanges(true);
    toast.success("Sucesso", `Seção duplicada: ${getSectionDef(newKey)?.label || newKey}`);
  }, [sectionOrder, updateSectionOrder, toast]);

  const handleRemoveSection = useCallback((key: string) => {
    const newOrder = sectionOrder.filter((k) => k !== key);
    updateSectionOrder(newOrder);
    setDraft((prev) => {
      const copy = { ...prev };
      const prefix = key + ".";
      for (const k of Object.keys(prev)) {
        if (k.startsWith(prefix) || k === `sections.${key}_visible`) {
          delete copy[k];
        }
      }
      return copy;
    });
    setHasChanges(true);
    toast.info("Info", "Seção removida");
  }, [sectionOrder, updateSectionOrder, toast]);

  const handleAddSection = useCallback((baseKey: string) => {
    let maxNum = 1;
    for (const k of sectionOrder) {
      if (k === baseKey) continue;
      if (k.startsWith(baseKey + "_")) {
        const num = parseInt(k.slice(baseKey.length + 1), 10);
        if (!isNaN(num) && num >= maxNum) maxNum = num;
      }
    }
    const newKey = `${baseKey}_${maxNum + 1}`;
    setDraft((prev) => {
      const copy = { ...prev };
      const sourcePrefix = baseKey + ".";
      for (const [k, v] of Object.entries(prev)) {
        if (k.startsWith(sourcePrefix)) {
          copy[newKey + "." + k.slice(sourcePrefix.length)] = v;
        }
      }
      return copy;
    });
    const baseIdx = sectionOrder.indexOf(baseKey);
    const newOrder = [...sectionOrder];
    if (baseIdx >= 0) {
      newOrder.splice(baseIdx + 1, 0, newKey);
    } else {
      newOrder.push(newKey);
    }
    updateSectionOrder(newOrder);
    setShowAddMenu(false);
    setHasChanges(true);
    setActivePanel({ key: newKey, type: "section" });
    toast.success("Sucesso", `Seção adicionada: ${getSectionDef(newKey)?.label || newKey}`);
  }, [sectionOrder, updateSectionOrder, toast]);

  // Send draft to iframe for live preview
  useEffect(() => {
    if (!initialized) return;
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "store-customizer-preview", draft },
        window.location.origin
      );
    }
  }, [draft, initialized]);

  const get = useCallback(
    (key: string, fallback: string = ""): string => {
      if (key in draft) return draft[key];
      return getSetting(key, fallback);
    },
    [draft, getSetting]
  );

  const set = useCallback((key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    const entries = Object.entries(draft)
      .filter(([key, v]) => v !== undefined && v !== settings[key])
      .map(([key, value]) => ({ key, value }));
    if (entries.length === 0) {
      toast.info("Info", "Nenhuma alteração.");
      setHasChanges(false);
      return;
    }
    try {
      await saveSettings(entries);
      setHasChanges(false);
      toast.success("Sucesso", `${entries.length} configuração(ões) salva(s)`);
    } catch (err: any) {
      toast.error("Erro", err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // ============================================================
  // PANEL RENDERER
  // ============================================================
  const renderPanel = () => {
    if (activePanel) {
      const { key, type } = activePanel;
      const allItems = CATEGORIES.flatMap(c => c.items);
      const item = allItems.find(i => i.key === key);
      const panelProps = { get, set, allSettings: draft };

      return (
        <>
          <div className="h-14 border-b border-white/[0.06] flex items-center gap-3 px-4 flex-shrink-0">
            <button onClick={() => setActivePanel(null)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-[15px] font-semibold text-white">{item?.label || ""}</span>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
            {type === "theme" && key === "colors" && <ColorsPanel {...panelProps} />}
            {type === "theme" && key === "typography" && <TypographyPanel {...panelProps} />}
            {type === "theme" && key === "buttons" && <ButtonsPanel {...panelProps} />}
            {type === "section" && key === "loading" && <LoadingPanel {...panelProps} />}
            {type === "section" && key === "hero" && <HeroPanel {...panelProps} />}
            {type === "section" && key === "booking" && <BookingPanel {...panelProps} />}
            {type === "section" && key === "navbar" && <NavbarPanel {...panelProps} />}
            {type === "section" && key === "footer" && <FooterPanel {...panelProps} />}
            {type === "section" && key === "extras" && <ExtrasPanel {...panelProps} />}
            {type === "section" && key === "announcement" && <AnnouncementPanel {...panelProps} />}
            {type === "section" && key === "review" && <ReviewPanel {...panelProps} />}
            {type === "section" && key === "referral" && <ReferralPanel {...panelProps} />}
            {type === "section" && key === "pwa" && <PWAPanel {...panelProps} />}
          </div>
        </>
      );
    }

    // Category overview – show items as elegant cards
    const cat = CATEGORIES.find(c => c.key === activeCategory);
    if (!cat) return null;

    return (
      <>
        <div className="h-14 border-b border-white/[0.06] flex items-center px-5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center mr-3">
            <cat.icon className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-[15px] font-semibold text-white">{cat.label}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cat.items.map(item => (
            <button key={item.key} onClick={() => setActivePanel({ key: item.key, type: item.panelType })}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.04] hover:border-orange-500/20 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.04] flex items-center justify-center group-hover:bg-orange-500/[0.1] group-hover:border-orange-500/20 transition-all duration-200">
                <item.icon className="w-[18px] h-[18px] text-gray-500 group-hover:text-orange-400 transition-colors duration-200" />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors" />
            </button>
          ))}
        </div>
      </>
    );
  };

  // iframe src: Public site route via hash
  const previewSrc = `${window.location.origin}${window.location.pathname}#/site`;

  return (
    <div className="dark fixed inset-0 flex flex-col z-50" style={{ background: "#080808" }}>
      {/* ===== TOOLBAR ===== */}
      <div className="h-[52px] border-b border-white/[0.06] flex items-center justify-between px-4 flex-shrink-0" style={{ background: "#0e0e0e" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
          <div className="h-5 w-px bg-white/[0.06]" />
          <span className="text-sm font-semibold text-white tracking-tight">{get("store_name", "VINNX BARBER")}</span>
          <button
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}#/site`;
              navigator.clipboard?.writeText(url).then(() => toast.success("Link copiado", url)).catch(() => toast.info("Link", url));
            }}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors text-gray-500 hover:text-white"
            title="Copiar link público"
          ><Copy className="w-3 h-3" /></button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
            <button onClick={() => setPreviewMode("desktop")}
              className={`p-1.5 rounded-md transition-all ${previewMode === "desktop" ? "bg-white/[0.1] text-white shadow-sm" : "text-gray-500 hover:text-gray-300"}`}
              title="Desktop"><Monitor className="w-4 h-4" /></button>
            <button onClick={() => setPreviewMode("mobile")}
              className={`p-1.5 rounded-md transition-all ${previewMode === "mobile" ? "bg-white/[0.1] text-white shadow-sm" : "text-gray-500 hover:text-gray-300"}`}
              title="Mobile"><Smartphone className="w-4 h-4" /></button>
          </div>

          <div className="h-5 w-px bg-white/[0.06]" />

          {hasChanges && (
            <span className="text-[11px] text-orange-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Não salvo
            </span>
          )}
          {hasChanges && (
            <Button onClick={() => { setDraft({...settings}); setHasChanges(false); toast.info("Info", "Alterações descartadas."); }}
              size="sm" variant="outline" className="h-7 text-[11px] px-2.5 border-white/10 text-gray-400 hover:text-white">
              Descartar
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="sm"
            className="h-7 text-[11px] px-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 font-semibold shadow-lg shadow-orange-500/20 disabled:opacity-40 disabled:shadow-none">
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            <span className="ml-1">Salvar</span>
          </Button>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Rail */}
        <div className="w-[80px] border-r border-white/[0.04] flex flex-col pt-3 flex-shrink-0" style={{ background: "#070707" }}>
          {CATEGORIES.map(cat => (
            <button key={cat.key}
              onClick={() => { setActiveCategory(cat.key); setActivePanel(null); }}
              className={`relative flex flex-col items-center gap-1 py-3 mx-1.5 my-0.5 rounded-xl transition-all duration-200 ${
                activeCategory === cat.key
                  ? "text-orange-400 bg-orange-500/[0.08]"
                  : "text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]"
              }`}
            >
              {activeCategory === cat.key && (
                <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-gradient-to-b from-orange-500 to-amber-500" />
              )}
              <cat.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight text-center w-full px-1">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="w-[360px] border-r border-white/[0.04] flex flex-col flex-shrink-0 overflow-hidden" style={{ background: "#0e0e0e" }}>
          {renderPanel()}
        </div>

        {/* Preview */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-6" style={{ background: "radial-gradient(ellipse at 50% 50%, #181818 0%, #0a0a0a 70%)" }}>
          <div className={`overflow-hidden transition-all duration-500 ease-out ${
            previewMode === "desktop"
              ? "w-full h-full rounded-xl shadow-2xl shadow-black/50"
              : "w-[375px] h-[812px] rounded-[44px] border-[6px] border-neutral-800 shadow-2xl shadow-black/60"
          }`}>
            <iframe
              ref={iframeRef}
              src={previewSrc}
              className="w-full h-full border-0 block bg-white"
              title="Store Preview"
              onLoad={() => {
                if (iframeRef.current?.contentWindow && Object.keys(draft).length > 0) {
                  iframeRef.current.contentWindow.postMessage(
                    { type: "store-customizer-preview", draft },
                    window.location.origin
                  );
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

