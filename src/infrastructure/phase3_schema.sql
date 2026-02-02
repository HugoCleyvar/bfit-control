-- Phase 3: Inventory Rules

CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    category TEXT,
    emoji TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all authenticated users"
ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write access for admins"
ON public.products FOR INSERT TO authenticated WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Allow update access for admins"
ON public.products FOR UPDATE TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Allow delete access for admins"
ON public.products FOR DELETE TO authenticated USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Seed some initial data for Quick Sell (The ones hardcoded in Payments.tsx)
INSERT INTO public.products (name, price, stock, category, emoji) VALUES
('Agua 600ml', 15.00, 50, 'Bebidas', '💧'),
('Gatorade', 35.00, 30, 'Bebidas', '⚡'),
('Day Pass', 80.00, 9999, 'Servicios', '🎫'),
('Proteína', 45.00, 20, 'Suplementos', '💪'),
('Barra', 25.00, 40, 'Snacks', '🍫'),
('Pre-Workout', 30.00, 15, 'Suplementos', '🚀')
ON CONFLICT DO NOTHING;
