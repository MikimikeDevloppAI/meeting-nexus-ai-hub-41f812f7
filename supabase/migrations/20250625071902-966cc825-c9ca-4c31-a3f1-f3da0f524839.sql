
-- Ajout de la colonne priority à la table todos
ALTER TABLE todos ADD COLUMN priority text DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low'));

-- Index pour améliorer les performances de tri
CREATE INDEX idx_todos_priority ON todos(priority, created_at);
