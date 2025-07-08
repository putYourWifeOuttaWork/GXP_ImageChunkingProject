# Custom Reporting Module Implementation Plan

## Executive Summary
Build a comprehensive Tableau-like reporting module using D3.js for multi-dimensional, multi-variate analysis and visualization of agricultural data, with the flexibility to redesign/augment the existing `custom_reports` table as needed.

## Current State Analysis

### Existing `custom_reports` Table Limitations
```sql
-- Current schema is too simplistic for advanced reporting
CREATE TABLE public.custom_reports (
  report_id uuid not null default gen_random_uuid(),
  name text not null,
  description text null,
  created_by_user_id uuid not null,
  company_id uuid not null,
  program_id uuid null,                    -- Too restrictive - reports can span multiple programs
  configuration jsonb not null,           -- Too vague - needs structured schema
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
```

### What We Need Instead
- **Multi-program support**: Reports spanning multiple programs
- **Structured configuration**: Typed schema for report definitions
- **Version control**: Track report changes over time
- **Advanced permissions**: Share reports with specific users/roles
- **Performance optimization**: Cached query results
- **Dashboard support**: Group related reports

## Proposed New Schema Design

### 1. Enhanced Reports Table
```sql
-- Main reports table with enhanced capabilities
CREATE TABLE public.reports (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category report_category_enum DEFAULT 'analytics',
  report_type report_type_enum NOT NULL, -- 'chart', 'table', 'dashboard', 'export'
  
  -- Ownership and access
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  company_id uuid NOT NULL REFERENCES companies(company_id),
  is_public boolean DEFAULT false,
  is_template boolean DEFAULT false,
  
  -- Configuration
  data_source jsonb NOT NULL,           -- Which tables/views to query
  dimensions jsonb NOT NULL,            -- Dimension definitions
  measures jsonb NOT NULL,              -- Measure definitions
  filters jsonb DEFAULT '[]'::jsonb,    -- Filter configurations
  visualization_config jsonb NOT NULL,  -- D3 visualization settings
  
  -- Metadata
  tags text[],
  last_refreshed_at timestamp with time zone,
  refresh_frequency interval,
  
  -- Audit
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  version integer DEFAULT 1
);

-- Report access control
CREATE TABLE public.report_permissions (
  permission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  role user_role_enum,
  company_id uuid REFERENCES companies(company_id),
  permission_type permission_type_enum NOT NULL, -- 'read', 'write', 'admin'
  granted_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Report version history
CREATE TABLE public.report_versions (
  version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  configuration_snapshot jsonb NOT NULL,
  change_summary text,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Dashboards for grouping reports
CREATE TABLE public.dashboards (
  dashboard_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  layout jsonb NOT NULL,               -- Dashboard layout configuration
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  company_id uuid NOT NULL REFERENCES companies(company_id),
  is_public boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Dashboard report associations
CREATE TABLE public.dashboard_reports (
  dashboard_id uuid NOT NULL REFERENCES dashboards(dashboard_id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  position_x integer NOT NULL,
  position_y integer NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (dashboard_id, report_id)
);

-- Cached query results for performance
CREATE TABLE public.report_cache (
  cache_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  result_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  UNIQUE(report_id, cache_key)
);
```

### 2. Supporting Enums
```sql
CREATE TYPE report_category_enum AS ENUM (
  'analytics',
  'operational',
  'compliance',
  'research',
  'executive'
);

CREATE TYPE report_type_enum AS ENUM (
  'chart',
  'table',
  'dashboard',
  'export',
  'real_time'
);

CREATE TYPE permission_type_enum AS ENUM (
  'read',
  'write',
  'admin'
);
```

## Architecture & File Structure

