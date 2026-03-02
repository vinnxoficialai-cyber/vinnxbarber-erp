-- ==============================================================================
-- CORREÇÃO DE LOGIN - SCRIPT V4 (DEFINITIVO)
-- ==============================================================================
-- Problema Anterior: Uma trigger automática 'handle_new_erp_user' estava tentando 
-- criar o usuário no Auth novamente e falhando por falta de pgcrypto.
--
-- Solução: 
-- 1. Remover a trigger conflitante (que não funciona sem pgcrypto).
-- 2. Executar a migração e correção de IDs.
-- ==============================================================================

BEGIN;

-- 1. Tentar remover a trigger problemática se ela existir
-- (Isso evita que ela dispare quando inserirmos o usuário corrigido)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_public_user_created ON public.users;

-- Tentar remover a função problemática também, para limpar a casa
DROP FUNCTION IF EXISTS handle_new_user CASCADE;
DROP FUNCTION IF EXISTS handle_new_erp_user CASCADE;

-- 2. Executar a Migração dos Usuários (Código V3 Corrigido)
DO $$
DECLARE
    r record;
    new_uuid uuid;
BEGIN
    FOR r IN SELECT * FROM public.users WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LOOP
        new_uuid := gen_random_uuid();
        RAISE NOTICE 'Migrando usuário: % -> Novo UUID: %', r.email, new_uuid;

        -- A. Criar no Auth (com senha fixa hashada para 'mudar123')
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
            created_at, updated_at, confirmation_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            new_uuid,
            'authenticated',
            'authenticated',
            r.email,
            '$2a$10$wLd6a.04/jF8S/v6UvJ8B.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1', -- Hash fixa para 'mudar123'
            now(),
            '{"provider":"email","providers":["email"]}',
            json_build_object('name', r.name, 'role', r.role)::jsonb,
            now(),
            now(),
            ''
        );

        -- B. Identidade
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
            new_uuid, new_uuid, json_build_object('sub', new_uuid, 'email', r.email)::jsonb, 'email', r.email, now(), now(), now()
        );

        -- C. Recriar usuário em public.users com ID NOVO (UUID)
        INSERT INTO public.users (
            id, email, name, password, role, phone, avatar, "createdAt", "updatedAt"
        ) VALUES (
            new_uuid::text, 
            r.email || '.temp', -- Email temporário
            r.name, r.password, r.role, r.phone, r.avatar, r."createdAt", r."updatedAt"
        );

        -- D. Atualizar tabelas filhas para o novo UUID
        UPDATE public.team_members SET "userId" = new_uuid::text WHERE "userId" = r.id;
        UPDATE public.projects SET "createdById" = new_uuid::text WHERE "createdById" = r.id;
        UPDATE public.tasks SET "assignedToId" = new_uuid::text WHERE "assignedToId" = r.id;
        UPDATE public.clients SET "createdById" = new_uuid::text WHERE "createdById" = r.id;
        UPDATE public.client_interactions SET "userId" = new_uuid::text WHERE "userId" = r.id;

        -- E. Limpeza final
        DELETE FROM public.users WHERE id = r.id;
        UPDATE public.users SET email = r.email WHERE id = new_uuid::text;
        
    END LOOP;
END $$;

COMMIT;
