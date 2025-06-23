
-- Supprimer TOUTES les politiques existantes sur toutes les tables
-- Ceci éliminera tous les conflits

-- Supprimer toutes les politiques sur task_deep_search_followups
DROP POLICY IF EXISTS "Users can view followups for their deep searches" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Users can create followups for their deep searches" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can view task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can create task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can update task deep search followups" ON public.task_deep_search_followups;
DROP POLICY IF EXISTS "Anyone can delete task deep search followups" ON public.task_deep_search_followups;

-- Supprimer toutes les politiques sur task_deep_searches
DROP POLICY IF EXISTS "Users can view all task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Users can create task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can view task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can create task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can update task deep searches" ON public.task_deep_searches;
DROP POLICY IF EXISTS "Anyone can delete task deep searches" ON public.task_deep_searches;

-- Supprimer toutes les politiques sur users
DROP POLICY IF EXISTS "Anyone can view users" ON public.users;
DROP POLICY IF EXISTS "Anyone can create users" ON public.users;
DROP POLICY IF EXISTS "Anyone can update users" ON public.users;
DROP POLICY IF EXISTS "Anyone can delete users" ON public.users;

-- Supprimer toutes les politiques sur meetings
DROP POLICY IF EXISTS "Anyone can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Anyone can delete meetings" ON public.meetings;

-- Supprimer toutes les politiques sur todos
DROP POLICY IF EXISTS "Anyone can view todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can create todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can update todos" ON public.todos;
DROP POLICY IF EXISTS "Anyone can delete todos" ON public.todos;

-- Supprimer toutes les politiques sur participants
DROP POLICY IF EXISTS "Anyone can view participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can create participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can update participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can delete participants" ON public.participants;

-- Supprimer toutes les politiques sur meeting_participants
DROP POLICY IF EXISTS "Anyone can view meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can create meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can update meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can delete meeting participants" ON public.meeting_participants;

-- Supprimer toutes les politiques sur todo_comments
DROP POLICY IF EXISTS "Anyone can view todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can create todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can update todo comments" ON public.todo_comments;
DROP POLICY IF EXISTS "Anyone can delete todo comments" ON public.todo_comments;

-- Supprimer toutes les politiques sur todo_participants
DROP POLICY IF EXISTS "Anyone can view todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can create todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can update todo participants" ON public.todo_participants;
DROP POLICY IF EXISTS "Anyone can delete todo participants" ON public.todo_participants;

-- Supprimer toutes les politiques sur todo_ai_recommendations
DROP POLICY IF EXISTS "Anyone can view todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can create todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can update todo ai recommendations" ON public.todo_ai_recommendations;
DROP POLICY IF EXISTS "Anyone can delete todo ai recommendations" ON public.todo_ai_recommendations;

-- Supprimer toutes les politiques sur pending_task_actions
DROP POLICY IF EXISTS "Anyone can view pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can create pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can update pending task actions" ON public.pending_task_actions;
DROP POLICY IF EXISTS "Anyone can delete pending task actions" ON public.pending_task_actions;

-- Supprimer toutes les politiques sur documents
DROP POLICY IF EXISTS "Anyone can view documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can create documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can update documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can delete documents" ON public.documents;

-- Supprimer toutes les politiques sur document_embeddings
DROP POLICY IF EXISTS "Anyone can view document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can create document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can update document embeddings" ON public.document_embeddings;
DROP POLICY IF EXISTS "Anyone can delete document embeddings" ON public.document_embeddings;

-- Supprimer toutes les politiques sur uploaded_documents
DROP POLICY IF EXISTS "Anyone can view uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can create uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can update uploaded documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Anyone can delete uploaded documents" ON public.uploaded_documents;

-- Supprimer toutes les politiques sur meeting_preparation_notes
DROP POLICY IF EXISTS "Anyone can view meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can create meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can update meeting preparation notes" ON public.meeting_preparation_notes;
DROP POLICY IF EXISTS "Anyone can delete meeting preparation notes" ON public.meeting_preparation_notes;

-- Supprimer toutes les politiques sur meeting_preparation_custom_points
DROP POLICY IF EXISTS "Anyone can view meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can create meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can update meeting preparation custom points" ON public.meeting_preparation_custom_points;
DROP POLICY IF EXISTS "Anyone can delete meeting preparation custom points" ON public.meeting_preparation_custom_points;

-- Maintenant créer les nouvelles politiques universelles

-- Politiques pour task_deep_search_followups
CREATE POLICY "Universal access task deep search followups" 
  ON public.task_deep_search_followups 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour task_deep_searches
CREATE POLICY "Universal access task deep searches" 
  ON public.task_deep_searches 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour users
CREATE POLICY "Universal access users" 
  ON public.users 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour meetings
CREATE POLICY "Universal access meetings" 
  ON public.meetings 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour todos
CREATE POLICY "Universal access todos" 
  ON public.todos 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour participants
CREATE POLICY "Universal access participants" 
  ON public.participants 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour meeting_participants
CREATE POLICY "Universal access meeting participants" 
  ON public.meeting_participants 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour todo_comments
CREATE POLICY "Universal access todo comments" 
  ON public.todo_comments 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour todo_participants
CREATE POLICY "Universal access todo participants" 
  ON public.todo_participants 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour todo_ai_recommendations
CREATE POLICY "Universal access todo ai recommendations" 
  ON public.todo_ai_recommendations 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour pending_task_actions
CREATE POLICY "Universal access pending task actions" 
  ON public.pending_task_actions 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour documents
CREATE POLICY "Universal access documents" 
  ON public.documents 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour document_embeddings
CREATE POLICY "Universal access document embeddings" 
  ON public.document_embeddings 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour uploaded_documents
CREATE POLICY "Universal access uploaded documents" 
  ON public.uploaded_documents 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour meeting_preparation_notes
CREATE POLICY "Universal access meeting preparation notes" 
  ON public.meeting_preparation_notes 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Politiques pour meeting_preparation_custom_points
CREATE POLICY "Universal access meeting preparation custom points" 
  ON public.meeting_preparation_custom_points 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
