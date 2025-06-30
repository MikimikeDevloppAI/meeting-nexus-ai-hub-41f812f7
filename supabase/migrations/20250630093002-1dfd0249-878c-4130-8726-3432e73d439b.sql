
-- Fonction pour corriger automatiquement le montant TTC si incohérent
CREATE OR REPLACE FUNCTION correct_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Si on a un montant HT et un montant de taxe, mais que le TTC ne correspond pas
  IF NEW.total_net IS NOT NULL AND NEW.total_tax IS NOT NULL THEN
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

-- Créer le trigger qui s'exécute avant chaque INSERT ou UPDATE
CREATE OR REPLACE TRIGGER trigger_correct_invoice_total
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION correct_invoice_total();
