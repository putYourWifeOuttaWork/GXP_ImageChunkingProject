import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export const useFacilityMappingData = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFacilityDetails = async (siteId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase
        .rpc('get_facility_mapping_data', { p_site_id: siteId });

      if (rpcError) {
        throw rpcError;
      }

      return data;
    } catch (err: any) {
      console.error('Error fetching facility details:', err);
      setError(err.message || 'Failed to fetch facility details');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getGlobalFacilities = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase
        .rpc('get_global_facilities_overview');

      if (rpcError) {
        throw rpcError;
      }

      return data;
    } catch (err: any) {
      console.error('Error fetching global facilities:', err);
      setError(err.message || 'Failed to fetch global facilities');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateContours = async (siteId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase
        .rpc('generate_mold_growth_contours', { p_site_id: siteId });

      if (rpcError) {
        throw rpcError;
      }

      return data;
    } catch (err: any) {
      console.error('Error generating contours:', err);
      setError(err.message || 'Failed to generate contours');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    getFacilityDetails,
    getGlobalFacilities,
    generateContours,
    loading,
    error
  };
};