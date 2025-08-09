-- Sync documents.title when uploaded_documents.ai_generated_name changes
-- Creates trigger function and trigger on uploaded_documents

-- 1) Create or replace trigger function
CREATE OR REPLACE FUNCTION public.sync_document_title_from_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update when we have a non-empty name
  IF NEW.ai_generated_name IS NOT NULL AND btrim(NEW.ai_generated_name) <> '' THEN
    UPDATE public.documents
    SET title = NEW.ai_generated_name,
        updated_at = now()
    WHERE uploaded_document_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Drop and recreate trigger to keep it idempotent
DROP TRIGGER IF EXISTS trg_sync_document_title_from_uploaded ON public.uploaded_documents;
CREATE TRIGGER trg_sync_document_title_from_uploaded
AFTER UPDATE OF ai_generated_name ON public.uploaded_documents
FOR EACH ROW
WHEN (OLD.ai_generated_name IS DISTINCT FROM NEW.ai_generated_name)
EXECUTE FUNCTION public.sync_document_title_from_uploaded();