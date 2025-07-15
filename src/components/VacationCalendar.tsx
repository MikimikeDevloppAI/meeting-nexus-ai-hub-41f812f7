import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, X } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

interface VacationCalendarProps {
  onSubmit: (data: {
    start_date: string;
    end_date: string;
    vacation_type: string;
    description: string;
  }) => void;
  onCancel: () => void;
  editingData?: {
    start_date: string;
    end_date: string;
    vacation_type: string;
    description: string;
  };
}

export function VacationCalendar({ onSubmit, onCancel, editingData }: VacationCalendarProps) {
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(() => {
    if (editingData) {
      return {
        from: new Date(editingData.start_date),
        to: new Date(editingData.end_date)
      };
    }
    return undefined;
  });
  
  const [vacationType, setVacationType] = useState(editingData?.vacation_type || "annual");
  const [description, setDescription] = useState(editingData?.description || "");

  const handleSubmit = () => {
    if (!selectedRange?.from || !selectedRange?.to) {
      return;
    }

    const startDate = selectedRange.from.toISOString().split('T')[0];
    const endDate = selectedRange.to.toISOString().split('T')[0];

    onSubmit({
      start_date: startDate,
      end_date: endDate,
      vacation_type: vacationType,
      description
    });
  };

  const getDaysCount = () => {
    if (!selectedRange?.from || !selectedRange?.to) return 0;
    return differenceInDays(selectedRange.to, selectedRange.from) + 1;
  };

  const getVacationTypeLabel = (type: string) => {
    const types = {
      annual: "Congés annuels",
      sick: "Congé maladie", 
      personal: "Congé personnel",
      other: "Autre"
    };
    return types[type as keyof typeof types] || type;
  };

  const getVacationTypeColor = (type: string) => {
    const colors = {
      annual: "bg-blue-100 text-blue-800 border-blue-200",
      sick: "bg-red-100 text-red-800 border-red-200",
      personal: "bg-green-100 text-green-800 border-green-200", 
      other: "bg-purple-100 text-purple-800 border-purple-200"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Sélectionner les dates de vacances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={setSelectedRange}
            numberOfMonths={2}
            className="rounded-md border pointer-events-auto"
            locale={fr}
            disabled={(date) => date < new Date()}
          />
          
          {selectedRange?.from && selectedRange?.to && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Du {format(selectedRange.from, "PPP", { locale: fr })} 
                    au {format(selectedRange.to, "PPP", { locale: fr })}
                  </p>
                  <p className="text-xs text-gray-600">
                    {getDaysCount()} jour{getDaysCount() > 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRange(undefined)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détails des vacances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Type de congé</Label>
            <Select value={vacationType} onValueChange={setVacationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Congés annuels</SelectItem>
                <SelectItem value="sick">Congé maladie</SelectItem>
                <SelectItem value="personal">Congé personnel</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
            {vacationType && (
              <Badge variant="outline" className={getVacationTypeColor(vacationType)}>
                {getVacationTypeLabel(vacationType)}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label>Description (optionnel)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Raison ou détails des vacances..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={!selectedRange?.from || !selectedRange?.to}
        >
          {editingData ? "Modifier" : "Confirmer"}
        </Button>
      </div>
    </div>
  );
}