import React, { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';

interface HelpInfo {
  page_id: string;
  page_name: string;
  help_content: string;
}

export const HelpButton: React.FC = () => {
  const [helpInfo, setHelpInfo] = useState<HelpInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const fetchHelpInfo = async () => {
      // Convert URL path to page_id
      let pageId = location.pathname.replace('/', '');
      if (pageId === '') pageId = 'todos'; // Default page

      const { data, error } = await supabase
        .from('page_help_information')
        .select('*')
        .eq('page_id', pageId)
        .single();

      if (data && !error) {
        setHelpInfo(data);
      } else {
        setHelpInfo(null);
      }
    };

    fetchHelpInfo();
  }, [location.pathname]);

  // Don't render button if no help content exists
  if (!helpInfo) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-white border-gray-200 hover:bg-gray-50"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Aide</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Aide - {helpInfo.page_name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-gray-700">
              {helpInfo.help_content}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};