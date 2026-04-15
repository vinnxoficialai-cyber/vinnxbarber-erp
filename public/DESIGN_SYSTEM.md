# Design System Reference — Antigravity SaaS

> **Propósito**: Fonte da verdade visual e UX do projeto. Consulte ANTES de criar qualquer tela, modal, componente ou função.
> **Formato**: Specs em texto + código de referência validado para cada componente.

---

## 1. Fundamentos Visuais

### 1.1 Tema & Cores

Dark theme como padrão. Paleta baseada em Zinc/Slate.

| Token | Hex | Uso |
|-------|-----|-----|
| `--bg-page` | `#121214` | Fundo da página principal |
| `--bg-card` | `#18181B` | Cards, containers, painéis (zinc-900) |
| `--bg-elevated` | `#27272A` | Headers de tabela, hover, dropdowns (zinc-800) |
| `--bg-element` | `#3F3F46` | Avatares, badges, botões secondary (zinc-700) |
| `--border-default` | `#27272A` | Bordas de cards, tabelas, inputs |
| `--text-primary` | `#FFFFFF` | Títulos principais |
| `--text-heading` | `#F4F4F5` | Títulos de seção, labels, texto enfatizado |
| `--text-body` | `#E4E4E7` | Texto de corpo, dados de tabela |
| `--text-muted` | `#A1A1AA` | Descrições, placeholders, texto inativo |
| `--text-disabled` | `#71717A` | Texto desabilitado |
| `--text-faded` | `#52525B` | Texto em estado muted/faded |
| `--accent-primary` | `#3B82F6` | Cor primária (blue-500) |
| `--accent-primary-light` | `#60A5FA` | Texto destaque azul (blue-400) |
| `--success` | `#00E676` / `#4ADE80` / `#22C55E` | Verde (badges/status/dots) |
| `--warning` | `#FFEA00` / `#FFC400` | Amarelo/Âmbar |
| `--error` | `#FF5252` / `#F87171` / `#EF4444` | Vermelho/Coral |
| `--info` | `#60A5FA` / `#3B82F6` | Azul info |

**Aliases de conveniência** (usados internamente nos componentes de insight/rings):

| Alias | Hex | Equivalente |
|-------|-----|-------------|
| `blue` | `#3B82F6` | `accentPrimary` |
| `green` | `#22C55E` | `successDot` |
| `gray` | `#71717A` | `textDisabled` |

### 1.2 Tipografia

- **Família**: `'Inter', 'Segoe UI', system-ui, sans-serif`
- **Título de página**: `1.5rem`, `fontWeight: 700`, `#FFFFFF`
- **Título de seção**: `1.125rem`, `fontWeight: 600`, `#F4F4F5`
- **Subtítulo de seção**: `1rem`, `fontWeight: 600`, `#F4F4F5`
- **Descrição**: `1rem`, `fontWeight: 400`, `#A1A1AA`
- **Label de input**: `0.875rem`, `fontWeight: 600`, `#F4F4F5`
- **Texto de corpo**: `0.875rem`, `fontWeight: 400`, `#E4E4E7`
- **Texto pequeno**: `0.75rem`

### 1.3 Espaçamento

- **Gap entre header e conteúdo**: `2rem`
- **Gap entre seções**: `2rem`
- **Gap entre título de seção e conteúdo**: `1rem`
- **Gap entre itens em linha (badges, botões)**: `1rem`
- **Padding de página**: `2rem`
- **Padding de cards**: `1rem`
- **Border radius de cards**: `8px` (0.5rem)

---

## 2. Charts (Recharts)

### 2.1 Configuração Global

**Atenção**: Use a paleta Zinc (tokens do projeto), não Slate.

```jsx
// Tooltip — bg #27272A, border #3F3F46 (zinc, não slate)
const tooltipStyle = {
  backgroundColor: "#27272A",
  border: "1px solid #3F3F46",
  borderRadius: "8px",
  fontSize: "0.8rem",
  color: "#E4E4E7",
};

// Objeto helper reutilizável para todos os charts Recharts
const tooltipProps = {
  contentStyle: tooltipStyle,
  labelStyle: { color: "#E4E4E7" },
  cursor: { fill: "rgba(255,255,255,0.05)" }, // highlight de hover sutil
};

// Eixos padrão
<XAxis dataKey="name" stroke="#27272A" tick={{ fill: "#A1A1AA", fontSize: 12 }} axisLine={{ stroke: "#27272A" }} tickLine={false} />
<YAxis stroke="#27272A" tick={{ fill: "#A1A1AA", fontSize: 12 }} axisLine={{ stroke: "#27272A" }} tickLine={false} />

// Grid
<CartesianGrid strokeDasharray="3 3" stroke="#27272A" strokeOpacity={0.4} />

// Legend
<Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "#A1A1AA", fontSize: "0.8rem", marginLeft: 4 }}>{v}</span>} />
```

### 2.2 Area Chart — Gradiente vertical OBRIGATÓRIO

**Multi-série**: Para múltiplas séries, cada uma recebe seu próprio `<linearGradient id="...">` e fill distinto. A série secundária (ex: comparativo) usa `T.textMuted` (`#A1A1AA`) como stroke e fill.

```jsx
{/* Série primária */}
<defs>
  <linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
  </linearGradient>
  {/* Série secundária (muted) */}
  <linearGradient id="gradSecondary" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#A1A1AA" stopOpacity={0.35} />
    <stop offset="95%" stopColor="#A1A1AA" stopOpacity={0.02} />
  </linearGradient>
</defs>
<Area type="monotone" dataKey="primary" stroke="#3b82f6" fill="url(#gradPrimary)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#3b82f6", stroke: "#18181B", strokeWidth: 2 }} />
<Area type="monotone" dataKey="secondary" stroke="#A1A1AA" fill="url(#gradSecondary)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#A1A1AA", stroke: "#18181B", strokeWidth: 2 }} />
```

### 2.3 Bar Chart — Gradiente vertical, cantos arredondados

**Multi-série**: Igual ao Area Chart — cada série com `<linearGradient>` próprio e `fill="url(#...)"`.

```jsx
<defs>
  <linearGradient id="gradBar" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
  </linearGradient>
  {/* Segunda barra (muted) */}
  <linearGradient id="gradBar2" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#A1A1AA" stopOpacity={1} />
    <stop offset="100%" stopColor="#A1A1AA" stopOpacity={0.6} />
  </linearGradient>
</defs>
<Bar dataKey="primary" fill="url(#gradBar)" radius={[4, 4, 0, 0]} />
<Bar dataKey="secondary" fill="url(#gradBar2)" radius={[4, 4, 0, 0]} />
```

### 2.4 Line Chart

```jsx
<Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4, stroke: "#0f172a", strokeWidth: 2 }} />
```

### 2.5 Pie Chart — Donut

```jsx

  {data.map((e, i) => <Cell key={i} fill={e.color} />)}
</Pie>
```

### 2.6 Radar Chart

```jsx


<Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
```

### 2.7 Rings Chart — Concêntrico, degradê diagonal, sem glow

