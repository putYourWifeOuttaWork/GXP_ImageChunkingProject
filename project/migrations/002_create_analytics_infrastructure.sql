-- Migration 002: Analytics Infrastructure
-- This creates the foundation for executive-level analytics

BEGIN;

-- 1. Add geographic data to sites
ALTER TABLE sites 
  ADD COLUMN latitude numeric,
  ADD COLUMN longitude numeric,
  ADD COLUMN elevation_ft numeric,
  ADD COLUMN climate_zone varchar(50);

-- Add check constraints
ALTER TABLE sites
  ADD CONSTRAINT chk_latitude CHECK (latitude >= -90 AND latitude <= 90),
  ADD CONSTRAINT chk_longitude CHECK (longitude >= -180 AND longitude <= 180);

-- 2. Create materialized views for fast analytics
CREATE MATERIALIZED VIEW mv_daily_metrics AS
WITH phase_mapping AS (
  -- Map each date to its program phase
  SELECT 
    p.program_id,
    p.company_id,
    phase->>'name' as phase_name,
    (phase->>'start_date')::date as phase_start,
    (phase->>'end_date')::date as phase_end
  FROM pilot_programs p,
  jsonb_array_elements(p.phases) as phase
)
SELECT 
  date_trunc('day', po.created_at) as metric_date,
  po.company_id,
  po.program_id,
  po.site_id,
  pm.phase_name,
  COUNT(DISTINCT po.observation_id) as observation_count,
  COUNT(DISTINCT po.petri_code) as unique_petris,
  AVG(po.growth_index) as avg_growth_index,
  MAX(po.growth_index) as max_growth_index,
  MIN(po.growth_index) as min_growth_index,
  STDDEV(po.growth_index) as stddev_growth_index,
  AVG(po.growth_progression) as avg_progression,
  AVG(po.growth_velocity) as avg_velocity,
  COUNT(CASE WHEN po.flag_for_review THEN 1 END) as flagged_count,
  AVG(po.outdoor_temperature) as avg_outdoor_temp,
  AVG(po.outdoor_humidity) as avg_outdoor_humidity
FROM petri_observations po
LEFT JOIN phase_mapping pm 
  ON po.program_id = pm.program_id 
  AND po.created_at::date BETWEEN pm.phase_start AND pm.phase_end
GROUP BY 1, 2, 3, 4, 5;

-- Create indexes on materialized view
CREATE INDEX idx_mv_daily_metrics_lookup 
  ON mv_daily_metrics(company_id, program_id, metric_date);
CREATE INDEX idx_mv_daily_metrics_phase 
  ON mv_daily_metrics(company_id, phase_name);

-- 3. Create effectiveness calculations table
CREATE TABLE effectiveness_metrics (
  metric_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(company_id),
  program_id uuid NOT NULL REFERENCES pilot_programs(program_id),
  site_id uuid NOT NULL REFERENCES sites(site_id),
  calculation_date date NOT NULL,
  phase_name varchar(100),
  
  -- Core effectiveness metrics
  growth_suppression_rate numeric, -- Percentage reduction vs control
  coverage_effectiveness numeric, -- Effectiveness per sq ft
  treatment_efficiency numeric, -- Results per gasifier
  
  -- Financial metrics
  treatment_cost_usd numeric,
  pest_damage_prevented_usd numeric,
  roi_percentage numeric,
  payback_period_days integer,
  
  -- Comparative metrics
  vs_control_improvement numeric,
  vs_industry_benchmark numeric,
  vs_previous_phase numeric,
  
  -- Environmental factors
  avg_temperature numeric,
  avg_humidity numeric,
  weather_impact_score numeric,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_effectiveness_lookup 
  ON effectiveness_metrics(company_id, program_id, calculation_date);

-- 4. Create aggregate statistics table for fast dashboards
CREATE TABLE aggregate_program_stats (
  stat_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(company_id),
  program_id uuid NOT NULL REFERENCES pilot_programs(program_id),
  stat_date date NOT NULL,
  stat_type varchar(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'phase'
  
  -- Counts
  total_observations integer,
  total_sites integer,
  active_petris integer,
  active_gasifiers integer,
  
  -- Growth metrics
  avg_growth_index numeric,
  growth_trend numeric, -- Positive/negative trend
  growth_acceleration numeric,
  
  -- Effectiveness
  overall_effectiveness_score numeric,
  best_performing_site_id uuid,
  worst_performing_site_id uuid,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, program_id, stat_date, stat_type)
);

-- 5. Create performance comparison table
CREATE TABLE performance_benchmarks (
  benchmark_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(company_id),
  benchmark_type varchar(50) NOT NULL, -- 'industry', 'internal', 'control'
  metric_name varchar(100) NOT NULL,
  metric_value numeric NOT NULL,
  unit varchar(50),
  conditions jsonb, -- Environmental conditions, site type, etc
  valid_from date NOT NULL,
  valid_to date,
  source varchar(200),
  created_at timestamptz DEFAULT now()
);

-- 6. Create indexes for common query patterns
CREATE INDEX idx_petri_growth_analysis 
  ON petri_observations(company_id, program_id, growth_index, created_at)
  WHERE growth_index IS NOT NULL;

CREATE INDEX idx_petri_phase_analysis 
  ON petri_observations(company_id, site_id, todays_day_of_phase, growth_index);

CREATE INDEX idx_gasifier_effectiveness 
  ON gasifier_observations(company_id, program_id, measure, created_at)
  WHERE measure IS NOT NULL;

-- 7. Create helper functions for phase detection
CREATE OR REPLACE FUNCTION get_phase_for_date(
  p_program_id uuid,
  p_date timestamptz
) RETURNS varchar AS $$
DECLARE
  v_phase_name varchar;
BEGIN
  SELECT phase->>'name' INTO v_phase_name
  FROM pilot_programs p,
  jsonb_array_elements(p.phases) as phase
  WHERE p.program_id = p_program_id
    AND (phase->>'start_date')::date <= p_date::date
    AND (phase->>'end_date')::date >= p_date::date
  LIMIT 1;
  
  RETURN v_phase_name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;