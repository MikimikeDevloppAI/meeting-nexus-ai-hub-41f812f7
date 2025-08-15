-- Insert all navigation pages into the pages table
INSERT INTO public.pages (id, name, path, description) VALUES
('todos', 'À faire', '/todos', 'Gestion des tâches et des actions à effectuer'),
('meetings', 'Réunions', '/meetings', 'Organisation et suivi des réunions'),
('documents', 'Documents', '/documents', 'Gestion des documents et fichiers'),
('iol-calculator', 'IOL Calculator', '/iol-calculator', 'Calculateur pour les lentilles intraoculaires'),
('patient-letters', 'Lettres Patient', '/patient-letters', 'Création et gestion des lettres pour les patients'),
('invoices', 'Factures', '/invoices', 'Gestion des factures et de la comptabilité'),
('retrocession', 'Rétrocession', '/retrocession', 'Gestion des rétrocessions'),
('stock-management', 'Gestion du stock', '/gestion-stock', 'Gestion des stocks et des commandes d''injection'),
('time-tracking', 'Gestion du temps', '/time-tracking', 'Suivi du temps de travail et des heures supplémentaires'),
('hr-validation', 'Validation RH', '/hr-validation', 'Validation des demandes RH (congés, heures supplémentaires)'),
('users', 'Gestion Utilisateurs', '/users', 'Gestion des utilisateurs et de leurs permissions'),
('profile', 'Profil', '/profile', 'Gestion du profil utilisateur')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  path = EXCLUDED.path,
  description = EXCLUDED.description;