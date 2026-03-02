-- Adicionar colunas para RH em TeamMembers
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'CLT', -- 'CLT', 'PJ', 'IO', 'ESTAGIO'
ADD COLUMN IF NOT EXISTS payment_preference TEXT DEFAULT 'Mensal', -- 'Mensal', 'Quinzenal'
ADD COLUMN IF NOT EXISTS pix_key TEXT,
ADD COLUMN IF NOT EXISTS bank_info JSONB DEFAULT '{}'::jsonb, -- { bank, agency, account, type }
ADD COLUMN IF NOT EXISTS admission_date DATE; -- Data de admissão formal (pode diferir do joinDate)

-- Garantir que a coluna salary existe e está correta
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'salary') THEN 
        ALTER TABLE team_members ADD COLUMN salary NUMERIC(10,2) DEFAULT 0;
    END IF;
END $$;

-- Atualizar salário baseados em baseSalary se salary estiver 0
UPDATE team_members SET salary = "baseSalary" WHERE salary = 0 OR salary IS NULL;
