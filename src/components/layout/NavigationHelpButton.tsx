import React, { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

interface NavigationHelpButtonProps {
  pageId: string;
  className?: string;
}

interface HelpInfo {
  page_id: string;
  page_name: string;
  help_content: string;
  hover_text: string;
}

export const NavigationHelpButton: React.FC<NavigationHelpButtonProps> = ({ 
  pageId, 
  className = "" 
}) => {
  const [helpInfo, setHelpInfo] = useState<HelpInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHelpInfo = async () => {
      if (!pageId) return;
      
      setLoading(true);
      try {
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
      } catch (error) {
        console.error('Error fetching help info:', error);
        setHelpInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHelpInfo();
  }, [pageId]);

  // Don't render if no help content exists
  if (!helpInfo?.help_content || loading) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`
            h-6 w-6 p-0 
            text-muted-foreground/60 
            hover:text-muted-foreground 
            hover:bg-muted/50
            transition-all duration-200
            ${className}
          `}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 max-h-96 overflow-y-auto shadow-lg border border-border"
        side="right"
        align="start"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <HelpCircle className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">{helpInfo.page_name}</h4>
          </div>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {helpInfo.help_content}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};