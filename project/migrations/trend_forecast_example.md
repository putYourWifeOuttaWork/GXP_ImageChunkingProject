# Trend and Forecast Calculation Examples

## Trend Column

The trend combines momentum (acceleration/deceleration) with flow rate performance:

### Momentum Categories:
- **Rapidly accelerating ⬆️⬆️**: momentum > 1.0
- **Accelerating ⬆️**: momentum > 0.5
- **Slightly accelerating ↗️**: momentum > 0.1
- **Steady →**: momentum between -0.1 and 0.1
- **Slightly decelerating ↘️**: momentum > -0.5
- **Decelerating ⬇️**: momentum > -1.0
- **Rapidly decelerating ⬇️⬇️**: momentum <= -1.0

### Performance Categories (vs 1.0714 cm/day benchmark):
- **(Critical)**: flow_rate > 2.14 cm/day (2x target)
- **(High)**: flow_rate > 1.61 cm/day (1.5x target)
- **(Above target)**: flow_rate > 1.07 cm/day
- **(On target)**: flow_rate > 0.54 cm/day (0.5x target)
- **(Below target)**: flow_rate <= 0.54 cm/day

### Example Trends:
- "Accelerating ⬆️ (Critical)" - Getting faster and way above target
- "Steady → (On target)" - Maintaining good pace
- "Decelerating ⬇️ (Below target)" - Slowing down but already slow

## Forecasted Expiration Column

Formula: `forecasted_expiration = created_at + (linear_reading / flow_rate * 24) hours`

### Example:
- Day 1: 
  - linear_reading = 12 cm
  - flow_rate = 3 cm/day
  - Days to expiration = 12 / 3 = 4 days
  - forecasted_expiration = Day 1 + 4 days = Day 5

### Notes:
- Assumes constant flow rate (current rate continues)
- Updates with each observation as flow rate changes
- NULL if flow_rate is 0 or negative
- Provides timestamp precision (not just date)