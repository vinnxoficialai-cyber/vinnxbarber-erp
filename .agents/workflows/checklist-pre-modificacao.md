---
description: Checklist obrigatório antes de qualquer modificação no projeto VINNX ERP
---

# Checklist Pré-Modificação — VINNX ERP

> **REGRA DE OURO:** Nunca assuma, sempre verifique. Leia antes de escrever.

---

## 1. ANTES DE TOCAR EM QUALQUER ARQUIVO

### 🔍 Auditoria Obrigatória
1. **Leia os arquivos de referência** — Abra e estude pelo menos 2 páginas existentes que já estejam no padrão correto antes de criar/modificar qualquer componente. Referências principais:
   - `pages/Clients.tsx` — Padrão-ouro de modal, file upload, cards e tabela
   - `pages/Contracts.tsx` — Padrão de formulário, status badges, mobile cards
   - `pages/Agenda.tsx` — Padrão de layout complexo com múltiplas interações

2. **Verifique tipos em `types.ts`** — Confirme os nomes EXATOS das propriedades da interface antes de usar

3. **Verifique `lib/dataService.ts`** — Confirme se a função CRUD já existe. Se existe, leia a implementação antes de modificar

4. **Verifique `lib/storage.ts`** — Use o sistema de upload existente (`uploadBase64Image`, `isBase64`)

5. **Verifique migrations em `prisma/`** — Confirme os nomes EXATOS das colunas no banco (camelCase usa aspas duplas)

---

## 2. REGRAS DE DESIGN (INEGOCIÁVEIS)

### ❌ NUNCA USAR
- Emojis no código (🔥 ❌ ✅ 💈 ✂️) — use **lucide-react icons** em TUDO
- Input de URL para imagens — use **file upload** com `useRef` + `readAsDataURL` + `uploadBase64Image`
- Cores e estilos ad-hoc — siga os **tokens do tema** exatos das referências
- Modais com altura fixa pequena — sempre `max-h-[90vh]`
- Scrollbar padrão do browser — sempre `custom-scrollbar`

### ✅ SEMPRE SEGUIR
| Elemento | Padrão Correto |
|----------|----------------|
| **Modal container (simples)** | `max-h-[90vh]`, `flex flex-col`, `custom-scrollbar`, `zoom-in-95 duration-200` |
| **Modal container (com abas/steps)** | `h-[85vh]`, `w-full max-w-2xl`, `flex flex-col`, `zoom-in-95 duration-200` — altura e largura FIXAS |
| **Modal footer (botões)** | FORA do `<form>`, `p-5 border-t mt-auto shrink-0 flex gap-3` — SEMPRE pinado no rodapé |
| **Modal header** | `p-4 border-b`, título `font-semibold text-lg`, botão X com `textSub` |
| **Labels** | `text-xs font-medium textSub mb-1 flex items-center gap-1` + `<Icon size={12}/>` |
| **Inputs** | `bgInput border borderCol rounded-lg p-2.5 text-sm textMain focus:ring-1 focus:ring-primary outline-none` |
| **Submit button** | `w-full py-3 font-bold rounded-lg shadow-lg shadow-primary/20` |
| **Image upload** | Bloco com preview (w-20 h-20) + botões "Carregar Imagem" e "Remover" (mesmo de Clients) |
| **Seção read-only** | `p-5 rounded-xl border` + título `text-sm font-bold text-primary` + valores `cursor-not-allowed` |
| **Card buttons (mobile)** | Editar (flex-1, border, uppercase) + Excluir (px-4, red, border) — padrão Contracts |
| **Table actions (desktop)** | `text-primary hover:underline` / `text-red-500 hover:underline` — padrão Contracts |
| **Empty state** | Ícone grande (size={48}) + `opacity-20` + mensagem centralizada |
| **Stats cards** | `bgCard border rounded-xl p-4 flex items-center gap-3` + ícone em `p-2 rounded-lg` |
| **Category filters** | Pills `rounded-full text-xs font-medium border` com `<Icon size={12}/>` antes do texto |
| **Status badges** | `px-2.5 py-0.5 rounded-full text-xs font-bold uppercase` com cores por status |

### 🎨 Tokens do Tema (copie exatamente)
```tsx
const textMain = isDarkMode ? 'text-slate-50' : 'text-slate-900';
const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';
const bgCard = isDarkMode ? 'bg-dark-surface' : 'bg-white';
const borderCol = isDarkMode ? 'border-dark-border' : 'border-slate-300';
const bgInput = isDarkMode ? 'bg-dark' : 'bg-white';
const shadowClass = isDarkMode ? '' : 'shadow-sm';
```

---

## 3. BANCO DE DADOS (SQL/Supabase)

- Consulte `prisma/` para ver os nomes EXATOS das colunas e tipos
- Campos `camelCase` usam aspas duplas: `"userId"`, `"employeeId"`
- `auth.uid()` retorna UUID — faça cast `::text` se a coluna for TEXT
- RLS: `auth.role() = 'authenticated'` para usuários logados
- Políticas existentes: sempre `DROP` antes de `CREATE`
- Funções sensíveis: `SECURITY DEFINER`

---

## 4. PROCESSO DE EXECUÇÃO

```
1. AUDITAR  → Ler arquivos de referência e entender padrões existentes
2. VERIFICAR → Checar types.ts, dataService.ts, storage.ts, migrations
3. PLANEJAR → Documentar exatamente o que vai mudar e por quê
4. EXECUTAR → Implementar seguindo os padrões auditados
5. VALIDAR  → Verificar compilação (HMR sem erros)
```

### ⚠️ Se encontrar algo que não sabe
- **NÃO ASSUMA** — leia o código fonte
- **NÃO INVENTE** — use padrões que já existem no projeto
- **NÃO SIMPLIFIQUE** — mantenha o mesmo nível de detalhe das referências

# checklist-pre-modificacao

1) Identificar arquivos afetados e ABRIR todos antes de editar
2) Verificar types (types.ts / types/index.ts)
3) Verificar dataService.ts e hooks existentes
4) Se houver banco:
   - Ler prisma/migrations e confirmar tipos/colunas
   - Confirmar tabela/coluna no Supabase antes de policy
5) Implementar em pequenos commits/blocos
6) Rodar:
   - npx tsc --noEmit
   - (lint/test se existir)
7) Descrever como validar manualmente no app