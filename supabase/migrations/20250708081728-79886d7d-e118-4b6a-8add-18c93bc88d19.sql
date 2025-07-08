-- Modifier la fonction pour que la correction du total TTC se fasse au début
CREATE OR REPLACE FUNCTION correct_invoice_total()
RETURNS TRIGGER AS $$
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

  -- 2. NOUVELLE LOGIQUE : Gérer le taux de change après
  -- Si la devise est CHF, fixer le taux de change à 1
  IF NEW.currency = 'CHF' AND (NEW.exchange_rate IS NULL) THEN
    NEW.exchange_rate := 1;
  END IF;
  
  -- Si pas de taux de change et que la devise n'est pas CHF, fixer à 1 par défaut
  IF NEW.exchange_rate IS NULL THEN
    NEW.exchange_rate := 1;
  END IF;
  
  -- Toujours calculer original_amount_chf = total_amount * exchange_rate
  IF NEW.total_amount IS NOT NULL AND NEW.exchange_rate IS NOT NULL THEN
    NEW.original_amount_chf := NEW.total_amount * NEW.exchange_rate;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;