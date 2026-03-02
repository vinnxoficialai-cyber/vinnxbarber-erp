-- ============================================================
-- VINNX Barber — Purchase Orders (Compras de Produtos)
-- Tracks purchases from suppliers with NF, dates, and items
-- ============================================================

-- 1. Purchase Orders (header)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "supplierId" UUID REFERENCES product_suppliers(id) ON DELETE SET NULL,
    "supplierName" TEXT NOT NULL,
    "nfNumber" TEXT,             -- Nota Fiscal number
    "orderDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deliveryDate" TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'cancelled')),
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'purchase_orders_auth_all') THEN
        CREATE POLICY purchase_orders_auth_all ON purchase_orders FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 2. Purchase Order Items (line items)
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "purchaseOrderId" UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    "productId" UUID REFERENCES products(id) ON DELETE SET NULL,
    "productName" TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'purchase_order_items_auth_all') THEN
        CREATE POLICY purchase_order_items_auth_all ON purchase_order_items FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders("supplierId");
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders("orderDate");
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items("purchaseOrderId");
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items("productId");
