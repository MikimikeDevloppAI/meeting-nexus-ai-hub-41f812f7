
-- Ajouter les nouvelles colonnes
ALTER TABLE invoices ADD COLUMN compte TEXT;
ALTER TABLE invoices ADD COLUMN purchase_category TEXT;
ALTER TABLE invoices ADD COLUMN purchase_subcategory TEXT;

-- Migrer les données existantes du système de pourcentages vers la colonne compte
UPDATE invoices 
SET compte = CASE 
  WHEN david_percentage = 100 THEN 'David Tabibian'
  WHEN cabinet_percentage = 100 THEN 'Commun'
  WHEN david_percentage = 50 AND cabinet_percentage = 50 THEN 'Commun'
  ELSE 'Commun'
END;

-- Passer toutes les factures en validated
UPDATE invoices SET status = 'validated';

-- Supprimer les anciennes colonnes de pourcentages
ALTER TABLE invoices DROP COLUMN IF EXISTS david_percentage;
ALTER TABLE invoices DROP COLUMN IF EXISTS cabinet_percentage;
