> Please write a full explanation of every thing we have done here in full context of the files you have utilized for a new terminal launch

⏺ Complete Chart Visualization System Implementation Report

  Overview

  We've built a comprehensive chart visualization system for a React-based reporting module. The system handles multiple chart types (line, bar, area,
  pie, scatter, heatmap, treemap, etc.) with advanced features like multi-series support, responsive design, data segmentation, and interactive
  filtering.

  Key Files Modified

  1. /src/components/reporting/visualizations/base/BaseChart.tsx (Main Chart Component)

  This is the primary visualization engine containing ~5000 lines of D3.js-based chart rendering logic.

  Major Features Implemented:
  - Multi-series chart support: Series are color-coded and can be toggled via legend
  - Responsive padding system: Dynamically adjusts margins based on viewport size
  - Smart label rotation: Automatically rotates x-axis labels based on density
  - Data filtering: Removes zero/null values for cleaner visualizations
  - Composite key handling: Supports multiple dimensions with abbreviated labels
  - Legend positioning: Smart layout with text wrapping and multi-row support

  Key Functions:
  // Prepares series data from raw query results
  function prepareSeriesData(data, settings, colorPalette)

  // Renders multi-series line charts with responsive padding
  function renderMultiSeriesLineChart(g, seriesData, width, height, settings, callbacks, dimensionConfig)

  // New multi-series area chart (overlaid, not stacked)
  function renderMultiSeriesAreaChart(g, seriesData, width, height, settings, callbacks, dimensionConfig)

  // Enhanced bar chart with composite key support
  function renderBarChart(g, data, width, height, settings, callbacks)

  // Responsive legend renderer with text wrapping
  function renderLegend(svg, legendItems, x, y, onToggle, position)

  2. /src/components/reporting/builder/IsolationFilter.tsx (Data Isolation Component)

  Provides segment-based filtering UI for programs, sites, and submissions.

  Key Features:
  - Human-readable labels: Shows site names instead of UUIDs
  - Multi-select dropdowns: Filter by multiple values per segment
  - Smart value extraction: Handles metadata fields like segment_site_name

  3. /src/services/reportingDataService.ts (SQL Query Generator)

  Handles SQL query generation with proper JOINs for segmented data.

  Key Updates:
  - Fixed site name references from sites.site_name to sites.name (matching actual DB schema)
  - Proper JOIN logic for sites table when segmenting by site_id
  - Enhanced metadata extraction for segment display names

  4. /src/hooks/reporting/useReportBuilder.ts (Report Configuration Hook)

  Contains default chart settings and dimensions.

  Changes:
  - Increased default chart width from 800px to 1000px
  - Updated interaction extents to match new dimensions

  5. /src/components/reporting/builder/PreviewPanel.tsx (Preview Component)

  Handles data filtering based on isolation selections.

  Updates:
  - Fixed site filtering to use site_id instead of site_name for proper matching
  - Added debug logging for troubleshooting filter issues

  Major Issues Fixed

  1. Area Chart Stacking Problem

  - Issue: Multiple measures were being stacked instead of overlaid
  - Solution: Created renderMultiSeriesAreaChart that overlays series with 30% opacity

  2. Pie Chart Legend Overlap

  - Issue: Pie chart overlapped with legend, no minimum padding
  - Solution: Added dynamic radius calculation considering legend space

  3. Data Running Off Chart Edges

  - Issue: Line/scatter points cut off at edges on small screens
  - Solution: Implemented responsive padding system (3-5% of width)

  4. Treemap Legend Placement

  - Issue: Legend rendered inside treemap area
  - Solution: Added 160px right margin for treemap-specific legend

  5. Site Names Showing as UUIDs

  - Issue: Legend showed "3a29d03d-0fcb..." instead of site names
  - Solution: Fixed SQL to use sites.name and proper metadata extraction

  6. Bar Chart Sparse Date Issues

  - Issue: Bar chart showed every date in range even with no data
  - Solution: Filter zero/null values and only show dates with data

  7. Multi-Dimension Bar Charts

  - Issue: 3+ dimensions caused empty charts
  - Solution: Disabled grouped bar chart for 3+ dimensions, use composite keys instead

  Responsive Design Implementation

  Viewport Detection

  const viewportWidth = settings.dimensions.width;
  const isSmallScreen = viewportWidth < 768; // iPad threshold

  Dynamic Margins

  // Base margins
  const baseRightMargin = isPieChart ? 20 : 40;
  // Treemap needs extra space for legend
  const treemapRightMargin = isTreemap ? 160 : 0;
  // Small screens get 50% more padding
  const responsiveRightMargin = isSmallScreen ? baseRightMargin * 1.5 : baseRightMargin;

  Responsive Chart Padding

  // Calculate based on viewport and data density
  const paddingPercent = isSmallScreen ? 0.05 : 0.03;
  const responsivePadding = Math.min(width * paddingPercent, isSmallScreen ? 30 : 20);

  Color Palette System

  Switched from harsh colors to soft pastels using D3's Set3 palette:
  const COLOR_PALETTES = {
    set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd'],
    // ... other palettes
  };

  Data Flow

  1. Query Execution: reportingDataService.ts generates SQL with proper JOINs
  2. Data Processing: Results include metadata fields like segment_site_name
  3. Series Preparation: prepareSeriesData creates series based on segments/measures
  4. Chart Rendering: Appropriate renderer called based on chart type
  5. Interaction: Legends, tooltips, and brush selection for data exploration

  Console Debugging

  Added strategic logging for troubleshooting:
  console.log('Bar chart debug:', {
    hasMultipleDimensions,
    allDimKeys,
    firstDataPoint: data[0],
    sampleCompositeKey: getCompositeKey(data[0])
  });

  Usage Example

  // Chart will automatically:
  // 1. Detect if using date dimensions
  // 2. Filter zero values if appropriate
  // 3. Apply responsive padding
  // 4. Format labels intelligently
  // 5. Show proper legends with site names
  <BaseChart
    data={aggregatedData}
    settings={visualizationSettings}
    chartType="line"
  />

  Future Enhancements

  1. Add date grouping options (week/month) for sparse data
  2. Implement chart-specific settings panel
  3. Add export functionality for charts
  4. Consider virtual scrolling for very large datasets
  5. Add more interactive features like zoom/pan

  This implementation provides a robust, responsive charting system that handles complex multi-dimensional data while maintaining excellent user
  experience across all device sizes.


