
-- PHASE 3: ACTIVATION DE RLS SUR LES TABLES MANQUANTES
-- Cette migration active RLS sur les 12 tables qui ont des politiques mais pas RLS activé
-- Cela résoudra les erreurs "Policy Exists RLS Disabled" et "RLS Disabled in Public"

-- === ACTIVATION DE RLS SUR LES 12 TABLES CONCERNÉES ===

-- 1. Activer RLS sur document_embeddings
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- 2. Activer RLS sur documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 3. Activer RLS sur meeting_participants
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

-- 4. Activer RLS sur meetings
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- 5. Activer RLS sur participants
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- 6. Activer RLS sur pending_task_actions
ALTER TABLE public.pending_task_actions ENABLE ROW LEVEL SECURITY;

-- 7. Activer RLS sur todo_ai_recommendations
ALTER TABLE public.todo_ai_recommendations ENABLE ROW LEVEL SECURITY;

-- 8. Activer RLS sur todo_comments
ALTER TABLE public.todo_comments ENABLE ROW LEVEL SECURITY;

-- 9. Activer RLS sur todo_participants
ALTER TABLE public.todo_participants ENABLE ROW LEVEL SECURITY;

-- 10. Activer RLS sur todos
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- 11. Activer RLS sur uploaded_documents
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;

-- 12. Activer RLS sur users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- === RÉSULTAT FINAL ATTENDU ===
-- Après cette migration :
-- - Les 16 tables auront RLS activé
-- - Les 16 politiques "allow_all_*" fonctionneront correctement
-- - Plus d'erreurs "Policy Exists RLS Disabled" 
-- - Plus d'erreurs "RLS Disabled in Public"
-- - Security Advisor propre (0 erreur)
-- - Application fonctionnelle
