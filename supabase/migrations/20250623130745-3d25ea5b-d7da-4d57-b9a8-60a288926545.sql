
-- Activer REPLICA IDENTITY FULL pour capturer tous les changements
ALTER TABLE todo_ai_recommendations REPLICA IDENTITY FULL;

-- Ajouter la table à la publication realtime pour diffuser les événements
ALTER PUBLICATION supabase_realtime ADD TABLE todo_ai_recommendations;
