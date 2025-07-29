-- Create vacation_days table for non-consecutive vacation days
CREATE TABLE public.vacation_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vacation_id UUID NOT NULL REFERENCES public.vacations(id) ON DELETE CASCADE,
  vacation_date DATE NOT NULL,
  is_half_day BOOLEAN NOT NULL DEFAULT false,
  half_day_period TEXT NULL CHECK (half_day_period IN ('morning', 'afternoon')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vacation_id, vacation_date)
);

-- Enable RLS
ALTER TABLE public.vacation_days ENABLE ROW LEVEL SECURITY;

-- Create policies for vacation_days
CREATE POLICY "Users can view all vacation days" 
ON public.vacation_days 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create vacation days for their own vacations" 
ON public.vacation_days 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vacations v 
    WHERE v.id = vacation_id AND v.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update vacation days for their own pending vacations" 
ON public.vacation_days 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.vacations v 
    WHERE v.id = vacation_id AND v.user_id = auth.uid() AND v.status = 'pending'
  )
);

CREATE POLICY "Users can delete vacation days for their own pending vacations" 
ON public.vacation_days 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.vacations v 
    WHERE v.id = vacation_id AND v.user_id = auth.uid() AND v.status = 'pending'
  )
);

CREATE POLICY "HR can manage all vacation days" 
ON public.vacation_days 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_permissions up 
    WHERE up.user_id = auth.uid() 
    AND up.page_id = 'hr-validation' 
    AND up.granted = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_permissions up 
    WHERE up.user_id = auth.uid() 
    AND up.page_id = 'hr-validation' 
    AND up.granted = true
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_vacation_days_updated_at
BEFORE UPDATE ON public.vacation_days
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_vacation_days_vacation_id ON public.vacation_days(vacation_id);
CREATE INDEX idx_vacation_days_date ON public.vacation_days(vacation_date);

-- Migrate existing vacation data to vacation_days
INSERT INTO public.vacation_days (vacation_id, vacation_date, is_half_day)
SELECT 
  v.id,
  generate_series(v.start_date, v.end_date, '1 day'::interval)::date,
  false
FROM public.vacations v
WHERE v.start_date IS NOT NULL AND v.end_date IS NOT NULL;