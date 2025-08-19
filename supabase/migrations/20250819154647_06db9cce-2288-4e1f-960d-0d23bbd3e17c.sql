-- Ajouter une colonne stock_cible à la table produit_injection
ALTER TABLE public.produit_injection 
ADD COLUMN stock_cible INTEGER DEFAULT 0;