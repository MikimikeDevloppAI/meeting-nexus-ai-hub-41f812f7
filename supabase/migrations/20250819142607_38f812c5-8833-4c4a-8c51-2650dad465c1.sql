-- Drop and recreate get_all_overtime_hours function to include is_recovery
DROP FUNCTION IF EXISTS public.get_all_overtime_hours();

CREATE OR REPLACE FUNCTION public.get_all_overtime_hours()
 RETURNS TABLE(id uuid, user_id uuid, date date, hours numeric, description text, status text, approved_by uuid, approved_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, is_recovery boolean, users jsonb)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT 
    oh.id,
    oh.user_id,
    oh.date,
    oh.hours,
    oh.description,
    oh.status,
    oh.approved_by,
    oh.approved_at,
    oh.created_at,
    oh.updated_at,
    oh.is_recovery,
    jsonb_build_object('name', u.name, 'email', u.email) as users
  FROM public.overtime_hours oh
  LEFT JOIN public.users u ON oh.user_id = u.id
  ORDER BY oh.date DESC;
$function$