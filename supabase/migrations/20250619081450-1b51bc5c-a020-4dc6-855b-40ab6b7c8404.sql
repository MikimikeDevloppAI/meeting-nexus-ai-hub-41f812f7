
-- Ajouter une colonne sources à la table task_deep_searches pour stocker les liens sources
ALTER TABLE public.task_deep_searches 
ADD COLUMN sources JSONB DEFAULT '[]'::jsonb;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.task_deep_searches.sources IS 'Array of source URLs returned by Perplexity API citations';
