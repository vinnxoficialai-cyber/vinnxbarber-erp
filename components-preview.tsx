import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import {
  AreaChart as RechartsAreaChart, Area,
  BarChart as RechartsBarChart, Bar,
  LineChart as RechartsLineChart, Line,
  PieChart as RechartsPieChart, Pie, Cell,
  RadarChart as RechartsRadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

/* ═══════════════════════════════════════════════════════════
   TOKENS (§1.1)
   ═══════════════════════════════════════════════════════════ */
const T = {
  bgPage: "#121214", bgCard: "#18181B", bgElevated: "#27272A", bgElement: "#3F3F46",
  border: "#27272A", textPrimary: "#FFFFFF", textHeading: "#F4F4F5", textBody: "#E4E4E7",
  textMuted: "#A1A1AA", textDisabled: "#71717A", textFaded: "#52525B",
  accentPrimary: "#3B82F6", accentLight: "#60A5FA",
  success: "#4ADE80", successDot: "#22C55E", warning: "#FFEA00", error: "#FF5252", errorLight: "#F87171",
  blue: "#3b82f6", green: "#22c55e", gray: "#71717a",
  font: "'Inter', 'Segoe UI', system-ui, sans-serif",
};
const tooltipStyle = { backgroundColor: "#27272A", border: "1px solid #3F3F46", borderRadius: "8px", fontSize: "0.8rem", color: "#E4E4E7" };
const tooltipProps = { contentStyle: tooltipStyle, labelStyle: { color: "#E4E4E7" }, cursor: { fill: "rgba(255,255,255,0.05)" } };

// Light mode tokens
const TL = {
  bgPage: "#f8fafc", bgCard: "#ffffff", bgElevated: "#f1f5f9", bgElement: "#e2e8f0",
  border: "#cbd5e1", textPrimary: "#0f172a", textHeading: "#1e293b", textBody: "#334155",
  textMuted: "#64748b", textDisabled: "#94a3b8", textFaded: "#cbd5e1",
  accentPrimary: "#2563eb", accentLight: "#3b82f6",
  success: "#16a34a", successDot: "#22c55e", warning: "#ca8a04", error: "#dc2626", errorLight: "#ef4444",
  blue: "#2563eb", green: "#16a34a", gray: "#64748b",
  font: "'Inter', 'Segoe UI', system-ui, sans-serif",
};

const ThemeCtx = createContext(T);

/* ═══════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════ */
const monthlyData = [
  { name: "Jan", vendas: 3500, receita: 4200, lucro: 1800 },
  { name: "Fev", vendas: 2800, receita: 1500, lucro: 1200 },
  { name: "Mar", vendas: 2600, receita: 9200, lucro: 2600 },
  { name: "Abr", vendas: 2900, receita: 3200, lucro: 2900 },
  { name: "Mai", vendas: 3800, receita: 2800, lucro: 3200 },
  { name: "Jun", vendas: 2500, receita: 4500, lucro: 2800 },
];
const pieData = [{ name: "Ativos", value: 65, color: T.accentPrimary }, { name: "Inativos", value: 35, color: T.bgElement }];
const skillsData = [{ subject: "Vendas", value: 85 }, { subject: "Marketing", value: 72 }, { subject: "Suporte", value: 90 }, { subject: "Dev", value: 68 }, { subject: "Design", value: 78 }, { subject: "Finanças", value: 82 }];
const ringsData = [
  { label: "Usuários Ativos", description: "Usuários ativos diários este mês", value: 85, color: T.accentPrimary, icon: "activity" },
  { label: "Receita", description: "Meta de receita mensal", value: 75, color: T.textMuted, icon: "trending" },
  { label: "Conversões", description: "Conversões de vendas da semana", value: 45, color: T.textDisabled, icon: "bar" },
];
const tableData = [
  { name: "João Silva", email: "joao@exemplo.com", role: "Admin", status: "ativo" },
  { name: "Maria Santos", email: "maria@exemplo.com", role: "Usuário", status: "ativo" },
  { name: "Pedro Lima", email: "pedro@exemplo.com", role: "Editor", status: "inativo" },
];
const users = [
  { name: "João Silva", email: "joao.silva@exemplo.com", initial: "J", roles: ["Admin"], showStatus: true },
  { name: "Maria Santos", email: "maria.santos@exemplo.com", initial: "M", roles: ["Desenvolvedora", "Designer"], showStatus: false },
  { name: "Pedro Lima", email: null, initial: "P", roles: [], showStatus: false },
];
const insightsData = {
  performance: {
    center: 85,
    rings: [{ color: T.blue, value: 85 }, { color: T.green, value: 84 }, { color: T.gray, value: 78 }],
    metrics: [
      { icon: "target", color: T.blue, title: "Task Completion", sub: "Overall completion rate", value: 85 },
      { icon: "users", color: T.green, title: "User Engagement", sub: "Active user participation", value: 84 },
      { icon: "clock", color: T.gray, title: "Response Time", sub: "Average response efficiency", value: 78, valueColor: T.textBody },
    ],
  },
  trends: {
    center: 92,
    rings: [{ color: T.green, value: 92 }, { color: T.blue, value: 88 }, { color: T.gray, value: 75 }],
    metrics: [
      { icon: "users", color: T.green, title: "User Growth", sub: "Month-over-month increase", value: 92 },
      { icon: "engagement", color: T.blue, title: "Engagement Rate", sub: "Daily active users", value: 88 },
      { icon: "target", color: T.gray, title: "Retention", sub: "User retention rate", value: 75, valueColor: T.textBody },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════════ */
function SectionHeader({ label }) {
  const t = useContext(ThemeCtx);
  return <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: t.accentLight, borderBottom: `1px solid ${t.border}`, paddingBottom: "0.5rem", marginTop: "2.5rem", marginBottom: "1.5rem" }}>{label}</div>;
}
function SectionTitle({ children }) {
  return <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600, color: T.textHeading }}>{children}</h3>;
}
function Card({ title, subtitle, children, fullWidth, style: extra }: { title?: any; subtitle?: any; children?: any; fullWidth?: any; style?: any }) {
  const t = useContext(ThemeCtx);
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "8px", padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem", gridColumn: fullWidth ? "1 / -1" : undefined, ...extra }}>
      {title && <div><h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: t.textHeading }}>{title}</h3>
        {subtitle && <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: t.textMuted }}>{subtitle}</p>}</div>}
      {children}
    </div>
  );
}

