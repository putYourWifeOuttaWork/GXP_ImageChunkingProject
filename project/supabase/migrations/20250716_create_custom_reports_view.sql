-- Create a view to maintain backward compatibility with custom_reports
-- This view maps the new saved_reports table to the old custom_reports structure

-- Drop the view if it exists
DROP VIEW IF EXISTS public.custom_reports;

-- Create the view
CREATE VIEW public.custom_reports AS
SELECT 
    report_id,
    report_name AS name,
    description,
    report_config AS configuration,
    created_by,
    created_at,
    updated_at,
    company_id,
    is_template,
    'analytics' as category,  -- Default category for compatibility
    report_type as type,
    last_accessed_at,
    access_count
FROM public.saved_reports;

-- Grant permissions on the view
GRANT ALL ON public.custom_reports TO authenticated;

-- Create RLS policies for the view (views inherit from base table but we'll be explicit)
ALTER VIEW public.custom_reports SET (security_invoker = true);