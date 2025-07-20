-- Supprimer la contrainte qui empêche l'insertion des factures non traitées
ALTER TABLE public.invoices 
DROP CONSTRAINT check_total_amount_valid;