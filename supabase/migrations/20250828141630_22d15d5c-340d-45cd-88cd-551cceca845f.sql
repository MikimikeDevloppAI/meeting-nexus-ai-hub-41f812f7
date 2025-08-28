-- Décaler tous les jours de congé de +1 jour dans vacation_days
UPDATE vacation_days 
SET vacation_date = vacation_date + INTERVAL '1 day';