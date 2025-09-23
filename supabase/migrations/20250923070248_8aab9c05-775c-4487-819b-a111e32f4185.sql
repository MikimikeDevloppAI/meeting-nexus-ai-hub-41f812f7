-- Enable RLS on IOL table and create policy to allow read access
ALTER TABLE public."IOL" ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read IOL data
CREATE POLICY "Anyone can view IOL data" 
ON public."IOL" 
FOR SELECT 
USING (true);