// ── Rings Chart (§2.7) ──
function RingIcon({ type, color }) {
  const s = { width: 36, height: 36, borderRadius: "8px", background: color + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" };
  if (type === "activity") return <div style={s}><svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg></div>;
  if (type === "trending") return <div style={s}><svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg></div>;
  return <div style={s}><svg {...p}><rect x="3" y="12" width="4" height="8" rx="1" /><rect x="10" y="8" width="4" height="12" rx="1" /><rect x="17" y="4" width="4" height="16" rx="1" /></svg></div>;
}
function RingsChart({ data, size = 200, strokeWidth = 13 }) {
  const center = size / 2;
  const maxVal = data.reduce((m, d) => Math.max(m, d.value), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
      <div style={{ position: "relative" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>{data.map((it, i) => <linearGradient key={i} id={`rg${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={it.color} stopOpacity={1} /><stop offset="100%" stopColor={it.color} stopOpacity={0.45} /></linearGradient>)}</defs>
          {data.map((it, i) => { const g = strokeWidth + 6, r = center - strokeWidth / 2 - 10 - i * g, c = 2 * Math.PI * r; return (<g key={i}><circle cx={center} cy={center} r={r} fill="none" stroke={T.border} strokeWidth={strokeWidth} opacity={0.5} /><circle cx={center} cy={center} r={r} fill="none" stroke={`url(#rg${i})`} strokeWidth={strokeWidth} strokeDasharray={c} strokeDashoffset={c - (it.value / 100) * c} strokeLinecap="round" transform={`rotate(-90 ${center} ${center})`} style={{ transition: "stroke-dashoffset 1s ease" }} /></g>); })}
        </svg>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}><div style={{ fontSize: "1.3rem", fontWeight: 700, color: T.textHeading }}>{maxVal}%</div></div>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
        {data.map((it, i) => (<div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 0.5rem", borderTop: i === 0 ? `1px solid ${T.border}` : "none", borderBottom: `1px solid ${T.border}` }}><div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}><RingIcon type={it.icon} color={it.color} /><div><div style={{ fontSize: "0.85rem", fontWeight: 600, color: T.textBody }}>{it.label}</div><div style={{ fontSize: "0.75rem", color: T.textMuted }}>{it.description}</div></div></div><div style={{ fontSize: "0.9rem", fontWeight: 600, color: T.textMuted }}>{it.value}%</div></div>))}
      </div>
    </div>
  );
}

// ── Insights Icons ──
function InsightIcon({ type, color, size = 18 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (type) {
    case "target": return <svg {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case "users": return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "clock": return <svg {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
    case "engagement": return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>;
    default: return null;
  }
}

// ── Animated Counter ──
function useAnimatedCounter(target, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current; prev.current = target; if (from === target) return;
    const start = performance.now(); let raf;
    const step = (now) => { const t = Math.min((now - start) / duration, 1); const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; setDisplay(Math.round(from + (target - from) * ease)); if (t < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

// ── Insight Ring Chart (animated) ──
function InsightRingChart({ rings, centerValue, size = 180, strokeWidth = 10 }) {
  const center = size / 2;
  const displayVal = useAnimatedCounter(centerValue, 700);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring, i) => { const gap = strokeWidth + 5, r = center - strokeWidth / 2 - 8 - i * gap, c = 2 * Math.PI * r, offset = c - (ring.value / 100) * c; return (<g key={i}><circle cx={center} cy={center} r={r} fill="none" stroke={T.border} strokeWidth={strokeWidth} /><circle cx={center} cy={center} r={r} fill="none" stroke={ring.color} strokeWidth={strokeWidth} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${center} ${center})`} style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease" }} /></g>); })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "2.5rem", fontWeight: 700, color: T.textPrimary }}>{displayVal}%</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   §15 — DROPDOWN SUB-COMPONENTS (stateful, evita hooks em loop)
   ═══════════════════════════════════════════════════════════ */
function DropdownItem({ label, options, isDark = false }: { label: any; options: any; isDark?: any }) {
  const [val, setVal] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === val);
  const bg = isDark ? "#18181b" : "#ffffff";
  const border = isDark ? "#27272a" : "#cbd5e1";
  const textColor = isDark ? "#e4e4e7" : "#334155";
  const mutedColor = isDark ? "#71717a" : "#94a3b8";
  const menuBg = isDark ? "#18181b" : "#ffffff";
  const primaryColor = isDark ? "#00bf62" : "#00a855";
  const itemHoverBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";

  return (
    <div>
      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: mutedColor, marginBottom: "0.4rem" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <button onClick={() => setOpen(p => !p)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "0.625rem 0.75rem", borderRadius: 12, border: `1px solid ${open ? primaryColor + "66" : border}`, background: open ? primaryColor + "0d" : bg, color: textColor, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: T.font, textAlign: "left", boxSizing: "border-box", transition: "all 0.15s" }}>
          {selected?.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: selected.dot, flexShrink: 0 }} />}
          <span style={{ flex: 1, color: selected ? textColor : mutedColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label || "Selecionar..."}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="2" style={{ flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        {open && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: menuBg, border: `1px solid ${border}`, borderRadius: 12, boxShadow: isDark ? "0 25px 50px -12px rgba(0,0,0,0.6)" : "0 10px 40px rgba(0,0,0,0.12)", zIndex: 9999, padding: "6px 0", overflow: "hidden" }}>
            {options.map(opt => (
              <button key={opt.value} onClick={() => { setVal(opt.value); setOpen(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, background: opt.value === val ? primaryColor + "1a" : "transparent", color: opt.value === val ? primaryColor : textColor, border: "none", cursor: "pointer", fontFamily: T.font, textAlign: "left", transition: "background 0.1s" }}
                onMouseEnter={e => { if (opt.value !== val) e.currentTarget.style.background = itemHoverBg; }}
                onMouseLeave={e => { if (opt.value !== val) e.currentTarget.style.background = "transparent"; }}>
                {opt.dot && <span style={{ width: 10, height: 10, borderRadius: "50%", background: opt.dot, flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{opt.label}</span>
                {opt.value === val && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DropdownDarkPreview() {
  return (
    <Card title="Dropdown — Dark Mode" subtitle="Portal z-9999, auto-posicionamento, ChevronDown animado">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <DropdownItem isDark label="Status" options={[{ value: "active", label: "Ativo", dot: "#22c55e" }, { value: "paused", label: "Pausado", dot: "#eab308" }, { value: "cancelled", label: "Cancelado", dot: "#ef4444" }]} />
        <DropdownItem isDark label="Profissional" options={[{ value: "m1", label: "Marcos Silva" }, { value: "m2", label: "Vinicius Costa" }, { value: "m3", label: "Lucas Mendes" }]} />
        <div>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: T.textMuted, marginBottom: "0.4rem" }}>Desabilitado</label>
          <button disabled style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "0.625rem 0.75rem", borderRadius: 12, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.02)", color: T.textMuted, fontSize: "0.75rem", fontWeight: 700, cursor: "not-allowed", fontFamily: T.font, opacity: 0.6, textAlign: "left" }}>
            <span style={{ flex: 1 }}>Selecionar...</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>
      </div>
    </Card>
  );
}

function DropdownLightPreview() {
  return (
    <Card title="Dropdown — Light Mode" subtitle="Mesma lógica, paleta invertida (bg branco, border slate)">
      <div style={{ background: "#f8fafc", borderRadius: 8, padding: "1rem", margin: "-0.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <DropdownItem label="Unidade" options={[{ value: "u1", label: "Barbearia Matheus" }, { value: "u2", label: "Barbearia Centro" }, { value: "u3", label: "Barbearia Norte" }]} />
        <DropdownItem label="Categoria" options={[{ value: "c1", label: "Corte de Cabelo" }, { value: "c2", label: "Barba" }, { value: "c3", label: "Tratamento" }]} />
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   §18 — MODAL PREVIEWS (stateful, cada modal independente)
   ═══════════════════════════════════════════════════════════ */
function ModalButton({ label, maxW, hasTabs, isSplit }: { label: any; maxW: any; hasTabs?: any; isSplit?: any }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("info");
  const TABS = [{ id: "info", label: "Informações" }, { id: "contact", label: "Contato" }, { id: "history", label: "Histórico" }, { id: "settings", label: "Configurações" }];
  const fields = [["Nome", "Marcos da Silva"], ["Email", "marcos@exemplo.com"], ["Telefone", "(11) 99999-9999"]];

  return (
    <div>
      <button onClick={() => setOpen(true)}
        style={{ padding: "0.5rem 1.25rem", borderRadius: 9999, fontSize: "0.8rem", fontWeight: 600, background: T.bgElement, color: T.textBody, border: `1px solid ${T.border}`, cursor: "pointer", fontFamily: T.font }}>
        {label}
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9050, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <style>{`@keyframes mIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}`}</style>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)", width: "100%", maxWidth: maxW, maxHeight: "85vh", display: "flex", flexDirection: "column", animation: "mIn 0.2s cubic-bezier(0.4,0,0.2,1)" }}>
            {/* Header — shrink-0 */}
            <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "#09090b", borderRadius: "12px 12px 0 0" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: T.textHeading }}>{label}</h3>
              <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            {/* Tabs */}
            {hasTabs && (
              <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, flexShrink: 0, overflowX: "auto" }}>
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    style={{ padding: "0.625rem 1rem", fontSize: "0.75rem", fontWeight: 700, border: "none", background: "transparent", cursor: "pointer", fontFamily: T.font, whiteSpace: "nowrap", color: tab === t.id ? "#00bf62" : T.textMuted, borderBottom: tab === t.id ? "2px solid #00bf62" : "2px solid transparent", transition: "all 0.15s" }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            {/* Body — split ou simples */}
            {isSplit ? (
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                <div className="ds-scroll-dark" style={{ width: "60%", padding: "1.25rem", overflowY: "auto", borderRight: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: T.textMuted, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Coluna Esquerda — 60%</div>
                  {[["Nome", "Marcos da Silva"], ["Email", "marcos@exemplo.com"], ["Telefone", "(11) 99999-9999"], ["Endereço", "Rua das Flores, 123"], ["Cidade", "São Paulo – SP"]].map(([lbl, val]) => (
                    <div key={lbl} style={{ marginBottom: "0.875rem" }}>
                      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: T.textMuted, marginBottom: "0.3rem" }}>{lbl}</label>
                      <input defaultValue={val} style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: `1px solid ${T.border}`, background: "#09090b", color: T.textBody, fontSize: "0.8rem", fontFamily: T.font, boxSizing: "border-box", outline: "none" }} />
                    </div>
                  ))}
                </div>
                <div className="ds-scroll-dark" style={{ width: "40%", padding: "1.25rem", overflowY: "auto" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: T.textMuted, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Coluna Direita — 40%</div>
                  <div style={{ background: T.bgElevated, borderRadius: 10, padding: "1rem", textAlign: "center", marginBottom: "1rem" }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.bgElement, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", fontWeight: 700, color: T.textPrimary, margin: "0 auto 0.75rem" }}>M</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: T.textHeading }}>Marcos da Silva</div>
                    <div style={{ fontSize: "0.72rem", color: T.textMuted, marginTop: "0.2rem" }}>Cliente desde Jan 2024</div>
                  </div>
                  {[["Visitas", "12"], ["LTV", "R$ 1.240"], ["Status", "Ativo"]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: `1px solid ${T.border}`, fontSize: "0.78rem" }}>
                      <span style={{ color: T.textMuted }}>{k}</span>
                      <span style={{ color: T.textBody, fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ds-scroll-dark" style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
                {hasTabs && <div style={{ fontSize: "0.72rem", color: T.textMuted, marginBottom: "0.75rem" }}>Aba ativa: <span style={{ color: "#00bf62", fontWeight: 600 }}>{tab}</span></div>}
                {fields.map(([lbl, val]) => (
                  <div key={lbl} style={{ marginBottom: "0.875rem" }}>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: T.textMuted, marginBottom: "0.3rem" }}>{lbl}</label>
                    <input defaultValue={val} style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: `1px solid ${T.border}`, background: "#09090b", color: T.textBody, fontSize: "0.8rem", fontFamily: T.font, boxSizing: "border-box", outline: "none" }} />
                  </div>
                ))}
                <p style={{ fontSize: "0.78rem", color: T.textMuted, lineHeight: 1.6, marginTop: "0.75rem" }}>
                  Corpo: <code style={{ background: T.bgElevated, padding: "0 0.3rem", borderRadius: 4, fontSize: "0.7rem" }}>flex-1 overflow-y-auto custom-scrollbar</code>. Header e footer usam <code style={{ background: T.bgElevated, padding: "0 0.3rem", borderRadius: 4, fontSize: "0.7rem" }}>shrink-0</code>.
                </p>
              </div>
            )}
            {/* Footer — shrink-0 */}
            <div style={{ padding: "0.875rem 1.25rem", borderTop: `1px solid ${T.border}`, display: "flex", gap: "0.625rem", justifyContent: "flex-end", flexShrink: 0, background: "#09090b", borderRadius: "0 0 12px 12px" }}>
              <button onClick={() => setOpen(false)} style={{ padding: "0.5rem 1rem", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700, background: "#27272a", color: T.textBody, border: "none", cursor: "pointer", fontFamily: T.font }}>Cancelar</button>
              <button onClick={() => setOpen(false)} style={{ padding: "0.5rem 1.25rem", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700, background: "#00bf62", color: "#fff", border: "none", cursor: "pointer", fontFamily: T.font }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalPreviews() {
  return (
    <Card title="Modais — 3 padrões (Simples / Com Tabs / Split 60/40)" subtitle="Clique para abrir cada modal. Header/footer fixos (shrink-0), corpo scrollável (flex-1 overflow-y-auto custom-scrollbar)">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <ModalButton label="Modal Simples (max-w-lg)" maxW={480} />
        <ModalButton label="Modal com Tabs (max-w-2xl)" maxW={680} hasTabs />
        <ModalButton label="Modal Split 60/40 (max-w-4xl)" maxW={900} isSplit />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }}>
        {[
          { label: "Backdrop", spec: "fixed inset-0 z-50\nbg-black/60\nbackdrop-blur-sm" },
          { label: "Container", spec: "flex flex-col\nh-[85vh] / max-h-[90vh]\nanimate-in zoom-in-95 200ms" },
          { label: "Header (fixo)", spec: "shrink-0\nborder-b\nbg-dark / bg-slate-50" },
          { label: "Corpo (scroll)", spec: "flex-1\noverflow-y-auto\ncustom-scrollbar" },
          { label: "Tabs de seção", spec: "border-b-2 border-primary\ntext-xs font-bold\nwhitespace-nowrap" },
          { label: "Footer (fixo)", spec: "shrink-0\nborder-t\npx-4 py-3 gap-3" },
        ].map((s, i) => (
          <div key={i} style={{ background: T.bgElevated, borderRadius: 8, padding: "0.75rem" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: T.accentLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>{s.label}</div>
            <code style={{ fontSize: "0.65rem", color: T.textBody, fontFamily: "monospace", whiteSpace: "pre-line", lineHeight: 1.7 }}>{s.spec}</code>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════ */
export default function Preview() {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("notifications");
  const [inputVal, setInputVal] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [checks, setChecks] = useState({ a: false, b: true, c: false, d: true, all: false });
  const tabRefs = useRef({});
  const [indStyle, setIndStyle] = useState({});
  // Insights state
  const [insightTab, setInsightTab] = useState("performance");
  const [listOpacity, setListOpacity] = useState(1);
  const insightTabRefs = useRef({});
  const [insightIndStyle, setInsightIndStyle] = useState({});
  const insData = insightsData[insightTab];
  // Theme toggle
  const [isDark, setIsDark] = useState(true);
  const th = isDark ? T : TL;

  const tabItems = [
    { id: "profile", title: "Perfil" },
    { id: "notifications", title: "Notificações" },
    { id: "settings", title: "Configurações" },
  ];

  useEffect(() => { const el = tabRefs.current[activeTab]; if (el) setIndStyle({ width: el.offsetWidth, transform: `translateX(${el.offsetLeft - 6}px)` }); }, [activeTab]);
  useEffect(() => { const el = insightTabRefs.current[insightTab]; if (el) setInsightIndStyle({ width: el.offsetWidth, transform: `translateX(${el.offsetLeft - 4}px)` }); }, [insightTab]);

  const handleInsightTab = (tab) => { if (tab === insightTab) return; setListOpacity(0); setTimeout(() => { setInsightTab(tab); setListOpacity(1); }, 200); };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/DESIGN_SYSTEM.md';
    link.download = 'DESIGN_SYSTEM.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ThemeCtx.Provider value={th}>
      <div style={{ minHeight: "100vh", background: th.bgPage, color: th.textBody, fontFamily: th.font, padding: "2rem", transition: "background-color 0.35s ease, color 0.35s ease" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes skel{0%{background-position:200% 0}100%{background-position:-200% 0}} @keyframes toggleSlide{0%{transform:translateX(0)}100%{transform:translateX(24px)}}`}</style>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* ══ Page Header — Logo + Title + Toggle + Download ══ */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem", paddingBottom: "1.5rem", borderBottom: `1px solid ${th.border}`, transition: "border-color 0.35s ease" }}>
            {/* Left: Logo + Title */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <img src="https://vinnx-site.vercel.app/logo-verde.png" alt="VINNX" style={{ height: 40, width: "auto", objectFit: "contain" }} />
              <div>
                <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: th.textPrimary, letterSpacing: "-0.02em", transition: "color 0.35s ease" }}>Design System Preview</h1>
                <p style={{ margin: "0.15rem 0 0", fontSize: "0.82rem", color: th.textMuted, transition: "color 0.35s ease" }}>Componentes, padrões e regras enterprise</p>
              </div>
            </div>
            {/* Right: Toggle + Download */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {/* Theme Toggle */}
              <button
                onClick={() => setIsDark(p => !p)}
                aria-label="Alternar tema"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.75rem", borderRadius: 9999, border: `1px solid ${th.border}`, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", cursor: "pointer", fontFamily: T.font, fontSize: "0.75rem", fontWeight: 600, color: th.textBody, transition: "all 0.3s ease" }}
              >
                {/* Track */}
                <div style={{ position: "relative", width: 44, height: 22, borderRadius: 11, background: isDark ? "#27272a" : "#cbd5e1", transition: "background 0.3s ease", flexShrink: 0 }}>
                  {/* Thumb */}
                  <div style={{ position: "absolute", top: 2, left: isDark ? 2 : 24, width: 18, height: 18, borderRadius: "50%", background: isDark ? "#fbbf24" : "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", boxShadow: isDark ? "0 0 8px rgba(251,191,36,0.4)" : "0 0 8px rgba(59,130,246,0.4)" }}>
                    {isDark ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1e1b4b" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                    )}
                  </div>
                </div>
                <span>{isDark ? "Dark" : "Light"}</span>
              </button>
              {/* Download Button */}
              <button
                onClick={handleDownload}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1.125rem", borderRadius: 9999, border: "none", background: "#00bf62", color: "#ffffff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", fontFamily: T.font, transition: "all 0.2s ease", boxShadow: "0 2px 8px rgba(0,191,98,0.25)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#00a855"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,191,98,0.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#00bf62"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,191,98,0.25)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                DESIGN_SYSTEM.md
              </button>
            </div>
          </div>

          {/* ═══ CHARTS ═══ */}
          <SectionHeader label="Gráficos" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
            <Card title="Gráfico de Área" fullWidth>
              <ResponsiveContainer width="100%" height={260}>
                <RechartsAreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="gA1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accentPrimary} stopOpacity={0.4} /><stop offset="95%" stopColor={T.accentPrimary} stopOpacity={0.02} /></linearGradient><linearGradient id="gA2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accentPrimary} stopOpacity={0.35} /><stop offset="95%" stopColor={T.accentPrimary} stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.textBody} strokeOpacity={0.4} /><XAxis dataKey="name" stroke="#334155" tick={{ fill: T.textMuted, fontSize: 12 }} axisLine={{ stroke: T.border }} tickLine={false} /><YAxis stroke="#334155" tick={{ fill: T.textMuted, fontSize: 12 }} axisLine={{ stroke: T.border }} tickLine={false} /><Tooltip {...tooltipProps} /><Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: T.textMuted, fontSize: "0.8rem", marginLeft: 4 }}>{v}</span>} />
                  <Area type="monotone" dataKey="receita" stroke={T.textBody} fill="url(#gA2)" strokeWidth={2} name="Receita" dot={false} activeDot={{ r: 4, fill: T.textMuted, stroke: T.bgCard, strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="vendas" stroke={T.textBody} fill="url(#gA1)" strokeWidth={2} name="Vendas" dot={false} activeDot={{ r: 4, fill: T.accentPrimary, stroke: T.bgCard, strokeWidth: 2 }} />
                </RechartsAreaChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Gráfico de Barras">
              <ResponsiveContainer width="100%" height={220}><RechartsBarChart data={monthlyData}><defs><linearGradient id="gB1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accentPrimary} stopOpacity={1} /><stop offset="100%" stopColor={T.accentPrimary} stopOpacity={0.6} /></linearGradient><linearGradient id="gB2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accentPrimary} stopOpacity={1} /><stop offset="100%" stopColor={T.accentPrimary} stopOpacity={0.6} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={T.textBody} strokeOpacity={0.4} /><XAxis dataKey="name" stroke="#334155" tick={{ fill: T.textMuted, fontSize: 12 }} tickLine={false} /><YAxis stroke="#334155" tick={{ fill: T.textMuted, fontSize: 12 }} tickLine={false} /><Tooltip {...tooltipProps} /><Bar dataKey="vendas" fill="url(#gB1)" radius={[4, 4, 0, 0]} name="Vendas" /><Bar dataKey="lucro" fill="url(#gB2)" radius={[4, 4, 0, 0]} name="Lucro" /></RechartsBarChart></ResponsiveContainer>
            </Card>
            <Card title="Gráfico de Pizza">
              <ResponsiveContainer width="100%" height={220}><RechartsPieChart><Tooltip {...tooltipProps} /><Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={0} cornerRadius={0} dataKey="value">{pieData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: T.textMuted, fontSize: "0.8rem" }}>{v}</span>} /></RechartsPieChart></ResponsiveContainer>
            </Card>
            <Card title="Gráfico de Anéis">
              <RingsChart data={ringsData} size={200} strokeWidth={13} />
            </Card>
          </div>

          {/* ═══ TABLE ═══ */}
          <SectionHeader label="Tabela" />
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: "8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead><tr style={{ background: T.bgCard }}>{["Nome", "E-mail", "Cargo", "Status"].map(h => <th key={h} style={{ textAlign: "left", padding: "0.75rem 1rem", color: T.textHeading, fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>{tableData.map((row, i) => (<tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}><td style={{ padding: "1.25rem 1rem", color: T.textMuted }}>{row.name}</td><td style={{ padding: "1.25rem 1rem", color: T.textMuted }}>{row.email}</td><td style={{ padding: "1.25rem 1rem", color: T.textMuted }}>{row.role}</td><td style={{ padding: "1.25rem 1rem" }}><span style={{ display: "inline-flex", padding: "0.125rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 500, textTransform: "lowercase", background: row.status === "ativo" ? "rgba(34,197,94,0.15)" : "#1e293b", color: row.status === "ativo" ? "#4ade80" : "#cbd5e1" }}>{row.status}</span></td></tr>))}</tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: "0.875rem", color: T.textBody }}>Exibindo 1 a 3 de 3 resultados</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  onClick={() => { if (page > 1) setPage(page - 1); }}
                  onMouseEnter={(e) => { if (page > 1) e.currentTarget.style.background = "#2A2A2A"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  style={{ height: 40, padding: "0 1rem", borderRadius: "9999px", background: "transparent", border: "none", color: page === 1 ? T.bgPage : "#E5E5E5", fontWeight: 500, fontSize: "0.875rem", cursor: page === 1 ? "not-allowed" : "pointer", fontFamily: T.font, transition: "background-color 150ms ease, color 150ms ease" }}>Anterior</button>
                {[1, 2, 3].map(n => {
                  const isActive = page === n;
                  return <button key={n} onClick={() => setPage(n)}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#2A2A2A"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    style={{ width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem", background: isActive ? "#FFFFFF" : "transparent", color: isActive ? "#000000" : "#E5E5E5", fontWeight: isActive ? 600 : 500, transition: "background-color 150ms ease, color 150ms ease" }}>{n}</button>;
                })}
                <button
                  onClick={() => { if (page < 3) setPage(page + 1); }}
                  onMouseEnter={(e) => { if (page < 3) e.currentTarget.style.background = "#2A2A2A"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  style={{ height: 40, padding: "0 1rem", borderRadius: "9999px", background: "transparent", border: "none", color: page === 3 ? T.bgPage : "#E5E5E5", fontWeight: 500, fontSize: "0.875rem", cursor: page === 3 ? "not-allowed" : "pointer", fontFamily: T.font, transition: "background-color 150ms ease, color 150ms ease" }}>Próximo</button>
              </div>
            </div>
          </div>

          {/* ═══ USER NAME ═══ */}
          <SectionHeader label="Nome do Usuário" />
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
              {users.map((u, i) => (<div key={i} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}><div style={{ position: "relative", flexShrink: 0 }}><div style={{ width: 40, height: 40, borderRadius: "9999px", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "1rem", fontWeight: 500, color: T.textHeading, textTransform: "uppercase" }}>{u.initial}</span></div>{u.showStatus && <div style={{ position: "absolute", top: 0, right: 0, width: 13, height: 13, borderRadius: "9999px", background: T.successDot, border: `2px solid ${T.border}`, transform: "translate(15%,-15%)" }} />}</div><div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minHeight: 40, justifyContent: "center" }}><span style={{ fontSize: "1rem", fontWeight: 600, color: T.textHeading, lineHeight: 1.3 }}>{u.name}</span>{u.email && <span style={{ fontSize: "0.875rem", fontWeight: 400, color: T.textHeading, lineHeight: 1.3 }}>{u.email}</span>}{u.roles.length > 0 && <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>{u.roles.map((r, j) => <span key={j} style={{ background: T.bgPage, borderRadius: "9999px", padding: "2px 10px", fontSize: "0.7rem", fontWeight: 600, color: T.textHeading, lineHeight: 1.6 }}>{r}</span>)}</div>}</div></div>))}
            </div>
          </Card>

          {/* ═══ BADGES ═══ */}
          <SectionHeader label="Badges e Status" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <Card title="Badges Básicos">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
                {[{ label: "Default", bg: T.textBody, color: T.textHeading, border: "none" }, { label: "Outline", bg: "transparent", color: T.textHeading, border: `1px solid ${T.border}` }, { label: "Sucesso", bg: "rgba(0,230,118,0.1)", color: "#00E676", border: "1px solid rgba(0,230,118,0.25)" }, { label: "Alerta", bg: "rgba(255,234,0,0.1)", color: "#FFEA00", border: "1px solid rgba(255,234,0,0.25)" }, { label: "Error", bg: "rgba(255,82,82,0.1)", color: "#FF5252", border: "1px solid rgba(255,82,82,0.25)" }].map((b, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", borderRadius: "9999px", padding: "0.25rem 0.75rem", fontSize: "0.875rem", fontWeight: 600, background: b.bg, color: b.color, border: b.border }}>{b.label}</span>)}
              </div>
            </Card>
            <Card title="Status por Severidade">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
                {[{ label: "Baixo", dot: "#3B82F6", text: "#60A5FA", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" }, { label: "Médio", dot: "#EAB308", text: "#FDE047", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.2)" }, { label: "Alto", dot: "#F97316", text: "#FB923C", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)" }, { label: "Crítico", dot: "#EF4444", text: "#F87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" }].map((s, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", borderRadius: "9999px", padding: "0.25rem 0.75rem", fontSize: "0.875rem", fontWeight: 500, background: s.bg, color: s.text, border: `1px solid ${s.border}` }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, marginRight: "0.375rem" }} />{s.label}</span>)}
              </div>
            </Card>
          </div>
          {/* Shine Badges */}
          <style>{`.shine-loop { position: relative; overflow: hidden; } .shine-loop::after { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent); transform: skewX(-20deg); animation: shineLoop 3s ease-in-out infinite; pointer-events: none; } .shine-d1::after { animation-delay: 0s; } .shine-d2::after { animation-delay: 1s; } .shine-d3::after { animation-delay: 2s; } @keyframes shineLoop { 0% { left: -100%; } 30% { left: 200%; } 100% { left: 200%; } }`}</style>
          <Card title="Badges com Brilho" style={{ marginTop: "1.25rem" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <span className="shine-loop shine-d1" style={{ display: "inline-flex", padding: "0.375rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 500, background: "linear-gradient(180deg,#FFFFFF 0%,#D4D4D8 100%)", color: "#121214", boxShadow: "0 0 8px rgba(255,255,255,0.15)" }}>Novo</span>
              <span className="shine-loop shine-d2" style={{ display: "inline-flex", padding: "0.375rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 500, background: T.bgCard, color: T.textBody, border: "1px solid rgba(255,255,255,0.08)" }}>Destaque</span>
              <span className="shine-loop shine-d3" style={{ display: "inline-flex", padding: "0.375rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 500, background: "linear-gradient(180deg,#3F3F46 0%,#18181B 100%)", color: T.textBody, border: "1px solid rgba(255,255,255,0.12)" }}>Premium</span>
            </div>
          </Card>

          {/* ═══ BUTTONS ═══ */}
          <SectionHeader label="Botões" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <Card title="Variantes">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
                {[{ label: "Default", bg: "#E4E4E7", hBg: "#D4D4D8", color: "#18181B", border: "none" }, { label: "Destructive", bg: "#F87171", hBg: "#EF4444", color: "#121214", border: "none" }, { label: "Outline", bg: "transparent", hBg: "#27272A", color: T.textBody, border: `1px solid ${T.border}` }, { label: "Secondary", bg: T.border, hBg: "#52525B", color: T.textBody, border: "none" }, { label: "Ghost", bg: "transparent", hBg: "#27272A", color: T.textBody, border: "none" }].map((b, i) => <button key={i} onMouseEnter={(e) => e.currentTarget.style.background = b.hBg} onMouseLeave={(e) => e.currentTarget.style.background = b.bg} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 500, background: b.bg, color: b.color, border: b.border, cursor: "pointer", transition: "background-color 0.2s", fontFamily: T.font }}>{b.label}</button>)}
              </div>
            </Card>
            <Card title="Estados">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
                <button style={{ display: "inline-flex", alignItems: "center", padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 500, background: "#E4E4E7", color: "#18181B", border: "none", opacity: 0.5, cursor: "not-allowed", fontFamily: T.font }}>Desabilitado</button>
                <button style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 500, background: "#E4E4E7", color: "#18181B", border: "none", opacity: 0.5, cursor: "not-allowed", fontFamily: T.font }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Carregando</button>
              </div>
            </Card>
          </div>

          {/* ═══ INPUTS ═══ */}
          <SectionHeader label="Campos de Formulário" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <Card title="Campos de Texto">
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div><label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: T.textHeading, marginBottom: "0.5rem" }}>Campo de Texto</label><input value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="Digite algo..." style={{ width: "100%", maxWidth: "32rem", padding: "0.625rem 1rem", borderRadius: "8px", fontSize: "0.875rem", border: `1px solid ${T.border}`, background: T.bgCard, color: T.textHeading, outline: "none", boxSizing: "border-box", fontFamily: T.font }} onFocus={(e) => e.target.style.borderColor = T.textBody} onBlur={(e) => e.target.style.borderColor = T.textBody} /></div>
                <div><label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: T.textMuted, marginBottom: "0.5rem" }}>Busca</label><div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: T.bgElevated, borderRadius: "9999px", padding: "0.5rem 0.5rem 0.5rem 1rem", height: "2.5rem", boxSizing: "border-box" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.textBody} strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg><span style={{ flex: 1, fontSize: "0.875rem", color: T.textMuted }}>Buscar...</span><kbd style={{ background: T.bgElevated, borderRadius: "6px", padding: "0.125rem 0.375rem", fontSize: "0.75rem", fontWeight: 500, color: T.textMuted, border: "none", fontFamily: T.font }}>Ctrl+K</kbd></div></div>
              </div>
            </Card>
            <Card title="Caixas de Seleção">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                  {[{ key: "a", label: "Desmarcado" }, { key: "b", label: "Marcado" }].map(({ key, label }) => { const ch = checks[key]; return (<label key={key} onClick={() => setChecks(p => ({ ...p, [key]: !p[key] }))} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}><div style={{ width: 16, height: 16, borderRadius: "4px", background: ch ? T.textBody : T.textBody, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>{ch && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textBody} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}</div><span style={{ fontSize: "0.875rem", color: T.textBody }}>{label}</span></label>); })}
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", opacity: 0.5, cursor: "not-allowed" }}><div style={{ width: 16, height: 16, borderRadius: "4px", background: T.bgElevated }} /><span style={{ fontSize: "0.875rem", color: T.textDisabled }}>Desabilitado</span></label>
                </div>
                <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><div style={{ width: 16, height: 16, borderRadius: "4px", background: T.bgElevated, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textBody} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg></div><span style={{ fontSize: "0.875rem", color: T.textBody }}>Padrão</span></label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><div style={{ width: 16, height: 16, borderRadius: "4px", background: "transparent", border: "1px solid #52525B", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textBody} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg></div><span style={{ fontSize: "0.875rem", color: T.textBody }}>Contorno</span></label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><div style={{ width: 16, height: 16, borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textBody} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg></div><span style={{ fontSize: "0.875rem", color: T.textBody }}>Fantasma</span></label>
                </div>
              </div>
            </Card>
          </div>

          {/* ═══ NAVIGATION ═══ */}
          <SectionHeader label="Navegação" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <Card title="Abas Animadas">
              <div style={{ display: "flex", alignItems: "center", position: "relative", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "6px" }}>
                <div style={{ position: "absolute", top: 6, bottom: 6, left: 6, background: T.bgCard, borderRadius: "8px", zIndex: 0, transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s ease", ...indStyle }} />
                {tabItems.map((tab) => <button key={tab.id} ref={(el) => tabRefs.current[tab.id] = el} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.625rem 1rem", fontSize: "0.875rem", fontWeight: 500, borderRadius: "8px", border: "none", background: "transparent", position: "relative", zIndex: 10, cursor: "pointer", color: activeTab === tab.id ? T.textPrimary : T.textPrimary, transition: "color 0.2s", fontFamily: T.font }}>{tab.title}</button>)}
              </div>
            </Card>
            <Card title="Breadcrumb">
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem" }}>
                {[{ label: "Painel" }, { label: "Usuários" }, { label: "Perfil", current: true }].map((item, i) => <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>{i > 0 && <span style={{ color: T.textHeading }}>/</span>}<span style={{ color: item.current ? T.textBody : T.textBody, fontWeight: item.current ? 500 : 400, cursor: item.current ? "default" : "pointer" }}>{item.label}</span></span>)}
              </div>
            </Card>
          </div>

          {/* ═══ FEEDBACK ═══ */}
          <SectionHeader label="Feedback" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <Card title="Avisos">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {[{ title: "Informação", desc: "Este é um aviso informativo.", icon: "ℹ", muted: false }, { title: "Sucesso", desc: "Ação concluída com sucesso!", icon: "✓", muted: true }, { title: "Alerta", desc: "Fique atento a esta informação.", icon: "⚠", muted: true }].map((n, i) => <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "1rem", opacity: n.muted ? 0.4 : 1 }}><div style={{ width: 20, height: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.textHeading, fontSize: "0.85rem", fontWeight: 700 }}>{n.icon}</div><div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}><span style={{ fontSize: "1rem", fontWeight: 600, color: T.textHeading }}>{n.title}</span><span style={{ fontSize: "0.875rem", color: T.textHeading, lineHeight: 1.4 }}>{n.desc}</span></div></div>)}
              </div>
            </Card>
            <Card title="Carregamento Skeleton">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[{ w: "100%", h: 16 }, { w: "85%", h: 16 }, { w: "60%", h: 16 }].map((s, i) => <div key={i} style={{ width: s.w, height: s.h, borderRadius: 6, background: `linear-gradient(90deg,${T.bgElevated} 25%,${T.bgElevated} 50%,${T.bgElevated} 75%)`, backgroundSize: "200% 100%", animation: "skel 1.5s infinite" }} />)}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}><div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(90deg,${T.bgElevated} 25%,${T.bgElevated} 50%,${T.bgElevated} 75%)`, backgroundSize: "200% 100%", animation: "skel 1.5s infinite" }} /><div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", justifyContent: "center" }}><div style={{ width: "70%", height: 14, borderRadius: 6, background: `linear-gradient(90deg,${T.bgElevated} 25%,${T.bgElevated} 50%,${T.bgElevated} 75%)`, backgroundSize: "200% 100%", animation: "skel 1.5s infinite" }} /><div style={{ width: "50%", height: 12, borderRadius: 6, background: `linear-gradient(90deg,${T.bgElevated} 25%,${T.bgElevated} 50%,${T.bgElevated} 75%)`, backgroundSize: "200% 100%", animation: "skel 1.5s infinite" }} /></div></div>
              </div>
            </Card>
          </div>

          {/* Progress Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", marginTop: "1.25rem" }}>
            {[
              { title: "Progresso de Vendas", value: "$7,500", sub: "de $10.000", progress: 75, color: "#3B82F6", footer: "75% da meta mensal", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg> },
              { title: "New Usuários", value: "600", sub: "de 1.000", progress: 60, color: "#10B981", footer: null, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> },
              { title: "Conclusão de Metas", value: "90", sub: "de 100", progress: 90, color: "#A855F7", footer: "75% da meta mensal", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg> },
            ].map((card, i) => (
              <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "1.75rem", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "12px", flexShrink: 0, background: card.color + "26", display: "flex", alignItems: "center", justifyContent: "center" }}>{card.icon}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0", flexGrow: 1 }}>
                    <span style={{ fontSize: "1rem", fontWeight: 600, color: T.textHeading, lineHeight: 1, marginBottom: "-2px" }}>{card.title}</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}><span style={{ fontSize: "1.5rem", fontWeight: 700, color: T.textPrimary }}>{card.value}</span><span style={{ fontSize: "0.875rem", fontWeight: 400, color: T.textPrimary }}>{card.sub}</span></div>
                  </div>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: T.textHeading, alignSelf: "flex-start", marginTop: "0.125rem" }}>{card.progress}%</span>
                </div>
                <div style={{ width: "100%", height: 12, background: T.bgCard, borderRadius: "9999px", overflow: "hidden" }}><div style={{ width: `${card.progress}%`, height: "100%", borderRadius: "9999px", background: card.color, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }} /></div>
                {card.footer && <span style={{ fontSize: "0.75rem", fontWeight: 400, color: T.textMuted, marginTop: "1rem" }}>{card.footer}</span>}
              </div>
            ))}
          </div>

          {/* ═══ MODAL ═══ */}
          <SectionHeader label="Sobreposições" />
          <Card title="Modal">
            <button onClick={() => setModalOpen(true)} style={{ display: "inline-flex", padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 500, background: "#E4E4E7", color: "#18181B", border: "none", cursor: "pointer", fontFamily: T.font }}>Abrir Modal</button>
            {modalOpen && (<div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setModalOpen(false)} /><div style={{ position: "relative", background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "1.5rem", width: 420, maxWidth: "90vw" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}><h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: T.textHeading }}>Título do Modal</h3><button onClick={() => setModalOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.textHeading }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div><p style={{ fontSize: "0.875rem", color: T.textHeading, margin: "0 0 1.25rem", lineHeight: 1.6 }}>Conteúdo do modal com blur de fundo e botões em formato pílula.</p><div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}><button onClick={() => setModalOpen(false)} style={{ padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 500, background: "transparent", color: T.textHeading, border: `1px solid ${T.border}`, cursor: "pointer", fontFamily: T.font }}>Cancelar</button><button onClick={() => setModalOpen(false)} style={{ padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 500, background: "#E4E4E7", color: "#18181B", border: "none", cursor: "pointer", fontFamily: T.font }}>Confirmar</button></div></div></div>)}
          </Card>

          {/* Empty State */}
          <Card title="Estado Vazio" style={{ marginTop: "1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem 1rem", gap: "0.75rem" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.textBody} strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: T.textHeading }}>Nenhum resultado encontrado</h4>
              <p style={{ margin: 0, fontSize: "0.82rem", color: T.textBody, textAlign: "center" }}>Tente ajustar sua busca ou filtros</p>
              <button style={{ marginTop: "0.5rem", padding: "0.375rem 0.875rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 500, background: "transparent", color: T.textMuted, border: `1px solid ${T.border}`, cursor: "pointer", fontFamily: T.font }}>Limpar filtros</button>
            </div>
          </Card>

          {/* ═══════════════════════════════════════════════════════════
            §15 — CUSTOM DROPDOWN
            ═══════════════════════════════════════════════════════════ */}
          <SectionHeader label="§15 — CustomDropdown (Componente Oficial de Seleção)" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <DropdownDarkPreview />
            <DropdownLightPreview />
          </div>

          {/* ═══════════════════════════════════════════════════════════
            §16 — CUSTOM SCROLLBAR
            ═══════════════════════════════════════════════════════════ */}
          <SectionHeader label="§16 — Custom Scrollbar (webkit 6px)" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <Card title="Dark mode — thumb #3f3f46" subtitle="width: 6px, track: transparent, border-radius: 3px">
              <style>{`.ds-scroll-dark::-webkit-scrollbar{width:6px;height:6px}.ds-scroll-dark::-webkit-scrollbar-track{background:transparent}.ds-scroll-dark::-webkit-scrollbar-thumb{background:#3f3f46;border-radius:3px}.ds-scroll-dark::-webkit-scrollbar-thumb:hover{background:#52525b}`}</style>
              <div className="ds-scroll-dark" style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", paddingRight: "0.5rem" }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} style={{ padding: "0.625rem 0.875rem", background: T.bgCard, borderRadius: 8, fontSize: "0.8rem", color: T.textBody, display: "flex", justifyContent: "space-between" }}>
                    <span>Item de lista {i + 1}</span>
                    <span style={{ color: T.textBody, fontSize: "0.7rem" }}>#{String(i + 1).padStart(3, "0")}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Light mode — thumb #cbd5e1" subtitle="hover: #94a3b8 (slate-400)">
              <style>{`.ds-scroll-light::-webkit-scrollbar{width:6px}.ds-scroll-light::-webkit-scrollbar-track{background:transparent}.ds-scroll-light::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}.ds-scroll-light::-webkit-scrollbar-thumb:hover{background:#94a3b8}`}</style>
              <div className="ds-scroll-light" style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", background: "#f8fafc", borderRadius: 8, padding: "0.75rem" }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} style={{ padding: "0.625rem 0.875rem", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: "0.8rem", color: "#334155", display: "flex", justifyContent: "space-between" }}>
                    <span>Item de lista {i + 1}</span>
                    <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>#{String(i + 1).padStart(3, "0")}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ═══════════════════════════════════════════════════════════
            §17 & §19.1 — THEME HELPERS + FONTES
            ═══════════════════════════════════════════════════════════ */}
          <SectionHeader label="§17 & §19.1 — Theme Helpers + Fontes (Inter)" />
          <Card title="Theme Helpers — 6 aliases obrigatórios em toda página" subtitle="Declarados no topo de cada componente, suporte dark/light automático">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: T.textMuted, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Dark Mode</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {[
                    { name: "textMain", sample: "Título Principal", fg: "#f8fafc", bg: "#18181b", hex: "text-slate-50" },
                    { name: "textSub", sample: "Texto Secundário", fg: "#94a3b8", bg: "#18181b", hex: "text-slate-400" },
                    { name: "bgCard", sample: "Card / Modal", fg: "#e4e4e7", bg: "#18181b", border: "1px solid #27272a", hex: "bg-dark-surface" },
                    { name: "borderCol", sample: "──── Borda ────", fg: "#e4e4e7", bg: "#27272a", hex: "border-dark-border" },
                    { name: "bgInput", sample: "Input field", fg: "#e4e4e7", bg: "#09090b", border: "1px solid #27272a", hex: "bg-dark" },
                    { name: "shadowClass", sample: "Sem sombra (dark)", fg: T.textBody, bg: "#18181b", hex: "'' vazio" },
                  ].map((h, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.4rem 0.6rem", background: "#27272a", borderRadius: 6 }}>
                      <code style={{ fontSize: "0.68rem", color: "#60a5fa", fontFamily: "monospace", width: 78, flexShrink: 0 }}>{h.name}</code>
                      <div style={{ flex: 1, padding: "0.2rem 0.5rem", background: h.bg, border: h.border, borderRadius: 4, fontSize: "0.7rem", color: h.fg, fontFamily: T.font }}>{h.sample}</div>
                      <code style={{ fontSize: "0.6rem", color: T.textBody, fontFamily: "monospace", flexShrink: 0 }}>{h.hex}</code>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Light Mode</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {[
                    { name: "textMain", sample: "Título Principal", fg: "#0f172a", bg: "#ffffff", hex: "text-slate-900" },
                    { name: "textSub", sample: "Texto Secundário", fg: "#475569", bg: "#ffffff", hex: "text-slate-600" },
                    { name: "bgCard", sample: "Card / Modal", fg: "#334155", bg: "#ffffff", border: "1px solid #cbd5e1", hex: "bg-white" },
                    { name: "borderCol", sample: "──── Borda ────", fg: "#334155", bg: "#cbd5e1", hex: "border-slate-300" },
                    { name: "bgInput", sample: "Input field", fg: "#334155", bg: "#ffffff", border: "1px solid #cbd5e1", hex: "bg-white" },
                    { name: "shadowClass", sample: "Sombra suave", fg: "#64748b", bg: "#ffffff", border: "1px solid #e2e8f0", extra: "0 1px 2px rgba(0,0,0,0.06)", hex: "shadow-sm" },
                  ].map((h, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.4rem 0.6rem", background: "#f1f5f9", borderRadius: 6 }}>
                      <code style={{ fontSize: "0.68rem", color: "#2563eb", fontFamily: "monospace", width: 78, flexShrink: 0 }}>{h.name}</code>
                      <div style={{ flex: 1, padding: "0.2rem 0.5rem", background: h.bg, border: h.border, borderRadius: 4, fontSize: "0.7rem", color: h.fg, fontFamily: T.font, boxShadow: h.extra }}>{h.sample}</div>
                      <code style={{ fontSize: "0.6rem", color: "#64748b", fontFamily: "monospace", flexShrink: 0 }}>{h.hex}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: "1rem", marginTop: "0.25rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: T.textMuted, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Inter — Pesos Carregados (300–700)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", alignItems: "baseline" }}>
                {[300, 400, 500, 600, 700].map(w => (
                  <span key={w} style={{ fontFamily: "Inter, sans-serif", fontWeight: w, fontSize: "1rem", color: T.textBody }}>
                    Inter {w}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* ═══════════════════════════════════════════════════════════
            §18 — ENTERPRISE MODALS
            ═══════════════════════════════════════════════════════════ */}
          <SectionHeader label="§18 — Modais Enterprise (3 padrões)" />
          <ModalPreviews />

          {/* ═══════════════════════════════════════════════════════════
            §19 — LAYOUT ENTERPRISE
            ═══════════════════════════════════════════════════════════ */}
          <SectionHeader label="§19 — Layout Enterprise (Page Structure + Grids)" />
          <Card title="Estrutura Padrão de Página" subtitle="animate-in slide-in-from-bottom-4 + header + KPI grid (4 cols) + grid principal (12 cols)">
            <div style={{ background: "#09090b", borderRadius: 10, padding: "1.25rem", border: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: T.textPrimary }}>Gestão de Clientes</h1>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: T.textBody }}>Gerencie sua base de clientes e histórico</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button style={{ padding: "0.5rem 0.875rem", borderRadius: 9999, fontSize: "0.75rem", fontWeight: 700, background: T.bgCard, color: T.textMuted, border: `1px solid ${T.border}`, cursor: "pointer" }}>Importar</button>
                  <button style={{ padding: "0.5rem 0.875rem", borderRadius: 9999, fontSize: "0.75rem", fontWeight: 700, background: "#00bf62", color: "#fff", border: "none", cursor: "pointer" }}>+ Novo Cliente</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.625rem", marginBottom: "1.25rem" }}>
                {[
                  { label: "Total de Clientes", value: "1.247", sub: "+12 esse mês", color: "#3b82f6" },
                  { label: "Clientes Ativos", value: "943", sub: "75.6% do total", color: "#22c55e" },
                  { label: "Assinantes", value: "318", sub: "33.7% dos ativos", color: "#a855f7" },
                  { label: "MRR Total", value: "R$ 9.540", sub: "+5.2% vs mês ant.", color: "#f59e0b" },
                ].map((kpi, i) => (
                  <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "0.875rem" }}>
                    <div style={{ fontSize: "0.68rem", color: T.textMuted, fontWeight: 500, marginBottom: "0.3rem" }}>{kpi.label}</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: T.textPrimary, lineHeight: 1 }}>{kpi.value}</div>
                    <div style={{ fontSize: "0.66rem", color: kpi.color, fontWeight: 500, marginTop: "0.25rem" }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Grid Principal: xl:grid-cols-12</div>
              <div style={{ display: "grid", gridTemplateColumns: "8fr 4fr", gap: "0.625rem" }}>
                <div style={{ background: T.bgPage, border: `1px solid ${T.border}`, borderRadius: 10, padding: "0.75rem", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: T.textBody }}>xl:col-span-8 — Conteúdo Principal (tabelas, gráficos)</span>
                </div>
                <div style={{ background: T.bgPage, border: `1px solid ${T.border}`, borderRadius: 10, padding: "0.75rem", minHeight: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: T.textBody }}>xl:col-span-4 — Sidebar</span>
                </div>
              </div>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginTop: "1.25rem" }}>
            <Card title="dash-card — Cards Premium" subtitle="Hover com shadow elevado e border sutil">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[
                  { label: "Normal", border: "rgba(255,255,255,0.06)", shadow: "0 1px 4px rgba(0,0,0,0.3)" },
                  { label: "Hover (simulado)", border: "rgba(255,255,255,0.12)", shadow: "0 8px 32px rgba(0,0,0,0.4)" },
                ].map((s, i) => (
                  <div key={i} style={{ borderRadius: 12, border: `1px solid ${s.border}`, boxShadow: s.shadow, padding: "1rem", background: T.bgCard }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: T.textMuted }}>{s.label}</div>
                    <div style={{ fontSize: "0.68rem", color: T.textBody, marginTop: "0.2rem" }}>border: {s.border}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="hero-header — Textura Dot Noise" subtitle="Dot grid 14px via ::after, border 1px rgba(255,255,255,0.06)">
              <div style={{ position: "relative", borderRadius: 12, padding: "24px 28px", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", overflow: "hidden", background: "linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)" }}>
                <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle,rgba(255,255,255,0.7) 1px,transparent 1px)", backgroundSize: "14px 14px", zIndex: 0, pointerEvents: "none" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Bom dia, Matheus</div>
                  <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.7)", marginTop: "0.25rem" }}>Sábado, 07 de março de 2026</div>
                  <div style={{ fontSize: "3rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1, marginTop: "0.5rem" }}>18:29</div>
                </div>
              </div>
            </Card>
          </div>

          {/* ═══════════════════════════════════════════════════════════
            §20 — REGRAS ENTERPRISE
            ═══════════════════════════════════════════════════════════ */}
          <SectionHeader label="§20 — Regras Enterprise Obrigatórias" />
          <Card title="Quick Reference — Correto vs. Proibido">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {[
                {
                  title: "Componentes", color: "#3b82f6", rules: [
                    { ok: true, text: "<CustomDropdown> para seleção" },
                    { ok: false, text: "<select> nativo" },
                    { ok: true, text: "overflow-y-auto custom-scrollbar" },
                    { ok: false, text: "Scrollbar padrão em listas internas" },
                    { ok: true, text: "<Loader2 animate-spin> (lucide)" },
                    { ok: false, text: "Spinner SVG customizado" },
                    { ok: true, text: "useToast() para notificações" },
                    { ok: false, text: "alert() / window.confirm()" },
                  ]
                },
                {
                  title: "Modais", color: "#a855f7", rules: [
                    { ok: true, text: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" },
                    { ok: true, text: "flex flex-col h-[85vh] — corpo scrollável" },
                    { ok: true, text: "Header e Footer: shrink-0 (sempre fixos)" },
                    { ok: true, text: "Tabs para modais com 3+ seções" },
                    { ok: true, text: "animate-in zoom-in-95 duration-200" },
                    { ok: false, text: "Modal sem footer fixo com conteúdo longo" },
                    { ok: false, text: "slide-in no container do modal" },
                  ]
                },
                {
                  title: "Dark/Light Mode", color: "#22c55e", rules: [
                    { ok: true, text: "Theme Helpers: bgCard, textMain, textSub, borderCol, bgInput, shadowClass" },
                    { ok: true, text: "isDarkMode ? dark : light em toda classe" },
                    { ok: true, text: "text-primary / bg-primary (CSS vars dinâmicas)" },
                    { ok: false, text: "Hardcode de cores #hex sem ternário" },
                    { ok: false, text: "Componente sem suporte ao light mode" },
                  ]
                },
                {
                  title: "Filtro por Unidade", color: "#f59e0b", rules: [
                    { ok: true, text: "Dados com unitId → useFilteredData()" },
                    { ok: true, text: "subscriptions → unitSubscriptions filtrado via clientId da unidade" },
                    { ok: true, text: "KPIs sempre com dados filtrados" },
                    { ok: true, text: "Verificar selectedUnitId !== 'all'" },
                    { ok: false, text: "KPI usando dados globais quando há unidade selecionada" },
                    { ok: false, text: "subscriptions sem filtro por unidade em KPI" },
                  ]
                },
              ].map((section, i) => (
                <div key={i} style={{ background: T.bgCard, borderRadius: 10, padding: "1rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: section.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>{section.title}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {section.rules.map((rule, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.72rem", color: rule.ok ? T.textBody : T.textBody }}>
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: rule.ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", border: `1px solid ${rule.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          {rule.ok
                            ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                            : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          }
                        </span>
                        <span style={{ textDecoration: rule.ok ? "none" : "line-through", opacity: rule.ok ? 1 : 0.55, lineHeight: 1.5 }}>{rule.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

