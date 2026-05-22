
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'piece',
  low_stock_threshold NUMERIC(12,2) NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_sel" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "p_ins" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_upd" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "p_del" ON public.products FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_products_user ON public.products(user_id);

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "s_sel" ON public.sales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "s_ins" ON public.sales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "s_upd" ON public.sales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "s_del" ON public.sales FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_sales_user_date ON public.sales(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "si_sel" ON public.sale_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "si_ins" ON public.sale_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "si_upd" ON public.sale_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "si_del" ON public.sale_items FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);

CREATE TABLE IF NOT EXISTS public.due_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.due_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dp_sel" ON public.due_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dp_ins" ON public.due_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dp_upd" ON public.due_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dp_del" ON public.due_payments FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_due_payments_sale ON public.due_payments(sale_id);
