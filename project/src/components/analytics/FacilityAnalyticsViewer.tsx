import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Info,
  Layers,
  BarChart3
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import LoadingScreen from '../common/LoadingScreen';
import { ErrorDisplay, commonErrorActions } from '../common/ErrorDisplay';

interface FacilityAnalyticsViewerProps {
  siteId: string;
  date?: Date;
  showLegend?: boolean;
  showStats?: boolean;
  height?: number;
  onMetricClick?: (metric: string, value: number) => void;
}

interface Equipment {
  equipment_id: string;
  type: 'petri_dish' | 'gasifier' | 'sensor' | 'vent' | 'shelving' | 'door' | 'fan';
  position: { x: number; y: number; z: number };
  status: 'active' | 'inactive' | 'maintenance';
  label?: string;
  configuration?: any;
}

interface ObservationData {
  equipment_id: string;
  growth_index: number;
  observations: number;
  latest_observation: Date;
}

interface FacilityMetrics {
  totalGrowthIndex: number;
  averageGrowth: number;
  criticalZones: number;
  activeEquipment: number;
  totalObservations: number;
  coveragePercentage: number;
}

// Color scale for growth index visualization
const getGrowthColor = (growthIndex: number): string => {
  if (growthIndex === 0) return '#E5E7EB'; // gray-200
  if (growthIndex <= 2) return '#DBEAFE'; // blue-100
  if (growthIndex <= 4) return '#93C5FD'; // blue-300
  if (growthIndex <= 6) return '#3B82F6'; // blue-500
  if (growthIndex <= 8) return '#F59E0B'; // amber-500
  return '#EF4444'; // red-500 for critical zones
};

