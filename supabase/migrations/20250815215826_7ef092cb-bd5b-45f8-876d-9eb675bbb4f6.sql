-- Update trigger function to use quoted column names
CREATE OR REPLACE FUNCTION calculate_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate commission based on CXL and PTK values
  IF NEW."CXL" = true AND NEW."PTK" = true THEN
    NEW.commission := 460 + 310; -- 770
  ELSIF NEW."CXL" = true AND (NEW."PTK" = false OR NEW."PTK" IS NULL) THEN
    NEW.commission := 460;
  ELSIF NEW."PTK" = true AND (NEW."CXL" = false OR NEW."CXL" IS NULL) THEN
    NEW.commission := 310;
  ELSE
    -- Both are false or null, use 0.55 * montant
    NEW.commission := COALESCE(NEW.montant * 0.55, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;