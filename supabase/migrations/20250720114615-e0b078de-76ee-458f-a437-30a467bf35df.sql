-- Ajouter une contrainte pour s'assurer que total_amount n'est pas null et n'est pas égal à 0
ALTER TABLE public.invoices 
ADD CONSTRAINT check_total_amount_valid 
CHECK (total_amount IS NOT NULL AND total_amount != 0);