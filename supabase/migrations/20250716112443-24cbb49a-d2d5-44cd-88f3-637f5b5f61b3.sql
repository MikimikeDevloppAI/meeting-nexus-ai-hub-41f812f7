-- Permettre payment_date d'être NULL lors de l'insertion initiale
-- Il sera défini lors du traitement automatique
ALTER TABLE public.invoices 
ALTER COLUMN payment_date DROP NOT NULL;