export const FacilityAnalyticsViewer: React.FC<FacilityAnalyticsViewerProps> = ({
  siteId,
  date = new Date(),
  showLegend = true,
  showStats = true,
  height = 600,
  onMetricClick
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facilityData, setFacilityData] = useState<any>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [observations, setObservations] = useState<Map<string, ObservationData>>(new Map());
  const [metrics, setMetrics] = useState<FacilityMetrics>({
    totalGrowthIndex: 0,
    averageGrowth: 0,
    criticalZones: 0,
    activeEquipment: 0,
    totalObservations: 0,
    coveragePercentage: 0
  });

  // Load facility data and observations
  useEffect(() => {
    loadFacilityAnalytics();
  }, [siteId, date]);

  const loadFacilityAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load facility layout data
      const { data: facilityData, error: facilityError } = await supabase
        .from('facilities')
        .select(`
          *,
          sites!inner(
            site_id,
            site_name,
            description,
            program_id
          )
        `)
        .eq('site_id', siteId)
        .single();

      if (facilityError) throw facilityError;
      if (!facilityData) throw new Error('Facility not found');

      setFacilityData(facilityData);

      // Load equipment data
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('facility_equipment')
        .select('*')
        .eq('facility_id', facilityData.facility_id);

      if (equipmentError) throw equipmentError;
      setEquipment(equipmentData || []);

      // Load observations for the specified date
      await loadObservationsForDate(facilityData.facility_id, date);

    } catch (err) {
      console.error('Error loading facility analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load facility data');
    } finally {
      setLoading(false);
    }
  };

  const loadObservationsForDate = async (facilityId: string, targetDate: Date) => {
    try {
      // Get submissions for the date range
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('submission_id')
        .eq('site_id', siteId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      if (submissionError) throw submissionError;
      
      if (!submissions || submissions.length === 0) {
        // No data for this date
        setObservations(new Map());
        calculateMetrics([], equipment);
        return;
      }

      // Get observations for these submissions
      const submissionIds = submissions.map(s => s.submission_id);
      
      const { data: petriObs, error: petriError } = await supabase
        .from('petri_observations')
        .select(`
          equipment_id,
          growth_index,
          created_at
        `)
        .in('submission_id', submissionIds);

      if (petriError) throw petriError;

      // Aggregate observations by equipment
      const observationMap = new Map<string, ObservationData>();
      
      (petriObs || []).forEach(obs => {
        const existing = observationMap.get(obs.equipment_id);
        if (existing) {
          existing.growth_index = Math.max(existing.growth_index, obs.growth_index);
          existing.observations += 1;
          existing.latest_observation = new Date(obs.created_at);
        } else {
          observationMap.set(obs.equipment_id, {
            equipment_id: obs.equipment_id,
            growth_index: obs.growth_index,
            observations: 1,
            latest_observation: new Date(obs.created_at)
          });
        }
      });

      setObservations(observationMap);
      calculateMetrics(Array.from(observationMap.values()), equipment);

    } catch (err) {
      console.error('Error loading observations:', err);
    }
  };

  const calculateMetrics = (observationData: ObservationData[], equipmentList: Equipment[]) => {
    const totalGrowth = observationData.reduce((sum, obs) => sum + obs.growth_index, 0);
    const totalObs = observationData.reduce((sum, obs) => sum + obs.observations, 0);
    const avgGrowth = observationData.length > 0 ? totalGrowth / observationData.length : 0;
    const critical = observationData.filter(obs => obs.growth_index > 7).length;
    const activeEquip = equipmentList.filter(eq => eq.status === 'active').length;
    const petriDishes = equipmentList.filter(eq => eq.type === 'petri_dish').length;
    const coverage = petriDishes > 0 ? (observationData.length / petriDishes) * 100 : 0;

    setMetrics({
      totalGrowthIndex: totalGrowth,
      averageGrowth: Number(avgGrowth.toFixed(2)),
      criticalZones: critical,
      activeEquipment: activeEquip,
      totalObservations: totalObs,
      coveragePercentage: Number(coverage.toFixed(1))
    });
  };

  // Render equipment with color coding based on observations
  const renderEquipment = () => {
    if (!facilityData) return null;

    const scale = Math.min(
      (height - 150) / facilityData.dimensions.height,
      800 / facilityData.dimensions.width
    );

    return (
      <svg
        width={facilityData.dimensions.width * scale}
        height={facilityData.dimensions.height * scale}
        className="border border-gray-300 rounded-lg bg-white"
      >
        {/* Facility boundary */}
        <rect
          x={0}
          y={0}
          width={facilityData.dimensions.width * scale}
          height={facilityData.dimensions.height * scale}
          fill="none"
          stroke="#9CA3AF"
          strokeWidth={2}
        />

        {/* Render equipment */}
        {equipment.map(eq => {
          const obsData = observations.get(eq.equipment_id);
          const growthIndex = obsData?.growth_index || 0;
          const color = getGrowthColor(growthIndex);
          
          return (
            <g key={eq.equipment_id}>
              {eq.type === 'petri_dish' && (
                <circle
                  cx={eq.position.x * scale}
                  cy={eq.position.y * scale}
                  r={15}
                  fill={color}
                  stroke={obsData ? '#1F2937' : '#9CA3AF'}
                  strokeWidth={obsData ? 2 : 1}
                  opacity={eq.status === 'active' ? 1 : 0.5}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onMetricClick?.('equipment', growthIndex)}
                />
              )}
              
              {eq.type === 'gasifier' && (
                <rect
                  x={(eq.position.x - 20) * scale}
                  y={(eq.position.y - 20) * scale}
                  width={40 * scale}
                  height={40 * scale}
                  fill={eq.status === 'active' ? '#34D399' : '#9CA3AF'}
                  stroke="#1F2937"
                  strokeWidth={2}
                  rx={4}
                  opacity={eq.status === 'active' ? 1 : 0.5}
                />
              )}
              
              {eq.type === 'sensor' && (
                <rect
                  x={(eq.position.x - 10) * scale}
                  y={(eq.position.y - 10) * scale}
                  width={20 * scale}
                  height={20 * scale}
                  fill="#8B5CF6"
                  stroke="#1F2937"
                  strokeWidth={1}
                  rx={2}
                  opacity={eq.status === 'active' ? 1 : 0.5}
                />
              )}

              {/* Equipment label */}
              {eq.label && (
                <text
                  x={eq.position.x * scale}
                  y={(eq.position.y + 25) * scale}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#374151"
                  className="select-none"
                >
                  {eq.label}
                </text>
              )}

              {/* Growth index indicator for petri dishes with observations */}
              {eq.type === 'petri_dish' && obsData && obsData.growth_index > 0 && (
                <text
                  x={eq.position.x * scale}
                  y={eq.position.y * scale + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="bold"
                  fill="white"
                  className="select-none"
                >
                  {obsData.growth_index}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <LoadingScreen />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        type="data-not-found"
        message={error}
        actions={[
          commonErrorActions.retry(loadFacilityAnalytics)
        ]}
      />
    );
  }

  return (
    <div className="facility-analytics-viewer">
      {/* Header with date and facility info */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {facilityData?.sites?.site_name || 'Facility Analytics'}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
              <Calendar size={14} />
              <span>{format(date, 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main visualization area */}
      <div className="flex gap-4">
        <div className="flex-1">
          {/* Facility map */}
          <div className="bg-gray-50 p-4 rounded-lg">
            {renderEquipment()}
          </div>

          {/* Legend */}
          {showLegend && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Growth Index Scale</h4>
              <div className="flex items-center gap-4">
                {[0, 2, 4, 6, 8, 10].map(value => (
                  <div key={value} className="flex items-center gap-1">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: getGrowthColor(value) }}
                    />
                    <span className="text-xs text-gray-600">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats panel */}
        {showStats && (
          <div className="w-80">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Facility Metrics</h4>
              
              <div className="space-y-3">
                {/* Total Growth Index */}
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                  onClick={() => onMetricClick?.('totalGrowth', metrics.totalGrowthIndex)}
                >
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-blue-500" />
                    <span className="text-sm text-gray-700">Total Growth Index</span>
                  </div>
                  <span className="text-lg font-semibold text-gray-900">
                    {metrics.totalGrowthIndex}
                  </span>
                </div>

                {/* Average Growth */}
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                  onClick={() => onMetricClick?.('averageGrowth', metrics.averageGrowth)}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-green-500" />
                    <span className="text-sm text-gray-700">Average Growth</span>
                  </div>
                  <span className="text-lg font-semibold text-gray-900">
                    {metrics.averageGrowth}
                  </span>
                </div>

                {/* Critical Zones */}
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                  onClick={() => onMetricClick?.('criticalZones', metrics.criticalZones)}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500" />
                    <span className="text-sm text-gray-700">Critical Zones</span>
                  </div>
                  <span className="text-lg font-semibold text-red-600">
                    {metrics.criticalZones}
                  </span>
                </div>

                {/* Coverage */}
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                  onClick={() => onMetricClick?.('coverage', metrics.coveragePercentage)}
                >
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-purple-500" />
                    <span className="text-sm text-gray-700">Coverage</span>
                  </div>
                  <span className="text-lg font-semibold text-gray-900">
                    {metrics.coveragePercentage}%
                  </span>
                </div>

                {/* Total Observations */}
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                  onClick={() => onMetricClick?.('observations', metrics.totalObservations)}
                >
                  <div className="flex items-center gap-2">
                    <Info size={16} className="text-indigo-500" />
                    <span className="text-sm text-gray-700">Observations</span>
                  </div>
                  <span className="text-lg font-semibold text-gray-900">
                    {metrics.totalObservations}
                  </span>
                </div>
              </div>

              {/* Trend indicators */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Status</span>
                  {metrics.criticalZones > 0 ? (
                    <div className="flex items-center gap-1 text-red-600">
                      <AlertTriangle size={14} />
                      <span className="font-medium">Attention Required</span>
                    </div>
                  ) : metrics.averageGrowth > 5 ? (
                    <div className="flex items-center gap-1 text-orange-600">
                      <TrendingUp size={14} />
                      <span className="font-medium">Elevated Activity</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-green-600">
                      <TrendingDown size={14} />
                      <span className="font-medium">Normal</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};