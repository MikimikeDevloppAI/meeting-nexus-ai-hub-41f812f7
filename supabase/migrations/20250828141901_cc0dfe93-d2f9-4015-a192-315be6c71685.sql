-- Première étape: décaler toutes les dates vers une plage temporaire très élevée (+50 ans) pour éviter les conflits
UPDATE vacation_days 
SET vacation_date = vacation_date + INTERVAL '50 years';

-- Deuxième étape: décaler de -50 ans +1 jour pour obtenir le résultat final (+1 jour)
UPDATE vacation_days 
SET vacation_date = vacation_date - INTERVAL '50 years' + INTERVAL '1 day';