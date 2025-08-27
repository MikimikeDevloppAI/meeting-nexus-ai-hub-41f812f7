-- Standardiser les valeurs du champ compte dans la table invoices
-- Remplacer "David" par "David Tabibian" pour une cohérence totale

UPDATE invoices 
SET compte = 'David Tabibian' 
WHERE compte = 'David';