### Directory Structure
```
src/
├── components/
│   └── reporting/
│       ├── builder/
│       │   ├── ReportBuilder.tsx          # Main builder interface
│       │   ├── DimensionPanel.tsx         # Drag-and-drop dimensions
│       │   ├── MeasurePanel.tsx           # Drag-and-drop measures
│       │   ├── FilterPanel.tsx            # Filter configuration
│       │   ├── VisualizationPanel.tsx     # Chart type selection
│       │   └── PreviewPanel.tsx           # Live preview
│       ├── visualizations/
│       │   ├── base/
│       │   │   ├── BaseChart.tsx          # Common D3 chart logic
│       │   │   ├── ChartContainer.tsx     # Chart wrapper
│       │   │   └── ChartTooltip.tsx       # Interactive tooltips
│       │   ├── charts/
│       │   │   ├── TimeSeriesChart.tsx    # Time-series with D3
│       │   │   ├── HeatmapChart.tsx       # Heatmaps for spatial data
│       │   │   ├── ScatterPlot.tsx        # Correlation analysis
│       │   │   ├── ContourMap.tsx         # Growth progression maps
│       │   │   ├── BarChart.tsx           # Categorical comparisons
│       │   │   ├── BoxPlot.tsx            # Statistical distributions
│       │   │   └── NetworkDiagram.tsx     # Relationship analysis
│       │   └── scientific/
│       │       ├── GrowthProgressionChart.tsx # Petri growth over time
│       │       ├── SpatialEffectivenessMap.tsx # Placement effectiveness
│       │       ├── PhaseComparisonChart.tsx    # Control vs experimental
│       │       └── EnvironmentalCorrelation.tsx # Environmental factors
│       ├── filters/
│       │   ├── FilterManager.tsx          # Filter orchestration
│       │   ├── DateRangeFilter.tsx        # Time-based filtering
│       │   ├── CategoricalFilter.tsx      # Dropdown/checkbox filters
│       │   ├── NumericRangeFilter.tsx     # Slider/input filters
│       │   └── SpatialFilter.tsx          # Map-based filtering
│       ├── export/
│       │   ├── ExportManager.tsx          # Export orchestration
│       │   ├── PDFExporter.tsx            # PDF generation
│       │   ├── ImageExporter.tsx          # PNG/SVG export
│       │   └── DataExporter.tsx           # CSV/Excel export
│       └── dashboard/
│           ├── Dashboard.tsx              # Dashboard container
│           ├── DashboardGrid.tsx          # Grid layout system
│           ├── DashboardCard.tsx          # Individual report cards
│           └── DashboardControls.tsx      # Dashboard-level controls
├── hooks/
│   └── reporting/
│       ├── useReportData.ts               # Data fetching and caching
│       ├── useReportBuilder.ts            # Report builder state
│       ├── useReportFilters.ts            # Filter state management
│       ├── useReportExport.ts             # Export functionality
│       └── useReportPermissions.ts        # Access control
├── utils/
│   └── reporting/
│       ├── dataTransformers.ts            # Data aggregation engine
│       ├── queryBuilder.ts                # Dynamic SQL generation
│       ├── dimensionDefinitions.ts        # Dimension metadata
│       ├── measureDefinitions.ts          # Measure metadata
│       ├── visualizationTemplates.ts      # Pre-built chart configs
│       └── exportUtils.ts                 # Export helpers
├── types/
│   └── reporting/
│       ├── index.ts                       # Main type exports
│       ├── reportTypes.ts                 # Report configuration types
│       ├── dataTypes.ts                   # Data structure types
│       ├── visualizationTypes.ts          # Chart configuration types
│       └── filterTypes.ts                 # Filter configuration types
└── pages/
    ├── ReportingPage.tsx                  # Main reporting interface
    ├── ReportBuilderPage.tsx              # Report creation/editing
    ├── DashboardPage.tsx                  # Dashboard view
    └── ReportViewPage.tsx                 # Individual report view
```

## Core Components Design

### 1. Report Builder Interface
```typescript
interface ReportConfiguration {
  id: string;
  name: string;
  description?: string;
  category: ReportCategory;
  type: ReportType;
  
  // Data configuration
  dataSources: DataSource[];
  dimensions: Dimension[];
  measures: Measure[];
  filters: Filter[];
  
  // Visualization configuration
  chartType: ChartType;
  visualizationSettings: VisualizationSettings;
  
  // Display configuration
  formatting: FormattingOptions;
  interactivity: InteractivityOptions;
}

interface DataSource {
  id: string;
  table: string;
  joins?: Join[];
  baseFilters?: Filter[];
}

interface Dimension {
  id: string;
  name: string;
  field: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  hierarchyLevel?: number;
  customGrouping?: GroupingRule[];
}

interface Measure {
  id: string;
  name: string;
  field: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'stddev';
  dataType: 'number' | 'percentage' | 'currency' | 'duration';
  customCalculation?: string;
}
```

### 2. Data Aggregation Engine
```typescript
class ReportDataEngine {
  async aggregateData(config: ReportConfiguration): Promise<AggregatedData> {
    // Build dynamic query based on dimensions, measures, and filters
    const query = this.buildQuery(config);
    
    // Execute query with caching
    const rawData = await this.executeQuery(query, config.id);
    
    // Transform data for visualization
    return this.transformData(rawData, config);
  }
  
  private buildQuery(config: ReportConfiguration): QueryDefinition {
    // Generate SQL based on configuration
    // Handle joins, aggregations, filters, and groupings
  }
  
  private executeQuery(query: QueryDefinition, reportId: string): Promise<RawData> {
    // Check cache first
    // Execute against Supabase
    // Cache results
  }
  
  private transformData(data: RawData, config: ReportConfiguration): AggregatedData {
    // Transform for D3 consumption
    // Handle time series formatting
    // Calculate derived metrics
  }
}
```

