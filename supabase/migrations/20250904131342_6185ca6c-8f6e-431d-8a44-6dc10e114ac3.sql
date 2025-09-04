-- Add vacation quota for Michael Enry for 2025
INSERT INTO public.vacation_quotas (user_id, year, quota_days)
SELECT id, 2025, 20
FROM public.users 
WHERE name = 'Michael Enry'
ON CONFLICT (user_id, year) DO UPDATE SET quota_days = 20;