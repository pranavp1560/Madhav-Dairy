-- =============================================================================
-- Migration 018: Update Batch Generator for March (MH) and May (MY)
-- Module: Batch Numbering
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_batch_number(p_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_month int;
  v_day text;
  v_year text;
  v_month_code text;
BEGIN
  v_month := EXTRACT(MONTH FROM p_date);
  v_day := LPAD(EXTRACT(DAY FROM p_date)::text, 2, '0');
  v_year := EXTRACT(YEAR FROM p_date)::text;

  v_month_code := CASE v_month
    WHEN 1 THEN 'JA'
    WHEN 2 THEN 'FE'
    WHEN 3 THEN 'MH'  -- Explicit requirement: March is MH
    WHEN 4 THEN 'AP'
    WHEN 5 THEN 'MY'  -- Explicit requirement: May is MY
    WHEN 6 THEN 'JE'  -- Explicit requirement: June is JE
    WHEN 7 THEN 'JY'  -- Explicit requirement: July is JY
    WHEN 8 THEN 'AU'
    WHEN 9 THEN 'SE'
    WHEN 10 THEN 'OC'
    WHEN 11 THEN 'NO'
    WHEN 12 THEN 'DE'
    ELSE 'JA'
  END;

  RETURN v_month_code || v_day || v_year;
END;
$$;
