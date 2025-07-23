import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface IsolationFilterSelectProps {
  segment: string;
  reportId: string;
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

interface SegmentOption {
  id: string;
  name: string;
}

export const IsolationFilterSelect: React.FC<IsolationFilterSelectProps> = ({
  segment,
  reportId,
  value = [],
  onChange,
  placeholder = 'Select values...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<SegmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Map segment to table and name field - using actual table names from the database
  const segmentConfig: Record<string, { table: string; nameField: string; idField?: string }> = {
    'program_id': { table: 'unique_programs_view', nameField: 'program_name', idField: 'program_id' },
    'site_id': { table: 'unique_sites_view', nameField: 'site_name', idField: 'site_id' },
    'submission_id': { table: 'unique_submissions_view', nameField: 'submission_name', idField: 'submission_id' },
    'facility_id': { table: 'facilities', nameField: 'name' },
    'global_site_id': { table: 'unique_sites_view', nameField: 'global_site_id', idField: 'global_site_id' }
  };

  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen, segment]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadOptions = async () => {
    const config = segmentConfig[segment];
    if (!config) return;

    setLoading(true);
    try {
      // For facility_id, we need to get the company_id from the user
      if (segment === 'facility_id') {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data: userProfile } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', userData.user.id)
          .single();

        if (!userProfile) return;

        const idField = config.idField || 'id';
        const { data, error } = await supabase
          .from(config.table)
          .select(`${idField}, ${config.nameField}`)
          .eq('company_id', userProfile.company_id)
          .order(config.nameField);

        if (!error && data) {
          setOptions(data.map(item => ({
            id: item[idField].toString(),
            name: item[config.nameField] || item[idField].toString()
          })));
        }
      } else {
        // For other segments
        const idField = config.idField || 'id';
        
        // Build query
        let query = supabase.from(config.table);
        
        // Select appropriate fields
        if (idField === config.nameField) {
          query = query.select(idField);
        } else {
          query = query.select(`${idField}, ${config.nameField}`);
        }
        
        // No additional filtering needed - views already handle company access
        
        const { data, error } = await query.order(config.nameField);

        if (!error && data) {
          setOptions(data.map(item => ({
            id: item[idField].toString(),
            name: item[config.nameField] || item[idField].toString()
          })));
        }
      }
    } catch (err) {
      console.error('Error loading options:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleOption = (optionId: string) => {
    if (value.includes(optionId)) {
      onChange(value.filter(v => v !== optionId));
    } else {
      onChange([...value, optionId]);
    }
  };

  const removeValue = (valueId: string) => {
    onChange(value.filter(v => v !== valueId));
  };

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOptions = options.filter(opt => value.includes(opt.id));

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="w-full min-h-[38px] px-3 py-2 border border-gray-300 rounded-md bg-white cursor-pointer flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {selectedOptions.length > 0 ? (
            selectedOptions.map(option => (
              <span
                key={option.id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
              >
                {option.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeValue(option.id);
                  }}
                  className="ml-1 hover:text-blue-600"
                >
                  <X size={12} />
                </button>
              </span>
            ))
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-center text-sm text-gray-500">Loading...</div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <label
                  key={option.id}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(option.id)}
                    onChange={() => toggleOption(option.id)}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {option.name}
                    <span className="text-xs text-gray-500 ml-1">({option.id})</span>
                  </span>
                </label>
              ))
            ) : (
              <div className="p-3 text-center text-sm text-gray-500">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};