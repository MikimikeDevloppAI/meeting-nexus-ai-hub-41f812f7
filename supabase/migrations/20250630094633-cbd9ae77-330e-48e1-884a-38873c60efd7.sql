
-- Modifier la fonction pour corriger automatiquement le montant TTC uniquement si HT et TVA sont renseignés
CREATE OR REPLACE FUNCTION correct_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
