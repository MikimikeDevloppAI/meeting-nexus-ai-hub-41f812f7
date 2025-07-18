import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, X } from "lucide-react";
import { format, eachDayOfInterval, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface VacationCalendarProps {
  onSubmit: (data: {
    dates: string[];
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
  existingVacations?: Array<{
    id: string;
    start_date: string;
    end_date: string;
    vacation_type: string;
    status: string;
    users?: { name: string; email: string; } | null;
  }>;
}

export function VacationCalendar({ onSubmit, onCancel, editingData, existingVacations = [] }: VacationCalendarProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>(() => {
    if (editingData) {
      // Convertir la plage en jours individuels pour l'édition
      const startDate = new Date(editingData.start_date);
      const endDate = new Date(editingData.end_date);
      return eachDayOfInterval({ start: startDate, end: endDate });
    }
    return [];
  });
  
  const [vacationType, setVacationType] = useState(editingData?.vacation_type || "annual");
  const [description, setDescription] = useState(editingData?.description || "");

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (!dates) {
      setSelectedDates([]);
      return;
    }
    setSelectedDates(dates.sort((a, b) => a.getTime() - b.getTime()));
  };

  const handleSubmit = () => {
    if (selectedDates.length === 0) {
      return;
    }

    const dates = selectedDates.map(date => date.toISOString().split('T')[0]);

    onSubmit({
      dates,
      vacation_type: vacationType,
      description
    });
  };

  const getDaysCount = () => {
    return selectedDates.length;
  };

  const clearSelection = () => {
    setSelectedDates([]);
  };

  // Créer la liste des jours de vacances existantes
  const existingVacationDates = existingVacations.flatMap(vacation => {
    try {
      const startDate = parseISO(vacation.start_date);
      const endDate = parseISO(vacation.end_date);
      return eachDayOfInterval({ start: startDate, end: endDate });
    } catch {
      return [];
    }
  });

  // Fonction pour vérifier si une date est déjà en vacances
  const isVacationDate = (date: Date) => {
    return existingVacationDates.some(vacDate => 
      date.toISOString().split('T')[0] === vacDate.toISOString().split('T')[0]
    );
  };

  const getVacationTypeLabel = (type: string) => {
    const types = {
      annual: "Congés annuels",
      sick: "Congé maladie", 
      personal: "Congé personnel",
      overtime_recovery: "Récupération heures supplémentaires",
      other: "Autre"
    };
    return types[type as keyof typeof types] || type;
  };

  const getVacationTypeColor = (type: string) => {
    const colors = {
      annual: "bg-blue-100 text-blue-800 border-blue-200",
      sick: "bg-red-100 text-red-800 border-red-200",
      personal: "bg-green-100 text-green-800 border-green-200",
      overtime_recovery: "bg-orange-100 text-orange-800 border-orange-200",
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
            mode="multiple"
            selected={selectedDates}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            className="rounded-md border pointer-events-auto"
            locale={fr}
            disabled={(date) => {
              // Désactiver seulement les week-ends (samedi = 6, dimanche = 0)
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return isWeekend;
            }}
            modifiers={{
              vacation: existingVacationDates
            }}
            modifiersStyles={{
              vacation: { 
                backgroundColor: 'hsl(var(--destructive))',
                color: 'hsl(var(--destructive-foreground))',
                opacity: 0.7
              }
            }}
          />
          
          {selectedDates.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {selectedDates.length} jour{selectedDates.length > 1 ? 's' : ''} sélectionné{selectedDates.length > 1 ? 's' : ''}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedDates.slice(0, 5).map((date, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {format(date, "dd/MM", { locale: fr })}
                      </Badge>
                    ))}
                    {selectedDates.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{selectedDates.length - 5} autres
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
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
                <SelectItem value="overtime_recovery">Récupération heures supplémentaires</SelectItem>
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
          disabled={selectedDates.length === 0}
        >
          {editingData ? "Modifier" : "Confirmer"}
        </Button>
      </div>
    </div>
  );
}