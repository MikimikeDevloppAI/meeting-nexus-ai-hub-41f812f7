-- Update the check constraint to allow 'overtime_recovery' vacation type
ALTER TABLE public.vacations DROP CONSTRAINT IF EXISTS vacations_vacation_type_check;

ALTER TABLE public.vacations ADD CONSTRAINT vacations_vacation_type_check 
CHECK (vacation_type IN ('annual', 'sick', 'personal', 'overtime_recovery', 'other'));