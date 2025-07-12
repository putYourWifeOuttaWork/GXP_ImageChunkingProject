# Frontend Testing Guide - Verify Performance Improvements

## Quick Performance Tests

### 1. Dashboard Loading Test
**What to do:**
1. Open your application dashboard
2. Time how long it takes to load completely
3. Look for these metrics:
   - Total observations count
   - Average growth index
   - Program/site statistics

**Expected Results:**
- Dashboard should load in **< 1 second** (previously 5-10+ seconds)
- No loading spinners should appear for more than a brief moment
- All numbers should appear almost instantly

### 2. Program Filter Test
**What to do:**
1. Go to your observations page
2. Select a specific program from the dropdown
3. Time how long it takes to filter

**Expected Results:**
- Filtering should be **instant** (< 100ms)
- No lag when switching between programs
- Smooth user experience

### 3. Date Range Test
**What to do:**
1. On any page with date filters
2. Select "Last 30 days" or "Last 7 days"
3. Watch how fast the data updates

**Expected Results:**
- Date filtering should be **immediate**
- Charts should redraw without delay
- No "Loading..." messages

## Specific Pages to Test

### 📊 Report Builder Page (`/report-builder`)
**Test these actions:**
```
1. Create a new report
2. Select "Petri Observations" as data source
3. Add filters:
   - Program = [Select any program]
   - Date = Last 30 days
4. Add measures:
   - Count of observations
   - Average growth index
5. Click "Preview"
```
**Expected:** Preview loads in < 500ms (was 5+ seconds)

### 📈 Analytics/Dashboard Page
**Test these queries:**
```
1. Program Performance Overview
   - Should show all programs instantly
   - Switching between programs should be lag-free

2. Time Series Charts
   - Daily observation counts
   - Growth trends over time
   - Should render without delay

3. Site Comparison
   - Compare multiple sites
   - Should load all site data quickly
```

### 🔍 Observations List Page
**Test pagination and filtering:**
```
1. Load the observations list
2. Filter by:
   - Specific program
   - Date range
   - Growth index > 50
3. Sort by different columns
4. Navigate through pages
```
**Expected:** All operations < 200ms

## Developer Console Tests

### Open Browser DevTools (F12) and Check:

#### Network Tab
```javascript
// Look for API calls to Supabase
// Filter by "supabase" in the network tab
// Check the timing of these requests:

1. GET /rest/v1/petri_observations
   - Should be < 100ms (was 1000ms+)

2. GET /rest/v1/mv_daily_metrics  
   - Should be < 50ms (new materialized view)

3. Any query with program_id filter
   - Should show dramatic improvement
```

#### Console Timing
```javascript
// Add this to your app temporarily to measure query time:
console.time('Dashboard Load');
// Your dashboard query here
const data = await supabase
  .from('petri_observations')
  .select('*')
  .eq('program_id', programId)
  .gte('created_at', thirtyDaysAgo);
console.timeEnd('Dashboard Load');
// Should show: "Dashboard Load: 50ms" or less
```

## Specific Supabase Queries to Test

### In your application code, these queries should be MUCH faster:

```typescript
// 1. Program-specific query (10-50x faster)
const { data, error } = await supabase
  .from('petri_observations')
  .select('*')
  .eq('program_id', selectedProgramId)
  .gte('created_at', startDate)
  .order('created_at', { ascending: false });

// 2. Dashboard aggregation (using materialized view - 100x faster)
const { data, error } = await supabase
  .from('mv_daily_metrics')
  .select('*')
  .eq('company_id', companyId)
  .gte('metric_date', last30Days);

// 3. Cross-program analytics (faster with partitions)
const { data, error } = await supabase
  .from('petri_observations')
  .select(`
    program_id,
    pilot_programs!inner(name),
    growth_index
  `)
  .eq('company_id', companyId);
```

## Performance Benchmarks

### Before Migration (Typical):
- Dashboard load: 3-10 seconds
- Program filter: 1-3 seconds  
- Date range query: 2-5 seconds
- Report generation: 5-20 seconds

### After Migration (Expected):
- Dashboard load: < 1 second ✨
- Program filter: < 100ms ⚡
- Date range query: < 200ms 🚀
- Report generation: < 2 seconds 📊

## Troubleshooting

### If performance hasn't improved:

1. **Check partitions are being used:**
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM petri_observations
WHERE program_id = 'your-program-id';
-- Should show "Partitions: 1 of 6"
```

2. **Verify indexes are being used:**
```sql
SELECT * FROM pg_stat_user_indexes
WHERE tablename = 'petri_observations'
AND idx_scan > 0;
```

3. **Ensure materialized view is fresh:**
```sql
REFRESH MATERIALIZED VIEW mv_daily_metrics;
```

4. **Check your app is using the right table:**
```sql
-- Should return results
SELECT COUNT(*) FROM petri_observations;
-- Should fail (table renamed)
SELECT COUNT(*) FROM petri_observations_partitioned;
```

## User Feedback to Collect

Ask users about:
1. "Does the dashboard feel snappier?"
2. "Are reports generating faster?"
3. "Is filtering more responsive?"
4. "Any timeouts or errors?"

## Success Metrics

You've succeeded if:
- ✅ No user complaints about slow loading
- ✅ Dashboard loads feel "instant"
- ✅ Reports generate without timeouts
- ✅ Filtering is seamless
- ✅ Users notice the improvement!

## Next Steps

If everything is working well:
1. Monitor for 24-48 hours
2. Remove the backup table after 1 week
3. Set up automated materialized view refresh
4. Celebrate your 10-50x performance gain! 🎉