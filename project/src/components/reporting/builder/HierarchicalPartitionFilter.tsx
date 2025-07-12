import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ChevronRight, Zap, Activity, TrendingUp } from 'lucide-react';

interface Program {
  program_id: string;
  name: string;
  start_date: string;
  end_date: string;
  company_id: string;
}

interface Site {
  site_id: string;
  name: string;
  site_type: string;
}

interface Submission {
  submission_id: string;
  global_submission_id: number;
  created_at: string;
}

interface HierarchicalPartitionFilterProps {
  onSelectionChange: (filters: {
    program_id?: string;
    site_id?: string;
    submission_id?: string;
    dateRange?: { start: string; end: string };
  }) => void;
  onPerformanceUpdate?: (level: 'optimal' | 'good' | 'moderate' | 'slow') => void;
}

export const HierarchicalPartitionFilter: React.FC<HierarchicalPartitionFilterProps> = ({
  onSelectionChange,
  onPerformanceUpdate
}) => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedSubmission, setSelectedSubmission] = useState<string>('');
  
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  
  const [performanceLevel, setPerformanceLevel] = useState<'optimal' | 'good' | 'moderate' | 'slow'>('slow');

  // Load programs on mount
  useEffect(() => {
    loadPrograms();
  }, []);

  // Update performance level based on selections
  useEffect(() => {
    let level: 'optimal' | 'good' | 'moderate' | 'slow' = 'slow';
    
    if (selectedProgram && selectedSite && selectedSubmission) {
      level = 'optimal';
    } else if (selectedProgram && selectedSite) {
      level = 'good';
    } else if (selectedProgram) {
      level = 'moderate';
    }
    
    setPerformanceLevel(level);
    onPerformanceUpdate?.(level);
  }, [selectedProgram, selectedSite, selectedSubmission, onPerformanceUpdate]);

  // Notify parent of selection changes
  useEffect(() => {
    const filters: any = {};
    if (selectedProgram) filters.program_id = selectedProgram;
    if (selectedSite) filters.site_id = selectedSite;
    if (selectedSubmission) filters.submission_id = selectedSubmission;
    
    onSelectionChange(filters);
  }, [selectedProgram, selectedSite, selectedSubmission, onSelectionChange]);

  const loadPrograms = async () => {
    const { data, error } = await supabase
      .from('pilot_programs')
      .select('program_id, name, start_date, end_date, company_id')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setPrograms(data);
    }
  };

  const loadSites = async (programId: string) => {
    setLoadingSites(true);
    const { data, error } = await supabase
      .from('sites')
      .select('site_id, name, site_type')
      .eq('program_id', programId)
      .order('name');
    
    if (!error && data) {
      setSites(data);
    }
    setLoadingSites(false);
  };

  const loadSubmissions = async (programId: string, siteId: string) => {
    setLoadingSubmissions(true);
    const { data, error } = await supabase
      .from('submissions')
      .select('submission_id, global_submission_id, created_at')
      .eq('program_id', programId)
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(50); // Show recent submissions
    
    if (!error && data) {
      setSubmissions(data);
    }
    setLoadingSubmissions(false);
  };

  const handleProgramChange = async (programId: string) => {
    setSelectedProgram(programId);
    setSelectedSite('');
    setSelectedSubmission('');
    setSites([]);
    setSubmissions([]);
    
    if (programId) {
      await loadSites(programId);
    }
  };

  const handleSiteChange = async (siteId: string) => {
    setSelectedSite(siteId);
    setSelectedSubmission('');
    setSubmissions([]);
    
    if (selectedProgram && siteId) {
      await loadSubmissions(selectedProgram, siteId);
    }
  };

  const getPerformanceIcon = () => {
    switch (performanceLevel) {
      case 'optimal': return <Zap className="w-4 h-4 text-green-500" />;
      case 'good': return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case 'moderate': return <Activity className="w-4 h-4 text-yellow-500" />;
      default: return null;
    }
  };

  const getPerformanceText = () => {
    switch (performanceLevel) {
      case 'optimal': return 'Ultra-fast query (using all partition levels)';
      case 'good': return 'Fast query (using program + site partitions)';
      case 'moderate': return 'Moderate speed (using program partition only)';
      default: return 'Slower query (no partition optimization)';
    }
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Hierarchical Analysis Filter</h3>
        <div className="flex items-center gap-2 text-sm">
          {getPerformanceIcon()}
          <span className="text-gray-600">{getPerformanceText()}</span>
        </div>
      </div>

      {/* Program Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Program
        </label>
        <select
          value={selectedProgram}
          onChange={(e) => handleProgramChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a program...</option>
          {programs.map((program) => (
            <option key={program.program_id} value={program.program_id}>
              {program.name}
            </option>
          ))}
        </select>
      </div>

      {/* Site Selection */}
      {selectedProgram && (
        <div className="space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <label className="block text-sm font-medium text-gray-700">
              Site
            </label>
          </div>
          <select
            value={selectedSite}
            onChange={(e) => handleSiteChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loadingSites}
          >
            <option value="">All sites in program</option>
            {sites.map((site) => (
              <option key={site.site_id} value={site.site_id}>
                {site.name} ({site.site_type})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Submission Selection */}
      {selectedSite && (
        <div className="space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <label className="block text-sm font-medium text-gray-700">
              Submission (Optional)
            </label>
          </div>
          <select
            value={selectedSubmission}
            onChange={(e) => setSelectedSubmission(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loadingSubmissions}
          >
            <option value="">All submissions</option>
            {submissions.map((submission) => (
              <option key={submission.submission_id} value={submission.submission_id}>
                #{submission.global_submission_id} - {new Date(submission.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Quick Actions */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Analysis Presets</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (selectedProgram) {
                const program = programs.find(p => p.program_id === selectedProgram);
                if (program) {
                  onSelectionChange({
                    program_id: selectedProgram,
                    dateRange: {
                      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                      end: new Date().toISOString()
                    }
                  });
                }
              }
            }}
            disabled={!selectedProgram}
            className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last 30 Days
          </button>
          
          <button
            onClick={() => {
              if (selectedProgram) {
                const program = programs.find(p => p.program_id === selectedProgram);
                if (program) {
                  onSelectionChange({
                    program_id: selectedProgram,
                    dateRange: {
                      start: program.start_date,
                      end: new Date().toISOString()
                    }
                  });
                }
              }
            }}
            disabled={!selectedProgram}
            className="px-3 py-2 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Full Program
          </button>
        </div>
      </div>
    </div>
  );
};