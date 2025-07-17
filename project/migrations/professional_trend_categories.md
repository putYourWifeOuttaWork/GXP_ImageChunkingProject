# Professional Trend Categories

## ENUM Type: `trend_category`

### Categories and Criteria

| Category | Momentum | Performance | Description | Action Required |
|----------|----------|-------------|-------------|-----------------|
| `CRITICAL_ACCELERATION` | > 0.5 cm/day² | > 1.5x target | Rapid consumption increase above target | Immediate intervention |
| `HIGH_ACCELERATION` | > 0.5 cm/day² | > 1.0x target | Significant consumption increase | Urgent review |
| `MODERATE_ACCELERATION` | > 0.1 cm/day² | Any | Moderate consumption increase | Monitor closely |
| `STABLE` | -0.1 to 0.1 cm/day² | Any | Stable consumption rate | Normal operation |
| `MODERATE_DECELERATION` | > -0.5 cm/day² | Any | Moderate consumption decrease | Positive trend |
| `HIGH_DECELERATION` | > -1.0 cm/day² | < 0.5x target | Significant consumption decrease | Verify no blockage |
| `CRITICAL_DECELERATION` | ≤ -1.0 cm/day² | Any | Extreme consumption decrease | Check for issues |
| `INSUFFICIENT_DATA` | NULL | NULL | Missing flow rate or momentum data | Await more data |

## Usage Example

```sql
-- Query trends with professional categories
SELECT 
    gasifier_code,
    trend_category,
    COUNT(*) as occurrences
FROM gasifier_observations_partitioned
WHERE trend_category != 'INSUFFICIENT_DATA'
GROUP BY gasifier_code, trend_category
ORDER BY gasifier_code, trend_category;
```

## Benefits

1. **Type Safety**: ENUM ensures only valid categories are stored
2. **Professional**: No emojis or informal language
3. **Actionable**: Each category implies specific actions
4. **Sortable**: Categories have implicit severity ordering
5. **Queryable**: Easy to filter and aggregate by category