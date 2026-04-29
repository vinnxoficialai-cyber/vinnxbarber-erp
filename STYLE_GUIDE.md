# VinnxBarber ERP — Style Guide (Padrão Negrita/WooShoes)

> Referência obrigatória para TODAS as telas.  
> Extraído diretamente da Negrita WooShoes: `ManualOrderModal.tsx`, `Orders.tsx`, `Dialog.tsx`, `Input.tsx`, `Button.tsx`.

---

## 1. Tokens Semânticos (NUNCA usar isDarkMode ternários)

### ❌ PROIBIDO
```tsx
isDarkMode ? 'bg-dark-surface' : 'bg-white'
isDarkMode ? 'text-slate-50' : 'text-slate-900'
isDarkMode ? 'border-dark-border' : 'border-slate-200'
```

### ✅ OBRIGATÓRIO — Tokens reais da Negrita
| Uso | Classe Negrita |
|-----|--------|
| Fundo de card/modal | `bg-card` |
| Fundo de seção destacada | `bg-muted/20` (ex: customer card, item card) |
| Fundo de sumário | `bg-muted/30` (ex: totals) |
| Fundo de header de tabela | `bg-muted/30` |
| Fundo de input | `bg-background` (via `<Input>`) |
| Texto principal | `text-foreground` (implícito) |
| Texto secundário | `text-muted-foreground` |
| Borda padrão | `border-border` |
| Borda de input | `border-input` |
| Borda sutil | `border-border/50` |
| Hover em lista/row | `hover:bg-muted/50` ou `hover:bg-muted/30` |
| Hover ativo (mobile) | `active:bg-muted/40` |
| Foco | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |

### Variáveis isDarkMode a eliminar
```tsx
// REMOVER TODAS:
const textMain = isDarkMode ? '...' : '...';
const textSub = isDarkMode ? '...' : '...';
const bgCard = isDarkMode ? '...' : '...';
const borderCol = isDarkMode ? '...' : '...';
const bgInput = isDarkMode ? '...' : '...';
```

---

## 2. Tipografia (extraída da Negrita)

| Elemento | Classe Negrita | Exemplo |
|----------|--------|---------|
| **H1 (página)** | `text-2xl font-bold` | `<h1 className="text-2xl font-bold">Pedidos</h1>` |
| **Subtítulo da página** | `text-sm text-muted-foreground` | `<p className="text-sm text-muted-foreground">42 pedidos</p>` |
| **H3 (seção header)** | `text-sm font-semibold` | `<h3 className="text-sm font-semibold">Cliente</h3>` |
| **Label de formulário** | `text-xs text-muted-foreground mb-1 block` | `<label className="text-xs text-muted-foreground mb-1 block">Nome *</label>` |
| **Label minúsculo** | `text-[10px] text-muted-foreground mb-0.5 block` | Variante, Qtd, Preço |
| **Label uppercase** | `text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block` | Produto (no item card) |
| **Corpo** | `text-sm` (implícito) | — |
| **Valor monetário grande** | `text-2xl font-bold text-foreground` | KPI cards |
| **Valor total** | `text-lg font-bold text-primary` | Summary total |
| **Badge texto** | `text-[10px]` ou `text-[9px]` | Status badges |
| **Monospace** | `font-mono text-xs` | #123, CPF |

---

## 3. Cores de Status (padrão Negrita translúcido)

### Fórmula: `bg-{cor}-500/15 text-{cor}-400 border-{cor}-500/25`

| Status | Classe |
|--------|--------|
| Pendente | `bg-yellow-500/15 text-yellow-400 border-yellow-500/25` |
| Confirmado | `bg-blue-500/15 text-blue-400 border-blue-500/25` |
| Em atendimento | `bg-indigo-500/15 text-indigo-400 border-indigo-500/25` |
| Concluído/Pago | `bg-emerald-500/15 text-emerald-400 border-emerald-500/25` |
| Cancelado/Erro | `bg-red-500/15 text-red-400 border-red-500/25` |
| Muted/Default | `bg-muted text-muted-foreground border-border` |
| Assinante | `bg-violet-500/15 text-violet-400 border-violet-500/25` |

