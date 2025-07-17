# Momentum Calculation Example

## Formula
`momentum = current_flow_rate - previous_flow_rate`

## Interpretation
- **Positive momentum**: Consumption is accelerating (getting faster)
- **Negative momentum**: Consumption is decelerating (slowing down)
- **Zero momentum**: Steady consumption rate

## Example

Given a gasifier with observations:
- Day 0: flow_rate = 0.5 cm/day, momentum = 0 (first observation)
- Day 1: flow_rate = 0.75 cm/day, momentum = 0.75 - 0.5 = +0.25 (accelerating)
- Day 3: flow_rate = 0.6 cm/day, momentum = 0.6 - 0.75 = -0.15 (decelerating)
- Day 5: flow_rate = 0.8 cm/day, momentum = 0.8 - 0.6 = +0.2 (accelerating)

## Use Cases

1. **Quality Control**: Sudden positive momentum might indicate a problem (bag rupture, increased flow)
2. **Predictive Maintenance**: Consistent negative momentum might indicate clogging
3. **Performance Tracking**: Compare momentum patterns across different gasifiers
4. **Trend Analysis**: Average momentum shows if consumption is generally increasing or decreasing

## Notes
- First observation always has momentum = 0 (no previous data)
- Calculated per gasifier_code/program_id combination
- Stored in `linear_reduction_per_day` column (despite the name mismatch)