import React, { useState, useEffect } from 'react';
import { HelpCircle, X, Sparkles } from 'lucide-react';
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
      // Mapping entre les URLs et les IDs de pages
      const urlToPageIdMap: { [key: string]: string } = {
        '': 'todos',
        'todos': 'todos',
        'meetings': 'meetings',
        'documents': 'documents',
        'iol-calculator': 'iol-calculator',
        'patient-letters': 'patient-letters',
        'invoices': 'invoices',
        'retrocession': 'retrocession',
        'gestion-stock': 'stock-management',
        'time-tracking': 'time-tracking',
        'hr-validation': 'hr-validation',
        'users': 'users',
        'profile': 'profile'
      };

      const pathKey = location.pathname.replace('/', '');
      const pageId = urlToPageIdMap[pathKey] || pathKey;

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
          className="
            relative group
            bg-gradient-to-r from-blue-50 to-indigo-50 
            border-2 border-blue-200 
            text-blue-700 
            hover:from-blue-100 hover:to-indigo-100 
            hover:border-blue-300 
            hover:text-blue-800
            shadow-md hover:shadow-lg 
            transition-all duration-300 ease-in-out
            transform hover:scale-105
            font-medium
            animate-pulse hover:animate-none
          "
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-100/20 to-indigo-100/20 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <HelpCircle className="h-4 w-4 relative z-10" />
          <Sparkles className="h-3 w-3 ml-1 relative z-10 animate-bounce" />
          <span className="ml-2 hidden sm:inline font-semibold relative z-10">Aide</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border-2 border-blue-200 shadow-2xl">
        <DialogHeader className="border-b border-blue-100 pb-4">
          <DialogTitle className="flex items-center justify-between text-blue-800">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              <span>Aide - {helpInfo.page_name}</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-6">
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
              {helpInfo.help_content}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};