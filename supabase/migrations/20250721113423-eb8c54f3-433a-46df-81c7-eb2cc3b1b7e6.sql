-- Activer les mises à jour en temps réel pour les tables todos et todo_users
-- Cela permettra aux compteurs de tâches de se mettre à jour automatiquement

-- Configurer REPLICA IDENTITY pour capturer les données complètes lors des mises à jour
ALTER TABLE public.todos REPLICA IDENTITY FULL;
ALTER TABLE public.todo_users REPLICA IDENTITY FULL;

-- Ajouter les tables à la publication supabase_realtime pour activer le temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE public.todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.todo_users;