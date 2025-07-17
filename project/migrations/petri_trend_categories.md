# Petri Growth Trend Categories

## ENUM Type: `petri_trend_category`

### Categories and Criteria

| Category | Growth Velocity | Description | Action Required |
|----------|----------------|-------------|-----------------|
| `RAPID_GROWTH` | > 5.0/day | Exceptional growth rate | Monitor for optimization opportunities |
| `STRONG_GROWTH` | > 2.0/day | Excellent growth performance | Continue current conditions |
| `MODERATE_GROWTH` | > 0.5/day | Good, steady growth | Normal monitoring |
| `STABLE_GROWTH` | > 0.0/day | Slow but positive growth | Monitor closely |
| `STAGNANT` | = 0.0/day | No growth detected | Investigate conditions |
| `MODERATE_DECLINE` | > -2.0/day | Culture declining slowly | Review and adjust |
| `SIGNIFICANT_DECLINE` | ≤ -2.0/day | Rapid decline detected | Immediate intervention |
| `INSUFFICIENT_DATA` | NULL | Missing velocity data | Await more observations |

## Usage Example

```sql
-- Query cultures by trend performance
SELECT 
    petri_code,
    trend,
    COUNT(*) as occurrences
FROM petri_observations_partitioned
WHERE trend != 'INSUFFICIENT_DATA'
GROUP BY petri_code, trend
ORDER BY petri_code, trend;
```

## Benefits

1. **Type Safety**: ENUM ensures only valid categories
2. **Professional**: Clear, scientific terminology
3. **Actionable**: Each category suggests specific actions
4. **Comparable**: Easy to benchmark across experiments
5. **Alerting**: Can trigger automated monitoring alerts

## Alert Thresholds

- **CRITICAL**: Multiple SIGNIFICANT_DECLINE events
- **WARNING**: Prolonged STAGNANT periods (>3 observations)
- **ALERT**: Net negative average velocity
- **OK**: Normal growth patterns