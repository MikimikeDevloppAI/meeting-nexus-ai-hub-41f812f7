begin;

-- Backfill uploaded_document_id in documents by matching title to uploaded_documents.ai_generated_name
-- If multiple uploaded_documents share the same ai_generated_name, pick the most recent one
WITH best_matches AS (
  SELECT DISTINCT ON (ud.ai_generated_name)
    ud.ai_generated_name,
    ud.id AS uploaded_id
  FROM public.uploaded_documents ud
  ORDER BY ud.ai_generated_name, ud.created_at DESC
)
UPDATE public.documents d
SET uploaded_document_id = bm.uploaded_id
FROM best_matches bm
WHERE d.type = 'uploaded_document'
  AND d.uploaded_document_id IS NULL
  AND d.title = bm.ai_generated_name;

commit;