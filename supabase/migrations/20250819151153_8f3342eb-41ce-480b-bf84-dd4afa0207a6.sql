-- Insérer les heures supplémentaires récupérées pour l'utilisateur
INSERT INTO public.overtime_hours (user_id, date, hours, is_recovery, status, description)
VALUES 
  ('cda6be10-c1ad-4066-aa22-cbdd8e363ea0', '2025-01-22', 0.5, true, 'pending', 'Récupération 30 minutes'),
  ('cda6be10-c1ad-4066-aa22-cbdd8e363ea0', '2025-01-21', 0.5, true, 'pending', 'Récupération 30 minutes'),
  ('cda6be10-c1ad-4066-aa22-cbdd8e363ea0', '2025-04-02', 1.0, true, 'pending', 'Récupération 1 heure'),
  ('cda6be10-c1ad-4066-aa22-cbdd8e363ea0', '2025-02-19', 0.5, true, 'pending', 'Récupération 30 minutes'),
  ('cda6be10-c1ad-4066-aa22-cbdd8e363ea0', '2025-06-04', 0.5, true, 'pending', 'Récupération 30 minutes');