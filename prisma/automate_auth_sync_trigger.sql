-- ==============================================================================
-- AUTOMAÇÃO DE CRIAÇÃO DE USUÁRIOS (TRIGGER)
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para automatizar a criação de usuários.
-- Sempre que o ERP criar um usuário na tabela 'public.users', esta trigger irá
-- criar automaticamente o usuário correspondente no 'auth.users' do Supabase.

-- 1. Habilitar extensão de criptografia (geralmente já vem habilitada)
create extension if not exists pgcrypto;

-- 2. Criar função que será executada pela trigger
create or replace function public.handle_new_erp_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Verifica se o usuário já existe no auth para evitar erro
  if not exists (select 1 from auth.users where email = new.email) then
    insert into auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      role,
      aud,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      new.id, -- Usa o mesmo ID gerado pelo ERP
      '00000000-0000-0000-0000-000000000000',
      new.email,
      crypt(new.password, gen_salt('bf')), -- Usa a senha fornecida pelo ERP
      now(), -- Auto-confirma o email
      'authenticated',
      'authenticated',
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('name', new.name, 'role', new.role),
      now(),
      now()
    );
  end if;
  return new;
end;
$$;

-- 3. Criar a trigger na visualização/tabela public.users
-- IMPORTANTE: Se public.users for uma tabela, use o comando abaixo:
drop trigger if exists on_file_user_created on public.users;
create trigger on_file_user_created
  after insert on public.users
  for each row execute procedure public.handle_new_erp_user();

-- Se public.users for diferente, ajuste conforme necessário.
