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
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

type SidebarView =
  | { level: "sections" }
  | { level: "edit"; sectionKey: string }
  | { level: "theme-menu" }
  | { level: "theme-edit"; themeKey: string };

type PreviewMode = "desktop" | "mobile";

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

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
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
    <div className="relative py-2" ref={popRef}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <Input
            value={value || ""} onChange={(e) => onChange(e.target.value)}
            placeholder="#000000" className="w-28 h-8 font-mono text-[11px] text-right"
          />
          <button
            onClick={() => setOpen(!open)}
            className="w-8 h-8 rounded-lg border border-border cursor-pointer flex items-center justify-center shrink-0 transition-all hover:ring-2 hover:ring-orange-400/50"
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
        <div className="absolute right-0 top-full mt-1 z-50 w-[280px] bg-card border border-border rounded-xl shadow-2xl p-3 space-y-3" style={{ animation: 'fadeZoomIn 150ms ease-out' }}>
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
    <div className="py-2">
      <Label className="text-sm text-foreground mb-2 block">{label}</Label>
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
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="URL ou clique para upload" className="h-9 text-sm flex-1" />
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
    <div className="py-2">
      <Label className="text-sm text-foreground mb-2 block">{label}</Label>
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
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="URL do vídeo ou clique para upload" className="h-9 text-sm flex-1" />
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
    <div className="py-2">
      <Label className="text-sm text-foreground mb-1.5 block">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="text-sm" />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 text-sm" type={type} />
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
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  );
}

// ============================================================
type PanelProps = { get: (k: string, f?: string) => string; set: (k: string, v: string) => void; allSettings?: Record<string, string> };

// SECTION EDIT PANELS
// ============================================================

