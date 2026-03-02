---
description: Regras importantes sobre acesso ao Supabase e uso do browser
---

# Regras de Acesso — VINNX ERP

## 🚫 NUNCA ABRIR O BROWSER
- **NUNCA** use o `browser_subagent` para nada
- O usuário proibiu explicitamente o uso do browser
- Use sempre o terminal (PowerShell/curl) para qualquer operação

## 🔑 SUPABASE — ACESSO DIRETO VIA API
- As chaves de API estão no arquivo `.env` do projeto
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão disponíveis
- Para executar SQL, use o endpoint REST do Supabase:
  ```powershell
  # Ler as variáveis do .env
  $env = Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { @{$matches[1]=$matches[2].Trim('"')} } }
  
  # Usar a Management API ou rpc para SQL
  Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/..." -Headers @{...}
  ```
- Para operações de tabela, use o Supabase client JS diretamente em scripts Node.js
- **NUNCA** navegue ao painel web do Supabase

## 📌 Maneira correta de executar SQL no Supabase:
1. Criar script Node.js temporário que usa `@supabase/supabase-js`
2. Executar via `node /tmp/script.js`
3. Ou usar `curl` / `Invoke-RestMethod` com a service_role key