---

## 4. Ícones (padrão Negrita)

### Tamanhos extraídos
| Contexto | Tamanho | Exemplo Negrita |
|----------|---------|-----------------|
| H1 da página | `size={24}` | — (implícito) |
| Section header | `w-4 h-4` | `<User className="w-4 h-4 text-orange-500" />` |
| Modal header title | `w-5 h-5` | `<ShoppingBag className="w-5 h-5 text-orange-500" />` |
| Label de formulário | `w-3 h-3` a `w-3.5 h-3.5` | Search icon no input |
| Badge/chip | `w-2.5 h-2.5` a `w-3 h-3` | Phone, Mail inline |
| Botão +/- (qty) | `w-3 h-3` | Plus/Minus |
| Botão ação tabela | `h-4 w-4` | WhatsApp, More |
| Close modal (Radix) | `h-4 w-4` | X no DialogContent |
| Initials avatar | — | Container `w-8 h-8` ou `w-10 h-10` |

### Cor de ícone de seção
Na Negrita usa `text-orange-500`. No VinnxBarber usar **`text-primary`** (que resolve para a cor do tema).

### Avatar de iniciais
```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground shrink-0">
  {getInitials(name)}
</div>
```

Versão selecionada (com cor):
```tsx
<div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
  <span className="text-[10px] font-bold text-primary">{initials}</span>
</div>
```

---

## 5. Botões (padrão Negrita EXATO)

### CTA Principal
```tsx
// Negrita usa rounded-full + cor accent
<Button className="rounded-full bg-primary hover:bg-primary/90 text-white gap-1.5">
  <Plus className="w-4 h-4" /> Novo
</Button>
```
> Na Negrita: `bg-orange-500 hover:bg-orange-600`. No Vinnx: substituir por `bg-primary`.

### Botão Outline / Secundário
```tsx
<Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
  <UserPlus className="w-3 h-3" /> Novo Cliente
</Button>
```

### Botão Ghost (ações de tabela)
```tsx
<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
  <MoreHorizontal className="h-4 w-4" />
</Button>
```

### Footer do modal (Negrita real)
```tsx
<div className="flex-shrink-0 border-t p-4 flex justify-end gap-3 bg-background">
  <Button variant="outline" className="rounded-full">Cancelar</Button>
  <Button className="rounded-full bg-primary hover:bg-primary/90 text-white gap-1.5">
    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
    Confirmar
  </Button>
</div>
```

### Regras
- **`rounded-full`** em CTA e footer de modal
- **`rounded-md`** (default) em botões de toolbar
- Nunca `shadow-lg shadow-primary/20` (sem neon/glow)
- Disabled: `disabled:pointer-events-none disabled:opacity-50` (do `buttonVariants`)
- Tamanhos: `h-7` (tiny), `h-9` (sm), `h-10` (default)

---

## 6. Inputs / Formulários (padrão Negrita EXATO)

### Input — componente base Shadcn
```tsx
// Classes do <Input> Negrita:
"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 
 text-base ring-offset-background placeholder:text-muted-foreground 
 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 
 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 
 md:text-sm"
```

### Tamanhos comuns de input
| Contexto | className | 
|----------|-----------|
| Default (label + input) | `h-10` (base) |
| Compacto (dentro de cards) | `h-9` |
| Pequeno (busca em picker) | `h-8` |
| Com ícone left | `pl-9` (Search icon 3+3+icon = 9) |

### Select / Dropdown
```tsx
<Select value={v} onValueChange={set}>
  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
  <SelectContent>...</SelectContent>
</Select>
```

### Label padrão
```tsx
<label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
```

### Search com ícone
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
  <Input placeholder="Buscar..." className="pl-9 h-10" />
