import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IOLOption {
  id: number;
  iol: string;
  manufacturer: string;
}

export interface ManufacturerOption {
  manufacturer: string;
}

export const useIOLData = () => {
  const [iolData, setIOLData] = useState<IOLOption[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIOLData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all IOL data
      const { data: iolData, error: iolError } = await supabase
        .from('IOL')
        .select('id, iol, manufacturer')
        .order('manufacturer')
        .order('iol');

      if (iolError) {
        throw iolError;
      }

      // Fetch unique manufacturers
      const { data: manufacturerData, error: manufacturerError } = await supabase
        .from('IOL')
        .select('manufacturer')
        .not('manufacturer', 'is', null)
        .order('manufacturer');

      if (manufacturerError) {
        throw manufacturerError;
      }

      // Get unique manufacturers
      const uniqueManufacturers = [...new Set(manufacturerData?.map(item => item.manufacturer) || [])]
        .map(manufacturer => ({ manufacturer }));

      setIOLData(iolData || []);
      setManufacturers(uniqueManufacturers);
    } catch (err: any) {
      console.error('Error fetching IOL data:', err);
      setError(err.message || 'Failed to fetch IOL data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIOLData();
  }, []);

  const getIOLsByManufacturer = (manufacturer: string): IOLOption[] => {
    return iolData.filter(iol => iol.manufacturer === manufacturer);
  };

  return {
    iolData,
    manufacturers,
    isLoading,
    error,
    getIOLsByManufacturer,
    refetch: fetchIOLData
  };
};