-- ============================================================
-- VINNX Barber — Enterprise Fields: Services + Products
-- Adds professional-grade fields for barbershop SaaS
-- ============================================================

-- 1. Services: Enterprise fields
ALTER TABLE services ADD COLUMN IF NOT EXISTS commission DECIMAL(5,2) DEFAULT 50.00;
ALTER TABLE services ADD COLUMN IF NOT EXISTS "assistantCommission" DECIMAL(5,2) DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS "priceVaries" BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS "returnForecast" INT DEFAULT 30;
ALTER TABLE services ADD COLUMN IF NOT EXISTS "allowsOnlineBooking" BOOLEAN DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS "registerAllProfessionals" BOOLEAN DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS image TEXT DEFAULT NULL;

-- 2. Products: Image + extra fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'un';
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- 3. Product Suppliers
CREATE TABLE IF NOT EXISTS product_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    "contactName" TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    cnpj TEXT,
    address TEXT,
    notes TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_suppliers' AND policyname = 'product_suppliers_auth_all') THEN
        CREATE POLICY product_suppliers_auth_all ON product_suppliers FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Link products to suppliers
ALTER TABLE products ADD COLUMN IF NOT EXISTS "supplierId" UUID REFERENCES product_suppliers(id) ON DELETE SET NULL;

-- 4. Product Movements (stock history)
CREATE TABLE IF NOT EXISTS product_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('entrada', 'saida', 'ajuste', 'venda')),
    quantity INT NOT NULL,
    "previousStock" INT NOT NULL DEFAULT 0,
    "newStock" INT NOT NULL DEFAULT 0,
    reason TEXT,
    "referenceId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_movements' AND policyname = 'product_movements_auth_all') THEN
        CREATE POLICY product_movements_auth_all ON product_movements FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_movements_product ON product_movements("productId");
CREATE INDEX IF NOT EXISTS idx_product_movements_date ON product_movements("createdAt");
