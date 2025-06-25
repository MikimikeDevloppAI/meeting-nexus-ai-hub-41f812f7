
-- Remove NOT NULL constraints from invoices table columns (except id)
ALTER TABLE public.invoices 
  ALTER COLUMN original_filename DROP NOT NULL,
  ALTER COLUMN file_path DROP NOT NULL,
  ALTER COLUMN status DROP NOT NULL,
  ALTER COLUMN david_percentage DROP NOT NULL,
  ALTER COLUMN cabinet_percentage DROP NOT NULL,
  ALTER COLUMN created_at DROP NOT NULL,
  ALTER COLUMN updated_at DROP NOT NULL;

-- Update the allocation constraint to allow NULL values
ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS check_allocation_sum;

-- Add new constraint that only applies when both percentages are not null
ALTER TABLE public.invoices 
ADD CONSTRAINT check_allocation_sum 
CHECK (
  (david_percentage IS NULL OR cabinet_percentage IS NULL) OR 
  (david_percentage + cabinet_percentage = 100)
);