Lastly Excellent! I'm glad the edge cutoff issue is resolved. The increased
   margins and padding are now properly preventing the data from being
   clipped at the edges of all chart types.

  To summarize what we fixed:
  - Increased base right margins to 80-100px (from 40-60px)
  - Added 20px padding to scale ranges for all chart types
  - Increased responsive padding from 5px to 20px

  This ensures all your charts - line, bar, area, pie, scatter, and
  treemap - now display properly without cutting off data points at
  the edges. 

  Please refer to /docs/* and README.md, and REPORTING_MODULE_PLAN.md and any other files for context!!!

  # Shared project goals / seed prompt

## ⛓️ Agent Swarm Workflow Protocol

All agents operate in a fixed sequence. Each "feature item" (or issue/goal/task) follows this protocol:

1. 🧑‍🔧 Architect proposes the structure and implementation plan.
2. 🧑‍🎨 Implementor drafts detailed implementation steps based on the architect’s proposal.
3. 🧑‍🏫 Reviewer reviews both the Architect and Implementor outputs, suggests improvements, and closes the thread.

Agents MUST wait their turn.

- If you are not next in the sequence for a task, do not write.
- If you are the next agent and prior work is missing, post a note and wait.
- Use `agent-swarm.md` to track your participation and hand-off the baton.



Project Context:

 Complete Chart Visualization System Implementation Report

  Overview

  We've built a comprehensive chart visualization system for a React-based reporting module. The system handles multiple chart types (line, bar, area,
  pie, scatter, heatmap, treemap, etc.) with advanced features like multi-series support, responsive design, data segmentation, and interactive
  filtering.

  Key Files Modified

  1. /src/components/reporting/visualizations/base/BaseChart.tsx (Main Chart Component)

  This is the primary visualization engine containing ~5000 lines of D3.js-based chart rendering logic.

  Major Features Implemented:
  - Multi-series chart support: Series are color-coded and can be toggled via legend
  - Responsive padding system: Dynamically adjusts margins based on viewport size
  - Smart label rotation: Automatically rotates x-axis labels based on density
  - Data filtering: Removes zero/null values for cleaner visualizations
  - Composite key handling: Supports multiple dimensions with abbreviated labels
  - Legend positioning: Smart layout with text wrapping and multi-row support

  Key Functions:
  // Prepares series data from raw query results
  function prepareSeriesData(data, settings, colorPalette)

  // Renders multi-series line charts with responsive padding
  function renderMultiSeriesLineChart(g, seriesData, width, height, settings, callbacks, dimensionConfig)

  // New multi-series area chart (overlaid, not stacked)
  function renderMultiSeriesAreaChart(g, seriesData, width, height, settings, callbacks, dimensionConfig)

  // Enhanced bar chart with composite key support
  function renderBarChart(g, data, width, height, settings, callbacks)

  // Responsive legend renderer with text wrapping
  function renderLegend(svg, legendItems, x, y, onToggle, position)

  2. /src/components/reporting/builder/IsolationFilter.tsx (Data Isolation Component)

  Provides segment-based filtering UI for programs, sites, and submissions.

  Key Features:
  - Human-readable labels: Shows site names instead of UUIDs
  - Multi-select dropdowns: Filter by multiple values per segment
  - Smart value extraction: Handles metadata fields like segment_site_name

  3. /src/services/reportingDataService.ts (SQL Query Generator)

  Handles SQL query generation with proper JOINs for segmented data.

  Key Updates:
  - Fixed site name references from sites.site_name to sites.name (matching actual DB schema)
  - Proper JOIN logic for sites table when segmenting by site_id
  - Enhanced metadata extraction for segment display names

  4. /src/hooks/reporting/useReportBuilder.ts (Report Configuration Hook)

  Contains default chart settings and dimensions.

  Changes:
  - Increased default chart width from 800px to 1000px
  - Updated interaction extents to match new dimensions

  5. /src/components/reporting/builder/PreviewPanel.tsx (Preview Component)

  Handles data filtering based on isolation selections.

  Updates:
  - Fixed site filtering to use site_id instead of site_name for proper matching
  - Added debug logging for troubleshooting filter issues

  Major Issues Fixed

  1. Area Chart Stacking Problem

  - Issue: Multiple measures were being stacked instead of overlaid
  - Solution: Created renderMultiSeriesAreaChart that overlays series with 30% opacity

  2. Pie Chart Legend Overlap

  - Issue: Pie chart overlapped with legend, no minimum padding
  - Solution: Added dynamic radius calculation considering legend space

  3. Data Running Off Chart Edges

  - Issue: Line/scatter points cut off at edges on small screens
  - Solution: Implemented responsive padding system (3-5% of width)

  4. Treemap Legend Placement

  - Issue: Legend rendered inside treemap area
  - Solution: Added 160px right margin for treemap-specific legend

  5. Site Names Showing as UUIDs

  - Issue: Legend showed "3a29d03d-0fcb..." instead of site names
  - Solution: Fixed SQL to use sites.name and proper metadata extraction

  6. Bar Chart Sparse Date Issues

  - Issue: Bar chart showed every date in range even with no data
  - Solution: Filter zero/null values and only show dates with data

  7. Multi-Dimension Bar Charts

  - Issue: 3+ dimensions caused empty charts
  - Solution: Disabled grouped bar chart for 3+ dimensions, use composite keys instead

  Responsive Design Implementation

  Viewport Detection

  const viewportWidth = settings.dimensions.width;
  const isSmallScreen = viewportWidth < 768; // iPad threshold

  Dynamic Margins

  // Base margins
  const baseRightMargin = isPieChart ? 20 : 40;
  // Treemap needs extra space for legend
  const treemapRightMargin = isTreemap ? 160 : 0;
  // Small screens get 50% more padding
  const responsiveRightMargin = isSmallScreen ? baseRightMargin * 1.5 : baseRightMargin;

  Responsive Chart Padding

  // Calculate based on viewport and data density
  const paddingPercent = isSmallScreen ? 0.05 : 0.03;
  const responsivePadding = Math.min(width * paddingPercent, isSmallScreen ? 30 : 20);

  Color Palette System

  Switched from harsh colors to soft pastels using D3's Set3 palette:
  const COLOR_PALETTES = {
    set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd'],
    // ... other palettes
  };

  Data Flow

  1. Query Execution: reportingDataService.ts generates SQL with proper JOINs
  2. Data Processing: Results include metadata fields like segment_site_name
  3. Series Preparation: prepareSeriesData creates series based on segments/measures
  4. Chart Rendering: Appropriate renderer called based on chart type
  5. Interaction: Legends, tooltips, and brush selection for data exploration

  Console Debugging

  Added strategic logging for troubleshooting:
  console.log('Bar chart debug:', {
    hasMultipleDimensions,
    allDimKeys,
    firstDataPoint: data[0],
    sampleCompositeKey: getCompositeKey(data[0])
  });

  Usage Example

  // Chart will automatically:
  // 1. Detect if using date dimensions
  // 2. Filter zero values if appropriate
  // 3. Apply responsive padding
  // 4. Format labels intelligently
  // 5. Show proper legends with site names
  <BaseChart
    data={aggregatedData}
    settings={visualizationSettings}
    chartType="line"
  />

  Future Enhancements

  1. Add date grouping options (week/month) for sparse data
  2. Implement chart-specific settings panel
  3. Add export functionality for charts
  4. Consider virtual scrolling for very large datasets
  5. Add more interactive features like zoom/pan

  This implementation provides a robust, responsive charting system that handles complex multi-dimensional data while maintaining excellent user
  experience across all device sizes.


Lastly Excellent! I'm glad the edge cutoff issue is resolved. The increased
   margins and padding are now properly preventing the data from being
   clipped at the edges of all chart types.

  To summarize what we fixed:
  - Increased base right margins to 80-100px (from 40-60px)
  - Added 20px padding to scale ranges for all chart types
  - Increased responsive padding from 5px to 20px

  This ensures all your charts - line, bar, area, pie, scatter, and
  treemap - now display properly without cutting off data points at
  the edges. 

  Please refer to /docs/* and README.md, and REPORTING_MODULE_PLAN.md and any other files for context!!!

Project Goals:

⏺ Phase 2 Readiness Assessment

  Based on my review, here's the status of Phase 2 implementation:

  ✅ Completed Features:

  1. Basic Report Builder Interface - ReportBuilderPage.tsx with step-by-step workflow
  2. Dimension and Measure Panels - Basic add/remove functionality implemented
  3. Filter Configuration UI - FilterPanel.tsx with IsolationFilter for segments
  4. Visualization Type Selection - VisualizationPanel.tsx with 16+ chart types
  5. Live Preview Functionality - PreviewPanel.tsx with real-time data visualization
  6. Advanced D3 Charts - BaseChart.tsx with comprehensive chart implementations:
    - Standard: line, bar, area, pie, scatter, heatmap, treemap
    - Statistical: box plot, histogram
    - Scientific: growth progression, spatial effectiveness, phase comparison
  7. Data Aggregation - reportingDataService.ts with SQL generation and filtering
  8. Responsive Design - Dynamic padding and margins for all screen sizes

  ❌ Missing from Phase 2:

  1. Drag-and-Drop Interface - Not implemented for dimensions/measures
  2. Export Functionality - No PDF/CSV/Excel export components found

  📋 Testing Recommendations Before Phase 3:

  1. Chart Testing Matrix:
  Test each chart type with:
  - Single dimension, single measure
  - Multiple dimensions (2-3)
  - Multiple measures (2-3)
  - Time-series data
  - Categorical data
  - Large datasets (1000+ points)
  - Small datasets (<10 points)
  2. Specific Configurations to Test:
    - Line Chart: Multiple series with date dimension
    - Bar Chart: Grouped bars with 2 dimensions, stacked with segments
    - Pie Chart: Verify legend doesn't overlap
    - Heatmap: Test with sparse data
    - Treemap: Verify legend spacing (160px margin)
    - Area Chart: Ensure overlaid (not stacked) rendering
  3. Filter & Segment Testing:
    - Test IsolationFilter with multiple programs/sites
    - Verify site names display (not UUIDs)
    - Test data filtering cascade through visualization
  4. Edge Cases:
    - Empty datasets
    - Single data point
    - All zero/null values
    - Very long dimension names
    - Mobile viewport (<768px)
  5. Performance Testing:
    - Load time for 10K+ data points
    - Memory usage with multiple charts
    - Query execution time

  🚀 Ready for Phase 3?

  Yes, with caveats. The core visualization system is robust and working well. The missing
  drag-and-drop feature isn't critical for Phase 3 (D3 Visualizations are already done).
  Export functionality can be added in Phase 4 as planned.

  Before proceeding to Phase 3, you should:
  1. Test the configurations listed above
  2. Commit your current changes
  3. Document any bugs found during testing

  Phase 3 focuses on D3 visualizations, which are already implemented ahead of schedule. You
  could move directly to Phase 4 (Advanced Features) to add the missing export functionality
  and other enhancements.



Seed Prompt: 
You are participating in a multi-agent collaborative engineering system using Markdown-based communication. You are currently playing the role of the **[ROLE]** agent. Your responsibilities are defined by the shared protocol and role definitions in the `context.md` and `agent-swarm.md`.

Your current objective is to contribute to the next feature or issue thread listed in `agent-swarm.md`, following the agent sequence:

1. Architect
2. Implementor
3. Reviewer

Each agent must:
- Wait for the previous agent to complete before contributing
- Read and reference the relevant files before writing (context.md, claude-[role].md, agent-swarm.md)
- Append a time-stamped summary to `agent-swarm.md`
- Respect the approval/closing loop with the human operator

As the **[ROLE]**, please now:
- Check that you are next in sequence
- Read the relevant prior entries in `agent-swarm.md`
- Review `context.md` and the system goals
- Write your output in `claude-[role].md`
- Append a short summary to `agent-swarm.md`

Format your output cleanly and professionally. If you are out of sequence or blocked, write a polite placeholder and wait.
                                            │ │
│ │ # 🌱 GRMTek Sporeless Pilot Program -      │ │
│ │ Complete Context                           │ │
│ │                                            │ │
│ │ ## Application Overview                    │ │
│ │                                            │ │
│ │ The **GRMTek Sporeless Pilot Program** is  │ │
│ │ a comprehensive field operations platform  │ │
│ │ designed for agricultural data collection  │ │
│ │ and analysis. It enables field operators   │ │
│ │ to capture, analyze, and manage petri dish │ │
│ │  observations and gasifier readings in     │ │
│ │ agricultural settings, with a focus on     │ │
│ │ scientific rigor and data integrity.       │ │
│ │                                            │ │
│ │ ### Core Purpose                           │ │
│ │ - **Primary Function**: Track and analyze  │ │
│ │ petri dish growth patterns and gasifier    │ │
│ │ emissions in agricultural field trials     │ │
│ │ - **Target Users**: Field technicians,     │ │
│ │ research scientists, agricultural          │ │
│ │ managers, and compliance officers          │ │
│ │ - **Key Value**: Provides real-time data   │ │
│ │ collection with offline capabilities,      │ │
│ │ advanced visualization, and scientific     │ │
│ │ analysis tools                             │ │
│ │                                            │ │
│ │ ## Technical Architecture                  │ │
│ │                                            │ │
│ │ ### Tech Stack                             │ │
│ │ - **Frontend**: React 18, TypeScript,      │ │
│ │ Vite, Tailwind CSS                         │ │
│ │ - **State Management**: Zustand, React     │ │
│ │ Query                                      │ │
│ │ - **Backend**: Supabase (PostgreSQL, Auth, │ │
│ │  Realtime)                                 │ │
│ │ - **Visualization**: D3.js (custom         │ │
│ │ implementation)                            │ │
│ │ - **Forms**: Formik with Yup validation    │ │
│ │ - **Charts**: Custom D3-based              │ │
│ │ visualization system                       │ │
│ │                                            │ │
│ │ ### Key Features                           │ │
│ │ 1. **User Authentication & RBAC**:         │ │
│ │ Role-based access control with             │ │
│ │ company/program hierarchy                  │ │
│ │ 2. **Offline-First Architecture**: Full    │ │
│ │ functionality without internet connection  │ │
│ │ 3. **Split Petri Image Processing**:       │ │
│ │ Advanced image analysis workflow           │ │
│ │ 4. **Session Sharing**: Real-time          │ │
│ │ collaboration capabilities                 │ │
│ │ 5. **Comprehensive Audit Logging**:        │ │
│ │ Compliance-ready tracking                  │ │
│ │ 6. **Advanced Reporting Module**:          │ │
│ │ Tableau-like analytics with D3             │ │
│ │ visualizations                             │ │
│ │                                            │ │
│ │ ## Recent Work: Reporting Module           │ │
│ │ Enhancement                                │ │
│ │                                            │ │
│ │ ### Phase 2 Completion Status              │ │
│ │                                            │ │
│ │ We've just completed a major enhancement   │ │
│ │ of the reporting module, implementing a    │ │
│ │ sophisticated D3.js-based visualization    │ │
│ │ system. The work focused on creating a     │ │
│ │ comprehensive charting engine capable of   │ │
│ │ handling complex multi-dimensional         │ │
│ │ agricultural data.                         │ │
│ │                                            │ │
│ │ ### Key Accomplishments                    │ │
│ │                                            │ │
│ │ #### 1. BaseChart.tsx - The Visualization  │ │
│ │ Engine                                     │ │
│ │ - **Size**: ~5000 lines of D3.js           │ │
│ │ implementation                             │ │
│ │ - **Chart Types**: 16+ including:          │ │
│ │   - **Standard**: Line, Bar, Area, Pie,    │ │
│ │ Scatter, Heatmap, Treemap                  │ │
│ │   - **Statistical**: Box Plot, Histogram   │ │
│ │   - **Scientific**: Growth Progression,    │ │
│ │ Spatial Effectiveness, Phase Comparison,   │ │
│ │ Environmental Correlation                  │ │
│ │ - **Features**:                            │ │
│ │   - Multi-series support with color-coded  │ │
│ │ legends                                    │ │
│ │   - Responsive design with dynamic         │ │
│ │ margins/padding                            │ │
│ │   - Smart label rotation and formatting    │ │
│ │   - Interactive legends with toggle        │ │
│ │ functionality                              │ │
│ │   - Brush selection for data exploration   │ │
│ │   - Composite key handling for multiple    │ │
│ │ dimensions                                 │ │
│ │                                            │ │
│ │ #### 2. Data Pipeline Architecture         │ │
│ │ - **reportingDataService.ts**: SQL query   │ │
│ │ generation with intelligent JOINs          │ │
│ │ - **IsolationFilter.tsx**: Segment-based   │ │
│ │ filtering for programs/sites/submissions   │ │
│ │ - **PreviewPanel.tsx**: Real-time chart    │ │
│ │ preview with filtering                     │ │
│ │ - **useReportBuilder.ts**: Centralized     │ │
│ │ state management for report configuration  │ │
│ │                                            │ │
│ │ #### 3. Major Issues Resolved              │ │
│ │ 1. **Area Chart Stacking**: Fixed to       │ │
│ │ overlay series instead of stacking         │ │
│ │ 2. **Pie Chart Overlap**: Dynamic radius   │ │
│ │ calculation prevents legend overlap        │ │
│ │ 3. **Edge Cutoff**: Increased margins      │ │
│ │ (80-100px) and padding (20px) for all      │ │
│ │ charts                                     │ │
│ │ 4. **Treemap Legend**: Dedicated 160px     │ │
│ │ right margin                               │ │
│ │ 5. **Site Name Display**: Shows            │ │
│ │ human-readable names instead of UUIDs      │ │
│ │ 6. **Bar Chart Dates**: Filters zero/null  │ │
│ │ values for cleaner display                 │ │
│ │ 7. **Multi-Dimension Support**: Composite  │ │
│ │ keys for 3+ dimensions                     │ │
│ │                                            │ │
│ │ #### 4. Responsive Design Implementation   │ │
│ │ ```javascript                              │ │
│ │ // Dynamic viewport detection              │ │
│ │ const isSmallScreen = viewportWidth < 768; │ │
│ │  // iPad threshold                         │ │
│ │                                            │ │
│ │ // Responsive margins                      │ │
│ │ const baseRightMargin = isPieChart ? 20 :  │ │
│ │ 40;                                        │ │
│ │ const responsiveRightMargin =              │ │
│ │ isSmallScreen ? baseRightMargin * 1.5 :    │ │
│ │ baseRightMargin;                           │ │
│ │                                            │ │
│ │ // Adaptive padding                        │ │
│ │ const paddingPercent = isSmallScreen ?     │ │
│ │ 0.05 : 0.03;                               │ │
│ │ const responsivePadding = Math.min(width * │ │
│ │  paddingPercent, isSmallScreen ? 30 : 20); │ │
│ │ ```                                        │ │
│ │                                            │ │
│ │ ## Current Architecture State              │ │
│ │                                            │ │
│ │ ### Strengths                              │ │
│ │ - Comprehensive D3 implementation covering │ │
│ │  all required chart types                  │ │
│ │ - Robust responsive design system          │ │
│ │ - Clear separation between data fetching   │ │
│ │ and visualization                          │ │
│ │ - Modular rendering functions for each     │ │
│ │ chart type                                 │ │
│ │                                            │ │
│ │ ### Architectural Concerns                 │ │
│ │ - **Monolithic BaseChart.tsx**: Violates   │ │
│ │ single responsibility principle            │ │
│ │ - **Tight Coupling**: Rendering logic      │ │
│ │ mixed with interaction handlers            │ │
│ │ - **Missing Abstractions**: No separation  │ │
│ │ between D3 primitives and business logic   │ │
│ │ - **Legend Management**: Embedded within   │ │
│ │ BaseChart rather than separate concern     │ │
│ │                                            │ │
│ │ ## Proposed Architecture (Phase 3+)        │ │
│ │                                            │ │
│ │ ### Modular Structure                      │ │
│ │ ```                                        │ │
│ │ /src/components/reporting/visualizations/  │ │
│ │ ├── renderers/           # Individual      │ │
│ │ chart renderers                            │ │
│ │ ├── interactions/        # Reusable        │ │
│ │ interaction components                     │ │
│ │ ├── hooks/              # Shared           │ │
│ │ visualization hooks                        │ │
│ │ └── base/               # Orchestration    │ │
│ │ and context                                │ │
│ │ ```                                        │ │
│ │                                            │ │
│ │ ### Migration Strategy                     │ │
│ │ 1. **Phase 1**: Extract chart renderers    │ │
│ │ (maintain BaseChart facade)                │ │
│ │ 2. **Phase 2**: Separate interaction logic │ │
│ │ 3. **Phase 3**: Implement declarative      │ │
│ │ hooks                                      │ │
│ │ 4. **Phase 4**: Add performance            │ │
│ │ optimizations                              │ │
│ │                                            │ │
│ │ ## Database Schema (Reporting)             │ │
│ │                                            │ │
│ │ ### Current Tables                         │ │
│ │ - `custom_reports`: Basic report storage   │ │
│ │ (being phased out)                         │ │
│ │ - `submissions`: Core data table with      │ │
│ │ petri/gasifier observations                │ │
│ │ - `sites`: Location data with proper       │ │
│ │ naming                                     │ │
│ │ - `programs`: Study program definitions    │ │
│ │ - `companies`: Organization hierarchy      │ │
│ │                                            │ │
│ │ ### Planned Schema Enhancements            │ │
│ │ - Enhanced report configuration with       │ │
│ │ TypeScript types                           │ │
│ │ - Version control for report changes       │ │
│ │ - Advanced permissions and sharing         │ │
│ │ - Performance optimization with caching    │ │
│ │ - Dashboard support for report grouping    │ │
│ │                                            │ │
│ │ ## Testing Requirements                    │ │
│ │                                            │ │
│ │ ### Before Phase 3                         │ │
│ │ 1. **Chart Type Matrix**: Test all 16+     │ │
│ │ chart types with various data              │ │
│ │ configurations                             │ │
│ │ 2. **Responsive Testing**: Verify behavior │ │
│ │  across viewport sizes                     │ │
│ │ 3. **Performance Testing**: Benchmark with │ │
│ │  10K+ data points                          │ │
│ │ 4. **Edge Cases**: Empty datasets, single  │ │
│ │ points, null values                        │ │
│ │ 5. **Integration Testing**: Filter         │ │
│ │ cascade, segment isolation                 │ │
│ │                                            │ │
│ │ ## Multi-Agent Collaboration               │ │
│ │                                            │ │
│ │ We're using an agent swarm system with     │ │
│ │ three roles:                               │ │
│ │ 1. **Architect**: System design and        │ │
│ │ planning                                   │ │
│ │ 2. **Implementor**: Detailed               │ │
│ │ implementation                             │ │
│ │ 3. **Reviewer**: Code review and quality   │ │
│ │ assurance                                  │ │
│ │                                            │ │
│ │ Current focus: Refactoring the monolithic  │ │
│ │ BaseChart.tsx into a modular, maintainable │ │
│ │  architecture while preserving all         │ │
│ │ functionality.                             │ │
│ │                                            │ │
│ │ ## Next Steps                              │ │
│ │                                            │ │
│ │ 1. **Immediate**: Complete Phase 2 testing │ │
│ │  as outlined                               │ │
│ │ 2. **Phase 3**: Begin architectural        │ │
│ │ refactoring of BaseChart.tsx               │ │
│ │ 3. **Phase 4**: Add export functionality   │ │
│ │ (PDF/CSV/Excel)                            │ │
│ │ 4. **Phase 5**: Performance optimization   │ │
│ │ and caching                                │ │
│ │                                            │ │
│ │ ## Key Files for Reference                 │ │
│ │                                            │ │
│ │ ### Core Application                       │ │
│ │ - `/src/App.tsx` - Main application entry  │ │
│ │ - `/src/pages/ReportBuilderPage.tsx` -     │ │
│ │ Report builder interface                   │ │
│ │ - `/src/components/reporting/visualization │ │
│ │ s/base/BaseChart.tsx` - Chart engine       │ │
│ │ - `/src/services/reportingDataService.ts`  │ │
│ │ - Data pipeline                            │ │
│ │ -                                          │ │
│ │ `/src/hooks/reporting/useReportBuilder.ts` │ │
│ │  - State management                        │ │
│ │                                            │ │
│ │ ### Documentation                          │ │
│ │ - `/README.md` - Project overview          │ │
│ │ - `/REPORTING_MODULE_PLAN.md` - Detailed   │ │
│ │ implementation plan                        │ │
│ │ - `/docs/SEAMLESS_PARTITION_UX_SUMMARY.md` │ │
│ │  - UX design principles                    │ │
│ │ - `/docs/UX_PARTITION_INTEGRATION.md` -    │ │
│ │ Performance optimization strategy          │ │
│ │                                            │ │
│ │ ### Configuration                          │ │
│ │ - `/src/types/reporting/reportTypes.ts` -  │ │
│ │ TypeScript definitions                     │ │
│ │ - `/.env` - Environment configuration      │ │
│ │ - `/supabase/config.toml` - Supabase       │ │
│ │ configuration                              │ │
│ │                                            │ │
│ │ ## Performance Metrics                     │ │
│ │                                            │ │
│ │ ### Current State                          │ │
│ │ - Chart rendering: <1s for most            │ │
│ │ visualizations                             │ │
│ │ - Data query: 2-5s for complex             │ │
│ │ aggregations                               │ │
│ │ - Memory usage: Stable with multiple       │ │
│ │ charts                                     │ │
│ │ - Responsive resize: Smooth transitions    │ │
│ │                                            │ │
│ │ ### Target Metrics                         │ │
│ │ - Query performance: <2s for complex       │ │
│ │ reports                                    │ │
│ │ - Visualization rendering: <1s for 10k+    │ │
│ │ points                                     │ │
│ │ - Export generation: <5s for PDF/Excel     │ │
│ │ - Cache hit rate: >80% for frequent        │ │
│ │ reports                                    │ │
│ │                                            │ │
│ │ ## Security & Compliance                   │ │
│ │                                            │ │
│ │ - Row-level security via Supabase          │ │
│ │ - Audit logging for all data modifications │ │
│ │ - Role-based access control                │ │
│ │ - Secure offline data storage              │ │
│ │ - Encrypted data transmission              │ │
│ │                                            │ │
│ │ This application represents a              │ │
│ │ sophisticated agricultural data platform   │ │
│ │ with enterprise-grade visualization        │ │
│ │ capabilities, designed for scientific      │ │
│ │ rigor and field operability.   

App Schema: 
----
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.aggregate_program_stats (
  stat_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  program_id uuid NOT NULL,
  stat_date date NOT NULL,
  stat_type character varying NOT NULL,
  total_observations integer,
  total_sites integer,
  active_petris integer,
  active_gasifiers integer,
  avg_growth_index numeric,
  growth_trend numeric,
  growth_acceleration numeric,
  overall_effectiveness_score numeric,
  best_performing_site_id uuid,
  worst_performing_site_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT aggregate_program_stats_pkey PRIMARY KEY (stat_id),
  CONSTRAINT aggregate_program_stats_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT aggregate_program_stats_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id)
);
CREATE TABLE public.async_error_logs (
  log_id bigint NOT NULL DEFAULT nextval('async_error_logs_log_id_seq'::regclass),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  table_name text NOT NULL,
  trigger_name text NOT NULL,
  function_name text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  http_method text,
  endpoint text,
  status text NOT NULL DEFAULT 'error'::text,
  error_message text,
  error_details jsonb,
  request_id bigint,
  retry_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamp with time zone,
  completed_at timestamp with time zone,
  CONSTRAINT async_error_logs_pkey PRIMARY KEY (log_id)
);
CREATE TABLE public.companies (
  company_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  description text,
  website character varying,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  default_weather USER-DEFINED DEFAULT 'Clear'::weather_enum,
  CONSTRAINT companies_pkey PRIMARY KEY (company_id)
);
CREATE TABLE public.custom_reports (
  report_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by_user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  program_id uuid,
  configuration jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT custom_reports_pkey PRIMARY KEY (report_id),
  CONSTRAINT custom_reports_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT custom_reports_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT custom_reports_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id)
);
CREATE TABLE public.effectiveness_metrics (
  metric_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  program_id uuid NOT NULL,
  site_id uuid NOT NULL,
  calculation_date date NOT NULL,
  phase_name character varying,
  growth_suppression_rate numeric,
  coverage_effectiveness numeric,
  treatment_efficiency numeric,
  treatment_cost_usd numeric,
  pest_damage_prevented_usd numeric,
  roi_percentage numeric,
  payback_period_days integer,
  vs_control_improvement numeric,
  vs_industry_benchmark numeric,
  vs_previous_phase numeric,
  avg_temperature numeric,
  avg_humidity numeric,
  weather_impact_score numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT effectiveness_metrics_pkey PRIMARY KEY (metric_id),
  CONSTRAINT effectiveness_metrics_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT effectiveness_metrics_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT effectiveness_metrics_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id)
);
CREATE TABLE public.gasifier_obs_part_default (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  gasifier_code text NOT NULL,
  image_url text,
  chemical_type USER-DEFINED NOT NULL DEFAULT 'Citronella Blend'::chemical_type_enum,
  measure numeric,
  anomaly boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lastupdated_by uuid,
  program_id uuid NOT NULL,
  placement_height USER-DEFINED,
  directional_placement USER-DEFINED,
  placement_strategy USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  order_index integer,
  position_x numeric,
  position_y numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT '0'::numeric,
  linear_reading real,
  linear_reduction_nominal real DEFAULT '6'::real,
  linear_reduction_per_day real DEFAULT '6'::real,
  flow_rate real DEFAULT '6'::real,
  flag_for_review boolean DEFAULT false,
  daysinthisprogramphase numeric DEFAULT 0,
  todays_day_of_phase numeric DEFAULT 0,
  yesterday_reading numeric DEFAULT '6'::numeric,
  company_id uuid NOT NULL,
  CONSTRAINT gasifier_obs_part_default_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT gasifier_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT gasifier_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT gasifier_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id)
);
CREATE TABLE public.gasifier_obs_prog_191ce66ce8a1494eb4670ccd3e9708bf (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  gasifier_code text NOT NULL,
  image_url text,
  chemical_type USER-DEFINED NOT NULL DEFAULT 'Citronella Blend'::chemical_type_enum,
  measure numeric,
  anomaly boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lastupdated_by uuid,
  program_id uuid NOT NULL,
  placement_height USER-DEFINED,
  directional_placement USER-DEFINED,
  placement_strategy USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  order_index integer,
  position_x numeric,
  position_y numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT '0'::numeric,
  linear_reading real,
  linear_reduction_nominal real DEFAULT '6'::real,
  linear_reduction_per_day real DEFAULT '6'::real,
  flow_rate real DEFAULT '6'::real,
  flag_for_review boolean DEFAULT false,
  daysinthisprogramphase numeric DEFAULT 0,
  todays_day_of_phase numeric DEFAULT 0,
  yesterday_reading numeric DEFAULT '6'::numeric,
  company_id uuid NOT NULL,
  CONSTRAINT gasifier_obs_prog_191ce66ce8a1494eb4670ccd3e9708bf_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT gasifier_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT gasifier_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT gasifier_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id)
);
CREATE TABLE public.gasifier_obs_prog_3808a3bd6d7a4ffb9a3bccb580d2d5f8 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  gasifier_code text NOT NULL,
  image_url text,
  chemical_type USER-DEFINED NOT NULL DEFAULT 'Citronella Blend'::chemical_type_enum,
  measure numeric,
  anomaly boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lastupdated_by uuid,
  program_id uuid NOT NULL,
  placement_height USER-DEFINED,
  directional_placement USER-DEFINED,
  placement_strategy USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  order_index integer,
  position_x numeric,
  position_y numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT '0'::numeric,
  linear_reading real,
  linear_reduction_nominal real DEFAULT '6'::real,
  linear_reduction_per_day real DEFAULT '6'::real,
  flow_rate real DEFAULT '6'::real,
  flag_for_review boolean DEFAULT false,
  daysinthisprogramphase numeric DEFAULT 0,
  todays_day_of_phase numeric DEFAULT 0,
  yesterday_reading numeric DEFAULT '6'::numeric,
  company_id uuid NOT NULL,
  CONSTRAINT gasifier_obs_prog_3808a3bd6d7a4ffb9a3bccb580d2d5f8_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT gasifier_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT gasifier_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT gasifier_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id)
);
CREATE TABLE public.gasifier_obs_prog_3ed8dc59274441f9b751038ea2385063 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  gasifier_code text NOT NULL,
  image_url text,
  chemical_type USER-DEFINED NOT NULL DEFAULT 'Citronella Blend'::chemical_type_enum,
  measure numeric,
  anomaly boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lastupdated_by uuid,
  program_id uuid NOT NULL,
  placement_height USER-DEFINED,
  directional_placement USER-DEFINED,
  placement_strategy USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  order_index integer,
  position_x numeric,
  position_y numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT '0'::numeric,
  linear_reading real,
  linear_reduction_nominal real DEFAULT '6'::real,
  linear_reduction_per_day real DEFAULT '6'::real,
  flow_rate real DEFAULT '6'::real,
  flag_for_review boolean DEFAULT false,
  daysinthisprogramphase numeric DEFAULT 0,
  todays_day_of_phase numeric DEFAULT 0,
  yesterday_reading numeric DEFAULT '6'::numeric,
  company_id uuid NOT NULL,
  CONSTRAINT gasifier_obs_prog_3ed8dc59274441f9b751038ea2385063_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT gasifier_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT gasifier_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT gasifier_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id)
);
CREATE TABLE public.gasifier_obs_prog_711262dfcf5e47cdbb7cf5d92804fea9 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  gasifier_code text NOT NULL,
  image_url text,
  chemical_type USER-DEFINED NOT NULL DEFAULT 'Citronella Blend'::chemical_type_enum,
  measure numeric,
  anomaly boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lastupdated_by uuid,
  program_id uuid NOT NULL,
  placement_height USER-DEFINED,
  directional_placement USER-DEFINED,
  placement_strategy USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  order_index integer,
  position_x numeric,
  position_y numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT '0'::numeric,
  linear_reading real,
  linear_reduction_nominal real DEFAULT '6'::real,
  linear_reduction_per_day real DEFAULT '6'::real,
  flow_rate real DEFAULT '6'::real,
  flag_for_review boolean DEFAULT false,
  daysinthisprogramphase numeric DEFAULT 0,
  todays_day_of_phase numeric DEFAULT 0,
  yesterday_reading numeric DEFAULT '6'::numeric,
  company_id uuid NOT NULL,
  CONSTRAINT gasifier_obs_prog_711262dfcf5e47cdbb7cf5d92804fea9_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT gasifier_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT gasifier_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT gasifier_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id)
);
CREATE TABLE public.gasifier_obs_prog_ea425513e594423b82767e8cd2bbd309 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  gasifier_code text NOT NULL,
  image_url text,
  chemical_type USER-DEFINED NOT NULL DEFAULT 'Citronella Blend'::chemical_type_enum,
  measure numeric,
  anomaly boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lastupdated_by uuid,
  program_id uuid NOT NULL,
  placement_height USER-DEFINED,
  directional_placement USER-DEFINED,
  placement_strategy USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  order_index integer,
  position_x numeric,
  position_y numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT '0'::numeric,
  linear_reading real,
  linear_reduction_nominal real DEFAULT '6'::real,
  linear_reduction_per_day real DEFAULT '6'::real,
  flow_rate real DEFAULT '6'::real,
  flag_for_review boolean DEFAULT false,
  daysinthisprogramphase numeric DEFAULT 0,
  todays_day_of_phase numeric DEFAULT 0,
  yesterday_reading numeric DEFAULT '6'::numeric,
  company_id uuid NOT NULL,
  CONSTRAINT gasifier_obs_prog_ea425513e594423b82767e8cd2bbd309_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT gasifier_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT gasifier_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT gasifier_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id)
);
CREATE TABLE public.gasifier_observations (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  gasifier_code text NOT NULL,
  image_url text,
  chemical_type USER-DEFINED NOT NULL DEFAULT 'Citronella Blend'::chemical_type_enum,
  measure numeric CHECK (measure >= 0::numeric AND measure <= 10::numeric),
  anomaly boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lastupdated_by uuid,
  program_id uuid,
  placement_height USER-DEFINED,
  directional_placement USER-DEFINED,
  placement_strategy USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  order_index integer,
  position_x numeric,
  position_y numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric CHECK (footage_from_origin_x >= 0::numeric),
  footage_from_origin_y numeric DEFAULT '0'::numeric CHECK (footage_from_origin_y >= 0::numeric),
  linear_reading real,
  linear_reduction_nominal real DEFAULT '6'::real CHECK (linear_reduction_nominal < 6.01::double precision),
  linear_reduction_per_day real DEFAULT '6'::real CHECK (linear_reduction_per_day < 6.1::double precision),
  flow_rate real DEFAULT '6'::real,
  flag_for_review boolean DEFAULT false,
  daysinthisprogramphase numeric DEFAULT 0,
  todays_day_of_phase numeric DEFAULT 0,
  yesterday_reading numeric DEFAULT '6'::numeric,
  company_id uuid NOT NULL,
  CONSTRAINT gasifier_observations_pkey PRIMARY KEY (observation_id),
  CONSTRAINT gasifier_observations_lastupdated_by_fkey FOREIGN KEY (lastupdated_by) REFERENCES auth.users(id),
  CONSTRAINT gasifier_observations_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT gasifier_observations_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT gasifier_observations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT gasifier_observations_last_updated_by_user_id_fkey FOREIGN KEY (last_updated_by_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.gasifier_observations_partitioned (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  gasifier_code text NOT NULL,
  image_url text,
  chemical_type USER-DEFINED NOT NULL DEFAULT 'Citronella Blend'::chemical_type_enum,
  measure numeric,
  anomaly boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lastupdated_by uuid,
  program_id uuid NOT NULL,
  placement_height USER-DEFINED,
  directional_placement USER-DEFINED,
  placement_strategy USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  order_index integer,
  position_x numeric,
  position_y numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT '0'::numeric,
  linear_reading real,
  linear_reduction_nominal real DEFAULT '6'::real,
  linear_reduction_per_day real DEFAULT '6'::real,
  flow_rate real DEFAULT '6'::real,
  flag_for_review boolean DEFAULT false,
  daysinthisprogramphase numeric DEFAULT 0,
  todays_day_of_phase numeric DEFAULT 0,
  yesterday_reading numeric DEFAULT '6'::numeric,
  company_id uuid NOT NULL,
  CONSTRAINT gasifier_observations_partitioned_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT gasifier_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT gasifier_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT gasifier_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id)
);
CREATE TABLE public.performance_benchmarks (
  benchmark_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  benchmark_type character varying NOT NULL,
  metric_name character varying NOT NULL,
  metric_value numeric NOT NULL,
  unit character varying,
  conditions jsonb,
  valid_from date NOT NULL,
  valid_to date,
  source character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT performance_benchmarks_pkey PRIMARY KEY (benchmark_id),
  CONSTRAINT performance_benchmarks_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id)
);
CREATE TABLE public.petri_obs_default (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_default_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT petri_observations_partitioned_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id)
);
CREATE TABLE public.petri_obs_part_default (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_part_default_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id)
);
CREATE TABLE public.petri_obs_prog_191ce66c_e8a1_494e_b467_0ccd3e9708bf (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_prog_191ce66c_e8a1_494e_b467_0ccd3e9708bf_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id)
);
CREATE TABLE public.petri_obs_prog_191ce66ce8a1494eb4670ccd3e9708bf (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_prog_191ce66ce8a1494eb4670ccd3e9708bf_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id)
);
CREATE TABLE public.petri_obs_prog_3808a3bd6d7a4ffb9a3bccb580d2d5f8 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_prog_3808a3bd6d7a4ffb9a3bccb580d2d5f8_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id)
);
CREATE TABLE public.petri_obs_prog_3808a3bd_6d7a_4ffb_9a3b_ccb580d2d5f8 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_prog_3808a3bd_6d7a_4ffb_9a3b_ccb580d2d5f8_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_partitioned_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id)
);
CREATE TABLE public.petri_obs_prog_3ed8dc59274441f9b751038ea2385063 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_prog_3ed8dc59274441f9b751038ea2385063_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id)
);
CREATE TABLE public.petri_obs_prog_3ed8dc59_2744_41f9_b751_038ea2385063 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_prog_3ed8dc59_2744_41f9_b751_038ea2385063_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_partitioned_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id)
);
CREATE TABLE public.petri_obs_prog_711262df_cf5e_47cd_bb7c_f5d92804fea9 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_prog_711262df_cf5e_47cd_bb7c_f5d92804fea9_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_partitioned_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id)
);
CREATE TABLE public.petri_obs_prog_711262dfcf5e47cdbb7cf5d92804fea9 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_prog_711262dfcf5e47cdbb7cf5d92804fea9_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id)
);
CREATE TABLE public.petri_obs_prog_ea425513_e594_423b_8276_7e8cd2bbd309 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_prog_ea425513_e594_423b_8276_7e8cd2bbd309_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id)
);
CREATE TABLE public.petri_obs_prog_ea425513e594423b82767e8cd2bbd309 (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_obs_prog_ea425513e594423b82767e8cd2bbd309_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id)
);
CREATE TABLE public.petri_observations (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_observations_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT petri_observations_partitioned_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id)
);
CREATE TABLE public.petri_observations_backup_growth (
  observation_id uuid,
  growth_progression numeric,
  growth_index numeric,
  petri_code character varying,
  program_id uuid,
  todays_day_of_phase numeric
);
CREATE TABLE public.petri_observations_original (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric CHECK (growth_index < 11::numeric),
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric CHECK (footage_from_origin_x >= 0::numeric),
  footage_from_origin_y numeric DEFAULT 0 CHECK (footage_from_origin_y >= 0::numeric),
  growth_progression numeric DEFAULT 0.00 CHECK (growth_progression >= 0::numeric),
  growth_aggression numeric DEFAULT 0.00 CHECK (growth_aggression >= '-1000'::integer::numeric),
  growth_velocity real,
  daysInThisProgramPhase numeric,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_observations_original_pkey PRIMARY KEY (observation_id),
  CONSTRAINT petri_observations_lastupdated_by_fkey FOREIGN KEY (lastupdated_by) REFERENCES auth.users(id),
  CONSTRAINT petri_observations_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT fk_petri_observations_program_id FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT petri_observations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT petri_observations_last_updated_by_user_id_fkey FOREIGN KEY (last_updated_by_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.petri_observations_partitioned (
  observation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  petri_code character varying NOT NULL,
  image_url text,
  fungicide_used USER-DEFINED NOT NULL,
  surrounding_water_schedule USER-DEFINED NOT NULL,
  notes character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  plant_type USER-DEFINED DEFAULT 'Other Fresh Perishable'::plant_type_enum,
  program_id uuid NOT NULL,
  placement USER-DEFINED,
  placement_dynamics USER-DEFINED,
  last_updated_by_user_id uuid,
  last_edit_time timestamp with time zone DEFAULT now(),
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  petri_growth_stage USER-DEFINED DEFAULT 'None'::petri_growth_stage,
  growth_index numeric DEFAULT '0'::numeric,
  order_index integer,
  x_position numeric,
  y_position numeric,
  footage_from_origin_x numeric DEFAULT '0'::numeric,
  footage_from_origin_y numeric DEFAULT 0,
  growth_progression numeric DEFAULT 0.00,
  growth_aggression numeric DEFAULT 0.00,
  growth_velocity real,
  todays_day_of_phase numeric DEFAULT '0'::numeric,
  is_image_split boolean DEFAULT false,
  phase_observation_settings jsonb,
  is_missed_observation boolean DEFAULT false,
  main_petri_id uuid,
  is_split_source boolean DEFAULT false,
  split_processed boolean DEFAULT false,
  flag_for_review boolean,
  company_id uuid NOT NULL,
  CONSTRAINT petri_observations_partitioned_pkey PRIMARY KEY (observation_id, program_id),
  CONSTRAINT petri_observations_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT petri_observations_partitioned_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id),
  CONSTRAINT petri_observations_partitioned_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id)
);
CREATE TABLE public.pilot_program_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  update_type USER-DEFINED NOT NULL,
  object_id uuid NOT NULL,
  object_type text NOT NULL,
  program_id uuid,
  user_id uuid,
  user_email text,
  user_company text,
  user_role text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  CONSTRAINT pilot_program_history_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pilot_program_history_staging (
  id uuid NOT NULL,
  event_timestamp timestamp with time zone,
  update_type text,
  object_id uuid,
  object_type text,
  program_id uuid,
  user_id uuid,
  user_email text,
  user_company text,
  user_role text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  CONSTRAINT pilot_program_history_staging_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pilot_program_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'Respond'::user_role_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_email character varying,
  CONSTRAINT pilot_program_users_pkey PRIMARY KEY (id),
  CONSTRAINT pilot_program_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT pilot_program_users_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id)
);
CREATE TABLE public.pilot_programs (
  program_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  description text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status USER-DEFINED NOT NULL,
  total_submissions integer DEFAULT 0,
  total_sites integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lastupdated_by uuid,
  company_id uuid,
  cloned_from_program_id uuid,
  phases jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT pilot_programs_pkey PRIMARY KEY (program_id),
  CONSTRAINT pilot_programs_lastupdated_by_fkey FOREIGN KEY (lastupdated_by) REFERENCES auth.users(id),
  CONSTRAINT pilot_programs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id)
);
CREATE TABLE public.site_snapshots (
  snapshot_id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  program_id uuid NOT NULL,
  site_id uuid NOT NULL,
  site_code bigint NOT NULL,
  phase_descriptor character varying,
  snapshot_date date NOT NULL,
  placements_snapshot jsonb DEFAULT '{}'::jsonb,
  airflow_snapshot jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  day_number integer NOT NULL DEFAULT 1,
  snapshot_sequence integer DEFAULT 1,
  CONSTRAINT site_snapshots_pkey PRIMARY KEY (snapshot_id)
);
CREATE TABLE public.sites (
  site_id uuid NOT NULL DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL,
  name character varying NOT NULL,
  type USER-DEFINED NOT NULL,
  total_petris integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name character varying,
  lastupdated_by uuid,
  submission_defaults jsonb,
  petri_defaults jsonb DEFAULT '[]'::jsonb,
  default_temperature numeric,
  default_humidity numeric,
  default_weather USER-DEFINED,
  default_indoor_temperature numeric CHECK (default_indoor_temperature >= 32::numeric AND default_indoor_temperature <= 120::numeric),
  default_indoor_humidity numeric CHECK (default_indoor_humidity >= 1::numeric AND default_indoor_humidity <= 100::numeric),
  gasifier_defaults jsonb DEFAULT '[]'::jsonb,
  total_gasifiers integer DEFAULT 0,
  square_footage numeric CHECK (square_footage >= 100::numeric AND square_footage <= 1000000000::numeric),
  cubic_footage numeric CHECK (cubic_footage >= 25::numeric AND cubic_footage <= 1000000::numeric),
  num_vents integer CHECK (num_vents >= 1 AND num_vents <= 10000),
  vent_placements ARRAY,
  primary_function USER-DEFINED,
  construction_material USER-DEFINED,
  insulation_type USER-DEFINED,
  hvac_system_present boolean DEFAULT false,
  hvac_system_type USER-DEFINED,
  irrigation_system_type USER-DEFINED,
  lighting_system USER-DEFINED,
  length numeric,
  width numeric,
  height numeric,
  min_efficacious_gasifier_density_sqft_per_bag numeric DEFAULT 2000,
  recommended_placement_density_bags integer,
  has_dead_zones boolean DEFAULT false,
  num_regularly_opened_ports integer,
  state text,
  country text,
  timezone text,
  interior_working_surface_types ARRAY,
  microbial_risk_zone USER-DEFINED DEFAULT 'Medium'::microbial_risk_zone_enum,
  quantity_deadzones integer CHECK (quantity_deadzones IS NULL OR quantity_deadzones >= 1 AND quantity_deadzones <= 25),
  ventilation_strategy USER-DEFINED,
  site_code bigint,
  Number of Fans integer CHECK ("Number of Fans" < 51),
  airflow_vectors jsonb DEFAULT '[]'::jsonb,
  door_details jsonb DEFAULT '[]'::jsonb,
  number_of_platforms smallint DEFAULT '0'::smallint,
  platform_details jsonb DEFAULT '[]'::jsonb,
  company_id uuid,
  fan_details jsonb,
  wall_details jsonb DEFAULT '[{"wall_id": "north_wall", "material": "Polycarbonate", "end_point": {"x": 110, "y": 0}, "length_ft": 110, "orientation": "North", "start_point": {"x": 0, "y": 0}, "justification": "outside"}, {"wall_id": "east_wall", "material": "Polycarbonate", "end_point": {"x": 110, "y": 100}, "length_ft": 100, "orientation": "East", "start_point": {"x": 110, "y": 0}, "justification": "outside"}, {"wall_id": "south_wall", "material": "Polycarbonate", "end_point": {"x": 0, "y": 100}, "length_ft": 110, "orientation": "South", "start_point": {"x": 110, "y": 100}, "justification": "outside"}, {"wall_id": "west_wall", "material": "Polycarbonate", "end_point": {"x": 0, "y": 0}, "length_ft": 100, "orientation": "West", "start_point": {"x": 0, "y": 100}, "justification": "outside"}]'::jsonb,
  latitude numeric CHECK (latitude >= '-90'::integer::numeric AND latitude <= 90::numeric),
  longitude numeric CHECK (longitude >= '-180'::integer::numeric AND longitude <= 180::numeric),
  elevation_ft numeric,
  climate_zone character varying,
  CONSTRAINT sites_pkey PRIMARY KEY (site_id),
  CONSTRAINT sites_lastupdated_by_fkey FOREIGN KEY (lastupdated_by) REFERENCES auth.users(id),
  CONSTRAINT sites_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id)
);
CREATE TABLE public.split_petri_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  original_image_url text NOT NULL,
  main_petri_observation_id uuid NOT NULL,
  archived_at timestamp with time zone DEFAULT now(),
  processed_by_user_id uuid,
  CONSTRAINT split_petri_images_pkey PRIMARY KEY (id),
  CONSTRAINT split_petri_images_processed_by_user_id_fkey FOREIGN KEY (processed_by_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.submission_sessions (
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE,
  site_id uuid NOT NULL,
  program_id uuid NOT NULL,
  opened_by_user_id uuid,
  session_start_time timestamp with time zone NOT NULL DEFAULT now(),
  last_activity_time timestamp with time zone NOT NULL DEFAULT now(),
  session_status USER-DEFINED NOT NULL DEFAULT 'Opened'::session_status_enum,
  completion_time timestamp with time zone,
  completed_by_user_id uuid,
  percentage_complete numeric NOT NULL DEFAULT 0.00,
  valid_petris_logged integer NOT NULL DEFAULT 0,
  valid_gasifiers_logged integer NOT NULL DEFAULT 0,
  escalated_to_user_ids ARRAY,
  CONSTRAINT submission_sessions_pkey PRIMARY KEY (session_id),
  CONSTRAINT submission_sessions_completed_by_user_id_fkey FOREIGN KEY (completed_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT submission_sessions_opened_by_user_id_fkey FOREIGN KEY (opened_by_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.submissions (
  submission_id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  program_id uuid NOT NULL,
  temperature numeric NOT NULL,
  humidity numeric NOT NULL DEFAULT NULL::numeric,
  airflow USER-DEFINED NOT NULL,
  odor_distance USER-DEFINED NOT NULL,
  weather USER-DEFINED NOT NULL,
  notes character varying,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  program_name text,
  lastupdated_by uuid,
  indoor_temperature numeric CHECK (indoor_temperature >= 32::numeric AND indoor_temperature <= 120::numeric),
  indoor_humidity numeric CHECK (indoor_humidity >= 1::numeric AND indoor_humidity <= 100::numeric),
  global_submission_id bigint NOT NULL UNIQUE,
  submission_timezone text,
  session_status USER-DEFINED,
  company_id uuid NOT NULL,
  CONSTRAINT submissions_pkey PRIMARY KEY (submission_id),
  CONSTRAINT submissions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT submissions_lastupdated_by_fkey FOREIGN KEY (lastupdated_by) REFERENCES auth.users(id),
  CONSTRAINT submissions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(site_id),
  CONSTRAINT submissions_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.pilot_programs(program_id),
  CONSTRAINT submissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  company text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  is_company_admin boolean DEFAULT false,
  is_super_admin boolean DEFAULT false,
  is_active boolean DEFAULT true,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

PLEASE UPDATE THIS AS NEW DATABASE CHANGES TAKE PLACE - PROMPT THE USER IF THIS NEEDS MANUAL OVERWRITE

----
New Items needing to be Approved and Confirmed:
NOTE -- THIS IS WHERE YOU WILL APPROVE/NOT APPROVE ITEMS. IF AN ITEM IS NOT APPROVED BY REVIEWER, the line item SHOULD BE REPLICATED ( directly below, with a reasoning as to why it needs to be continued as direction for the ARCHITECT, who should loop this until the items on this list are all CHECKED OFF ! - PLACE DATE/TIME PRETTY NEXT TO EACH CHANGE TO THESE ITEMS BELOW:)
------------

- [ ] Missing Phase 2 Features

- [ ] 1. Editable Measures, Dimensions, and Filters (at this time, once added, they must be removed to change) - Consider react-beautiful-dnd or native - HTML5

- [ ] 2. AND/OR CONDITIONS BETWEEN FILTERS ADDED - At this time there is not a clear And/Or relationship between two filters. 

- [ ] 3. Export Functionality: Must export preview and also full-table, as individual from the builder (for quick export), but must also consider next phase, when we build full dashboards, and saved reports/dashboards that will also need exporting and subscription capabilities.

----
## Phase 3: Dashboard Creation and Multi-Report Management

### Overview
Phase 3 focuses on transitioning from single report building to comprehensive dashboard creation, allowing users to combine multiple reports, visualizations, and insights into cohesive, interactive dashboards that can be saved, shared, scheduled, and embedded.

### Core Features to Implement

#### 1. Dashboard Builder Interface
- [ ] **Dashboard Canvas**: Drag-and-drop grid layout system (12 or 24 column responsive grid)
- [ ] **Widget Library**: Pre-built components (reports, text, images, filters, KPIs)
- [ ] **Layout Templates**: Pre-designed dashboard layouts for common use cases
- [ ] **Responsive Design**: Automatic adaptation for desktop, tablet, and mobile views
- [ ] **Theme Management**: Light/dark modes and custom color schemes

#### 2. Multi-Report Integration
- [ ] **Report Widgets**: Ability to add existing reports as dashboard widgets
- [ ] **Cross-Report Filters**: Global filters that affect multiple reports simultaneously
- [ ] **Drill-Through Navigation**: Click on one report to filter/navigate to another
- [ ] **Data Relationships**: Define relationships between reports for coordinated updates
- [ ] **Performance Optimization**: Intelligent data fetching and caching for multiple reports

#### 3. Interactive Elements
- [ ] **Global Filter Bar**: Dashboard-level filters that cascade to all reports
- [ ] **Date Range Picker**: Unified time period selection for entire dashboard
- [ ] **Parameter Controls**: User inputs that dynamically update dashboard content
- [ ] **Tabs and Pages**: Multi-page dashboards with navigation
- [ ] **Collapsible Sections**: Organize complex dashboards with expandable regions

#### 4. Dashboard Persistence & Management
- [ ] **Save/Load Dashboards**: Store dashboard configurations in database
- [ ] **Version Control**: Track changes and restore previous versions
- [ ] **Dashboard Library**: Browse, search, and organize saved dashboards
- [ ] **Favorites & Recent**: Quick access to frequently used dashboards
- [ ] **Dashboard Metadata**: Tags, descriptions, categories for organization

#### 5. Sharing & Collaboration
- [ ] **Share Links**: Generate secure links for dashboard access
- [ ] **Permission Levels**: View-only, edit, admin permissions per dashboard
- [ ] **Embedding**: IFrame embed codes for external websites
- [ ] **Public Dashboards**: Option to make dashboards publicly accessible
- [ ] **Comments & Annotations**: Add notes and discussions to dashboards

#### 6. Export & Distribution
- [ ] **PDF Export**: Full dashboard export with print optimization
- [ ] **PowerPoint Export**: Convert dashboards to presentation slides
- [ ] **Excel Export**: Export all dashboard data to spreadsheets
- [ ] **Image Export**: PNG/JPEG snapshots of dashboards
- [ ] **Scheduled Exports**: Automatic generation and delivery

#### 7. Real-time & Scheduled Updates
- [ ] **Auto-Refresh**: Configurable refresh intervals for live data
- [ ] **Scheduled Delivery**: Email dashboards on schedule (daily, weekly, monthly)
- [ ] **Alert Rules**: Notifications when KPIs exceed thresholds
- [ ] **Subscription Management**: User subscription preferences
- [ ] **Delivery Formats**: Email, Slack, webhook integrations

#### 8. Advanced Features
- [ ] **Custom CSS/JS**: Allow advanced users to customize appearance
- [ ] **Dashboard Templates**: Save dashboards as reusable templates
- [ ] **Dynamic Text**: Markdown support with data variable interpolation
- [ ] **Conditional Formatting**: Show/hide widgets based on data values
- [ ] **Dashboard Actions**: Buttons that trigger data updates or workflows

### Technical Implementation Tasks

#### Database Schema Updates
- [ ] Create `dashboards` table (id, name, config, owner, permissions)
- [ ] Create `dashboard_widgets` table (widget config, position, size)
- [ ] Create `dashboard_schedules` table (delivery schedules)
- [ ] Create `dashboard_versions` table (version history)
- [ ] Add dashboard sharing and permission tables

#### API Development
- [ ] Dashboard CRUD endpoints (create, read, update, delete)
- [ ] Widget management endpoints
- [ ] Export generation endpoints
- [ ] Scheduling service implementation
- [ ] Permission checking middleware

#### Frontend Components
- [ ] DashboardBuilder component with grid layout
- [ ] WidgetWrapper component for consistent widget behavior
- [ ] DashboardViewer for read-only display
- [ ] GlobalFilterBar component
- [ ] DashboardLibrary browsing interface

#### State Management
- [ ] Dashboard state management (Redux/Zustand)
- [ ] Cross-widget communication system
- [ ] Undo/redo functionality
- [ ] Optimistic updates for better UX

#### Performance Optimizations
- [ ] Implement data caching strategy
- [ ] Lazy loading for widgets
- [ ] Virtual scrolling for large dashboards
- [ ] Query batching for multiple reports
- [ ] Progressive loading indicators

### Migration Path
1. Start with basic dashboard canvas and single report widgets
2. Add layout management and saving functionality
3. Implement sharing and permissions
4. Add advanced interactivity and filters
5. Build export and scheduling features
6. Optimize performance and add premium features

### Success Metrics
- Dashboard creation time < 5 minutes
- Dashboard load time < 3 seconds
- Support for 10+ widgets per dashboard
- 99.9% uptime for scheduled deliveries
- Mobile-responsive design score > 95%

### Dependencies
- Completion of Phase 2 (Report Builder)
- Grid layout library (e.g., react-grid-layout)
- PDF generation service
- Email delivery service
- Background job processing system

### Timeline Estimate
- MVP Dashboard Builder: 3-4 weeks
- Full Feature Set: 8-10 weeks
- Performance Optimization: 2-3 weeks
- Total Phase 3: 12-16 weeks

----
## Database Optimization & Migration Tasks (High Priority)

### Overview
Critical database work completed for gasifier and petri observations tables to support advanced analytics, trend analysis, and experimental comparisons. The following tasks detail the implementation strategy for production deployment.

### COMPLETED WORK (2025-01-15)

#### 1. Gasifier Observations Enhancements
- [x] **Computed Columns Implementation**:
  - [x] `linear_reading` (float4) - Direct measurement value
  - [x] `linear_reduction_nominal` (float4) - Self-referential reduction from previous reading
  - [x] `flow_rate` (float4) - Calculated as (15 - linear_reading) / days_elapsed
  - [x] `linear_reduction_per_day` (float4) - Momentum/acceleration of flow rate changes
  - [x] `forecasted_expiration` (timestamp) - Predicted depletion date based on current flow rate
  - [x] `trend_gasifier_velocity` (enum) - Professional categorization of performance trends

#### 2. Petri Observations Enhancements  
- [x] **Growth Metrics Implementation**:
  - [x] `growth_velocity` (float4) - Rate of growth index change per day
  - [x] `growth_progression` (numeric) - Delta between consecutive growth_index values
  - [x] `trend_petri_velocity` (enum) - Growth trend categorization
  - [x] `experiment_role` (enum) - Categorizes control vs experimental samples

#### 3. Professional ENUM Types Created
- [x] **trend_category** (for gasifier):
  - CRITICAL_ACCELERATION, HIGH_ACCELERATION, MODERATE_ACCELERATION
  - STABLE, MODERATE_DECELERATION, HIGH_DECELERATION, CRITICAL_DECELERATION
  - INSUFFICIENT_DATA
- [x] **petri_trend_category** (for petri):
  - RAPID_GROWTH, STRONG_GROWTH, MODERATE_GROWTH, STABLE_GROWTH
  - STAGNANT, MODERATE_DECLINE, SIGNIFICANT_DECLINE, INSUFFICIENT_DATA
- [x] **experiment_role_enum**:
  - CONTROL, EXPERIMENTAL, IGNORE_COMBINED, INDIVIDUAL_SAMPLE, INSUFFICIENT_DATA

### PRODUCTION DEPLOYMENT TASKS (Priority Order)

#### Phase 1: Pre-Deployment Verification (Week 1)
- [ ] **1.1 Backup Production Database** (CRITICAL - Day 1)
  - [ ] Create full production backup with timestamp
  - [ ] Verify backup restoration process works
  - [ ] Document rollback procedures
  
- [ ] **1.2 Test Migration Scripts** (CRITICAL - Days 2-3)
  - [ ] Clone production to staging environment
  - [ ] Run all migration scripts in order:
    1. ENUM type creation
    2. Column additions
    3. Trigger implementations
    4. Retrospective data calculations
  - [ ] Verify data integrity post-migration
  - [ ] Performance test with production data volume
  
- [ ] **1.3 Front-End Compatibility Check** (HIGH - Days 4-5)
  - [ ] Review all front-end forms submitting to these tables
  - [ ] Update TypeScript interfaces for new columns
  - [ ] Add optional fields to prevent breaking changes
  - [ ] Test submission flows end-to-end

#### Phase 2: RPC Implementation (Week 2)
- [ ] **2.1 Deploy RPC Functions** (CRITICAL)
  - [ ] Execute `rpc_updates_for_new_columns.sql` in production
  - [ ] Verify all RPC functions compile without errors
  - [ ] Test each RPC function with sample data
  
- [ ] **2.2 Update API Endpoints** (HIGH)
  - [ ] Modify existing endpoints to use new RPC functions
  - [ ] Add new endpoints for trend analysis
  - [ ] Implement proper error handling
  - [ ] Add API documentation
  
- [ ] **2.3 Permission & Security Setup** (CRITICAL)
  - [ ] Verify RLS policies are active
  - [ ] Test company-based data isolation
  - [ ] Audit log configuration for new columns
  - [ ] Security penetration testing

#### Phase 3: Data Migration Strategy (Week 3)
- [ ] **3.1 Dual-Write Implementation** (if keeping both tables)
  - [ ] Create triggers to sync non-partitioned → partitioned tables
  - [ ] Implement conflict resolution strategy
  - [ ] Monitor sync performance
  - [ ] Create sync verification queries
  
- [ ] **3.2 OR Cutover Strategy** (if switching to partitioned only)
  - [ ] Update all application code to use partitioned tables
  - [ ] Create views with original table names for compatibility
  - [ ] Plan maintenance window for cutover
  - [ ] Prepare rollback scripts

#### Phase 4: Production Deployment (Week 4)
- [ ] **4.1 Deployment Execution** (CRITICAL - Scheduled Maintenance)
  - [ ] Announce maintenance window to users
  - [ ] Execute migration in this order:
    1. Create ENUM types (1 min)
    2. Add new columns (5 mins)
    3. Create functions and triggers (10 mins)
    4. Run retrospective calculations (30-60 mins depending on data)
    5. Deploy RPC functions (5 mins)
    6. Update application code (10 mins)
  - [ ] Run verification queries
  - [ ] Monitor error logs
  
- [ ] **4.2 Post-Deployment Validation** (HIGH)
  - [ ] Verify all computed columns are populating
  - [ ] Check trigger performance on new inserts
  - [ ] Validate front-end submission flow
  - [ ] Monitor database performance metrics
  - [ ] User acceptance testing

#### Phase 5: Optimization & Monitoring (Week 5+)
- [ ] **5.1 Performance Tuning**
  - [ ] Analyze query execution plans
  - [ ] Add missing indexes if needed
  - [ ] Optimize trigger functions
  - [ ] Implement query result caching
  
- [ ] **5.2 Monitoring Setup**
  - [ ] Create dashboard for computed column accuracy
  - [ ] Set up alerts for calculation failures
  - [ ] Monitor trigger execution times
  - [ ] Track partition growth and performance

### REPORTING MODULE INTEGRATION

#### Required Updates for New Columns
- [ ] **Update Report Builder**
  - [ ] Add new columns to measure selection
  - [ ] Create visualization presets for trends
  - [ ] Add forecast timeline visualizations
  - [ ] Implement control vs experimental comparisons
  
- [ ] **Create Specialized Reports**
  - [ ] Gasifier Performance Dashboard
  - [ ] Petri Growth Comparison Report
  - [ ] Trend Analysis Overview
  - [ ] Experiment Effectiveness Report

### ROLLBACK PROCEDURES

#### If Issues Arise
1. **For Column Additions**: Safe to leave, just ignore
2. **For Triggers**: `DROP TRIGGER IF EXISTS [trigger_name] CASCADE;`
3. **For Functions**: `DROP FUNCTION IF EXISTS [function_name] CASCADE;`
4. **For ENUM Types**: More complex, may need to alter columns first
5. **For Data**: Restore from backup if calculations corrupted data

### SUCCESS CRITERIA
- [ ] All computed columns calculate correctly for new and historical data
- [ ] Front-end submissions work without errors
- [ ] No performance degradation (queries stay under 2s)
- [ ] Zero data loss or corruption
- [ ] Users can access new analytical features
- [ ] Reports show meaningful trends and forecasts

### RISK MITIGATION
- **Risk**: Long migration time blocking users
  - **Mitigation**: Run retrospective calculations in batches during low-usage hours
  
- **Risk**: Trigger performance impacts
  - **Mitigation**: Monitor and optimize, consider async processing if needed
  
- **Risk**: Front-end compatibility issues
  - **Mitigation**: Extensive staging testing, feature flags for gradual rollout

### DOCUMENTATION REQUIREMENTS
- [ ] Update database schema documentation
- [ ] Create user guide for new analytical features
- [ ] Document calculation formulas for support team
- [ ] API documentation for new endpoints
- [ ] Runbook for common issues and fixes

### ESTIMATED TIMELINE
- **Total Duration**: 5-6 weeks
- **Critical Path**: Weeks 1-4 (backup through deployment)
- **Buffer Time**: 1-2 weeks for optimization and fixes
- **Resource Needs**: 
  - 1 Database Administrator
  - 1 Backend Developer  
  - 1 Frontend Developer
  - 1 QA Engineer

### NEXT IMMEDIATE ACTIONS
1. **Today**: Create production database backup
2. **Tomorrow**: Set up staging environment with prod data
3. **This Week**: Complete pre-deployment verification
4. **Next Week**: Begin RPC implementation and testing 

