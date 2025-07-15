-- Nettoyer les résumés existants qui contiennent des artefacts markdown
UPDATE meetings 
SET summary = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(summary, '^[\s\n]*```+[\s]*(?:markdown[\s]*)?', '', 'g'),
    '```+[\s]*$', '', 'g'
  )
)
WHERE summary IS NOT NULL 
  AND (summary LIKE '%```%' OR summary LIKE '%markdown%');

-- Créer une fonction pour nettoyer automatiquement les résumés
CREATE OR REPLACE FUNCTION clean_meeting_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le résumé n'est pas NULL et contient des artefacts markdown
  IF NEW.summary IS NOT NULL AND (NEW.summary LIKE '%```%' OR NEW.summary LIKE '%markdown%') THEN
    -- Nettoyer le résumé en supprimant les artefacts markdown
    NEW.summary := TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(NEW.summary, '^[\s\n]*```+[\s]*(?:markdown[\s]*)?', '', 'g'),
        '```+[\s]*$', '', 'g'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger qui s'exécute avant l'insertion ou la mise à jour
DROP TRIGGER IF EXISTS trigger_clean_meeting_summary ON meetings;
CREATE TRIGGER trigger_clean_meeting_summary
  BEFORE INSERT OR UPDATE OF summary ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION clean_meeting_summary();