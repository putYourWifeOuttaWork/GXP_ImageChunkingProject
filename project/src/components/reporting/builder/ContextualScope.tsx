import React, { useState, useEffect } from 'react';
import { Building, MapPin, Calendar, ChevronDown } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface ContextualScopeProps {
  onScopeChange: (scope: {
    programId?: string;
    siteId?: string;
    dateRange?: { start: string; end: string };
  }) => void;
  className?: string;
}

export const ContextualScope: React.FC<ContextualScopeProps> = ({
  onScopeChange,
  className = ''
}) => {
  const [programs, setPrograms] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const [selectedSite, setSelectedSite] = useState<any>(null);
  const [datePreset, setDatePreset] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserContext();
  }, []);

  useEffect(() => {
    // Notify parent of scope changes
    const scope: any = {};
    if (selectedProgram) scope.programId = selectedProgram.program_id;
    if (selectedSite) scope.siteId = selectedSite.site_id;
    if (datePreset !== 'all') {
      scope.dateRange = getDateRange(datePreset);
    }
    onScopeChange(scope);
  }, [selectedProgram, selectedSite, datePreset]);

  const loadUserContext = async () => {
    setLoading(true);
    
    // Load user's programs
    const { data: programData } = await supabase
      .from('pilot_programs')
      .select('program_id, name, start_date, end_date')
      .order('created_at', { ascending: false });
    
    if (programData && programData.length > 0) {
      setPrograms(programData);
      
      // Auto-select if user has only one program
      if (programData.length === 1) {
        setSelectedProgram(programData[0]);
        loadSitesForProgram(programData[0].program_id);
      }
      // Or select most recent active program
      else {
        const activeProgram = programData.find(p => 
          new Date(p.start_date) <= new Date() && 
          new Date(p.end_date) >= new Date()
        );
        if (activeProgram) {
          setSelectedProgram(activeProgram);
          loadSitesForProgram(activeProgram.program_id);
        }
      }
    }
    
    setLoading(false);
  };

  const loadSitesForProgram = async (programId: string) => {
    const { data: siteData } = await supabase
      .from('sites')
      .select('site_id, name, site_type')
      .eq('program_id', programId)
      .order('name');
    
    if (siteData) {
      setSites(siteData);
      // Auto-select if only one site
      if (siteData.length === 1) {
        setSelectedSite(siteData[0]);
      }
    }
  };

  const getDateRange = (preset: string) => {
    const end = new Date();
    const start = new Date();
    
    switch (preset) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case 'ytd':
        start.setMonth(0, 1);
        break;
    }
    
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  };

  if (loading) {
    return <div className="animate-pulse h-10 bg-gray-100 rounded" />;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Program Selector */}
      <div className="relative group">
        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
          <Building className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium">
            {selectedProgram ? selectedProgram.name : 'All Programs'}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
          <div className="p-1">
            <button
              onClick={() => {
                setSelectedProgram(null);
                setSelectedSite(null);
                setSites([]);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded"
            >
              All Programs
            </button>
            {programs.map(program => (
              <button
                key={program.program_id}
                onClick={() => {
                  setSelectedProgram(program);
                  setSelectedSite(null);
                  loadSitesForProgram(program.program_id);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded ${
                  selectedProgram?.program_id === program.program_id ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                {program.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Site Selector (only show if program selected) */}
      {selectedProgram && sites.length > 0 && (
        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">
              {selectedSite ? selectedSite.name : 'All Sites'}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            <div className="p-1">
              <button
                onClick={() => setSelectedSite(null)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded"
              >
                All Sites
              </button>
              {sites.map(site => (
                <button
                  key={site.site_id}
                  onClick={() => setSelectedSite(site)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded ${
                    selectedSite?.site_id === site.site_id ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Date Range Selector */}
      <div className="relative group">
        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium">
            {datePreset === 'all' ? 'All Time' : 
             datePreset === '7d' ? 'Last 7 Days' :
             datePreset === '30d' ? 'Last 30 Days' :
             datePreset === '90d' ? 'Last 90 Days' :
             'Year to Date'}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        
        <div className="absolute top-full right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
          <div className="p-1">
            {['all', '7d', '30d', '90d', 'ytd'].map(preset => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded ${
                  datePreset === preset ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                {preset === 'all' ? 'All Time' : 
                 preset === '7d' ? 'Last 7 Days' :
                 preset === '30d' ? 'Last 30 Days' :
                 preset === '90d' ? 'Last 90 Days' :
                 'Year to Date'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Performance indicator */}
      {selectedProgram && (
        <div className="ml-auto flex items-center gap-2 text-xs text-green-600">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Optimized</span>
        </div>
      )}
    </div>
  );
};