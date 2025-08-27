-- Supprimer l'ancienne contrainte
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;

-- Créer la nouvelle contrainte avec toutes les catégories
ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_type_check 
CHECK (invoice_type = ANY (ARRAY[
  'assurance/cotisations sociales'::text,
  'contactologie'::text,
  'déplacement/formation'::text,
  'équipement médicaux'::text,
  'fourniture de bureau'::text,
  'fourniture injections intra-vitréennes'::text,
  'fourniture médicales'::text,
  'frais bancaires/financiers'::text,
  'frais de locaux'::text,
  'frais de véhicule'::text,
  'informatique/logiciel'::text,
  'investissement/amortissement'::text,
  'marketing/communication'::text,
  'nourritures'::text,
  'télécommunication'::text,
  'non assigné'::text
]));