</div>
```

---

## 7. Modais (padrão Negrita EXATO — ManualOrderModal)

### Anatomia real da Negrita
```tsx
<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="max-w-3xl h-[85vh] p-0 flex flex-col overflow-hidden">
    
    {/* HEADER — fixo */}
    <DialogHeader className="px-6 pt-5 pb-2 flex-shrink-0">
      <DialogTitle className="flex items-center gap-2 text-lg">
        <Icon className="w-5 h-5 text-primary" />
        Título do Modal
      </DialogTitle>
      <DialogDescription>
        Subtítulo / descrição
      </DialogDescription>
    </DialogHeader>

    {/* BODY — scrollável */}
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
      {/* Seções separadas por <Separator /> */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Seção</h3>
        </div>
        {/* conteúdo */}
      </div>
      <Separator />
      {/* próxima seção... */}
    </div>

    {/* FOOTER — fixo */}
    <div className="flex-shrink-0 border-t p-4 flex justify-end gap-3 bg-background">
      <Button variant="outline" className="rounded-full">Cancelar</Button>
      <Button className="rounded-full">Confirmar</Button>
    </div>

  </DialogContent>
</Dialog>
```

### Tamanhos
| Size | max-w | Uso |
|------|-------|-----|
| sm | `max-w-sm` ou `max-w-md` | Confirmação (como "Remover item") |
| md | `max-w-xl` | Configurações |
| lg | `max-w-3xl` | Formulários complexos (ManualOrderModal, Agenda modal) |

### Header — sem container circular de ícone
Na Negrita o header é simples:
```tsx
<DialogTitle className="flex items-center gap-2 text-lg">
  <ShoppingBag className="w-5 h-5 text-orange-500" />
  Lançar Pedido Manual
</DialogTitle>
```
> Sem `<div>` circular ao redor do ícone. O ícone é inline direto.

### Section headers dentro do body
```tsx
<div className="flex items-center gap-2 mb-3">
  <User className="w-4 h-4 text-primary" />
  <h3 className="text-sm font-semibold">Cliente</h3>
</div>
```

Com botão de ação:
```tsx
<div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-2">
    <Package className="w-4 h-4 text-primary" />
    <h3 className="text-sm font-semibold">Itens do Pedido</h3>
  </div>
  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
    <Plus className="w-3 h-3" /> Item
  </Button>
</div>
```

### Seções internas (cards de informação)
```tsx
<div className="bg-muted/20 border border-border rounded-lg p-3">
  {/* conteúdo */}
</div>
```

### Separadores entre seções
```tsx
<Separator />
```

---

## 8. KPI Cards (padrão Negrita EXATO — KpiCard)

```tsx
<Card className={alert ? "border-yellow-500/50 shadow-yellow-500/10 shadow-md" : ""}>
  <CardContent className="pt-5 pb-4 px-5">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-{cor}-500/15">
        <Icon className="h-5 w-5 text-{cor}-400" />
      </div>
    </div>
    {delta !== undefined && (
      <div className="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-400">
        <TrendingUp className="h-3 w-3" /> +{delta}%
      </div>
    )}
  </CardContent>
</Card>
```

---

## 9. Summary / Totais (padrão Negrita)

```tsx
<div className="bg-muted/30 rounded-xl border border-border p-4">
  <div className="space-y-1.5 text-sm">
    <div className="flex justify-between">
      <span className="text-muted-foreground">Subtotal (3 itens)</span>
      <span className="font-medium">{formatBRL(subtotal)}</span>
    </div>
    {discount > 0 && (
      <div className="flex justify-between text-green-500">
        <span>Desconto</span>
        <span>-{formatBRL(discount)}</span>
      </div>
    )}
    <Separator className="my-2" />
    <div className="flex justify-between text-lg font-bold">
      <span>Total</span>
      <span className="text-primary">{formatBRL(total)}</span>
    </div>
  </div>
</div>
```

---

## 10. Toggle / Switch (padrão Negrita)

```tsx
// CSS-only (VinnxBarber):
<div className="relative shrink-0">
  <input type="checkbox" className="sr-only peer" />
  <div className="w-9 h-5 rounded-full transition-colors peer-checked:bg-primary bg-muted" />
  <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow" />
</div>

// Shadcn (Negrita):
<Switch checked={value} onCheckedChange={handler} />
```
> Nunca `bg-slate-300 dark:bg-dark-border` → usar `bg-muted`.

---

## 11. Type Switcher / Tabs (segmented control)

Na Negrita (ManualOrderModal, person type pf/pj):
```tsx
<div className="flex gap-2">
  <button
    className={`flex-1 text-center text-xs font-medium py-2 rounded-lg border transition-colors ${
      active
        ? "bg-primary/10 border-primary/40 text-primary"
        : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
    }`}
  >
    Pessoa Física
  </button>
</div>
```

---

## 12. Tabela (padrão Negrita desktop + mobile)

### Desktop — `hidden sm:block`
```tsx
<div className="hidden sm:block bg-card rounded-xl border overflow-hidden">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b text-left bg-muted/30">
        <th className="p-3 font-medium">Coluna</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b last:border-0 transition-colors cursor-pointer hover:bg-muted/30">
        <td className="p-3">valor</td>
      </tr>
    </tbody>
  </table>
  {/* Summary footer */}
  <div className="border-t bg-muted/20 px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
    <span>Receita: <strong className="text-foreground">{valor}</strong></span>
  </div>
</div>
```

### Mobile — `sm:hidden`
```tsx
<div className="sm:hidden space-y-3">
  <div className="rounded-xl border bg-card p-4 cursor-pointer transition-colors border-border active:bg-muted/40">
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{info}</p>
        </div>
      </div>
      {/* Actions menu */}
    </div>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-[10px] bg-yellow-500/15 text-yellow-400 border-yellow-500/25">
          Pendente
        </Badge>
      </div>
      <span className="text-sm font-bold">{valor}</span>
    </div>
  </div>
</div>
```

---

## 13. 📱 Mobile Excellence Rules

### Breakpoints
- `sm:` = 640px+ (desktop table, filtros side-by-side)
- Tudo abaixo de `sm` = layout mobile

### Grid responsivo
```tsx
// Formulário
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

// Configurações
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
```

### Touch targets
- Botões: mínimo `h-9` (36px), ideal `h-10` (40px)
- Botões ícone qty: `w-7 h-7` mínimo, `w-8 h-8` ideal
- Rows clicáveis: `p-4` padding

### Feedback tátil
```tsx
// Mobile card
className="active:bg-muted/40 transition-colors"

// Touch-friendly close
<button className="p-2 rounded-lg hover:bg-muted transition-colors">
```

### Filtros mobile
- Desktop: `hidden sm:flex` — filtros inline
- Mobile: `sm:hidden` — botão filter que abre `<Sheet side="bottom" className="rounded-t-2xl">`

### Modais mobile
O `<DialogContent>` Negrita já resolve:
- `w-full` + `max-w-*` = responsivo
- `h-[85vh]` = ocupa quase toda tela no mobile
- `p-0 flex flex-col overflow-hidden` = body rola, header/footer fixos
- DialogContent base: `sm:rounded-lg` = no mobile ocupa tela inteira (sem border-radius)

### Text truncation
```tsx
<p className="text-sm font-medium truncate max-w-[160px]">{longText}</p>
```

### Espaçamento adaptativo
```tsx
// Body do modal
className="px-6 py-4 space-y-5"  // 24px lateral

// Seção no mobile precisa respirar:
className="p-3"  // Card interno
className="p-4"  // Card principal mobile
```

---

## 14. Alertas / Banners (padrão Negrita)

```tsx
// Warning (com badge no Negrita)
<Badge className="bg-red-500/15 text-red-400 border-red-500/25 text-[9px] animate-pulse">
  Cancelamento solicitado
</Badge>

// Urgência em table row
className={`border-b transition-colors cursor-pointer ${
  urg === "critical" ? "bg-red-500/5 hover:bg-red-500/10" 
  : urg === "warning" ? "bg-yellow-500/5 hover:bg-yellow-500/10" 
  : "hover:bg-muted/30"
}`}

// Alert card
<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs">
  <AlertCircle size={14} />
  Mensagem
</div>
```

---

## 15. Page Layout

```
┌──────────────────────────────────────────────┐
│ H1 + Subtítulo                 [Botões CTA]  │  ← flex justify-between
├──────────────────────────────────────────────┤
│ [KPI Cards grid]                             │  ← grid-cols-1 sm:grid-cols-2 lg:grid-cols-5
├──────────────────────────────────────────────┤
│ [Filtros desktop: hidden sm:flex]            │
│ [Filtros mobile: sm:hidden]                  │
├──────────────────────────────────────────────┤
│ [Tabela desktop: hidden sm:block]            │
│ [Cards mobile: sm:hidden]                    │
├──────────────────────────────────────────────┤
│ [Pagination]                                 │
└──────────────────────────────────────────────┘
```

### Header da página (Negrita real)
```tsx
<div className="flex items-center justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold">Pedidos</h1>
    <p className="text-sm text-muted-foreground">{count} pedidos encontrados</p>
  </div>
  <div className="flex items-center gap-2">
    <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
      <Settings2 className="h-4 w-4" /> Config
    </Button>
    <Button size="sm" className="gap-2 rounded-full bg-primary hover:bg-primary/90 text-white">
      <Plus className="h-4 w-4" /> Novo
    </Button>
  </div>
</div>
```

---

## 16. Chips / Tags

```tsx
// Status badge (Negrita)
<Badge variant="outline" className="text-[10px] bg-yellow-500/15 text-yellow-400 border-yellow-500/25">
  Pendente
</Badge>

// Service chip (removível)
<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-primary/10 border-primary/20 text-primary">
  <Scissors size={10} />
  <span>Corte</span>
  <button className="ml-0.5 opacity-50 hover:opacity-100"><X size={12} /></button>
</div>
```

---

## 17. Scrollbar

- Áreas scrolláveis: classe global `custom-scrollbar` (4px, cor semântica)
- Para ocultar: `scrollbar-hide`

---

## 18. Animações

- Modal entrance: Radix built-in (`animate-in zoom-in-95`)
- Page entrance: `animate-in fade-in duration-300`
- Hover: `transition-colors` (nunca `transition-all` em listas)
- Loading: `<Loader2 className="w-3.5 h-3.5 animate-spin" />`
- Alert pulse: `animate-pulse`

---

## ✅ Checklist de Revisão por Tela

- [ ] Zero ocorrências de `isDarkMode ?` no JSX
- [ ] Labels: `text-xs text-muted-foreground mb-1 block`
- [ ] Botões CTA: `rounded-full`
- [ ] Badges: padrão translúcido `/15` + `/25`
- [ ] Ícones seguem tamanhos da tabela
- [ ] Modal segue anatomia `p-0 flex flex-col overflow-hidden`
- [ ] Modal header: `px-6 pt-5 pb-2 flex-shrink-0`
- [ ] Modal body: `flex-1 overflow-y-auto px-6 py-4 space-y-5`
- [ ] Modal footer: `flex-shrink-0 border-t p-4 flex justify-end gap-3 bg-background`
- [ ] Inputs: `h-9` ou `h-10` + `border-input bg-background`
- [ ] Foco: `focus-visible:ring-2 focus-visible:ring-ring`
- [ ] Toggles: `bg-muted` (off) e `bg-primary` (on)
- [ ] Sem `shadow-lg shadow-primary/20` (sem neon)
- [ ] Scrollbar: `custom-scrollbar`
- [ ] Mobile: `grid-cols-1 sm:grid-cols-2` em formulários
- [ ] Mobile: touch targets >= `h-9` (36px)
- [ ] Mobile: `active:bg-muted/40` em cards clicáveis
- [ ] Mobile: filtros em `<Sheet>` bottom
