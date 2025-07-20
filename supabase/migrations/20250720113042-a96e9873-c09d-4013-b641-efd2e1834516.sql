-- Ajouter la colonne invoice_type à la table invoices
ALTER TABLE public.invoices 
ADD COLUMN invoice_type TEXT DEFAULT 'non assigné' CHECK (
  invoice_type IN (
    'équipement médicaux',
    'fourniture médicales',
    'fourniture injections intra-vitréennes',
    'fourniture de bureau',
    'informatique/logiciel',
    'télécommunication',
    'assurance/cotisations sociales',
    'marketing/communication',
    'déplacement/formation',
    'frais bancaires/financiers',
    'investissement/amortissement',
    'nourritures',
    'non assigné'
  )
);

-- Mettre à jour toutes les factures existantes pour avoir "non assigné" comme type
UPDATE public.invoices 
SET invoice_type = 'non assigné' 
WHERE invoice_type IS NULL;