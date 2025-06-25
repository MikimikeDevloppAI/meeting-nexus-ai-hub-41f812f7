
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TodoPriorityButtonProps {
  todoId: string;
  currentPriority: 'high' | 'normal' | 'low';
  onPriorityUpdate: () => void;
  compact?: boolean;
}

export const TodoPriorityButton = ({ 
  todoId, 
  currentPriority, 
  onPriorityUpdate,
  compact = false 
}: TodoPriorityButtonProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const togglePriority = async () => {
    setIsUpdating(true);
    
    try {
      // Toggle entre high et normal (simplifié)
      const newPriority = currentPriority === 'high' ? 'normal' : 'high';
      
      const { error } = await supabase
        .from('todos')
        .update({ priority: newPriority })
        .eq('id', todoId);

      if (error) throw error;

      onPriorityUpdate();
      
      toast({
        title: newPriority === 'high' ? "Tâche marquée comme importante" : "Priorité normale restaurée",
        description: newPriority === 'high' 
          ? "Cette tâche apparaîtra en premier dans la liste" 
          : "Cette tâche suit l'ordre normal",
      });
    } catch (error) {
      console.error('Error updating priority:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier la priorité",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getPriorityBadge = () => {
    if (currentPriority === 'high') {
      return (
        <Badge variant="default" className="bg-orange-100 text-orange-800 border-orange-200">
          <Star className="h-3 w-3 mr-1 fill-orange-500" />
          Important
        </Badge>
      );
    }
    return null;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {getPriorityBadge()}
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePriority}
          disabled={isUpdating}
          className={`h-6 w-6 p-0 ${
            currentPriority === 'high' 
              ? 'text-orange-500 hover:text-orange-600' 
              : 'text-gray-400 hover:text-orange-500'
          }`}
        >
          {isUpdating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Star className={`h-3 w-3 ${currentPriority === 'high' ? 'fill-current' : ''}`} />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {getPriorityBadge()}
      <Button
        variant="outline"
        size="sm"
        onClick={togglePriority}
        disabled={isUpdating}
        className={`flex items-center gap-1 ${
          currentPriority === 'high' 
            ? 'text-orange-600 border-orange-200 hover:bg-orange-50' 
            : 'hover:text-orange-500 hover:border-orange-200'
        }`}
      >
        {isUpdating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Star className={`h-4 w-4 ${currentPriority === 'high' ? 'fill-current' : ''}`} />
        )}
        {currentPriority === 'high' ? 'Important' : 'Marquer important'}
      </Button>
    </div>
  );
};
