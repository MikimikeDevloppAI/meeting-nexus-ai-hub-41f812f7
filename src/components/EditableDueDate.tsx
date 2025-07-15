import { useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditableDueDateProps {
  todoId: string;
  dueDate: string | null;
  onUpdate?: () => void;
}

export function EditableDueDate({ todoId, dueDate, onUpdate }: EditableDueDateProps) {
  const [date, setDate] = useState<Date | undefined>(dueDate ? new Date(dueDate) : undefined);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleDateChange = async (selectedDate: Date | undefined) => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ due_date: selectedDate?.toISOString() })
        .eq("id", todoId);

      if (error) throw error;

      setDate(selectedDate);
      setOpen(false);
      onUpdate?.();

      toast({
        title: selectedDate ? "Date d'échéance mise à jour" : "Date d'échéance supprimée",
        description: selectedDate 
          ? `Échéance fixée au ${format(selectedDate, "dd/MM/yyyy", { locale: fr })}`
          : "La date d'échéance a été supprimée",
      });
    } catch (error: any) {
      console.error("Error updating due date:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la date d'échéance",
        variant: "destructive",
      });
    }
  };

  const clearDate = () => {
    handleDateChange(undefined);
  };

  const isOverdue = date && new Date(date) < new Date() && new Date(date).toDateString() !== new Date().toDateString();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-8 justify-start text-left font-normal",
            !date && "text-muted-foreground",
            isOverdue && "text-red-600 border-red-300 bg-red-50"
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {date ? (
            <span className={isOverdue ? "text-red-600" : ""}>
              {format(date, "dd/MM/yyyy", { locale: fr })}
            </span>
          ) : (
            "Définir échéance"
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={date}
          onSelect={handleDateChange}
          initialFocus
          className="pointer-events-auto"
        />
        {date && (
          <div className="p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={clearDate}
              className="w-full"
            >
              Supprimer la date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}