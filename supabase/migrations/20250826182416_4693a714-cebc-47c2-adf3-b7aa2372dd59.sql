-- Modifier le type de la colonne quota_days pour permettre les décimales
ALTER TABLE vacation_quotas 
ALTER COLUMN quota_days TYPE NUMERIC(5,2);