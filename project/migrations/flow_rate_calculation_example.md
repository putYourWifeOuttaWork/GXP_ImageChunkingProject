# Flow Rate Calculation Example

## Formula
`flow_rate = (15 - linear_reading) / days_elapsed`

Where:
- `15` = theoretical maximum height (starting point)
- `linear_reading` = current measure value
- `days_elapsed` = total days since the first observation (minimum 1)

## Benchmark
Target flow rate: **1.0714 cm/day** for a 2-week bag life

## Example Calculation

Given observations:
- Day 0: linear_reading = 14.5 cm
- Day 1: linear_reading = 13.5 cm
- Day 3: linear_reading = 11.1 cm

Flow rate calculations:
- Day 0: flow_rate = (15 - 14.5) / 1 = 0.5 / 1 = **0.5 cm/day**
- Day 1: flow_rate = (15 - 13.5) / 2 = 1.5 / 2 = **0.75 cm/day**
- Day 3: flow_rate = (15 - 11.1) / 4 = 3.9 / 4 = **0.975 cm/day**

This represents the average consumption rate from the start of the program to the current observation.

## Interpretation
- **Below 1.0714 cm/day**: Good - bag will last longer than 2 weeks
- **Above 1.0714 cm/day**: Bag will be consumed faster than 2 weeks
- **At 1.0714 cm/day**: Exactly 2-week bag life

## SQL Implementation

The flow rate is calculated using:
1. Find the first observation date for each gasifier
2. Calculate days elapsed (minimum 1 for day 0)
3. Divide linear_reduction_nominal by days elapsed

This gives us the current rate of material consumption, allowing us to predict bag life and compare against the benchmark.