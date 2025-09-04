-- Allow users to view their own vacation quotas
CREATE POLICY "Users can view their own vacation quotas" 
ON public.vacation_quotas 
FOR SELECT 
USING (auth.uid() = user_id);