-- Add commission column to operation table
ALTER TABLE public.operation 
ADD COLUMN commission NUMERIC DEFAULT 0;

-- Create trigger function to calculate commission for operation table
CREATE OR REPLACE FUNCTION calculate_operation_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate commission as 0.2 * montant rounded to 2 decimal places
  NEW.commission := ROUND(COALESCE(NEW.montant * 0.2, 0), 2);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for operation table
CREATE TRIGGER operation_commission_trigger
  BEFORE INSERT OR UPDATE ON public.operation
  FOR EACH ROW
  EXECUTE FUNCTION calculate_operation_commission();

-- Update existing rows with calculated commission
UPDATE public.operation
SET commission = ROUND(COALESCE(montant * 0.2, 0), 2);