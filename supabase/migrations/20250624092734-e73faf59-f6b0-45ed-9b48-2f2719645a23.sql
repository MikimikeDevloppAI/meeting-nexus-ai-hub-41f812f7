
-- Ajouter les nouvelles colonnes pour line_items et IBAN
ALTER TABLE public.invoices 
ADD COLUMN line_items JSONB,
ADD COLUMN supplier_iban TEXT;
