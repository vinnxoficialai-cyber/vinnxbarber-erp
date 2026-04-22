-- ============================================================
-- VINNX Barber ERP — Migration RPCs
-- Execute no Supabase SQL Editor
-- Pré-requisito para o script de importação e o frontend
-- ============================================================
-- IDEMPOTENTE: pode ser executado múltiplas vezes sem efeitos colaterais
-- ============================================================

-- 1. Índice no phone para performance da busca por telefone
--    (A RPC lookup faz WHERE phone = p_phone — sem índice, faz full table scan em 740+ registros)
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);

-- 2. RPC: Busca cliente legado por telefone
--    Quem chama: PublicSite (anon — cliente NÃO logado)
--    Retorna: { found: true, firstName: "João", phone: "37998448998" }
--         ou: { found: false }
--    Segurança: SECURITY DEFINER para bypass RLS (anon não pode SELECT clients)
--              Retorna APENAS firstName (sem dados sensíveis)
CREATE OR REPLACE FUNCTION public.lookup_legacy_client(p_phone TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'found', true,
    'firstName', split_part(name, ' ', 1),
    'phone', phone
  ) INTO result
  FROM public.clients
  WHERE phone = p_phone
    AND "authUserId" IS NULL
  LIMIT 1;

  RETURN COALESCE(result, json_build_object('found', false));
END;
$$;

-- Acesso: anon (cliente antes de logar) + authenticated (para segurança)
GRANT EXECUTE ON FUNCTION public.lookup_legacy_client(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_legacy_client(TEXT) TO authenticated;

-- 3. RPC: Vincular auth user ao cliente legado
--    Quem chama: PublicSite (authenticated — APÓS signUp)
--    Fluxo: signUp() → claim_legacy_client() → setAuthDirect()
--    Parâmetros:
--      p_phone: telefone normalizado (11 dígitos, ex: "37998448998")
--      p_email: email real do cliente (ex: "joao@gmail.com")
--      p_birthday: data de nascimento no formato YYYY-MM-DD (ex: "1990-05-15") ou NULL
--      p_gender: gênero (ex: "Masculino", "Feminino") ou NULL
--    Segurança: 
--      - SECURITY DEFINER para bypass RLS
--      - Valida por TELEFONE (não por ID) para impedir impersonação
--      - auth.uid() garante que só o usuário autenticado pode vincular
--      - WHERE authUserId IS NULL impede re-claim
--      - Subquery com LIMIT 1 protege contra telefones duplicados
CREATE OR REPLACE FUNCTION public.claim_legacy_client(
  p_phone TEXT,
  p_email TEXT,
  p_birthday TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
  v_client_id TEXT;
  v_birthday TIMESTAMP;
BEGIN
  -- Bloquear chamadas sem autenticação (SECURITY DEFINER bypassa GRANT)
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Autenticação necessária');
  END IF;

  -- Safe birthday parse: qualquer input inválido → NULL (nunca crasha)
  v_birthday := NULL;
  IF p_birthday IS NOT NULL AND p_birthday != '' THEN
    BEGIN
      v_birthday := p_birthday::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
      v_birthday := NULL; -- Ignora data inválida
    END;
  END IF;

  -- Atualiza EXATAMENTE 1 registro (LIMIT 1 via subquery)
  UPDATE public.clients SET
    "authUserId" = auth.uid(),
    email = p_email,
    birthday = COALESCE(v_birthday, birthday),
    gender = CASE
      WHEN p_gender IS NOT NULL AND p_gender != ''
      THEN p_gender
      ELSE gender
    END,
    "updatedAt" = NOW()
  WHERE id = (
    SELECT id FROM public.clients
    WHERE phone = p_phone
      AND "authUserId" IS NULL
    LIMIT 1
  )
  RETURNING id INTO v_client_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RETURN json_build_object('success', true, 'clientId', v_client_id);
  ELSE
    RETURN json_build_object('success', false, 'error', 'Cliente já migrado ou telefone não encontrado');
  END IF;
END;
$$;

-- Acesso: apenas authenticated (APÓS signUp)
GRANT EXECUTE ON FUNCTION public.claim_legacy_client(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 4. Verificação rápida
SELECT 'Migration RPCs created successfully!' AS result;
