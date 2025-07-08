-- Ajouter des logs détaillés au trigger pour diagnostiquer le problème
CREATE OR REPLACE FUNCTION public.correct_invoice_total()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  should_call_api BOOLEAN := FALSE;
  api_response JSONB;
  converted_rate NUMERIC;
BEGIN
  -- Log détaillé pour diagnostic
  RAISE NOTICE 'TRIGGER DEBUG: Operation=%, Currency OLD=%, NEW=%, ExchangeRate OLD=%, NEW=%', 
    TG_OP, COALESCE(OLD.currency, 'NULL'), NEW.currency, 
    COALESCE(OLD.exchange_rate, -999), COALESCE(NEW.exchange_rate, -999);

  -- 1. LOGIQUE EXISTANTE : Corriger le total TTC d'abord
  IF NEW.total_net IS NOT NULL AND NEW.total_net > 0 AND 
     NEW.total_tax IS NOT NULL AND NEW.total_tax >= 0 THEN
    DECLARE
      expected_total NUMERIC;
    BEGIN
      expected_total := NEW.total_net + NEW.total_tax;
      
      IF NEW.total_amount IS NULL OR ABS(NEW.total_amount - expected_total) > 0.01 THEN
        NEW.total_amount := expected_total;
        RAISE NOTICE 'TRIGGER DEBUG: Total amount corrected to %', NEW.total_amount;
      END IF;
    END;
  END IF;

  -- 2. GESTION DU TAUX DE CHANGE - VERSION AVEC LOGS
  
  -- Cas 1: Nouvelle facture avec devise CHF
  IF TG_OP = 'INSERT' AND NEW.currency = 'CHF' AND NEW.exchange_rate IS NULL THEN
    NEW.exchange_rate := 1;
    RAISE NOTICE 'TRIGGER DEBUG: Case 1 - INSERT CHF, setting exchange_rate to 1';
  
  -- Cas 2: Nouvelle facture avec autre devise 
  ELSIF TG_OP = 'INSERT' AND NEW.currency != 'CHF' AND NEW.exchange_rate IS NULL THEN
    should_call_api := TRUE;
    RAISE NOTICE 'TRIGGER DEBUG: Case 2 - INSERT non-CHF, will call API';
  
  -- Cas 3: Modification de devise vers CHF
  ELSIF TG_OP = 'UPDATE' AND OLD.currency != NEW.currency AND NEW.currency = 'CHF' THEN
    NEW.exchange_rate := 1;
    RAISE NOTICE 'TRIGGER DEBUG: Case 3 - UPDATE to CHF, setting exchange_rate to 1';
  
  -- Cas 4: Modification de devise vers autre chose que CHF
  ELSIF TG_OP = 'UPDATE' AND OLD.currency != NEW.currency AND NEW.currency != 'CHF' THEN
    should_call_api := TRUE;
    RAISE NOTICE 'TRIGGER DEBUG: Case 4 - UPDATE to non-CHF, will call API';
  
  -- PAS D'AUTRES CAS - Le trigger ne doit PAS modifier exchange_rate dans d'autres situations
  ELSE
    RAISE NOTICE 'TRIGGER DEBUG: No exchange rate logic applied - preserving existing value %', NEW.exchange_rate;
  END IF;

  -- Appel API si nécessaire
  IF should_call_api AND NEW.total_amount IS NOT NULL AND NEW.invoice_date IS NOT NULL THEN
    RAISE NOTICE 'TRIGGER DEBUG: Calling currency API for % % on date %', NEW.currency, NEW.total_amount, NEW.invoice_date;
    
    BEGIN
      SELECT net.http_post(
        url := 'https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/currency-converter',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk"}'::jsonb,
        body := jsonb_build_object(
          'currency', NEW.currency,
          'amount', NEW.total_amount,
          'date', NEW.invoice_date::date
        )
      ) INTO api_response;
      
      RAISE NOTICE 'TRIGGER DEBUG: API Response: %', api_response;
      
      IF api_response IS NOT NULL AND (api_response->>'exchange_rate') IS NOT NULL THEN
        converted_rate := (api_response->>'exchange_rate')::numeric;
        IF converted_rate IS NOT NULL AND converted_rate > 0 THEN
          NEW.exchange_rate := converted_rate;
          RAISE NOTICE 'TRIGGER DEBUG: API SUCCESS - Set exchange_rate to %', converted_rate;
        ELSE
          NEW.exchange_rate := 1;
          RAISE NOTICE 'TRIGGER DEBUG: API returned invalid rate, fallback to 1';
        END IF;
      ELSE
        NEW.exchange_rate := 1;
        RAISE NOTICE 'TRIGGER DEBUG: API failed, fallback to 1';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NEW.exchange_rate := 1;
        RAISE NOTICE 'TRIGGER DEBUG: API exception, fallback to 1. Error: %', SQLERRM;
    END;
  END IF;
  
  -- 3. CALCULER original_amount_chf SEULEMENT si on a un taux valide
  IF NEW.total_amount IS NOT NULL AND NEW.exchange_rate IS NOT NULL THEN
    NEW.original_amount_chf := NEW.total_amount * NEW.exchange_rate;
    RAISE NOTICE 'TRIGGER DEBUG: Calculated CHF amount: % * % = %', NEW.total_amount, NEW.exchange_rate, NEW.original_amount_chf;
  END IF;
  
  RAISE NOTICE 'TRIGGER DEBUG: FINAL VALUES - Currency=%, ExchangeRate=%, CHF=%', NEW.currency, NEW.exchange_rate, NEW.original_amount_chf;
  
  RETURN NEW;
END;
$function$;