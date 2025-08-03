import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, RefreshCw } from 'lucide-react';
import { FacilityAnalyticsViewer } from '../../analytics/FacilityAnalyticsViewer';
import { supabase } from '../../../lib/supabaseClient';
import { format } from 'date-fns';
import Button from '../../common/Button';
import { ErrorDisplay, commonErrorActions } from '../../common/ErrorDisplay';

interface FacilityAnalyticsWidgetProps {
  siteId?: string;
  showDatePicker?: boolean;
  showSiteSelector?: boolean;
  height?: number;
  onMetricClick?: (metric: string, value: number) => void;
}

interface Site {
  site_id: string;
  site_name: string;
  description?: string;
}

export const FacilityAnalyticsWidget: React.FC<FacilityAnalyticsWidgetProps> = ({
  siteId: initialSiteId,
  showDatePicker = true,
  showSiteSelector = true,
  height = 500,
  onMetricClick
}) => {
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(initialSiteId);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load available sites
  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('site_id, site_name, description')
        .order('site_name');

      if (error) throw error;
      
      setSites(data || []);
      
      // If no site is selected and we have sites, select the first one
      if (!selectedSiteId && data && data.length > 0) {
        setSelectedSiteId(data[0].site_id);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading sites:', err);
      setError('Failed to load sites');
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded-lg" style={{ height }} />;
  }

  if (error) {
    return (
      <ErrorDisplay
        type="data-not-found"
        message={error}
        actions={[commonErrorActions.retry(loadSites)]}
      />
    );
  }

  if (sites.length === 0) {
    return (
      <ErrorDisplay
        type="data-not-found"
        title="No Sites Available"
        message="No facility sites have been configured yet"
        actions={[]}
      />
    );
  }

  return (
    <div className="facility-analytics-widget">
      {/* Controls */}
      {(showDatePicker || showSiteSelector) && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Site selector */}
            {showSiteSelector && (
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-gray-500" />
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {sites.map(site => (
                    <option key={site.site_id} value={site.site_id}>
                      {site.site_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date picker */}
            {showDatePicker && (
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-500" />
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={16} />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </div>
      )}

      {/* Analytics viewer */}
      {selectedSiteId && (
        <FacilityAnalyticsViewer
          key={refreshKey}
          siteId={selectedSiteId}
          date={selectedDate}
          height={height}
          onMetricClick={onMetricClick}
          showLegend={true}
          showStats={true}
        />
      )}
    </div>
  );
};