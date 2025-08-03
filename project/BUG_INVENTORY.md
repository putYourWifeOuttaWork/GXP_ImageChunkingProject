# Bug Inventory & Known Issues

## Critical Bugs (Must fix before release)

### 1. Data Integrity Issues

#### 1.1 Facility Analytics Data Aggregation
- **Status**: 🔴 Open
- **Component**: FacilityAnalyticsViewer
- **Description**: Growth index calculations may be incorrect when multiple observations exist for same equipment/date
- **Impact**: Incorrect color coding on facility maps
- **Reproduction**: Create multiple observations for same petri dish on same day
- **Fix**: Implement proper aggregation logic (MAX or AVG)

#### 1.2 Dashboard Widget Data Loss
- **Status**: 🔴 Open
- **Component**: DashboardBuilderPage
- **Description**: Widget configurations sometimes lost during auto-save
- **Impact**: User loses widget settings
- **Reproduction**: Rapid editing of multiple widgets
- **Fix**: Implement proper debouncing and state management

### 2. Performance Bugs

#### 2.1 Report Builder Memory Leak
- **Status**: 🔴 Open
- **Component**: BaseChart.tsx
- **Description**: Chart components not properly cleaning up D3 instances
- **Impact**: Browser slowdown after extended use
- **Reproduction**: Switch between multiple chart types repeatedly
- **Fix**: Add proper cleanup in useEffect

#### 2.2 Large Dataset Rendering
- **Status**: 🔴 Open
- **Component**: TableVisualization, Charts
- **Description**: UI freezes with datasets > 10,000 rows
- **Impact**: Browser becomes unresponsive
- **Fix**: Implement virtualization and pagination

## High Priority Bugs

### 3. UI/UX Issues

#### 3.1 Chart Color Settings Not Persisting
- **Status**: 🟡 Partially Fixed
- **Component**: SaveReportModal, DashboardViewer
- **Description**: Custom color schemes reset to default
- **Impact**: User has to reconfigure colors
- **Note**: Fixed in reports, but issue persists in some dashboard scenarios

#### 3.2 Date Range Picker Edge Cases
- **Status**: 🔴 Open
- **Component**: Date filters in Report Builder
- **Description**: Selecting "Last 30 days" sometimes includes 31 days
- **Impact**: Incorrect data in reports

#### 3.3 Responsive Design Breaks
- **Status**: 🔴 Open
- **Component**: Dashboard viewer on mobile
- **Description**: Widgets overlap on small screens
- **Impact**: Unusable on mobile devices

### 4. Functionality Bugs

#### 4.1 Export Functions Incomplete
- **Status**: 🔴 Open
- **Component**: Report exports
- **Description**: CSV export missing some columns
- **Impact**: Incomplete data exports
- **Affected exports**: Excel, CSV

#### 4.2 Permission Check Failures
- **Status**: 🔴 Open
- **Component**: Report sharing
- **Description**: Shared reports sometimes show "Access Denied"
- **Impact**: Users can't access shared content
- **Root cause**: RLS policy conflicts

#### 4.3 Real-time Updates Not Working
- **Status**: 🔴 Open  
- **Component**: Dashboard auto-refresh
- **Description**: Widgets don't update when data changes
- **Impact**: Stale data shown to users

## Medium Priority Bugs

### 5. Visual Bugs

#### 5.1 Tooltip Positioning
- **Status**: 🔴 Open
- **Component**: All chart types
- **Description**: Tooltips appear off-screen near edges
- **Impact**: Information not visible

#### 5.2 Legend Overflow
- **Status**: 🔴 Open
- **Component**: Pie charts, donuts
- **Description**: Long legend items overlap
- **Impact**: Legends unreadable

#### 5.3 Grid Layout Issues
- **Status**: 🔴 Open
- **Component**: Dashboard grid
- **Description**: Widgets sometimes snap to wrong positions
- **Impact**: Layout appears broken

### 6. Data Handling Bugs

#### 6.1 Null Value Handling
- **Status**: 🔴 Open
- **Component**: Data aggregations
- **Description**: Null values cause "NaN" in calculations
- **Impact**: Broken visualizations

#### 6.2 Timezone Issues
- **Status**: 🔴 Open
- **Component**: Date/time displays
- **Description**: Inconsistent timezone handling
- **Impact**: Confusing time displays

## Low Priority Bugs

### 7. Cosmetic Issues

#### 7.1 Loading State Flickers
- **Status**: 🔴 Open
- **Description**: Brief flash of loading state on fast connections
- **Impact**: Minor visual annoyance

#### 7.2 Inconsistent Spacing
- **Status**: 🔴 Open
- **Description**: Padding/margins inconsistent across components
- **Impact**: Visual inconsistency

## Fixed Bugs (Resolved)

### ✅ Z-index Modal Issues
- **Status**: ✅ Fixed
- **Component**: All modals
- **Fix**: Implemented React Portals

### ✅ TableVisualization Hoisting Error
- **Status**: ✅ Fixed
- **Component**: TableVisualization.tsx
- **Fix**: Moved function declaration

### ✅ Metric Widgets Showing 0%
- **Status**: ✅ Fixed
- **Component**: DashboardViewer
- **Fix**: Used DataMetricWidget component

## Bug Priority Matrix

### 🚨 Release Blockers (Critical)
1. Data integrity issues (1.1, 1.2)
2. Performance issues causing crashes (2.1, 2.2)
3. Security/permission bugs (4.2)
4. Complete functionality failures

### ⚠️ Should Fix Soon (High)
1. UI breaking on mobile (3.3)
2. Data export issues (4.1)
3. Real-time updates (4.3)
4. Major visual bugs

### 📝 Nice to Fix (Medium/Low)
1. Tooltip positioning
2. Visual inconsistencies
3. Minor calculation issues
4. Cosmetic problems

## Testing Coverage Needed

### Critical Test Scenarios
1. Large dataset handling (>10k rows)
2. Concurrent user editing
3. Permission inheritance
4. Data aggregation accuracy
5. Export completeness
6. Mobile responsiveness

### Regression Test Areas
1. Report saving/loading
2. Dashboard widget state
3. Color settings persistence
4. Date range calculations
5. Real-time updates

## Recommended Fix Order

1. **Week 1 (Pre-release)**
   - Data integrity bugs
   - Performance crashes
   - Security issues
   - Mobile breaking bugs

2. **Week 2 (Post-release)**
   - Export functionality
   - Real-time updates
   - Major visual bugs

3. **Future Sprints**
   - Tooltip positioning
   - Visual polish
   - Minor enhancements