```jsx
function RingsChart({ data, size = 200, strokeWidth = 13 }) {
  const center = size / 2;
  const maxValue = data.reduce((max, d) => Math.max(max, d.value), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
      <div style={{ position: "relative" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            {data.map((item, i) => (
              <linearGradient key={`rg-${i}`} id={`rg-${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity={1} />
                <stop offset="100%" stopColor={item.color} stopOpacity={0.45} />
              </linearGradient>
            ))}
          </defs>
          {data.map((item, i) => {
            const gap = strokeWidth + 6;
            const r = center - strokeWidth / 2 - 10 - i * gap;
            const c = 2 * Math.PI * r;
            const off = c - (item.value / 100) * c;
            return (
              <g key={i}>
                <circle cx={center} cy={center} r={r} fill="none" stroke="#27272A" strokeWidth={strokeWidth} opacity={0.5} />
                <circle cx={center} cy={center} r={r} fill="none" stroke={`url(#rg-${i})`} strokeWidth={strokeWidth}
                  strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
                  transform={`rotate(-90 ${center} ${center})`} style={{ transition: "stroke-dashoffset 1s ease" }} />
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#F4F4F5" }}>{maxValue}%</div>
        </div>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
        {data.map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0.75rem 0.5rem",
            borderTop: i === 0 ? "1px solid #27272A" : "none",
            borderBottom: "1px solid #27272A",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "8px", background: item.color + "20",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* RingIcon — ver §14.4 */}
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#E4E4E7" }}>{item.label}</div>
                <div style={{ fontSize: "0.75rem", color: "#A1A1AA" }}>{item.description}</div>
              </div>
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#A1A1AA" }}>{item.value}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2.8 InsightRingChart — Variante compacta animada

Versão menor do Rings Chart (sem a lista de legenda abaixo), projetada para cards de insight com tabs. Diferenças em relação ao §2.7:
- `size=180`, `strokeWidth=10`, gap entre anéis `= strokeWidth + 5`
- Sem gradiente diagonal — stroke usa cor sólida direta
- Centro: número animado via `useAnimatedCounter` (ver §9.5), `fontSize 2.5rem`, `fontWeight 700`
- Track dos anéis: `stroke={T.border}` sem opacidade extra
- Transição: `stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)` + `stroke 0.5s ease`

```jsx
function InsightRingChart({ rings, centerValue, size = 180, strokeWidth = 10 }) {
  const center = size / 2;
  const displayVal = useAnimatedCounter(centerValue, 700);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring, i) => {
          const gap = strokeWidth + 5;
          const r = center - strokeWidth / 2 - 8 - i * gap;
          const c = 2 * Math.PI * r;
          const offset = c - (ring.value / 100) * c;
          return (
            <g key={i}>
              <circle cx={center} cy={center} r={r} fill="none" stroke="#27272A" strokeWidth={strokeWidth} />
              <circle cx={center} cy={center} r={r} fill="none" stroke={ring.color} strokeWidth={strokeWidth}
                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                transform={`rotate(-90 ${center} ${center})`}
                style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease" }} />
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "2.5rem", fontWeight: 700, color: "#FFFFFF" }}>{displayVal}%</span>
      </div>
    </div>
  );
}
// rings: Array<{ color: string, value: number (0-100) }>
// centerValue: número que anima via useAnimatedCounter
```

### 2.9 InsightCard — Chart de insights com tabs animadas

Componente composto: `SmoothTabs` (§6.2) + `InsightRingChart` (§2.8) + lista de métricas com fade transition ao trocar aba.

**Specs de layout**: Flex row com gap `2rem`. Lado esquerdo: `InsightRingChart` + tabs abaixo. Lado direito: lista de métricas (flex column, gap separador `1px solid #27272A`).

**Fade transition na troca de aba**: `opacity: 0 → 1` em `200ms` — zerar opacity → `setTimeout(200ms)` → trocar dados → restaurar opacity.

```jsx
// Estado
const [insightTab, setInsightTab] = useState("performance");
const [listOpacity, setListOpacity] = useState(1);

// Troca de aba com fade
const handleInsightTab = (tab) => {
  if (tab === insightTab) return;
  setListOpacity(0);
  setTimeout(() => { setInsightTab(tab); setListOpacity(1); }, 200);
};

// Tabs menores: padding 4px, indicator com translateX ajustado para container-padding=4px
// Métricas: ícone 36x36 radius 8px bg=cor+20, title 0.85rem/600/#E4E4E7, sub 0.75rem/#A1A1AA
// Valor: fontSize 0.9rem, fontWeight 700, cor do item (ou #E4E4E7 para neutro)
```

---

**Specs**: Container bg `#18181B`, border `1px solid #27272A`, borderRadius `8px`. Header bg `#27272A` com radius no topo. Colunas: ~30% Name, ~35% Email, ~20% Role, ~15% Status.

```jsx
function Table({ columns, data, showPagination, currentPage, onPageChange, totalPages }) {
  return (
    <div style={{ background: "#18181B", border: "1px solid #27272A", borderRadius: "8px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ background: "#27272A" }}>
            {columns.map((col) => (
              <th key={col.accessor} style={{
                textAlign: "left", padding: "0.75rem 1rem",
                color: "#F4F4F5", fontWeight: 600, fontSize: "0.875rem",
                textTransform: "capitalize",
              }}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #27272A" }}>
              {columns.map((col) => (
                <td key={col.accessor} style={{
                  padding: "1.25rem 1rem", color: "#E4E4E7", fontWeight: 400,
                }}>{/* render cell */}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer / Pagination */}
      {showPagination && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "1rem", borderTop: "1px solid #27272A",
        }}>
          <span style={{ fontSize: "0.875rem", color: "#E4E4E7", fontWeight: 400 }}>
            Showing 1 to {data.length} of {data.length} results
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Pagination controls - ver §6.1 */}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3.1 Status Badges (dentro da tabela)

```jsx
// Active
<span style={{
  display: "inline-flex", padding: "0.125rem 0.5rem", borderRadius: "9999px",
  fontSize: "0.75rem", fontWeight: 500, textTransform: "lowercase",
  background: "rgba(34, 197, 94, 0.15)", color: "#4ade80",
}}>active</span>

// Inactive
<span style={{
  display: "inline-flex", padding: "0.125rem 0.5rem", borderRadius: "9999px",
  fontSize: "0.75rem", fontWeight: 500, textTransform: "lowercase",
  background: "#27272A", color: "#A1A1AA",
}}>inactive</span>
// Nota: o JSX de preview usa #1e293b/#cbd5e1 (Slate) neste badge — inconsistência
// conhecida na fonte. Usar #27272A/#A1A1AA (Zinc) em novas telas.
```

---

## 4. UserName Component

**Specs**: flex row, gap 1rem, align-items flex-start. Avatar 40x40, #3F3F46. Status dot 13px, #22C55E com border 2px solid (cor do fundo da página) = efeito cutout.

```jsx
function UserName({ name, email, initial, roles = [], showStatus = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "row", gap: "1rem", alignItems: "flex-start" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "9999px", background: "#3F3F46",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: "1rem", fontWeight: 500, color: "#FFFFFF", textTransform: "uppercase" }}>
            {initial}
          </span>
        </div>
        {showStatus && (
          <div style={{
            position: "absolute", top: 0, right: 0,
            width: 13, height: 13, borderRadius: "9999px",
            background: "#22C55E", border: "2px solid #18181B",
            transform: "translate(15%, -15%)",
          }} />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minHeight: 40, justifyContent: "center" }}>
        <span style={{ fontSize: "1rem", fontWeight: 600, color: "#FFFFFF", lineHeight: 1.3 }}>{name}</span>
        {email && <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "#A1A1AA", lineHeight: 1.3 }}>{email}</span>}
        {roles.length > 0 && (
          <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem", marginTop: "0.25rem" }}>
            {roles.map((role, j) => (
              <span key={j} style={{
                background: "#3F3F46", borderRadius: "9999px",
                padding: "2px 10px", fontSize: "0.7rem", fontWeight: 600,
                color: "#FFFFFF", lineHeight: 1.6,
              }}>{role}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 5. Badge & Status

### 5.1 Badge — Formato pill, 0.875rem, fontWeight 600

**Regra de cor**: texto = cor vibrante, border = mesma cor ~20% opacidade, bg = mesma cor ~10% opacidade.

```jsx
function Badge({ children, variant = "default", size = "md" }) {
  const variants = {
    default:   { bg: "#3F3F46", color: "#FFFFFF", border: "none" },
    outline:   { bg: "transparent", color: "#FFFFFF", border: "1px solid #3F3F46" },
    secondary: { bg: "rgba(255,255,255,0.05)", color: "#A1A1AA", border: "none" },
    success:   { bg: "rgba(0,230,118,0.1)", color: "#00E676", border: "1px solid rgba(0,230,118,0.25)" },
    warning:   { bg: "rgba(255,234,0,0.1)", color: "#FFEA00", border: "1px solid rgba(255,234,0,0.25)" },
    error:     { bg: "rgba(255,82,82,0.1)", color: "#FF5252", border: "1px solid rgba(255,82,82,0.25)" },
  };
  const sizes = {
    sm: { padding: "0.125rem 0.625rem", fontSize: "0.75rem" },
    md: { padding: "0.25rem 0.75rem", fontSize: "0.875rem" },
    lg: { padding: "0.375rem 1rem", fontSize: "1rem" },
  };
  const v = variants[variant] || variants.default;
  const s = sizes[size] || sizes.md;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      borderRadius: "9999px", fontWeight: 600, textTransform: "capitalize",
      background: v.bg, color: v.color, border: v.border || "none",
      padding: s.padding, fontSize: s.fontSize,
    }}>{children}</span>
  );
}
```

### 5.2 ShineBadge — Tratamento premium com animação de brilho

**Specs**: Pill, padding `0.375rem 1rem`, fontSize `0.875rem`, fontWeight 500. `position: relative`, `overflow: hidden` (para conter animação). Gradientes verticais (180deg) para sensação premium. Bordas semi-transparentes (~8-12%).

**Implementação recomendada — CSS Auto-Loop via `::after`** (validado no preview):

Em vez de animar no hover, usar classes CSS com `::after` e `@keyframes shineLoop`, com `animation-delay` por item para efeito escalonado. Isso cria um loop contínuo elegante a cada ~3s.

```css
/* Injetar via <style> ou CSS global */
.shine-loop { position: relative; overflow: hidden; }
.shine-loop::after {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
  transform: skewX(-20deg);
  animation: shineLoop 3s ease-in-out infinite;
  pointer-events: none;
}
.shine-d1::after { animation-delay: 0s; }
.shine-d2::after { animation-delay: 1s; }
.shine-d3::after { animation-delay: 2s; }
@keyframes shineLoop {
  0%   { left: -100%; }
  30%  { left: 200%; }
  100% { left: 200%; }
}
```

```jsx
function ShineBadge({ variant = "new", children }) {
  const variants = {
    new: {
      background: "linear-gradient(180deg, #FFFFFF 0%, #D4D4D8 100%)",
      color: "#121214",
      border: "none",
      boxShadow: "0 0 8px rgba(255,255,255,0.15)",
    },
    featured: {
      background: "#18181B",
      color: "#F4F4F5",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "none",
    },
    premium: {
      background: "linear-gradient(180deg, #3F3F46 0%, #18181B 100%)",
      color: "#FFFFFF",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "none",
    },
  };
  const v = variants[variant];
  return (
    <span className={`shine-loop shine-d1`} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "0.375rem 1rem", borderRadius: "9999px",
      fontSize: "0.875rem", fontWeight: 500,
      background: v.background, color: v.color,
      border: v.border, boxShadow: v.boxShadow,
    }}>
      {children}
    </span>
  );
}
// Para múltiplos badges lado a lado, use shine-d1/d2/d3 para delays escalonados
```

### 5.3 Status Badge — Com dot e severity levels

**Regra**: Dot = cor saturada 100% opacidade, texto = cor clara, border = cor ~20%, bg = cor ~10%.

```jsx
function StatusBadge({ variant = "low", label, showDot = false, size = "md" }) {
  const variants = {
    low:      { dot: "#3B82F6", text: "#60A5FA", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" },
    medium:   { dot: "#EAB308", text: "#FDE047", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.2)" },
    high:     { dot: "#F97316", text: "#FB923C", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)" },
    critical: { dot: "#EF4444", text: "#F87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
    success:  { dot: "#4ADE80", text: "#4ADE80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.2)" },
    warning:  { dot: "#FDE047", text: "#FDE047", bg: "rgba(253,224,71,0.1)", border: "rgba(253,224,71,0.2)" },
    error:    { dot: "#F87171", text: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)" },
    info:     { dot: "#60A5FA", text: "#60A5FA", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)" },
  };
  const sizes = {
    sm: { padding: "0.125rem 0.5rem", fontSize: "0.75rem" },
    md: { padding: "0.25rem 0.75rem", fontSize: "0.875rem" },
    lg: { padding: "0.375rem 1rem", fontSize: "1rem" },
  };
  const v = variants[variant];
  const s = sizes[size];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", borderRadius: "9999px",
      fontWeight: 500, textTransform: "capitalize",
      background: v.bg, color: v.text, border: `1px solid ${v.border}`,
      padding: s.padding, fontSize: s.fontSize,
    }}>
      {showDot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: v.dot, marginRight: "0.375rem", flexShrink: 0 }} />}
      {label}
    </span>
  );
}
```

---

## 6. Navigation

### 6.1 Pagination (Standalone)

**Specs**: Todos os botões com height `40px`. Numéricos: `40x40px`, circular. Previous/Next: height 40px, padding horizontal `1rem`, pill. Gap: `0.5rem`.

**States**:
- Inativo: bg `transparent`, color `#E5E5E5`, fontWeight 500
- Hover: bg `#2A2A2A` (ou `rgba(255,255,255,0.1)`), color `#FFFFFF`, transition `150ms ease`
- Ativo: bg `#FFFFFF`, color `#000000`, fontWeight 500-600, sem hover adicional
- Disabled: color `#71717A`, cursor `not-allowed`

```jsx
function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
      <span style={{ fontSize: "0.875rem", color: "#E4E4E7", fontWeight: 400 }}>
        Showing {start} to {end} of {totalItems} results
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {/* Previous */}
        <button
          disabled={currentPage === 1}
          onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.background = "#2A2A2A"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          style={{
            height: 40, padding: "0 1rem", borderRadius: "9999px",
            background: "transparent", border: "none",
            color: currentPage === 1 ? "#71717A" : "#E5E5E5",
            fontWeight: 500, fontSize: "0.875rem",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            transition: "background-color 150ms ease, color 150ms ease",
          }}>Previous</button>

        {/* Page numbers */}
        {Array.from({ length: totalPages }, (_, i) => {
          const isActive = currentPage === i + 1;
          return (
            <button key={i} onClick={() => onPageChange(i + 1)}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#2A2A2A"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.875rem", border: "none", cursor: "pointer",
                background: isActive ? "#FFFFFF" : "transparent",
                color: isActive ? "#000000" : "#E5E5E5",
                fontWeight: isActive ? 600 : 500,
                transition: "background-color 150ms ease, color 150ms ease",
              }}>{i + 1}</button>
          );
        })}

        {/* Next */}
        <button
          disabled={currentPage === totalPages}
          onMouseEnter={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = "#2A2A2A"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          style={{
            height: 40, padding: "0 1rem", borderRadius: "9999px",
            background: "transparent", border: "none",
            color: currentPage === totalPages ? "#71717A" : "#E5E5E5",
            fontWeight: 500, fontSize: "0.875rem",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            transition: "background-color 150ms ease, color 150ms ease",
          }}>Next</button>
      </div>
    </div>
  );
}
```

### 6.2 Smooth Tabs — Sliding indicator animado

**Specs**: Container bg `#18181B`, border `1px solid #27272A`, borderRadius `12px`, padding `6px`. Tabs flex:1, gap 0.5rem ícone-texto. Ativo: #FFFFFF. Inativo: #A1A1AA. Indicator: bg `#3F3F46`, borderRadius `8px`, position absolute, z-index 0, transition 0.3s cubic-bezier.

```jsx
function SmoothTabs({ items, value, onValueChange }) {
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const tabRefs = useRef({});

  useEffect(() => {
    const activeTab = tabRefs.current[value];
    if (activeTab) {
      setIndicatorStyle({
        width: activeTab.offsetWidth,
        transform: `translateX(${activeTab.offsetLeft - 6}px)`, // subtract container padding
      });
    }
  }, [value]);

  return (
    <div style={{
      display: "flex", alignItems: "center", position: "relative",
      background: "#18181B", border: "1px solid #27272A",
      borderRadius: "12px", padding: "6px",
    }}>
      {/* Sliding Indicator */}
      <div style={{
        position: "absolute", top: "6px", bottom: "6px", left: "6px",
        background: "#3F3F46", borderRadius: "8px", zIndex: 0,
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s ease",
        ...indicatorStyle,
      }} />

      {items.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => tabRefs.current[tab.id] = el}
          onClick={() => onValueChange(tab.id)}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            gap: "0.5rem", padding: "0.625rem 1rem", fontSize: "0.875rem",
            fontWeight: 500, borderRadius: "8px", border: "none",
            background: "transparent", position: "relative", zIndex: 10,
            color: value === tab.id ? "#FFFFFF" : "#A1A1AA",
            cursor: "pointer", transition: "color 0.2s",
          }}
        >
          {tab.icon && <tab.icon size={16} />}
          {tab.title}
        </button>
      ))}
    </div>
  );
}
```

### 6.3 Breadcrumb

```jsx
function Breadcrumb({ items }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem" }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          {i > 0 && <span style={{ color: "#71717A" }}>/</span>}
          <span style={{
            color: item.current ? "#F4F4F5" : "#60A5FA",
            fontWeight: item.current ? 500 : 400,
            cursor: item.current ? "default" : "pointer",
          }}>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
```

---

## 7. Buttons

### 7.1 Button — Pill format (borderRadius 9999px), fontWeight 500

**Specs**: Todas as variantes (exceto Link) usam `borderRadius: 9999px`. Transition `0.2s ease` em `background-color`, `color`, `border-color`.

**Hover states**:
- Default: bg escurece para `#D4D4D8`
- Destructive: bg escurece para `#EF4444`
- Outline: bg ganha preenchimento `#27272A` (ou `rgba(255,255,255,0.05)`)
- Secondary: bg clareia para `#52525B`
- Ghost: bg ganha preenchimento `#27272A` (igual Outline, sem borda)
- Link: `text-decoration: underline`, bg permanece transparent

**States**: Disabled/Loading = `opacity: 0.5`, `pointer-events: none`, `cursor: not-allowed`. Loading tem spinner SVG rotacionando (`@keyframes spin { to { transform: rotate(360deg) } }`, 1s linear infinite).

```jsx
function Button({ children, variant = "default", size = "md", disabled, loading, startIcon, endIcon, onClick }) {
  const variants = {
    default:     { background: "#E4E4E7", color: "#18181B", border: "none", hoverBg: "#D4D4D8" },
    destructive: { background: "#F87171", color: "#121214", border: "none", hoverBg: "#EF4444" },
    outline:     { background: "transparent", color: "#FFFFFF", border: "1px solid #27272A", hoverBg: "#27272A" },
    secondary:   { background: "#3F3F46", color: "#F4F4F5", border: "none", hoverBg: "#52525B" },
    ghost:       { background: "transparent", color: "#E4E4E7", border: "none", hoverBg: "#27272A" },
    link:        { background: "transparent", color: "#E4E4E7", border: "none", hoverBg: "transparent" },
  };
  const sizes = {
    sm: { padding: "0.375rem 0.875rem", fontSize: "0.75rem" },
    md: { padding: "0.5rem 1rem", fontSize: "0.875rem" },
    lg: { padding: "0.75rem 1.5rem", fontSize: "1rem" },
    xl: { padding: "1rem 2rem", fontSize: "1.125rem" },
  };
  const v = variants[variant];
  const s = variant === "link" ? { padding: "0", fontSize: s?.fontSize || "0.875rem" } : sizes[size];
  const isDisabled = disabled || loading;
  return (
    <button onClick={onClick} disabled={isDisabled}
      onMouseEnter={(e) => { if (!isDisabled) { e.currentTarget.style.background = v.hoverBg; if (variant === "link") e.currentTarget.style.textDecoration = "underline"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = v.background; if (variant === "link") e.currentTarget.style.textDecoration = "none"; }}
      style={{
        background: v.background, color: v.color, border: v.border || "none",
        padding: s.padding, fontSize: s.fontSize,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: "0.5rem", borderRadius: variant === "link" ? "0" : "9999px", fontWeight: 500,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.5 : 1,
        transition: "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
        pointerEvents: isDisabled ? "none" : "auto",
        textDecoration: "none",
      }}>
      {loading && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ animation: "spin 1s linear infinite" }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {!loading && startIcon}
      {children}
      {endIcon}
    </button>
  );
}
// CSS: @keyframes spin { to { transform: rotate(360deg); } }
```

### 7.2 IconButton — Circular, aspect-ratio 1:1

```jsx
function IconButton({ children, variant = "default", size = "md", onClick }) {
  const variants = {
    default:     { background: "#E4E4E7", color: "#18181B", border: "none" },
    outline:     { background: "transparent", color: "#E4E4E7", border: "1px solid #27272A" },
    destructive: { background: "#F87171", color: "#121214", border: "none" },
    ghost:       { background: "transparent", color: "#A1A1AA", border: "none" },
    secondary:   { background: "#3F3F46", color: "#F4F4F5", border: "none" },
  };
  const sizes = {
    sm: { width: 32, height: 32, iconSize: 16 },
    md: { width: 40, height: 40, iconSize: 20 },
    lg: { width: 48, height: 48, iconSize: 24 },
  };
  const v = variants[variant];
  const s = sizes[size];
  return (
    <button onClick={onClick} style={{
      ...v, width: s.width, height: s.height, borderRadius: "50%",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", transition: "all 0.2s ease",
    }}>{children}</button>
  );
}
```

---

## 8. Form Inputs

### 8.1 Input / TextArea

**Specs**: bg `#18181B`, border `1px solid #27272A`, borderRadius `8px`, padding `0.625rem 1rem`, fontSize `0.875rem`. Placeholder: `#A1A1AA`. Focus: border muda para accent color.

```jsx
function Input({ label, placeholder, value, onChange, type = "text", error }) {
  return (
    <div>
      {label && <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#F4F4F5", marginBottom: "0.5rem" }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
        width: "100%", maxWidth: "32rem", padding: "0.625rem 1rem",
        borderRadius: "8px", fontSize: "0.875rem",
        border: `1px solid ${error ? "rgba(239,68,68,0.4)" : "#27272A"}`,
        background: "#18181B", color: "#F4F4F5", outline: "none",
        boxSizing: "border-box", transition: "border-color 0.15s",
      }}
        onFocus={(e) => e.target.style.borderColor = error ? "#EF4444" : "#3B82F6"}
        onBlur={(e) => e.target.style.borderColor = error ? "rgba(239,68,68,0.4)" : "#27272A"}
      />
      {error && <span style={{ fontSize: "0.75rem", color: "#F87171", marginTop: "0.25rem", display: "block" }}>{error}</span>}
    </div>
  );
}

// TextArea: mesmo estilo, height ~120px, resize: vertical
// File Input: flex space-between, botão "Browse" à direita com fontWeight 600
// Date Picker: ícone calendário 20px #A1A1AA à esquerda, gap 0.75rem
```

### 8.2 Search Input — Pill, com badge de atalho

```jsx
function SearchInput({ placeholder = "Search...", shortcut = "Ctrl+K", onOpenModal }) {
  return (
    <div onClick={onOpenModal} style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      background: "#27272A", border: "none", borderRadius: "9999px",
      padding: "0.5rem 0.5rem 0.5rem 1rem", maxWidth: "28rem", height: "2.5rem",
      cursor: "pointer",
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <span style={{ flex: 1, fontSize: "0.875rem", color: "#A1A1AA" }}>{placeholder}</span>
      <kbd style={{
        background: "#18181B", border: "none", borderRadius: "6px",
        padding: "0.125rem 0.375rem", fontSize: "0.75rem",
        fontWeight: 500, color: "#A1A1AA", pointerEvents: "none", userSelect: "none",
      }}>{shortcut}</kbd>
    </div>
  );
}
```

### 8.3 Checkbox — Monocromático, cor ativa #3F3F46

**Specs**: Box 16x16 (md), borderRadius 4px. Unchecked: bg `#27272A`. Checked: bg `#3F3F46`, ícone checkmark `#F4F4F5`. Disabled: opacity 0.5, cursor not-allowed. Label: 0.875rem, 400, `#E4E4E7`.

**States**: unchecked, checked, indeterminate (dash icon), disabled
**Sizes**: sm (14px, icon 10px, label 0.75rem), md (16px, icon 12px, label 0.875rem), lg (20px, icon 16px, label 1rem, radius 6px)
**Variants**: default (filled #3F3F46), outline (transparent + border 1px solid #52525B), ghost (transparent, no border, icon only)

```jsx
function Checkbox({ checked, indeterminate, disabled, onChange, label, size = "md", variant = "default" }) {
  const sizes = {
    sm: { box: 14, icon: 10, label: "0.75rem", radius: "4px" },
    md: { box: 16, icon: 12, label: "0.875rem", radius: "4px" },
    lg: { box: 20, icon: 16, label: "1rem", radius: "6px" },
  };
  const s = sizes[size];
  const isActive = checked || indeterminate;

  const boxStyles = {
    default: {
      background: isActive ? "#3F3F46" : "#27272A",
      border: "none",
    },
    outline: {
      background: "transparent",
      border: isActive ? "1px solid #52525B" : "1px solid #27272A",
    },
    ghost: {
      background: "transparent",
      border: "none",
    },
  };
  const v = boxStyles[variant] || boxStyles.default;

  return (
    <label style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
    }} onClick={() => !disabled && onChange?.(!checked)}>
      <div style={{
        width: s.box, height: s.box, borderRadius: s.radius,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s ease", ...v,
      }}>
        {checked && (
          <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#F4F4F5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {indeterminate && !checked && (
          <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#F4F4F5" strokeWidth="3" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </div>
      {label && <span style={{ fontSize: s.label, fontWeight: 400, color: disabled ? "#71717A" : "#E4E4E7" }}>{label}</span>}
    </label>
  );
}

// Multi-Select container: bg #18181B, borderRadius 8px, padding 1rem, gap 0.75rem
// Select All (parent): fontWeight 500, state indeterminate
// Options (children): marginLeft 1.5rem
```

---

## 9. Feedback

### 9.1 Notice — Card com ícone + título + descrição

**Specs**: bg `#18181B`, border `1px solid #27272A`, borderRadius `8px`, padding `1rem`. Flex row, gap 0.75rem. Ícone 20x20, flexShrink 0. Prop `muted` aplica `opacity: 0.4`.

```jsx
function Notice({ variant = "info", title, children, muted = false }) {
  const icons = { info: "ℹ", success: "✓", warning: "⚠", error: "✕" };
  return (
    <div style={{
      display: "flex", flexDirection: "row", gap: "0.75rem", alignItems: "flex-start",
      background: "#18181B", border: "1px solid #27272A", borderRadius: "8px",
      padding: "1rem", opacity: muted ? 0.4 : 1, transition: "opacity 0.2s",
    }}>
      <div style={{
        width: 20, height: 20, flexShrink: 0, marginTop: "0.125rem",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#F4F4F5",
      }}>
        {/* Ícone SVG 20x20 conforme variant */}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flexGrow: 1 }}>
        <span style={{ fontSize: "1rem", fontWeight: 600, color: "#F4F4F5" }}>{title}</span>
        <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "#E4E4E7", lineHeight: 1.4 }}>{children}</span>
      </div>
    </div>
  );
}
```

### 9.2 Skeleton Loader

**Atenção**: O nome do keyframe é `skel`, não `skeleton`. Sempre injetar o `@keyframes skel` via `<style>` ou CSS global.

```css
@keyframes skel {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

```jsx
{/* Linha (texto) */}
<div style={{
  width, height, borderRadius: "6px",
  background: "linear-gradient(90deg, #27272A 25%, #3F3F46 50%, #27272A 75%)",
  backgroundSize: "200% 100%",
  animation: "skel 1.5s infinite",
}} />

{/* Circular (avatar) — mesma animação, borderRadius "50%" */}
<div style={{
  width: 48, height: 48, borderRadius: "50%",
  background: "linear-gradient(90deg, #27272A 25%, #3F3F46 50%, #27272A 75%)",
  backgroundSize: "200% 100%",
  animation: "skel 1.5s infinite",
}} />
```

**Padrão composto (avatar + linhas)**:
```jsx
<div style={{ display: "flex", gap: "0.75rem" }}>
  {/* avatar skeleton */}
  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "...", animation: "skel 1.5s infinite" }} />
  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", justifyContent: "center" }}>
    <div style={{ width: "70%", height: 14, borderRadius: 6, background: "...", animation: "skel 1.5s infinite" }} />
    <div style={{ width: "50%", height: 12, borderRadius: 6, background: "...", animation: "skel 1.5s infinite" }} />
  </div>
</div>
```

### 9.3 Empty State

```jsx
// Ícone: 48px, stroke #71717A, strokeWidth 1.5
// Título: 0.95rem, fontWeight 600, #F4F4F5
// Descrição: 0.82rem, #A1A1AA, textAlign center
// Action: Button variant="outline", size="sm"
// Container: flex column center, padding 2rem 1rem, gap 0.75rem
```

### 9.4 Progress Card

**Specs**: Container bg `#18181B`, border `1px solid #27272A`, borderRadius `12px`, padding `1.75rem`. Icon Box: 52x52, borderRadius 12px, bg = cor da barra com 15% opacidade. Barra: height 12px, pill, track `#27272A`, fill = cor sólida. Values com `align-items: baseline`. Gap header→barra: 1.5rem. Gap barra→footer: 1rem.

```jsx
function ProgressCard({ title, value, subValue, progress, color, icon, footerText }) {
  return (
    <div style={{
      background: "#18181B", border: "1px solid #27272A", borderRadius: "12px",
      padding: "1.75rem", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Icon Box */}
        <div style={{
          width: 52, height: 52, borderRadius: "12px", flexShrink: 0,
          background: color + "26", // ~15% opacity hex
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>
        {/* Text Block */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0", flexGrow: 1 }}>
          <span style={{ fontSize: "1rem", fontWeight: 600, color: "#E4E4E7", lineHeight: 1, marginBottom: "-2px" }}>{title}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#FFFFFF" }}>{value}</span>
            {subValue && <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "#A1A1AA" }}>{subValue}</span>}
          </div>
        </div>
        {/* Percentage */}
        <span style={{
          fontSize: "0.875rem", fontWeight: 600, color: "#FFFFFF",
          alignSelf: "flex-start", marginTop: "0.125rem",
        }}>{progress}%</span>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: "100%", height: 12, background: "#27272A",
        borderRadius: "9999px", overflow: "hidden",
      }}>
        <div style={{
          width: `${progress}%`, height: "100%", borderRadius: "9999px",
          background: color,
          transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }} />
      </div>

      {/* Footer */}
      {footerText && (
        <span style={{
          fontSize: "0.75rem", fontWeight: 400, color: "#A1A1AA",
          marginTop: "1rem",
        }}>{footerText}</span>
      )}
    </div>
  );
}

// Variações de cor:
// Sales:  color="#3B82F6" (azul),   iconBg="rgba(59,130,246,0.15)"
// Users:  color="#10B981" (verde),   iconBg="rgba(16,185,129,0.15)"
// Goals:  color="#A855F7" (roxo),    iconBg="rgba(168,85,247,0.15)"
```
```

### 9.5 useAnimatedCounter — Hook de número animado

Anima um número de um valor anterior para o alvo com easing `easeInOut`. Ideal para métricas em dashboards e centros de ring charts.

```jsx
function useAnimatedCounter(target, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      // easeInOut quadrático
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplay(Math.round(from + (target - from) * ease));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
// Uso: const displayVal = useAnimatedCounter(centerValue, 700);
// → exibir {displayVal}% no centro do InsightRingChart
```

---

### 10.1 Modal

```jsx
{/* Backdrop */}
<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />

{/* Modal */}
<div style={{
  position: "relative", background: "#18181B", border: "1px solid #27272A",
  borderRadius: "12px", padding: "1.5rem", width: "420px", maxWidth: "90vw",
}}>
  {/* Header: título 1rem/600/#F4F4F5 + botão X */}
  {/* Content: 0.875rem/#E4E4E7, lineHeight 1.6 */}
  {/* Footer: flex row, gap 0.5rem, justify-content flex-end */}
</div>
```

### 10.2 Tooltip

```jsx
// bg #27272A, border 1px solid #3F3F46, borderRadius 8px, fontSize 0.8rem, color #E4E4E7
```

---

## 11. Estrutura de Página

```jsx
<div style={{
  minHeight: "100vh", background: "#121214", color: "#E4E4E7",
  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", padding: "2rem",
}}>
  <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
    <div style={{ marginBottom: "2rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#FFFFFF" }}>{title}</h1>
      <p style={{ margin: "0.5rem 0 0", fontSize: "1rem", color: "#A1A1AA" }}>{description}</p>
    </div>
    {/* Conteúdo */}
  </div>
</div>
```

---

## 14. Helper Components (Layout)

### 14.1 SectionHeader — Separador de seção

Dividor visual entre seções de uma página de preview ou dashboard. Texto em uppercase com accent color + linha inferior.

**Specs**: `fontSize 0.7rem`, `fontWeight 600`, `textTransform uppercase`, `letterSpacing 0.1em`, `color #60A5FA` (accent light). `borderBottom 1px solid #27272A`, `paddingBottom 0.5rem`. Margin: `marginTop 2.5rem`, `marginBottom 1.5rem`.

```jsx
function SectionHeader({ label }) {
  return (
    <div style={{
      fontSize: "0.7rem",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "#60A5FA",
      borderBottom: "1px solid #27272A",
      paddingBottom: "0.5rem",
      marginTop: "2.5rem",
      marginBottom: "1.5rem",
    }}>
      {label}
    </div>
  );
}
```

### 14.2 Card — Container genérico reutilizável

Wrapper padrão para agrupar conteúdo. Aceita `title`, `subtitle` opcionais e suporta `fullWidth` para grid span completo.

**Specs**: bg `#18181B`, border `1px solid #27272A`, borderRadius `8px`, padding `1rem`, flex column, gap `1rem`.

```jsx
function Card({ title, subtitle, children, fullWidth, style: extra }) {
  return (
    <div style={{
      background: "#18181B",
      border: "1px solid #27272A",
      borderRadius: "8px",
      padding: "1rem",
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
      gridColumn: fullWidth ? "1 / -1" : undefined,
      ...extra,
    }}>
      {title && (
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#F4F4F5" }}>{title}</h3>
          {subtitle && (
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#A1A1AA" }}>{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
// Props:
// title?    — título do card (1rem/600/#F4F4F5)
// subtitle? — descrição abaixo do título (0.875rem/#A1A1AA)
// fullWidth — span completo em grid (gridColumn: "1 / -1")
// style     — override de estilos extras via spread
```

### 14.3 SectionTitle — Título de sub-seção (dentro de card)

Diferente do `SectionHeader` (§14.1), o `SectionTitle` é um `<h3>` simples sem linha inferior, usado como título dentro do fluxo de conteúdo de um card ou seção.

**Specs**: `fontSize 1rem`, `fontWeight 600`, `color #F4F4F5`, `margin "0 0 1rem"`.

```jsx
function SectionTitle({ children }) {
  return (
    <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600, color: "#F4F4F5" }}>
      {children}
    </h3>
  );
}
// Quando usar SectionTitle vs SectionHeader:
// SectionHeader → separador entre seções da página (com linha, uppercase, accent color)
// SectionTitle  → título simples dentro de um card ou sub-seção
```

### 14.4 RingIcon — Ícone com caixa colorida para Rings Chart

Ícone usado nas linhas de legenda abaixo do `RingsChart` (§2.7). Caixa com bg = cor + `"20"` (hex de ~12% opacidade) e ícone SVG na cor sólida do item.

**Specs**: Caixa 36x36, borderRadius 8px, bg = `color + "20"`. SVG 18x18, stroke = cor sólida, strokeWidth 2. Três tipos de ícone:

```jsx
function RingIcon({ type, color }) {
  const boxStyle = {
    width: 36, height: 36, borderRadius: "8px",
    background: color + "20", // hex ~12% opacidade
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  };
  const svgProps = {
    width: 18, height: 18, viewBox: "0 0 24 24",
    fill: "none", stroke: color, strokeWidth: "2",
    strokeLinecap: "round", strokeLinejoin: "round",
  };

  if (type === "activity") return (
    <div style={boxStyle}>
      <svg {...svgProps}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
    </div>
  );
  if (type === "trending") return (
    <div style={boxStyle}>
      <svg {...svgProps}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    </div>
  );
  // default: bar chart icon
  return (
    <div style={boxStyle}>
      <svg {...svgProps}>
        <rect x="3" y="12" width="4" height="8" rx="1" />
        <rect x="10" y="8" width="4" height="12" rx="1" />
        <rect x="17" y="4" width="4" height="16" rx="1" />
      </svg>
    </div>
  );
}
// Tipos: "activity" | "trending" | qualquer outro (default = bars)
```

### 14.5 InsightIcon — SVG icons para InsightCard

Ícones usados nas métricas do `InsightCard` (§2.9). Renderiza SVG diretamente (sem caixa), o wrapper de caixa colorida é feito externamente.

**Specs**: `size=18` por padrão, stroke = cor do item, strokeWidth 2, strokeLinecap/strokeLinejoin round.

```jsx
function InsightIcon({ type, color, size = 18 }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: color, strokeWidth: "2",
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (type) {
    case "target": return (
      <svg {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
    );
    case "users": return (
      <svg {...p}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
    case "clock": return (
      <svg {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    );
    case "engagement": return (
      <svg {...p}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    );
    default: return null;
  }
}
// Tipos disponíveis: "target" | "users" | "clock" | "engagement"
// Wrapper externo com caixa: width 36, height 36, borderRadius 8px, bg = cor+"20"
```

---

- **CollapsibleCode** — blocos de código com syntax highlighting
- **GridBackground** — padrão sutil de grid no fundo
- **MagicCard** — card com glow no hover, glowVariant chromatic/monochrome
- **Link** — variants primary/default, suporte external
- **Sheet** — slide-out lateral, prop side start/end
- **ConfirmableSheet** — sheet com confirmação de unsaved changes
- **DropdownMenu** — trigger render function + items array
- **Popover** — composição trigger + content
- **Collapsible** — seções expansíveis
- **Checkbox** — ver §8.3 (validado)
- **PhoneInput** — input com seletor de país
- **ArrayInput** — gerenciamento de tags
- **MultiLanguageInput** — suporte EN/AR
- **RichTextEditor** — WYSIWYG multilíngue
- **DateRangePicker** — presets + custom range
- **Calendar** — mode single/range

---

## 15. CustomDropdown — Componente Oficial de Seleção

**REGRA**: NUNCA usar `<select>` nativo. Sempre usar `CustomDropdown` de `components/CustomDropdown.tsx`.

### 15.1 Interface

```tsx
interface DropdownOption {
    value: string;
    label: string;
    icon?: React.ReactNode;   // Ícone à esquerda do label
    dot?: string;             // Classe Tailwind para dot colorido (ex: 'bg-green-500')
}

interface CustomDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: DropdownOption[];
    placeholder?: string;     // Default: 'Selecionar'
    icon?: React.ReactNode;   // Ícone no trigger (à esquerda)
    isDarkMode?: boolean;     // Auto-detecta se não informado
    className?: string;
    disabled?: boolean;
}
```

### 15.2 Specs Visuais

**Trigger**:
- `rounded-xl`, `border`, `px-3 py-2.5`
- Texto: `text-xs font-bold`, truncated
- Chevron: `ChevronDown size={13}`, rotação 180deg quando aberto
- Focus state: `border-primary/40 bg-primary/5 ring-1 ring-primary/20`
- Disabled: `opacity-60 cursor-not-allowed`

**Menu (Portal)**:
- `position: fixed`, `z-[9999]` (renderiza fora do fluxo do DOM)
- `rounded-xl`, `border`, `shadow-2xl`, `py-1.5`
- `max-h-[240px]`, `overflow-y-auto custom-scrollbar`
- Largura: mesma do trigger (calculada via `getBoundingClientRect`)
- Posição: auto-calcula se abre acima ou abaixo baseado no espaço disponível

**Item selecionado**:
- `bg-primary/10 text-primary` + ícone `CheckCircle2 size={12}` à direita

**Item hover**:
- Dark: `hover:bg-dark hover:text-white`
- Light: `hover:bg-slate-50 hover:text-slate-900`

### 15.3 Comportamento

- **Click outside**: fecha automaticamente via `document.addEventListener('mousedown')`
- **Auto-posicionamento**: calcula `spaceBelow` vs `menuHeight`, abre acima se não há espaço abaixo
- **Dark mode**: detecta automaticamente via `document.documentElement.classList.contains('dark')`

### 15.4 Uso

```tsx
import { CustomDropdown } from '../components/CustomDropdown';

<CustomDropdown
    value={selectedValue}
    onChange={setSelectedValue}
    options={[
        { value: 'opt1', label: 'Opção 1', icon: <Users size={14} /> },
        { value: 'opt2', label: 'Opção 2', dot: 'bg-green-500' },
    ]}
    placeholder="Selecionar..."
    isDarkMode={isDarkMode}
/>
```

---

## 16. Custom Scrollbar

Definido no `index.html` via `<style>`. Aplica-se globalmente e via classe utilitária `custom-scrollbar`.

### 16.1 CSS — Webkit Scrollbar

```css
/* Global scrollbar */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: #cbd5e1;    /* slate-300 */
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;    /* slate-400 */
}

/* Dark mode */
.dark ::-webkit-scrollbar-thumb {
    background: #3f3f46;    /* zinc-700 */
}
```

### 16.2 Quando Aplicar `custom-scrollbar`

Usar em **todo** container interno com scroll:
- Corpo de modais: `overflow-y-auto custom-scrollbar flex-1`
- Listas dentro de dropdowns/menus: `max-h-[240px] overflow-y-auto custom-scrollbar`
- Listas dentro de cards: `max-h-48 overflow-y-auto custom-scrollbar`
- Colunas do Kanban: `overflow-y-auto custom-scrollbar`
- Agenda: `overflow-y-auto custom-scrollbar`

---

## 17. Fontes e Tailwind Config

### 17.1 Font Stack

- **Família principal**: `'Inter', sans-serif`
- **Import** (Google Fonts no `<head>` de `index.html`):
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ```
- **Pesos usados**: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **CSS body**: `font-family: 'Inter', sans-serif;`

### 17.2 Tailwind Config

```js
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: 'rgb(var(--primary))',   // Customizável via CSS vars
                    50:  'rgb(var(--primary-50))',
                    500: 'rgb(var(--primary-500))',
                    600: 'rgb(var(--primary-600))',
                    700: 'rgb(var(--primary-700))',
                },
                dark: {
                    DEFAULT: '#09090b',    // Fundo principal dark
                    surface: '#18181b',    // Cards/containers (Zinc 900)
                    border:  '#27272a',    // Bordas (Zinc 800)
                    text:    '#e4e4e7',    // Texto corpo (Zinc 200)
                },
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
};
```

### 17.3 Sistema de Cor Primária Dinâmica

A cor primária é customizável via CSS custom properties (`--primary`, `--primary-50/500/600/700`).

**Valores padrão** (em `<style>` do `index.html`):
```css
:root {
    --primary: 0 191 98;       /* Verde VINNX */
    --primary-50: 230 249 239;
    --primary-500: 0 191 98;
    --primary-600: 0 168 86;
    --primary-700: 0 143 73;
}
```

**Persistência**: Salvo em `localStorage('erp_primary_color')` como JSON. Restaurado antes do primeiro paint via script bloqueante no `<head>`.

---

## 18. Modais Enterprise — Padrões Avançados

Amplia a seção §10.1 com padrões extraídos das 30+ páginas do projeto.

### 18.1 Estrutura Padrão de Modal

```tsx
{/* Backdrop */}
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">

    {/* Container */}
    <div className={`${bgCard} border ${borderCol} rounded-xl shadow-2xl
        w-full max-w-4xl overflow-hidden
        animate-in zoom-in-95 duration-200
        flex flex-col h-[85vh]`}>

        {/* Header — fixo, não scrolla */}
        <div className={`p-4 border-b ${borderCol} flex justify-between items-center shrink-0
            ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
            <h3 className={`font-semibold text-lg ${textMain}`}>Título do Modal</h3>
            <button onClick={onClose} className={`${textSub} hover:${textMain}`}>
                <X size={20} />
            </button>
        </div>

        {/* Corpo — scrollável */}
        <form className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-4">
                {/* Conteúdo */}
            </div>
        </form>

        {/* Footer — fixo, não scrolla */}
        <div className={`p-4 border-t ${borderCol} flex gap-3 justify-end shrink-0
            ${isDarkMode ? 'bg-dark' : 'bg-slate-50'}`}>
            <button type="button" onClick={onClose}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold
                ${isDarkMode ? 'bg-zinc-800 text-slate-300 hover:bg-zinc-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                Cancelar
            </button>
            <button type="submit"
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary-600">
                Salvar
            </button>
        </div>
    </div>
</div>
```

### 18.2 Variações de Tamanho

| Tipo | max-width | Altura | Uso |
|------|-----------|--------|-----|
| Pequeno | `max-w-lg` (32rem) | `max-h-[90vh]` | Formulários simples, confirmações |
| Médio | `max-w-2xl` (42rem) | `max-h-[90vh]` | Formulários multi-campo |
| Grande | `max-w-3xl` (48rem) | `max-h-[90vh]` | Listas, tabelas, multi-seção |
| Extra Grande | `max-w-4xl` (56rem) | `h-[85vh]` | Editores com duas colunas |
| Full-width duo | Split layout | `h-[90vh]` | Agenda (60%/40%) |

### 18.3 Modal com Tabs de Seção

Usado em modais complexos (Clientes, Agenda). Tabs ficam abaixo do header, acima do corpo scrollável.

```tsx
{/* Tabs de seção dentro do modal */}
<div className={`flex border-b ${borderCol} px-3 shrink-0 overflow-x-auto`}>
    {tabs.map(tab => (
        <button key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors
                ${activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary'
                    : `${textSub} hover:${textMain}`
                }`}>
            {tab.label}
        </button>
    ))}
</div>
```

### 18.4 Modal com Duas Colunas (Split Layout)

Usado no modal da Agenda. Layout com divider vertical.

```tsx
<div className="flex flex-1 overflow-hidden">
    {/* Coluna esquerda — 60% */}
    <div className={`w-[60%] p-5 space-y-4 overflow-y-auto custom-scrollbar border-r ${borderCol}`}>
        {/* Formulário principal */}
    </div>
    {/* Coluna direita — 40% */}
    <div className="w-[40%] p-5 space-y-4 overflow-y-auto custom-scrollbar">
        {/* Preview, detalhes, ações */}
    </div>
</div>
```

### 18.5 Animação de Entrada

Todos os modais usam `animate-in zoom-in-95 duration-200` no container. Nunca usar slide ou fade no container do modal (o backdrop já faz transição implícita).

---

## 19. Layout Enterprise — Padrões de Página

### 19.1 Theme Helpers — Aliases Obrigatórios

**TODA página** deve declarar estes aliases no início do componente. Usados em 30+ páginas do projeto como padrão consolidado:

```tsx
// Theme Helpers — declarar no início de cada componente de página
const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
const shadowClass = isDarkMode ? '' : 'shadow-sm';
```

| Alias | Dark Mode | Light Mode | Uso |
|-------|-----------|------------|-----|
| `textMain` | `text-slate-50` | `text-slate-900` | Títulos, labels, texto principal |
| `textSub` | `text-slate-400` | `text-slate-600` | Descrições, placeholders, texto secundário |
| `bgCard` | `bg-dark-surface` (#18181b) | `bg-white` | Cards, modais, containers |
| `borderCol` | `border-dark-border` (#27272a) | `border-slate-300` | Bordas de cards, tabelas, inputs |
| `bgInput` | `bg-dark` (#09090b) | `bg-white` | Fundo de inputs, selects |
| `shadowClass` | `''` | `shadow-sm` | Sombra suave (só light mode) |

### 19.2 Estrutura de Página

```tsx
<div className="animate-in slide-in-from-bottom-4 duration-500 relative">

    {/* Header da página */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
        <div>
            <h1 className={`text-xl font-bold ${textMain}`}>Título da Página</h1>
            <p className={`text-sm ${textSub}`}>Descrição breve</p>
        </div>
        <div className="flex gap-2">
            {/* Botões de ação */}
        </div>
    </div>

    {/* KPI Cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {/* KpiCard components */}
    </div>

    {/* Tabs de navegação (SmoothTabs §6.2 ou tabs inline) */}

    {/* Conteúdo principal */}
</div>
```

### 19.3 Dashboard — Grid System

```tsx
{/* Grid principal do Dashboard */}
<div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
    {/* Coluna principal — 8 cols */}
    <div className="xl:col-span-8 space-y-5">
        {/* Cards largos */}
    </div>
    {/* Sidebar — 4 cols */}
    <div className="xl:col-span-4 space-y-5">
        {/* Cards estreitos */}
    </div>
</div>
```

### 19.4 Classe `dash-card` — Cards Premium do Dashboard

Definida em `index.css`. Adiciona hover elevado e textura premium. Usar em cards de KPI e seções do dashboard.

```css
.dash-card {
    border-radius: 12px;
    border: 1px solid rgba(0, 0, 0, 0.04);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: box-shadow 0.25s ease, border-color 0.25s ease;
}
.dash-card:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    border-color: rgba(0, 0, 0, 0.08);
}
.dark .dash-card {
    border-color: rgba(255, 255, 255, 0.06);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
.dark .dash-card:hover {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.12);
}
```

### 19.5 Hero Header — Card Premium com Textura

Definida em `index.css`. Header principal do dashboard com textura dot noise.

```css
.hero-header {
    position: relative;
    border-radius: 12px;
    padding: 24px 28px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
/* Textura de dots sutil via ::after */
.hero-header::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.04;
    background-image: radial-gradient(circle, rgba(255, 255, 255, 0.7) 1px, transparent 1px);
    background-size: 14px 14px;
    border-radius: 12px;
    z-index: 0;
}
.hero-header > * {
    position: relative;
    z-index: 1;
}
```

### 19.6 Animação de Entrada de Página

Toda página usa animação de entrada via Tailwind:
```tsx
<div className="animate-in slide-in-from-bottom-4 duration-500 relative">
```

---

## 20. Regras Enterprise Obrigatórias

### 20.1 Componentes

| Regra | Correto | Incorreto |
|-------|---------|-----------|
| Seleção | `<CustomDropdown>` | `<select>` nativo |
| Scroll interno | `overflow-y-auto custom-scrollbar` | Scrollbar padrão |
| Loading | `<Loader2 className="animate-spin" />` (lucide) | Spinner custom |
| Toast | `useToast()` hook | `alert()` / `console.log` |
| Confirmação destrutiva | `useConfirm()` hook | `window.confirm()` |

### 20.2 Modais

- **3+ campos**: dividir em seções com tabs (§18.3)
- **Conteúdo scrollável**: `flex flex-col h-[85vh]` + body `flex-1 overflow-y-auto custom-scrollbar` + footer `shrink-0`
- **Header/Footer**: sempre fixos (`shrink-0`)
- **Tabelas dentro de modais**: header `sticky top-0`
- **Animação de entrada**: `animate-in zoom-in-95 duration-200`

### 20.3 Formulários

- **Input style**: `w-full ${bgInput} border ${borderCol} rounded-lg p-2.5 text-sm ${textMain} focus:ring-1 focus:ring-primary outline-none`
- **Label style**: `block text-xs font-medium ${textSub} mb-1 flex items-center gap-1`
- **Grid de campos**: `grid grid-cols-1 md:grid-cols-2 gap-4`
- **Botão submit**: `bg-primary text-white hover:bg-primary-600 rounded-xl text-sm font-bold px-5 py-2.5`
- **Botão cancelar**: `${isDarkMode ? 'bg-zinc-800 text-slate-300' : 'bg-slate-100 text-slate-600'} rounded-xl text-sm font-bold px-4 py-2.5`

### 20.4 Dark/Light Mode

- **TODOS** os componentes devem suportar ambos os modos
- Usar Theme Helpers (§19.1) — nunca hardcode de cores
- Ternário `isDarkMode ? dark : light` em toda classe condicional
- Primary color via variável CSS (`text-primary`, `bg-primary`, `border-primary`) — nunca hardcode hex

### 20.5 Dados Filtrados por Unidade

- Dados com `unitId`: filtrar diretamente via `useFilteredData()` hook
- Dados sem `unitId` (ex: `subscriptions`): filtrar indiretamente pelo `clientId` dos clientes da unidade (`unitSubscriptions` pattern)
- KPIs e indicadores: SEMPRE usar dados filtrados, nunca dados globais do context
- Verificar `selectedUnitId !== 'all'` antes de aplicar filtros

---

## 13. Checklist — Antes de entregar qualquer tela

- [ ] Fundo da página é `#121214`
- [ ] Cards usam `#18181B` com border `1px solid #27272A` e radius `8px`
- [ ] Gráficos Area/Bar usam `linearGradient` (nunca fill sólido)
- [ ] Charts multi-série: cada série tem seu próprio `<linearGradient>` com ID único
- [ ] Tooltip dos charts: bg `#27272A`, border `#3F3F46` (zinc, não slate)
- [ ] `tooltipProps` reutilizado em todos os charts (inclui `cursor: { fill: "rgba(255,255,255,0.05)" }`)
- [ ] Rings Chart: degradê diagonal, sem glow, strokeWidth 13
- [ ] InsightRingChart: cor sólida (sem gradiente), strokeWidth 10, size 180, contador animado
- [ ] Tabelas: header `#27272A`, rows com borderBottom, status badges pill
- [ ] Paginação: itens circulares 40px, ativo = bg #FFFFFF / color #000000, hover #2A2A2A, transition 150ms
- [ ] Botões: pill (9999px), variants com cores corretas
- [ ] Icon Buttons: circulares, sizes 32/40/48px
- [ ] Badges: regra de cor (texto vibrante, border ~20%, bg ~10%)
- [ ] Status dots: 6px com cor saturada
- [ ] Inputs: bg `#18181B`, border `#27272A`, focus state com accent
- [ ] Search Input: pill, bg `#27272A`, badge atalho `#18181B`
- [ ] Notices: bg `#18181B`, border `#27272A`, estado muted com opacity 0.4
- [ ] Smooth Tabs: sliding indicator `#3F3F46`, transition cubic-bezier
- [ ] UserName: avatar 40px, dot 13px com cutout, badges pill `#3F3F46`
- [ ] Modais: backdrop rgba(0,0,0,0.6) + blur(4px), card radius 12px
- [ ] Checkboxes: box 16px, unchecked #27272A, checked #3F3F46 (monocromático), radius 4px
- [ ] ShineBadges: gradientes verticais, loop automático via CSS `::after` + `shineLoop`, delays escalonados
- [ ] Progress Cards: icon box 52px radius 12px com bg cor+15%, barra 12px pill, values baseline-aligned, padding 1.75rem
- [ ] InsightCard: fade de 200ms na troca de aba (opacity 0→1 via setTimeout)
- [ ] SectionHeader: texto 0.7rem uppercase accent-light, borderBottom, marginTop 2.5rem
- [ ] Card wrapper: bg #18181B, border #27272A, radius 8px, padding 1rem, gap 1rem
- [ ] Textos seguem hierarquia: #FFFFFF > #F4F4F5 > #E4E4E7 > #A1A1AA > #71717A
- [ ] Empty states e loading states implementados
- [ ] Dropdowns usam `CustomDropdown` (nunca `<select>` nativo)
- [ ] Scrollbars internos usam `custom-scrollbar` (width 6px, thumb zinc-700 em dark)
- [ ] Modais multi-seção com tabs, header/footer fixos (`shrink-0`) e corpo scrollável (`flex-1`)
- [ ] Font Inter carregada via Google Fonts (pesos 300-700)
- [ ] Primary color via CSS vars (`--primary`) para customização dinâmica
- [ ] `dash-card` class usada em cards do dashboard (hover elevado, border sutil)
- [ ] Theme Helpers (`bgCard`, `textMain`, `textSub`, `borderCol`, `bgInput`, `shadowClass`) declarados
- [ ] Animação de entrada: `animate-in slide-in-from-bottom-4 duration-500` em páginas
- [ ] Animação de entrada: `animate-in zoom-in-95 duration-200` em modais
- [ ] Dados filtrados por unidade selecionada (especialmente subscriptions via `unitSubscriptions`)
