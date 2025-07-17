# Growth Progression Calculation Example

## Formula
`growth_progression = current_growth_index - previous_growth_index`

## Key Points
- Calculated per petri_code/program_id combination
- Shows the **change** in growth_index between consecutive observations
- First observation: progression = growth_index (since there's no previous value)
- Can be positive (growth) or negative (decline)

## Example Calculation

Given observations for petri_code 'P1' in program 'X':
- Day 0: growth_index = 0, growth_progression = 0 (first observation)
- Day 1: growth_index = 10, growth_progression = 10 - 0 = 10
- Day 3: growth_index = 25, growth_progression = 25 - 10 = 15
- Day 5: growth_index = 30, growth_progression = 30 - 25 = 5
- Day 7: growth_index = 28, growth_progression = 28 - 30 = -2

## Relationship to Growth Velocity
- **Growth Progression**: Absolute change between observations (delta)
- **Growth Velocity**: Rate of change per day (delta/days)

Example:
- If progression = 10 over 2 days, velocity = 5 per day
- If progression = 10 over 1 day, velocity = 10 per day

## Interpretation
- **Positive progression**: Culture is growing
- **Zero progression**: No change since last observation
- **Negative progression**: Culture is declining

## Use Cases
1. **Daily Growth Tracking**: See exactly how much growth occurred each day
2. **Spike Detection**: Large progression values indicate rapid growth
3. **Decline Monitoring**: Negative values show when cultures are struggling
4. **Cumulative Analysis**: Sum of progressions = total growth from start