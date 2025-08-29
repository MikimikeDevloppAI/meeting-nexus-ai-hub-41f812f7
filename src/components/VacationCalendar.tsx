import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, X } from "lucide-react";
import { format, eachDayOfInterval, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { formatDateToLocalString } from "@/utils/dateUtils";

interface VacationCalendarProps {
  onSubmit: (data: {
    dates: string[];
    vacation_type: string;
    description: string;
    isHalfDay: boolean;
  }) => void;
  onCancel: () => void;
  editingData?: {
    start_date: string;
    end_date: string;
    vacation_type: string;
    description: string;
    days_count: number;
  };
  existingVacations?: Array<{
    id: string;
    start_date: string;
    end_date: string;
    vacation_type: string;
    status: string;
    days_count: number;
    users?: { name: string; email: string; } | null;
    vacation_days?: Array<{ vacation_date: string; is_half_day?: boolean; half_day_period?: string | null }>
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
  const [isHalfDay, setIsHalfDay] = useState(editingData?.days_count === 0.5 || false);

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

    const dates = selectedDates.map(date => formatDateToLocalString(date));

    onSubmit({
      dates,
      vacation_type: vacationType,
      description,
      isHalfDay
    });
  };

  const getDaysCount = () => {
    return selectedDates.length;
  };

  const clearSelection = () => {
    setSelectedDates([]);
  };

  // Créer la liste des jours de vacances existantes (utilise vacation_days si dispo)
  const existingVacationDates = existingVacations
    .flatMap(vacation => {
      if (vacation.vacation_days && vacation.vacation_days.length > 0) {
        return vacation.vacation_days.map(d => {
          try { return parseISO(d.vacation_date); } catch { return null; }
        }).filter(Boolean) as Date[];
      }
      try {
        const startDate = parseISO(vacation.start_date);
        const endDate = parseISO(vacation.end_date);
        return eachDayOfInterval({ start: startDate, end: endDate });
      } catch {
        return [];
      }
    })
    // Déduplication par jour
    .filter((date, idx, arr) => idx === arr.findIndex(d => formatDateToLocalString(d) === formatDateToLocalString(date)));

  // Fonction pour vérifier si une date est déjà en vacances
  const isVacationDate = (date: Date) => {
    return existingVacationDates.some(vacDate => 
      formatDateToLocalString(date) === formatDateToLocalString(vacDate)
    );
  };

  // Grouper les dates par type de congé pour coloration
  const typeDateMap: Record<'annual' | 'sick' | 'other', Date[]> = {
    annual: [],
    sick: [],
    other: []
  };
  existingVacations.forEach(vacation => {
    // Regrouper personal et overtime_recovery dans 'other'
    let key = vacation.vacation_type || 'other';
    if (key === 'personal' || key === 'overtime_recovery') {
      key = 'other';
    }
    const mappedKey = key as keyof typeof typeDateMap;
    
    const pushUnique = (d: Date) => {
      const ymd = formatDateToLocalString(d);
      if (!typeDateMap[mappedKey].some(x => formatDateToLocalString(x) === ymd)) {
        typeDateMap[mappedKey].push(d);
      }
    };
    
    if (vacation.vacation_days && vacation.vacation_days.length > 0) {
      vacation.vacation_days.forEach(d => {
        try { pushUnique(parseISO(d.vacation_date)); } catch {}
      });
    } else {
      try {
        const startDate = parseISO(vacation.start_date);
        const endDate = parseISO(vacation.end_date);
        eachDayOfInterval({ start: startDate, end: endDate }).forEach(pushUnique);
      } catch {}
    }
  });
  const getVacationTypeLabel = (type: string) => {
    const types = {
      annual: "Congés annuels",
      sick: "Congé maladie", 
      other: "Autres"
    };
    return types[type as keyof typeof types] || "Autres";
  };

  const getVacationTypeColor = (type: string) => {
    const colors = {
      annual: "bg-blue-100 text-blue-800 border-blue-200",
      sick: "bg-red-100 text-red-800 border-red-200",
      other: "bg-purple-100 text-purple-800 border-purple-200"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
        <CardHeader className="bg-white">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Sélectionner les dates de vacances
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white">
          <Calendar
            mode="multiple"
            selected={selectedDates}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            className="w-full rounded-md border p-0 pointer-events-auto"
            classNames={{
              months: "grid grid-cols-2 gap-0 w-full divide-x divide-border",
              month: "w-full",
              table: "w-full",
              head_row: "grid grid-cols-7 w-full",
              row: "grid grid-cols-7 w-full",
              cell: "p-0",
              day: "w-full h-12 p-0"
            }}
            locale={fr}
            disabled={(date) => {
              // Désactiver seulement les week-ends (samedi = 6, dimanche = 0)
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return isWeekend;
            }}
            modifiers={{
              annual: typeDateMap.annual,
              sick: typeDateMap.sick,
              other: typeDateMap.other
            }}
            modifiersStyles={{
              annual: {
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                opacity: 0.6
              },
              sick: {
                backgroundColor: 'hsl(var(--destructive))',
                color: 'hsl(var(--destructive-foreground))',
                opacity: 0.65
              },
              other: {
                backgroundColor: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
                opacity: 0.7
              }
            }}
          />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary))', opacity: 0.6 }} />
              <span className="text-sm">Congés annuels</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--destructive))', opacity: 0.65 }} />
              <span className="text-sm">Congé maladie</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--muted))', opacity: 0.7 }} />
              <span className="text-sm">Autres</span>
            </div>
          </div>
          {selectedDates.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {isHalfDay ? 
                      `${selectedDates.length} demi-journée${selectedDates.length > 1 ? 's' : ''} sélectionnée${selectedDates.length > 1 ? 's' : ''}` :
                      `${selectedDates.length} jour${selectedDates.length > 1 ? 's' : ''} sélectionné${selectedDates.length > 1 ? 's' : ''}`
                    }
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

          {/* Détails des vacances intégrés */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Type de congé</Label>
              <Select value={vacationType} onValueChange={setVacationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Congés annuels</SelectItem>
                  <SelectItem value="sick">Congé maladie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="halfDay"
                  checked={isHalfDay}
                  onCheckedChange={(checked) => setIsHalfDay(checked as boolean)}
                />
                <Label htmlFor="halfDay">Demi-journée</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Cochez cette case si vous souhaitez poser des demi-journées
              </p>
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