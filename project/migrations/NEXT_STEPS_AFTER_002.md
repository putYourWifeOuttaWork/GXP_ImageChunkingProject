# Next Steps After Migration 002

## Immediate Actions

### 1. Verify the Migration
Run the verification script in your Supabase SQL editor:
```sql
-- Copy contents of verify_migration_002.sql
```

### 2. Refresh Materialized View
The materialized view needs to be populated with data:
```sql
REFRESH MATERIALIZED VIEW mv_daily_metrics;
```

### 3. Test Performance Improvements
Run the performance test script to see the speed improvements:
```sql
-- Copy contents of test_analytics_performance.sql
```

## Application Integration

### 1. Update TypeScript Types
Since we're in sandbox, generate types for the sandbox environment:
```bash
npx supabase gen types typescript --project-ref avjoiiqbampztgteqrph > src/types/supabase-sandbox.ts
```

### 2. Update Report Builder to Use New Views
The reporting module can now use:
- `mv_daily_metrics` - Pre-aggregated daily data (10-100x faster)
- `effectiveness_metrics` - ROI and effectiveness calculations
- `aggregate_program_stats` - Program-level statistics

### 3. Add Geographic Visualizations
Sites now have latitude/longitude, enabling:
- Map visualizations
- Geographic clustering analysis
- Climate-based performance comparisons

## Before Production Deployment

1. **Test Thoroughly in Sandbox**
   - Verify all queries work correctly
   - Check materialized view refresh performance
   - Test with production-like data volume

2. **Set Up Automated Refresh**
   - Materialized views need periodic refresh
   - Consider using pg_cron or Supabase Edge Functions
   - Recommended: Daily refresh at 2 AM

3. **Plan Partitioning Strategy**
   - Review Migration 003 for partitioning approach
   - Analyze your data distribution
   - Decide on partition boundaries

## Quick Wins for Executives

With Migration 002 complete, you can now build:

1. **Executive Dashboard** showing:
   - Total suppression rate across all programs
   - ROI by program and phase
   - Geographic heat map of effectiveness
   - Trend analysis with confidence intervals

2. **Investor Metrics** including:
   - Cost per acre treated
   - Damage prevention in dollars
   - Comparative effectiveness vs industry benchmarks
   - Scalability projections

3. **Real-time Analytics**:
   - Phase-by-phase effectiveness
   - Site performance rankings
   - Weather impact correlations
   - Predictive models for treatment success

## Migration 003 Preview

The next migration (003) will implement partitioning for:
- Even faster queries on large datasets
- Automatic data archival
- Simplified data retention policies
- Better parallel query execution

Ready to proceed when you are!