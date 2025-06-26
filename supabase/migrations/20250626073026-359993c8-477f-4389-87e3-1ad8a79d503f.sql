
-- Ajouter une politique RLS universelle pour permettre la suppression des factures
-- (comme pour les autres tables du projet)
CREATE POLICY "allow_all_invoices" 
  ON public.invoices 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