function LoadingPanel({ get, set, allSettings }: PanelProps) {
  return (
    <div className="px-4 py-3 space-y-3">
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
    <div className="px-4 py-3 space-y-3">
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
    <div className="px-4 py-3 space-y-3">
      <CollapsibleGroup title="Regras de Agendamento" defaultOpen={true}>
        <div className="py-2">
          <Label className="text-xs mb-1 block">Dias máx. para agendar</Label>
          <Select value={get("booking.max_advance_days", "30")} onChange={(e) => set("booking.max_advance_days", e.target.value)}>
            <option value="7">7 dias</option>
            <option value="14">14 dias</option>
            <option value="30">30 dias</option>
            <option value="60">60 dias</option>
          </Select>
        </div>
        <div className="py-2">
          <Label className="text-xs mb-1 block">Máx. agendamentos abertos</Label>
          <Select value={get("booking.max_open_appointments", "2")} onChange={(e) => set("booking.max_open_appointments", e.target.value)}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="5">5</option>
          </Select>
        </div>
        <div className="py-2">
          <Label className="text-xs mb-1 block">Intervalo entre slots (min)</Label>
          <Select value={get("booking.slot_interval", "30")} onChange={(e) => set("booking.slot_interval", e.target.value)}>
            <option value="15">15 min</option>
            <option value="20">20 min</option>
            <option value="30">30 min</option>
            <option value="40">40 min</option>
            <option value="60">60 min</option>
          </Select>
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
            <Label className="text-xs mb-0.5 block">Abertura</Label>
            <Input type="time" value={get("booking.default_start_time", "08:00")} onChange={(e) => set("booking.default_start_time", e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex-1">
            <Label className="text-xs mb-0.5 block">Fechamento</Label>
            <Input type="time" value={get("booking.default_end_time", "19:00")} onChange={(e) => set("booking.default_end_time", e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1">
            <Label className="text-xs mb-0.5 block">Início Intervalo</Label>
            <Input type="time" value={get("booking.default_break_start", "12:00")} onChange={(e) => set("booking.default_break_start", e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex-1">
            <Label className="text-xs mb-0.5 block">Fim Intervalo</Label>
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
    <div className="px-4 py-3 space-y-3">
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
          <Label className="text-xs mb-1 block">Aba padrão (abrir primeiro)</Label>
          <Select value={get("navbar.default_tab", "agendar")} onChange={(e) => set("navbar.default_tab", e.target.value)}>
            {TABS.filter(t => get(`navbar.tab_${t.key}_visible`, "true") !== "false").map((t) => (
              <option key={t.key} value={t.key}>{get(`navbar.tab_${t.key}_label`, "") || t.defaultLabel}</option>
            ))}
          </Select>
        </div>
      </CollapsibleGroup>
    </div>
  );
}

function FooterPanel({ get, set, allSettings }: PanelProps) {
  return (
    <div className="px-4 py-3 space-y-3">
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
    <div className="px-4 py-3 space-y-3">
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
    </div>
  );
}

// ============================================================
// THEME PANELS
// ============================================================

function ColorsPanel({ get, set, allSettings }: PanelProps) {
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestPalette>>(null);
  return (
    <div className="px-4 py-3 space-y-3">
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
    <div className="px-4 py-3 space-y-3">
      <CollapsibleGroup title="Fonte" defaultOpen={true}>
        <div className="py-2">
          <Label className="text-xs mb-1 block">Família de fonte</Label>
          <Select value={get("theme.font_family", "Inter")} onChange={(e) => set("theme.font_family", e.target.value)}>
            <option value="Inter">Inter</option>
            <option value="Poppins">Poppins</option>
            <option value="Roboto">Roboto</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Playfair Display">Playfair Display</option>
            <option value="Oswald">Oswald</option>
            <option value="Bebas Neue">Bebas Neue</option>
          </Select>
        </div>
        <div className="py-2">
          <Label className="text-xs mb-1 block">Fonte dos títulos</Label>
          <Select value={get("theme.heading_font", "Inter")} onChange={(e) => set("theme.heading_font", e.target.value)}>
            <option value="Inter">Inter</option>
            <option value="Poppins">Poppins</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Playfair Display">Playfair Display</option>
            <option value="Oswald">Oswald</option>
            <option value="Bebas Neue">Bebas Neue</option>
          </Select>
        </div>
      </CollapsibleGroup>
    </div>
  );
}

function ButtonsPanel({ get, set, allSettings }: PanelProps) {
  return (
    <div className="px-4 py-3 space-y-3">
      <CollapsibleGroup title="Estilo dos Botões" defaultOpen={true}>
        <div className="py-2">
          <Label className="text-xs mb-1 block">Formato</Label>
          <Select value={get("theme.btn_radius", "8")} onChange={(e) => set("theme.btn_radius", e.target.value)}>
            <option value="0">Quadrado</option>
            <option value="4">Levemente arredondado</option>
            <option value="8">Arredondado</option>
            <option value="16">Muito arredondado</option>
            <option value="9999">Pílula</option>
          </Select>
        </div>
        <ColorField label="Cor de fundo dos botões" value={get("theme.btn_bg_color", "")} onChange={(v) => set("theme.btn_bg_color", v)} allSettings={allSettings} />
        <ColorField label="Cor do texto dos botões" value={get("theme.btn_text_color", "#ffffff")} onChange={(v) => set("theme.btn_text_color", v)} allSettings={allSettings} />
      </CollapsibleGroup>
      <CollapsibleGroup title="Cards">
        <div className="py-2">
          <Label className="text-xs mb-1 block">Borda dos cards</Label>
          <Select value={get("theme.card_radius", "12")} onChange={(e) => set("theme.card_radius", e.target.value)}>
            <option value="0">Quadrado</option>
            <option value="8">Arredondado</option>
            <option value="12">Mais arredondado</option>
            <option value="16">Bem arredondado</option>
          </Select>
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
// MAIN COMPONENT
// ============================================================

export function StoreCustomizer({ isDarkMode, currentUser }: { isDarkMode?: boolean; currentUser?: any }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { settings, getSetting, saveSettings, isLoading, isSaving } = useStoreCustomization();
  const [sidebarView, setSidebarView] = useState<SidebarView>({ level: "sections" });
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
    setSidebarView({ level: "edit", sectionKey: newKey });
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

  // Render a single section row in the sidebar
  const renderSectionRow = (sectionKey: string, opts: { draggable: boolean; index?: number; isDuplicate?: boolean }) => {
    const def = getSectionDef(sectionKey);
    if (!def) return null;
    const isVisible = get(`sections.${sectionKey}_visible`, "true") !== "false";
    const isDup = opts.isDuplicate || false;
    const isDragTarget = opts.index !== undefined && dragOver === opts.index && dragFrom !== opts.index;
    const baseDef = SECTIONS.find((s) => s.key === getBaseKey(sectionKey));
    const canDuplicate = !!baseDef?.duplicable;

    return (
      <div
        key={sectionKey}
        className={`flex items-center gap-2 px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-all group ${
          isDragTarget ? "border-l-2 border-l-orange-500 bg-orange-500/5" : ""
        }`}
        onClick={() => setSidebarView({ level: "edit", sectionKey })}
        draggable={opts.draggable}
        onDragStart={opts.draggable && opts.index !== undefined ? (e) => {
          setDragFrom(opts.index!);
          e.dataTransfer.effectAllowed = "move";
        } : undefined}
        onDragOver={opts.draggable && opts.index !== undefined ? (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOver(opts.index!);
        } : undefined}
        onDragLeave={opts.draggable ? () => setDragOver(null) : undefined}
        onDrop={opts.draggable && opts.index !== undefined ? (e) => {
          e.preventDefault();
          if (dragFrom !== null && dragFrom !== opts.index!) {
            const newOrder = [...sectionOrder];
            const [moved] = newOrder.splice(dragFrom, 1);
            newOrder.splice(opts.index!, 0, moved);
            updateSectionOrder(newOrder);
          }
          setDragFrom(null);
          setDragOver(null);
        } : undefined}
        onDragEnd={opts.draggable ? () => { setDragFrom(null); setDragOver(null); } : undefined}
      >
        {opts.draggable ? (
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 cursor-grab" />
        ) : (
          <Lock className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
        )}
        <def.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-sm truncate">{def.label}</span>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {canDuplicate && (
            <button onClick={(e) => { e.stopPropagation(); handleDuplicateSection(sectionKey); }}
              className="p-1 rounded hover:bg-muted transition-colors" title="Duplicar seção"
            ><Copy className="w-3 h-3 text-muted-foreground" /></button>
          )}
          {isDup && (
            <button onClick={(e) => { e.stopPropagation(); handleRemoveSection(sectionKey); }}
              className="p-1 rounded hover:bg-red-500/10 transition-colors" title="Remover seção"
            ><Trash2 className="w-3 h-3 text-red-400" /></button>
          )}
        </div>

        {getBaseKey(sectionKey) !== "extras" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              set(`sections.${sectionKey}_visible`, isVisible ? "false" : "true");
            }}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            {isVisible ? <Eye className="w-3.5 h-3.5 text-muted-foreground" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
          </button>
        )}
        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  };

  const renderSidebar = () => {
    if (sidebarView.level === "sections") {
      return (
        <>
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Página Inicial</h3>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {FIXED_TOP.map((s) => renderSectionRow(s.key, { draggable: false }))}

            {sectionOrder.map((key, idx) => {
              const baseKey = getBaseKey(key);
              const isDuplicate = key !== baseKey;
              return renderSectionRow(key, { draggable: true, index: idx, isDuplicate });
            })}

            <div className="relative px-3 py-2" ref={addMenuRef}>
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-2 w-full py-2 px-3 rounded-lg border border-dashed border-border/80 hover:border-orange-500/50 hover:bg-muted/30 transition-colors text-sm text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar seção
              </button>
              {showAddMenu && (
                <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1" style={{ animation: 'fadeZoomIn 150ms ease-out' }}>
                  {DUPLICABLE_SECTIONS.map((s) => (
                    <button key={s.key} onClick={() => handleAddSection(s.key)}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                    >
                      <s.icon className="w-3.5 h-3.5 text-muted-foreground" /> {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {FIXED_BOTTOM.map((s) => renderSectionRow(s.key, { draggable: false }))}

            <div className="px-4 py-3 border-t border-border space-y-1">
              <button
                onClick={() => setSidebarView({ level: "theme-menu" })}
                className="flex items-center gap-3 w-full text-left py-2 px-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium flex-1">Configurações do Tema</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </>
      );
    }

    if (sidebarView.level === "edit") {
      const sKey = sidebarView.sectionKey;
      const baseKey = getBaseKey(sKey);
      const def = getSectionDef(sKey);
      const scopedGet = sKey !== baseKey
        ? (k: string, f: string = "") => {
            if (k.startsWith(baseKey + ".")) return get(sKey + k.slice(baseKey.length), f);
            return get(k, f);
          }
        : get;
      const scopedSet = sKey !== baseKey
        ? (k: string, v: string) => {
            if (k.startsWith(baseKey + ".")) set(sKey + k.slice(baseKey.length), v);
            else set(k, v);
          }
        : set;
      const panelProps = { get: scopedGet, set: scopedSet, allSettings: draft };
      return (
        <>
          <SectionHeader title={def?.label || ""} onBack={() => setSidebarView({ level: "sections" })} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {baseKey === "loading" && <LoadingPanel {...panelProps} />}
            {baseKey === "hero" && <HeroPanel {...panelProps} />}
            {baseKey === "booking" && <BookingPanel {...panelProps} />}
            {baseKey === "navbar" && <NavbarPanel {...panelProps} />}
            {baseKey === "footer" && <FooterPanel {...panelProps} />}
            {baseKey === "extras" && <ExtrasPanel {...panelProps} />}
          </div>
        </>
      );
    }

    if (sidebarView.level === "theme-menu") {
      return (
        <>
          <SectionHeader title="Configurações do Tema" onBack={() => setSidebarView({ level: "sections" })} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {THEME_ITEMS.map((item) => (
              <div key={item.key} onClick={() => setSidebarView({ level: "theme-edit", themeKey: item.key })}
                className="flex items-center gap-3 px-4 py-4 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors group"
              >
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm flex-1">{item.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </>
      );
    }

    if (sidebarView.level === "theme-edit") {
      const item = THEME_ITEMS.find((i) => i.key === sidebarView.themeKey);
      const panelProps = { get, set, allSettings: draft };
      return (
        <>
          <SectionHeader title={item?.label || ""} onBack={() => setSidebarView({ level: "theme-menu" })} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {sidebarView.themeKey === "colors" && <ColorsPanel {...panelProps} />}
            {sidebarView.themeKey === "typography" && <TypographyPanel {...panelProps} />}
            {sidebarView.themeKey === "buttons" && <ButtonsPanel {...panelProps} />}
          </div>
        </>
      );
    }

    return null;
  };

  // iframe src: Public site route via hash
  const previewSrc = `${window.location.origin}${window.location.pathname}#/site`;

  return (
    <div className="dark fixed inset-0 flex flex-col bg-background z-50">
      {/* ===== TOOLBAR ===== */}
      <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Sair</span>
          </button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm font-semibold">{get("store_name", "VINNX BARBER")}</span>
          <button
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}#/site`;
              navigator.clipboard?.writeText(url).then(() => {
                toast.success("Link copiado", url);
              }).catch(() => {
                toast.info("Link", url);
              });
            }}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Copiar link público"
          ><Copy className="w-3.5 h-3.5" /></button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setPreviewMode("desktop")}
              className={`p-1.5 rounded-md transition-colors ${previewMode === "desktop" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              title="Desktop"
            ><Monitor className="w-4 h-4" /></button>
            <button
              onClick={() => setPreviewMode("mobile")}
              className={`p-1.5 rounded-md transition-colors ${previewMode === "mobile" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              title="Mobile"
            ><Smartphone className="w-4 h-4" /></button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {hasChanges && (
            <span className="text-xs text-orange-400 flex items-center gap-1.5 mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Não salvo
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 h-8"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-[380px] border-r border-border bg-card flex flex-col flex-shrink-0 overflow-hidden">
          {renderSidebar()}
        </div>

        {/* Preview */}
        <div className="flex-1 bg-muted/30 flex items-center justify-center overflow-hidden p-4">
          <div
            className={`overflow-hidden transition-all duration-300 ${
              previewMode === "desktop"
                ? "w-full h-full rounded-lg shadow-2xl"
                : "w-[375px] h-[667px] border-[8px] border-neutral-800 rounded-[2rem] shadow-2xl"
            }`}
          >
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
