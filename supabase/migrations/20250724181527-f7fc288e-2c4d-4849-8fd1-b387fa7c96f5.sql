-- Function to calculate days count from vacation_days
CREATE OR REPLACE FUNCTION calculate_vacation_days_count(vacation_id_param UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_days NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN is_half_day THEN 0.5 ELSE 1 END), 0)
  INTO total_days
  FROM vacation_days 
  WHERE vacation_id = vacation_id_param;
  
  RETURN total_days;
END;
$$ LANGUAGE plpgsql;

-- Function to update vacation days_count
CREATE OR REPLACE FUNCTION update_vacation_days_count()
RETURNS TRIGGER AS $$
DECLARE
  target_vacation_id UUID;
BEGIN
  -- Get the vacation_id depending on the operation
  IF TG_OP = 'DELETE' THEN
    target_vacation_id := OLD.vacation_id;
  ELSE
    target_vacation_id := NEW.vacation_id;
  END IF;
  
  -- Update the days_count in vacations table
  UPDATE vacations 
  SET days_count = calculate_vacation_days_count(target_vacation_id),
      updated_at = now()
  WHERE id = target_vacation_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on vacation_days table
CREATE TRIGGER update_vacation_days_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON vacation_days
  FOR EACH ROW
  EXECUTE FUNCTION update_vacation_days_count();

-- Update existing vacation records to have correct days_count
UPDATE vacations 
SET days_count = calculate_vacation_days_count(id),
    updated_at = now();