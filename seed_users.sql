-- INSTRUÇÕES:
-- 1. Acesse o SQL Editor do Supabase (https://supabase.com/dashboard/project/_/sql)
-- 2. Cole e execute este script para criar os usuários de teste.
-- 3. Em seguida, rode o comando 'npx tsx seed-data.ts' no terminal para popular os dados financeiros.

-- Limpar usuários anteriores (opcional, remover se quiser manter histórico)
-- DELETE FROM users WHERE email LIKE '%@teste.com';

-- Inserir Usuários (Ajuste os IDs se necessário, ou deixe gerar UUID v4)
INSERT INTO users (email, name, role, "createdAt", "updatedAt")
VALUES
('ana.silva@teste.com', 'Ana Silva', 'SUPPORT', NOW(), NOW()),
('carlos.santos@teste.com', 'Carlos Santos', 'SUPPORT', NOW(), NOW()),
('beatriz.costa@teste.com', 'Beatriz Costa', 'MANAGER', NOW(), NOW()),
('joao.junior@teste.com', 'João Júnior', 'SUPPORT', NOW(), NOW()),
('roberto.dev@teste.com', 'Roberto Oliveira', 'ADMIN', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
