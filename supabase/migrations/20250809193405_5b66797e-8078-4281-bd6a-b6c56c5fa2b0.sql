-- Part 2: Add cascading foreign keys so that deleting an uploaded_document cascades to documents and document_embeddings
-- We use NOT VALID to avoid failing if historical data has orphans. New/updated rows will be checked.
-- You can VALIDATE CONSTRAINTS later after cleaning legacy data.

begin;

-- 1) documents.uploaded_document_id -> uploaded_documents(id) ON DELETE CASCADE
alter table if exists public.documents
  drop constraint if exists documents_uploaded_document_id_fkey;

alter table if exists public.documents
  add constraint documents_uploaded_document_id_fkey
  foreign key (uploaded_document_id)
  references public.uploaded_documents(id)
  on delete cascade
  not valid;

-- 2) document_embeddings.document_id -> documents(id) ON DELETE CASCADE
alter table if exists public.document_embeddings
  drop constraint if exists document_embeddings_document_id_fkey;

alter table if exists public.document_embeddings
  add constraint document_embeddings_document_id_fkey
  foreign key (document_id)
  references public.documents(id)
  on delete cascade
  not valid;

commit;