import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PageHoverInfo {
  page_id: string;
  hover_text: string;
}

export const usePageHover = () => {
  const [hoverTexts, setHoverTexts] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHoverTexts = async () => {
      try {
        const { data, error } = await supabase
          .from('page_help_information')
          .select('page_id, hover_text')
          .not('hover_text', 'is', null)
          .neq('hover_text', '');

        if (!error && data) {
          const hoverMap = data.reduce((acc, item) => {
            acc[item.page_id] = item.hover_text;
            return acc;
          }, {} as { [key: string]: string });
          
          setHoverTexts(hoverMap);
        }
      } catch (error) {
        console.error('Error fetching hover texts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHoverTexts();

    // Listen for changes in real-time
    const channel = supabase
      .channel('page_help_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'page_help_information'
        },
        () => {
          fetchHoverTexts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getHoverText = (pageId: string): string | undefined => {
    return hoverTexts[pageId];
  };

  return {
    getHoverText,
    loading
  };
};