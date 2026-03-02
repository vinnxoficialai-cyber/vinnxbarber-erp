---
description: Checklist obrigatório antes de qualquer modificação no projeto VINNX ERP
---

# Checklist Pré-Modificação

ANTES DE EXECUTAR QUALQUER AÇÃO, SIGA ESTE CHECKLIST:

## 📊 BANCO DE DADOS (SQL/Supabase)
- [ ] Consulte `prisma/migrations/` para ver os nomes EXATOS das colunas e tipos
- [ ] Verifique se o campo é TEXT, UUID, ou outro tipo antes de comparações
- [ ] `auth.uid()` retorna UUID - faça cast para TEXT se necessário (`::text`)
- [ ] Nomes de colunas: use aspas duplas para camelCase (`"userId"`, `"employeeId"`)
- [ ] Verifique se a tabela existe antes de criar policies

## 🔧 CÓDIGO FRONTEND (React/TypeScript)
- [ ] Verifique os types em `types/index.ts` antes de usar propriedades
- [ ] Confira se `dataService.ts` já tem a função que precisa
- [ ] Verifique hooks existentes antes de criar novos
- [ ] Confirme imports e exports

## 🔐 SUPABASE ESPECÍFICO
- [ ] RLS: `auth.role() = 'authenticated'` para usuários logados
- [ ] RLS: `auth.uid()::text` para comparar com colunas TEXT
- [ ] Políticas existentes: sempre DROP antes de CREATE
- [ ] Funções SECURITY DEFINER para acessar dados protegidos

## ⚠️ ANTES DE CADA MODIFICAÇÃO
1. LEIA o arquivo/schema que será modificado
2. ENTENDA a estrutura atual
3. VALIDE os nomes de colunas/campos
4. TESTE mentalmente se a lógica faz sentido
5. CONSIDERE casos de borda (tabela vazia, null values)

❌ NÃO ASSUMA - SEMPRE VERIFIQUE!
