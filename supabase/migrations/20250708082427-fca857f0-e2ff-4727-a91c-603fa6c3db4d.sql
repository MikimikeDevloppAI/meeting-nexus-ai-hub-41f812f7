-- Modifier la fonction pour gérer les changements de devise et appels API
CREATE OR REPLACE FUNCTION correct_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  should_call_api BOOLEAN := FALSE;
  api_response JSONB;
  converted_rate NUMERIC;
BEGIN
  -- 1. LOGIQUE EXISTANTE : Corriger le total TTC d'abord
  -- Ne corriger que si on a VRAIMENT un montant HT ET un montant de taxe (pas NULL et pas 0)
  IF NEW.total_net IS NOT NULL AND NEW.total_net > 0 AND 
     NEW.total_tax IS NOT NULL AND NEW.total_tax >= 0 THEN
    -- Calculer le TTC attendu
    DECLARE
      expected_total NUMERIC;
    BEGIN
      expected_total := NEW.total_net + NEW.total_tax;
      
      -- Si le TTC actuel est différent du TTC calculé (avec une tolérance de 0.01)
      IF NEW.total_amount IS NULL OR ABS(NEW.total_amount - expected_total) > 0.01 THEN
        NEW.total_amount := expected_total;
      END IF;
    END;
  END IF;

  -- 2. GESTION DU TAUX DE CHANGE
  
  -- Cas 1: Nouvelle facture avec devise CHF
  IF TG_OP = 'INSERT' AND NEW.currency = 'CHF' AND NEW.exchange_rate IS NULL THEN
    NEW.exchange_rate := 1;
  
  -- Cas 2: Nouvelle facture avec autre devise 
  ELSIF TG_OP = 'INSERT' AND NEW.currency != 'CHF' AND NEW.exchange_rate IS NULL THEN
    should_call_api := TRUE;
  
  -- Cas 3: Modification de devise vers CHF
  ELSIF TG_OP = 'UPDATE' AND OLD.currency != NEW.currency AND NEW.currency = 'CHF' THEN
    NEW.exchange_rate := 1;
  
  -- Cas 4: Modification de devise vers autre chose que CHF
  ELSIF TG_OP = 'UPDATE' AND OLD.currency != NEW.currency AND NEW.currency != 'CHF' THEN
    should_call_api := TRUE;
  
  -- Cas 5: Si pas de taux de change et que la devise n'est pas CHF, fixer à 1 par défaut
  ELSIF NEW.exchange_rate IS NULL THEN
    NEW.exchange_rate := 1;
  END IF;

  -- Appel API si nécessaire
  IF should_call_api AND NEW.total_amount IS NOT NULL AND NEW.invoice_date IS NOT NULL THEN
    BEGIN
      -- Appeler la fonction edge currency-converter
      SELECT net.http_post(
        url := 'https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/currency-converter',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk"}'::jsonb,
        body := jsonb_build_object(
          'currency', NEW.currency,
          'amount', NEW.total_amount,
          'date', NEW.invoice_date::date
        )
      ) INTO api_response;
      
      -- Extraire le taux de change de la réponse
      IF api_response IS NOT NULL AND (api_response->>'exchange_rate') IS NOT NULL THEN
        converted_rate := (api_response->>'exchange_rate')::numeric;
        IF converted_rate IS NOT NULL AND converted_rate > 0 THEN
          NEW.exchange_rate := converted_rate;
        ELSE
          NEW.exchange_rate := 1; -- Fallback
        END IF;
      ELSE
        NEW.exchange_rate := 1; -- Fallback si l'API échoue
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- En cas d'erreur avec l'API, utiliser 1 comme fallback
        NEW.exchange_rate := 1;
    END;
  END IF;
  
  -- 3. TOUJOURS CALCULER original_amount_chf
  -- Si l'utilisateur a modifié le taux de change OU si on a un nouveau taux
  IF NEW.total_amount IS NOT NULL AND NEW.exchange_rate IS NOT NULL THEN
    NEW.original_amount_chf := NEW.total_amount * NEW.exchange_rate;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;