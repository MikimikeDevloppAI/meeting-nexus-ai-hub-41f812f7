
-- PHASE 2: CRÉATION DES POLITIQUES FINALES
-- Cette migration crée UNIQUEMENT les 16 politiques universelles nécessaires
-- Une politique "allow_all_*" par table (16 tables = 16 politiques)

-- === CRÉATION DES 16 POLITIQUES UNIVERSELLES ===

-- 1. Politique universelle pour document_embeddings
CREATE POLICY "allow_all_document_embeddings" 
  ON public.document_embeddings 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 2. Politique universelle pour documents
CREATE POLICY "allow_all_documents" 
  ON public.documents 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 3. Politique universelle pour meeting_participants
CREATE POLICY "allow_all_meeting_participants" 
  ON public.meeting_participants 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 4. Politique universelle pour meeting_preparation_custom_points
CREATE POLICY "allow_all_meeting_preparation_custom_points" 
  ON public.meeting_preparation_custom_points 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 5. Politique universelle pour meeting_preparation_notes
CREATE POLICY "allow_all_meeting_preparation_notes" 
  ON public.meeting_preparation_notes 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 6. Politique universelle pour meetings
CREATE POLICY "allow_all_meetings" 
  ON public.meetings 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 7. Politique universelle pour participants
CREATE POLICY "allow_all_participants" 
  ON public.participants 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 8. Politique universelle pour pending_task_actions
CREATE POLICY "allow_all_pending_task_actions" 
  ON public.pending_task_actions 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 9. Politique universelle pour task_deep_search_followups
CREATE POLICY "allow_all_task_deep_search_followups" 
  ON public.task_deep_search_followups 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 10. Politique universelle pour task_deep_searches
CREATE POLICY "allow_all_task_deep_searches" 
  ON public.task_deep_searches 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 11. Politique universelle pour todo_ai_recommendations
CREATE POLICY "allow_all_todo_ai_recommendations" 
  ON public.todo_ai_recommendations 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 12. Politique universelle pour todo_comments
CREATE POLICY "allow_all_todo_comments" 
  ON public.todo_comments 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 13. Politique universelle pour todo_participants
CREATE POLICY "allow_all_todo_participants" 
  ON public.todo_participants 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 14. Politique universelle pour todos
CREATE POLICY "allow_all_todos" 
  ON public.todos 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 15. Politique universelle pour uploaded_documents
CREATE POLICY "allow_all_uploaded_documents" 
  ON public.uploaded_documents 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 16. Politique universelle pour users
CREATE POLICY "allow_all_users" 
  ON public.users 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- === RÉSULTAT FINAL ===
-- Après cette migration, nous devrions avoir exactement :
-- - 16 tables avec RLS activé
-- - 16 politiques "allow_all_*" (une par table)
-- - 0 conflit dans le Security Advisor
-- - Application fonctionnelle
