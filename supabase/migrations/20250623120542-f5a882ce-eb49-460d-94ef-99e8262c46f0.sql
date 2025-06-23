
-- Nettoyage radical et définitif de TOUTES les politiques RLS
-- Cette migration supprime explicitement chaque politique par son nom exact
-- puis recrée uniquement les politiques "allow_all_*" universelles

-- 1. SUPPRESSION EXPLICITE de toutes les politiques existantes par nom

-- Table: document_embeddings - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "allow_all_document_embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can view document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can create document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can update document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can delete document embeddings" ON public.document_embeddings;

-- Table: documents - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access documents" ON public.documents;
DROP POLICY IF EXISTS "allow_all_documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can view documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can create documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can update documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can delete documents" ON public.documents;

-- Table: meeting_participants - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "allow_all_meeting_participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can view meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can create meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can update meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can delete meeting participants" ON public.meeting_participants;

-- Table: meeting_preparation_custom_points - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "allow_all_meeting_preparation_custom_points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can view meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can create meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can update meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can delete meeting preparation custom points" ON public.meeting_preparation_custom_points;

-- Table: meeting_preparation_notes - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "allow_all_meeting_preparation_notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can view meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can create meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can update meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can delete meeting preparation notes" ON public.meeting_preparation_notes;

-- Table: meetings - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access meetings" ON public.meetings;
DROP POLICY IF EXISTS "allow_all_meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can delete meetings" ON public.meetings;

-- Table: participants - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access participants" ON public.participants;
DROP POLICY IF EXISTS "allow_all_participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can view participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can create participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can update participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can delete participants" ON public.participants;

-- Table: pending_task_actions - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "allow_all_pending_task_actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can view pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can create pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can update pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can delete pending task actions" ON public.pending_task_actions;

-- Table: task_deep_search_followups - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "allow_all_task_deep_search_followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Users can view followups for their deep searches" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Users can create followups for their deep searches" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can view task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can create task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can update task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can delete task deep search followups" ON public.task_deep_search_followups;

-- Table: task_deep_searches - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "allow_all_task_deep_searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Users can view all task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Users can create task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can view task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can create task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can update task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can delete task deep searches" ON public.task_deep_searches;

-- Table: todo_ai_recommendations - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "allow_all_todo_ai_recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can view todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can create todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can update todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can delete todo ai recommendations" ON public.todo_ai_recommendations;

-- Table: todo_comments - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "allow_all_todo_comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can view todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can create todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can update todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can delete todo comments" ON public.todo_comments;

-- Table: todo_participants - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "allow_all_todo_participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can view todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can create todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can update todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can delete todo participants" ON public.todo_participants;

-- Table: todos - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access todos" ON public.todos;
DROP POLICY IF EXISTS "allow_all_todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can view todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can create todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can update todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can delete todos" ON public.todos;

-- Table: uploaded_documents - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "allow_all_uploaded_documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can view uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can create uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can update uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can delete uploaded documents" ON public.uploaded_documents;

-- Table: users - Supprimer toutes les variantes
DROP POLICY IF EXISTS "Universal access users" ON public.users;
DROP POLICY IF EXISTS "allow_all_users" ON public.users;
DROP POLICY IF EXISTS "Anyone can view users" ON public.users;
DROP POLICY IF EXISTS "Anyone can create users" ON public.users;
DROP POLICY IF EXISTS "Anyone can update users" ON public.users;
DROP POLICY IF EXISTS "Anyone can delete users" ON public.users;

-- 2. CRÉATION des politiques universelles "allow_all_*" UNIQUEMENT (16 politiques au total)

-- Politique universelle pour document_embeddings
CREATE POLICY "allow_all_document_embeddings" 
  ON public.document_embeddings 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour documents
CREATE POLICY "allow_all_documents" 
  ON public.documents 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour meeting_participants
CREATE POLICY "allow_all_meeting_participants" 
  ON public.meeting_participants 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour meeting_preparation_custom_points
CREATE POLICY "allow_all_meeting_preparation_custom_points" 
  ON public.meeting_preparation_custom_points 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour meeting_preparation_notes
CREATE POLICY "allow_all_meeting_preparation_notes" 
  ON public.meeting_preparation_notes 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour meetings
CREATE POLICY "allow_all_meetings" 
  ON public.meetings 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour participants
CREATE POLICY "allow_all_participants" 
  ON public.participants 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour pending_task_actions
CREATE POLICY "allow_all_pending_task_actions" 
  ON public.pending_task_actions 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour task_deep_search_followups
CREATE POLICY "allow_all_task_deep_search_followups" 
  ON public.task_deep_search_followups 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour task_deep_searches
CREATE POLICY "allow_all_task_deep_searches" 
  ON public.task_deep_searches 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour todo_ai_recommendations
CREATE POLICY "allow_all_todo_ai_recommendations" 
  ON public.todo_ai_recommendations 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour todo_comments
CREATE POLICY "allow_all_todo_comments" 
  ON public.todo_comments 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour todo_participants
CREATE POLICY "allow_all_todo_participants" 
  ON public.todo_participants 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour todos
CREATE POLICY "allow_all_todos" 
  ON public.todos 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour uploaded_documents
CREATE POLICY "allow_all_uploaded_documents" 
  ON public.uploaded_documents 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politique universelle pour users
CREATE POLICY "allow_all_users" 
  ON public.users 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
