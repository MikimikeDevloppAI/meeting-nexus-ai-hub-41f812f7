
-- PHASE 1: NETTOYAGE COMPLET - Suppression de TOUTES les politiques RLS existantes
-- Cette migration supprime explicitement chaque politique par son nom exact
-- Basé sur l'analyse des migrations précédentes, voici TOUTES les politiques possibles à supprimer

-- === SUPPRESSION SYSTÉMATIQUE DE TOUTES LES POLITIQUES ===

-- Table: document_embeddings
DROP POLICY IF EXISTS "allow_all_document_embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Universal access document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can view document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can create document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can update document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can delete document embeddings" ON public.document_embeddings;

-- Table: documents
DROP POLICY IF EXISTS "allow_all_documents" ON public.documents;
DROP POLICY IF EXISTS "Universal access documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can view documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can create documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can update documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can delete documents" ON public.documents;

-- Table: meeting_participants
DROP POLICY IF EXISTS "allow_all_meeting_participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Universal access meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can view meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can create meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can update meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can delete meeting participants" ON public.meeting_participants;

-- Table: meeting_preparation_custom_points
DROP POLICY IF EXISTS "allow_all_meeting_preparation_custom_points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Universal access meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can view meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can create meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can update meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can delete meeting preparation custom points" ON public.meeting_preparation_custom_points;

-- Table: meeting_preparation_notes
DROP POLICY IF EXISTS "allow_all_meeting_preparation_notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Universal access meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can view meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can create meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can update meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can delete meeting preparation notes" ON public.meeting_preparation_notes;

-- Table: meetings
DROP POLICY IF EXISTS "allow_all_meetings" ON public.meetings;
DROP POLICY IF EXISTS "Universal access meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can delete meetings" ON public.meetings;

-- Table: participants
DROP POLICY IF EXISTS "allow_all_participants" ON public.participants;
DROP POLICY IF EXISTS "Universal access participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can view participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can create participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can update participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can delete participants" ON public.participants;

-- Table: pending_task_actions
DROP POLICY IF EXISTS "allow_all_pending_task_actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Universal access pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can view pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can create pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can update pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can delete pending task actions" ON public.pending_task_actions;

-- Table: task_deep_search_followups
DROP POLICY IF EXISTS "allow_all_task_deep_search_followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Universal access task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Users can view followups for their deep searches" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Users can create followups for their deep searches" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can view task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can create task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can update task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can delete task deep search followups" ON public.task_deep_search_followups;

-- Table: task_deep_searches
DROP POLICY IF EXISTS "allow_all_task_deep_searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Universal access task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Users can view all task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Users can create task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can view task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can create task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can update task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can delete task deep searches" ON public.task_deep_searches;

-- Table: todo_ai_recommendations
DROP POLICY IF EXISTS "allow_all_todo_ai_recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Universal access todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can view todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can create todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can update todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can delete todo ai recommendations" ON public.todo_ai_recommendations;

-- Table: todo_comments
DROP POLICY IF EXISTS "allow_all_todo_comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Universal access todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can view todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can create todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can update todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can delete todo comments" ON public.todo_comments;

-- Table: todo_participants
DROP POLICY IF EXISTS "allow_all_todo_participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Universal access todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can view todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can create todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can update todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can delete todo participants" ON public.todo_participants;

-- Table: todos
DROP POLICY IF EXISTS "allow_all_todos" ON public.todos;
DROP POLICY IF EXISTS "Universal access todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can view todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can create todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can update todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can delete todos" ON public.todos;

-- Table: uploaded_documents
DROP POLICY IF EXISTS "allow_all_uploaded_documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Universal access uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can view uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can create uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can update uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can delete uploaded documents" ON public.uploaded_documents;

-- Table: users
DROP POLICY IF EXISTS "allow_all_users" ON public.users;
DROP POLICY IF EXISTS "Universal access users" ON public.users;
DROP POLICY IF EXISTS "Anyone can view users" ON public.users;
DROP POLICY IF EXISTS "Anyone can create users" ON public.users;
DROP POLICY IF EXISTS "Anyone can update users" ON public.users;
DROP POLICY IF EXISTS "Anyone can delete users" ON public.users;

-- === VÉRIFICATION FINALE ===
-- Cette migration ne fait QUE supprimer les politiques
-- Après cette migration, toutes les tables devraient avoir RLS activé mais AUCUNE politique
-- Cela permettra de vérifier que le nettoyage est complet avant la Phase 2
