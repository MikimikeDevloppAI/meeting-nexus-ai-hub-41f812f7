
-- Corriger la fonction store_document_with_embeddings pour correspondre à la structure réelle de la table documents
CREATE OR REPLACE FUNCTION store_document_with_embeddings(
  p_title TEXT,
  p_type TEXT,
  p_content TEXT,
  p_chunks TEXT[],
  p_embeddings TEXT[],
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_created_by UUID DEFAULT NULL,
  p_meeting_id UUID DEFAULT NULL,
  p_uploaded_document_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  doc_id UUID;
  chunk_text TEXT;
  chunk_embedding TEXT;
  i INTEGER;
BEGIN
  -- Insérer le document principal SANS meeting_id car cette colonne n'existe pas dans la table documents
  INSERT INTO documents (
    title, 
    type, 
    content, 
    metadata, 
    created_by,
    uploaded_document_id
  ) VALUES (
    p_title, 
    p_type, 
    p_content, 
    p_metadata, 
    p_created_by,
    p_uploaded_document_id
  ) RETURNING id INTO doc_id;

  -- Insérer les chunks avec leurs embeddings
  FOR i IN 1..array_length(p_chunks, 1) LOOP
    chunk_text := p_chunks[i];
    chunk_embedding := p_embeddings[i];
    
    INSERT INTO document_embeddings (
      document_id,
      chunk_text,
      embedding,
      meeting_id,
      type,
      metadata
    ) VALUES (
      doc_id,
      chunk_text,
      chunk_embedding::vector(1536),
      p_meeting_id,
      p_type,
      p_metadata
    );
  END LOOP;

  RETURN doc_id;
END;
$$;
