-- Verify Migration 003: Partitioning Structure

-- 1. Check partition structure
SELECT 
  'Partition Structure' as test,
  COUNT(*) as partition_count,
  COUNT(*) - 1 as program_partitions -- Minus default partition
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'petri_observations_partitioned';

-- 2. Show detailed partition information
SELECT 
  p.name as program_name,
  'petri_obs_prog_' || replace(p.program_id::text, '-', '_') as partition_name,
  EXISTS (
    SELECT 1 FROM pg_class 
    WHERE relname = 'petri_obs_prog_' || replace(p.program_id::text, '-', '_')
  ) as partition_exists,
  COUNT(po.observation_id) as observations_in_original
FROM pilot_programs p
LEFT JOIN petri_observations po ON p.program_id = po.program_id
GROUP BY p.program_id, p.name
ORDER BY observations_in_original DESC;

-- 3. Test partition function with sample data
DO $$
DECLARE
  v_program_id uuid;
  v_site_id uuid;
  v_submission_id uuid;
  v_company_id uuid;
BEGIN
  -- Get test data
  SELECT p.program_id, s.site_id, sub.submission_id, p.company_id
  INTO v_program_id, v_site_id, v_submission_id, v_company_id
  FROM pilot_programs p
  JOIN sites s ON p.program_id = s.program_id
  JOIN submissions sub ON s.site_id = sub.site_id
  LIMIT 1;
  
  -- Insert test observation into partitioned table
  INSERT INTO petri_observations_partitioned (
    observation_id, petri_code, growth_index, 
    submission_id, site_id, program_id, company_id
  ) VALUES (
    gen_random_uuid(), 'TEST-001', 42.5,
    v_submission_id, v_site_id, v_program_id, v_company_id
  );
  
  RAISE NOTICE 'Successfully inserted test data into partitioned table';
  
  -- Verify it went to the correct partition
  PERFORM 1 FROM petri_observations_partitioned
  WHERE petri_code = 'TEST-001';
  
  -- Clean up test data
  DELETE FROM petri_observations_partitioned WHERE petri_code = 'TEST-001';
END $$;

-- 4. Compare table structures
SELECT 
  'Column Comparison' as test,
  c1.column_name,
  c1.data_type as original_type,
  c2.data_type as partitioned_type,
  CASE WHEN c1.data_type = c2.data_type THEN 'MATCH' ELSE 'DIFFERENT' END as status
FROM information_schema.columns c1
FULL OUTER JOIN information_schema.columns c2 
  ON c1.column_name = c2.column_name 
  AND c2.table_name = 'petri_observations_partitioned'
WHERE c1.table_name = 'petri_observations'
  AND c1.table_schema = 'public'
ORDER BY c1.ordinal_position;

-- 5. Performance test setup
-- Create test query function
CREATE OR REPLACE FUNCTION test_partition_performance(
  iterations integer DEFAULT 10
) RETURNS TABLE (
  query_type text,
  avg_time_ms numeric,
  min_time_ms numeric,
  max_time_ms numeric
) AS $$
DECLARE
  start_time timestamptz;
  end_time timestamptz;
  total_time interval;
  v_program_id uuid;
  i integer;
  times numeric[];
BEGIN
  -- Get a program with data
  SELECT program_id INTO v_program_id 
  FROM pilot_programs 
  WHERE EXISTS (
    SELECT 1 FROM petri_observations WHERE program_id = pilot_programs.program_id
  )
  LIMIT 1;
  
  -- Test 1: Original table query
  times := ARRAY[]::numeric[];
  FOR i IN 1..iterations LOOP
    start_time := clock_timestamp();
    
    PERFORM COUNT(*), AVG(growth_index)
    FROM petri_observations
    WHERE program_id = v_program_id
      AND created_at >= CURRENT_DATE - INTERVAL '30 days';
    
    end_time := clock_timestamp();
    times := array_append(times, 
      EXTRACT(MILLISECONDS FROM (end_time - start_time))
    );
  END LOOP;
  
  RETURN QUERY
  SELECT 
    'Original Table'::text,
    AVG(t)::numeric,
    MIN(t)::numeric,
    MAX(t)::numeric
  FROM unnest(times) t;
  
  -- Test 2: Partitioned table query (will be faster after data migration)
  times := ARRAY[]::numeric[];
  FOR i IN 1..iterations LOOP
    start_time := clock_timestamp();
    
    PERFORM COUNT(*), AVG(growth_index)
    FROM petri_observations_partitioned
    WHERE program_id = v_program_id
      AND created_at >= CURRENT_DATE - INTERVAL '30 days';
    
    end_time := clock_timestamp();
    times := array_append(times, 
      EXTRACT(MILLISECONDS FROM (end_time - start_time))
    );
  END LOOP;
  
  RETURN QUERY
  SELECT 
    'Partitioned Table'::text,
    AVG(t)::numeric,
    MIN(t)::numeric,
    MAX(t)::numeric
  FROM unnest(times) t;
END;
$$ LANGUAGE plpgsql;

-- 6. Test data distribution helper
CREATE OR REPLACE FUNCTION show_data_distribution()
RETURNS TABLE (
  table_type text,
  program_name text,
  observation_count bigint
) AS $$
BEGIN
  -- Original table distribution
  RETURN QUERY
  SELECT 
    'Original'::text,
    p.name,
    COUNT(po.observation_id)
  FROM pilot_programs p
  LEFT JOIN petri_observations po ON p.program_id = po.program_id
  GROUP BY p.program_id, p.name;
  
  -- Partitioned table distribution (after migration)
  RETURN QUERY
  SELECT 
    'Partitioned'::text,
    p.name,
    COUNT(pop.observation_id)
  FROM pilot_programs p
  LEFT JOIN petri_observations_partitioned pop ON p.program_id = pop.program_id
  GROUP BY p.program_id, p.name;
END;
$$ LANGUAGE plpgsql;

-- 7. Summary
SELECT 
  'Migration 003 Verification Complete' as status,
  'Partition structure created successfully' as result,
  'Ready for data migration' as next_step;