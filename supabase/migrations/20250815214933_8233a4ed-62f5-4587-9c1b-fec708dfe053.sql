-- Modify vision_ophta table to change CXL and PTK to boolean and add commission column
ALTER TABLE public.vision_ophta 
ALTER COLUMN CXL TYPE BOOLEAN USING (CXL::int::boolean),
ALTER COLUMN PTK TYPE BOOLEAN USING (PTK::int::boolean);

-- Add commission column
ALTER TABLE public.vision_ophta 
ADD COLUMN commission NUMERIC DEFAULT 0;

-- Create function to calculate commission
CREATE OR REPLACE FUNCTION calculate_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate commission based on CXL and PTK values
  IF NEW.CXL = true AND NEW.PTK = true THEN
    NEW.commission := 460 + 310; -- 770
  ELSIF NEW.CXL = true AND (NEW.PTK = false OR NEW.PTK IS NULL) THEN
    NEW.commission := 460;
  ELSIF NEW.PTK = true AND (NEW.CXL = false OR NEW.CXL IS NULL) THEN
    NEW.commission := 310;
  ELSE
    -- Both are false or null, use 0.55 * montant
    NEW.commission := COALESCE(NEW.montant * 0.55, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate commission
CREATE TRIGGER trigger_calculate_commission
BEFORE INSERT OR UPDATE ON public.vision_ophta
FOR EACH ROW
EXECUTE FUNCTION calculate_commission();