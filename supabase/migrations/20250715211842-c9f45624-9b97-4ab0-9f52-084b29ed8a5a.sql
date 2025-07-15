-- Ajouter la colonne payment_date à la table invoices
ALTER TABLE public.invoices 
ADD COLUMN payment_date timestamp with time zone;

-- Migrer les données existantes : payment_date = invoice_date
UPDATE public.invoices 
SET payment_date = invoice_date 
WHERE payment_date IS NULL;

-- Rendre la colonne NOT NULL après avoir migré les données
ALTER TABLE public.invoices 
ALTER COLUMN payment_date SET NOT NULL;