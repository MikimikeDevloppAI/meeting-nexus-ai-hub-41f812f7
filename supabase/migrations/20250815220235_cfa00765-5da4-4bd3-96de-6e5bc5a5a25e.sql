-- Update trigger function to round commission to 2 decimal places
CREATE OR REPLACE FUNCTION calculate_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate commission based on CXL and PTK values
  IF NEW."CXL" = true AND NEW."PTK" = true THEN
    NEW.commission := 770.00;
  ELSIF NEW."CXL" = true AND (NEW."PTK" = false OR NEW."PTK" IS NULL) THEN
    NEW.commission := 460.00;
  ELSIF NEW."PTK" = true AND (NEW."CXL" = false OR NEW."CXL" IS NULL) THEN
    NEW.commission := 310.00;
  ELSE
    -- Both are false or null, use 0.55 * montant rounded to 2 decimal places
    NEW.commission := ROUND(COALESCE(NEW.montant * 0.55, 0), 2);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing rows to round to 2 decimal places
UPDATE public.vision_ophta
SET commission = ROUND(commission, 2);