### 3. D3 Visualization Components
```typescript
interface BaseChartProps {
  data: AggregatedData;
  config: VisualizationConfig;
  width: number;
  height: number;
  onDataPointClick?: (point: DataPoint) => void;
  onBrushSelection?: (selection: BrushSelection) => void;
}

// Time series with advanced scientific features
class TimeSeriesChart extends BaseChart {
  render() {
    // D3 time series with:
    // - Multi-line support
    // - Brush selection
    // - Zoom and pan
    // - Anomaly highlighting
    // - Phase annotations
  }
}

// Heatmap for spatial analysis
class HeatmapChart extends BaseChart {
  render() {
    // D3 heatmap with:
    // - Contour mapping
    // - Color scales
    // - Interactive tooltips
    // - Spatial interpolation
  }
}

// Growth progression with scientific visualization
class GrowthProgressionChart extends BaseChart {
  render() {
    // Specialized chart for:
    // - Petri growth stages
    // - Animated transitions
    // - Growth velocity indicators
    // - Comparative analysis
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create enhanced database schema
- [ ] Set up basic file structure
- [ ] Implement core TypeScript types
- [ ] Build basic data fetching hooks
- [ ] Create simple report builder shell

### Phase 2: Report Builder (Week 3-4)
- [ ] Implement drag-and-drop interface
- [ ] Build dimension and measure panels
- [ ] Create filter configuration UI
- [ ] Add visualization type selection
- [ ] Implement live preview functionality

### Phase 3: D3 Visualizations (Week 5-6)
- [ ] Create base chart components
- [ ] Implement time series charts
- [ ] Build heatmap visualizations
- [ ] Add scatter plot and box plot charts
- [ ] Create specialized scientific charts

### Phase 4: Advanced Features (Week 7-8)
- [ ] Implement data aggregation engine
- [ ] Add interactive filtering
- [ ] Create drill-down capabilities
- [ ] Build export functionality
- [ ] Add dashboard support

### Phase 5: Performance & Polish (Week 9-10)
- [ ] Implement caching system
- [ ] Add real-time updates
- [ ] Create sharing and permissions
- [ ] Performance optimization
- [ ] Testing and documentation

## Migration Strategy

### 1. Backward Compatibility
- Keep existing `custom_reports` table temporarily
- Create migration script to move data to new schema
- Maintain API compatibility during transition

### 2. Data Migration
```sql
-- Migration script to move from old to new schema
INSERT INTO reports (
  report_id, name, description, created_by_user_id, company_id,
  data_source, dimensions, measures, visualization_config
)
SELECT 
  report_id, name, description, created_by_user_id, company_id,
  -- Transform old configuration to new format
  transform_old_config(configuration)
FROM custom_reports;
```

### 3. Feature Rollout
- Phase 1: New reports use new system
- Phase 2: Migrate existing reports
- Phase 3: Remove old table and code

## Success Metrics

### Technical Metrics
- Query performance: <2s for complex reports
- Visualization rendering: <1s for 10k+ data points
- Export generation: <5s for PDF/Excel
- Cache hit rate: >80% for frequently accessed reports

### User Experience Metrics
- Time to create report: <5 minutes for basic reports
- User adoption: 90% of users creating custom reports
- Report sharing: 50% of reports shared across teams
- Export usage: Daily exports for operational reports

## Risk Mitigation

### Technical Risks
- **Performance**: Implement aggressive caching and query optimization
- **Complexity**: Start with MVP and iterate based on user feedback
- **D3 Learning Curve**: Create reusable components and clear documentation

### Business Risks
- **User Adoption**: Provide templates and migration assistance
- **Data Quality**: Implement validation and error handling
- **Maintenance**: Design for extensibility and clear code structure

## Next Steps

1. **Review and Approval**: Get stakeholder approval for this plan
2. **Database Changes**: Create migration scripts for schema changes
3. **Development Environment**: Set up development branch and testing
4. **Implementation**: Begin Phase 1 development
5. **Testing**: Continuous testing throughout development

This plan provides a comprehensive roadmap for building a world-class reporting system while maintaining flexibility to adapt the existing schema as needed.