# Growth Velocity Calculation Example

## Formula
`growth_velocity = (current_growth_index - previous_growth_index) / days_between_observations`

## Key Points
- Calculated per petri_code/program_id combination
- First observation: velocity = growth_index / 1 day
- Subsequent observations: velocity = change in growth_index / days elapsed
- Can be positive (growth) or negative (decline)

## Example Calculation

Given observations for petri_code 'P1' in program 'X':
- Day 0: growth_index = 0, growth_velocity = 0 (first observation)
- Day 1: growth_index = 2.0, growth_velocity = (2.0 - 0) / 1 = 2.0 per day
- Day 3: growth_index = 5.5, growth_velocity = (5.5 - 2.0) / 2 = 1.75 per day
- Day 4: growth_index = 5.0, growth_velocity = (5.0 - 5.5) / 1 = -0.5 per day

## Interpretation
- **Positive velocity**: Culture is growing
- **Zero velocity**: No change in growth
- **Negative velocity**: Culture is declining (rare but possible)

## Growth Status Categories
- **Rapid growth**: velocity > 5
- **Strong growth**: velocity > 2
- **Positive growth**: velocity > 0
- **No change**: velocity = 0
- **Slight decline**: velocity > -2
- **Significant decline**: velocity ≤ -2