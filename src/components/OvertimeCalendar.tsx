import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Clock, Edit, X, TrendingUp } from "lucide-react";
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { formatHoursToHoursMinutes } from "@/utils/timeFormatter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OvertimeHour {
  id: string;
  user_id: string;
  date: string;
  hours: number;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  is_recovery?: boolean;
}

interface Vacation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  vacation_type: string;
  status: 'pending' | 'approved' | 'rejected';
  vacation_days?: Array<{
    vacation_date: string;
    is_half_day: boolean;
    half_day_period?: string | null;
  }>;
}

interface OvertimeCalendarProps {
  overtimeHours: OvertimeHour[];
  vacations?: Vacation[];
  onAddOvertime: (data: {
    date: string;
    hours: number;
    description?: string;
    is_recovery?: boolean;
  }) => Promise<void>;
  onEditOvertime: (id: string, data: {
    date: string;
    hours: number;
    description?: string;
    is_recovery?: boolean;
  }) => Promise<void>;
  onDeleteOvertime: (id: string) => Promise<void>;
}

export function OvertimeCalendar({ 
  overtimeHours, 
  vacations = [],
  onAddOvertime, 
  onEditOvertime, 
  onDeleteOvertime 
}: OvertimeCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [showDialog, setShowDialog] = useState(false);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [editingOvertime, setEditingOvertime] = useState<OvertimeHour | null>(null);

  // Créer la liste des jours avec heures supplémentaires
  const overtimeDates = overtimeHours.map(overtime => ({
    date: parseISO(overtime.date),
    overtime
  }));

  // Groupes par statut pour coloration pastel façon calendrier des vacances
  const pendingDates = overtimeHours
    .filter((o) => o.status === 'pending')
    .map((o) => parseISO(o.date));
  const approvedDates = overtimeHours
    .filter((o) => o.status === 'approved')
    .map((o) => parseISO(o.date));
  const rejectedDates = overtimeHours
    .filter((o) => o.status === 'rejected')
    .map((o) => parseISO(o.date));

  // Fonction pour obtenir les heures supplémentaires d'une date
  const getOvertimeForDate = (date: Date) => {
    return overtimeHours.find(overtime => 
      isSameDay(parseISO(overtime.date), date)
    );
  };

  // Fonction pour gérer le clic sur une date
  const handleDateClick = (date: Date | undefined) => {
    if (!date) return;
    
    setSelectedDate(date);
    const existingOvertime = getOvertimeForDate(date);
    
    if (existingOvertime) {
      // Vérifier si les heures sont validées (ne pas permettre la modification)
      if (existingOvertime.status === 'approved') {
        return; // Ne pas ouvrir le dialog pour les heures validées
      }
      
      // Modifier les heures existantes (seulement si pending ou rejected)
      setEditingOvertime(existingOvertime);
      const totalMinutes = existingOvertime.hours * 60;
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      setHours(hrs.toString());
      setMinutes(mins.toString());
      setDescription(existingOvertime.description || "");
      setIsRecovery(existingOvertime.is_recovery || false);
    } else {
      // Ajouter de nouvelles heures
      setEditingOvertime(null);
      setHours("");
      setMinutes("");
      setDescription("");
      setIsRecovery(false);
    }
    
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedDate) return;
    
    const totalHours = (parseInt(hours) || 0) + (parseInt(minutes) || 0) / 60;
    
    if (totalHours <= 0) return;

    const data = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      hours: totalHours,
      description: description.trim() || undefined,
      is_recovery: isRecovery
    };

    try {
      if (editingOvertime) {
        await onEditOvertime(editingOvertime.id, data);
      } else {
        await onAddOvertime(data);
      }
      
      setShowDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error saving overtime:', error);
    }
  };

  const handleDelete = async () => {
    if (!editingOvertime) return;
    
    try {
      await onDeleteOvertime(editingOvertime.id);
      setShowDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error deleting overtime:', error);
    }
  };

  const resetForm = () => {
    setSelectedDate(undefined);
    setEditingOvertime(null);
    setHours("");
    setMinutes("");
    setDescription("");
    setIsRecovery(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-500';
      case 'approved':
        return 'bg-green-500';
      case 'rejected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Calculer les statistiques mensuelles
  const currentYear = new Date().getFullYear();
  const monthsOfYear = eachMonthOfInterval({
    start: startOfYear(new Date(currentYear, 0, 1)),
    end: endOfYear(new Date(currentYear, 11, 31))
  });

  const monthlyStats = monthsOfYear.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const monthlyOvertimes = overtimeHours.filter(overtime => {
      const overtimeDate = parseISO(overtime.date);
      return isWithinInterval(overtimeDate, { start: monthStart, end: monthEnd });
    });
    
    // Calculer les heures de récupération utilisées (vacances type "overtime_recovery" approuvées)
    const recoveryVacations = vacations.filter(vacation => {
      if (vacation.vacation_type !== 'overtime_recovery' || vacation.status !== 'approved') {
        return false;
      }
      // Uniquement celles qui intersectent le mois courant
      const vacationStart = parseISO(vacation.start_date);
      const vacationEnd = parseISO(vacation.end_date);
      return (
        isWithinInterval(vacationStart, { start: monthStart, end: monthEnd }) ||
        isWithinInterval(vacationEnd, { start: monthStart, end: monthEnd }) ||
        (vacationStart <= monthStart && vacationEnd >= monthEnd)
      );
    });

    // Heures de récupération dans le mois en tenant compte des demi-journées (0.5 = 4h)
    const recoveryHours = recoveryVacations.reduce((sum, vacation) => {
      // Si on dispose du détail des jours, on l'utilise
      if (vacation.vacation_days && vacation.vacation_days.length > 0) {
        const hoursInMonth = vacation.vacation_days.reduce((h, day) => {
          const d = parseISO(day.vacation_date);
          return isWithinInterval(d, { start: monthStart, end: monthEnd })
            ? h + (day.is_half_day ? 4 : 8)
            : h;
        }, 0);
        return sum + hoursInMonth;
      }

      // Fallback: intersection simple start/end (sans détail 1/2j)
      const vacationStart = parseISO(vacation.start_date);
      const vacationEnd = parseISO(vacation.end_date);
      const effectiveStart = vacationStart > monthStart ? vacationStart : monthStart;
      const effectiveEnd = vacationEnd < monthEnd ? vacationEnd : monthEnd;
      if (effectiveStart > effectiveEnd) return sum;

      let total = 0;
      let currentDate = new Date(effectiveStart);
      while (currentDate <= effectiveEnd) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) total += 8; // jour ouvrable = 8h
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return sum + total;
    }, 0);
    
            const totalHours = monthlyOvertimes.reduce((sum, overtime) => {
              return sum + (overtime.is_recovery ? -overtime.hours : overtime.hours);
            }, 0);
            const approvedHours = monthlyOvertimes
              .filter(overtime => overtime.status === 'approved')
              .reduce((sum, overtime) => {
                return sum + (overtime.is_recovery ? -overtime.hours : overtime.hours);
              }, 0);
            const pendingHours = monthlyOvertimes
              .filter(overtime => overtime.status === 'pending')
              .reduce((sum, overtime) => {
                return sum + (overtime.is_recovery ? -overtime.hours : overtime.hours);
              }, 0);

    return {
      month,
      totalHours: totalHours - recoveryHours, // Soustraire les heures de récupération
      approvedHours: approvedHours - recoveryHours,
      pendingHours,
      recoveryHours,
      count: monthlyOvertimes.length
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendrier principal */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Calendrier des heures supplémentaires
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Cliquez sur un jour pour ajouter ou modifier des heures supplémentaires
            </p>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateClick}
              numberOfMonths={2}
              className="w-full rounded-md border p-0 pointer-events-auto"
              classNames={{
                months: "grid grid-cols-2 gap-0 w-full divide-x divide-border",
                month: "w-full",
                table: "w-full",
                head_row: "grid grid-cols-7 w-full",
                row: "grid grid-cols-7 w-full",
                cell: "p-0",
                day: "w-full h-12 p-0 hover:bg-transparent focus:bg-transparent"
              }}
              locale={fr}
              disabled={(date) => date > new Date()}
              modifiers={{
                approved: approvedDates,
                pending: pendingDates,
                rejected: rejectedDates,
              }}
              modifiersStyles={{
                approved: {
                  backgroundColor: 'hsl(var(--success-soft))',
                  color: 'hsl(var(--success-soft-foreground))',
                },
                pending: {
                  backgroundColor: 'hsl(var(--warning-soft, var(--accent)))',
                },
                rejected: {
                  backgroundColor: 'hsl(var(--destructive-soft, var(--destructive) / 0.18))',
                },
              }}
              components={{
                DayContent: ({ date }) => {
                  const overtime = getOvertimeForDate(date);
                  if (!overtime) {
                    return (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {date.getDate()}
                      </div>
                    );
                  }
                  const statusText = overtime.status === 'approved'
                    ? 'Approuvées'
                    : overtime.status === 'pending'
                      ? 'En attente'
                      : 'Rejetées';
                  return (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative w-full h-full flex items-center justify-center">
                            {date.getDate()}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center" className="max-w-xs">
                          <div className="text-sm font-medium">
                            {format(date, "PPP", { locale: fr })}
                          </div>
                           <div className="text-xs text-muted-foreground">
                             {overtime.is_recovery ? '(Récup) ' : ''}{formatHoursToHoursMinutes(overtime.hours)} • {statusText}
                             {overtime.description && (
                               <div className="mt-1">{overtime.description}</div>
                             )}
                           </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }
              }}
            />
            
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>En attente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Approuvé</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Rejeté</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des heures supplémentaires récentes */}
        {overtimeHours.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Heures récentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overtimeHours.slice(0, 5).map((overtime) => (
                  <div key={overtime.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(overtime.status)}`}></div>
                      <span className="font-medium">
                        {format(parseISO(overtime.date), "dd/MM/yyyy", { locale: fr })}
                      </span>
                       <Badge variant="outline" className={overtime.is_recovery ? "text-blue-600" : ""}>
                         {overtime.is_recovery ? 'Récup ' : ''}{formatHoursToHoursMinutes(overtime.hours)}
                       </Badge>
                      {overtime.description && (
                        <span className="text-sm text-gray-600 truncate max-w-32">{overtime.description}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {overtime.status !== 'approved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDateClick(parseISO(overtime.date))}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {overtime.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await onDeleteOvertime(overtime.id);
                            } catch (error) {
                              console.error('Error deleting overtime:', error);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Statistiques mensuelles */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Statistiques {currentYear}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Heures supplémentaires par mois
            </p>
          </CardHeader>
          <CardContent>
            {(() => {
              // Période annuelle courante
              const yearStart = startOfYear(new Date(currentYear, 0, 1));
              const yearEnd = endOfYear(new Date(currentYear, 11, 31));

              const approvedNetTotal = monthlyStats.reduce((sum, stat) => sum + stat.approvedHours, 0);
              const pendingTotal = monthlyStats.reduce((sum, stat) => sum + stat.pendingHours, 0);
              const recoveryTotal = monthlyStats.reduce((sum, stat) => sum + (stat.recoveryHours || 0), 0);
              const approvedRawTotal = approvedNetTotal + recoveryTotal; // approuvées sans soustraction

              // Conversion en jours (1j = 8h), arrondi au 1/2 jour
              const daysRaw = approvedNetTotal / 8;
              const daysHalf = Math.floor(daysRaw * 2) / 2; // Arrondi vers le bas au 1/2 jour
              const daysRecoveredRaw = recoveryTotal / 8;
              const daysRecoveredHalf = Math.floor(daysRecoveredRaw * 2) / 2;

              const formatDays = (d: number) => {
                if (d === 0.5) return "1/2 journée";
                const str = d.toString().replace(".", ",");
                return `${str}j`;
              };
              return (
                <div className="mb-4 pb-4 border-b">
                  <div className="grid grid-cols-2 gap-y-1 items-center">
                    <span className="font-semibold">Total {currentYear} (net)</span>
                    <span className="font-bold text-xl text-right">{formatHoursToHoursMinutes(approvedNetTotal)}</span>

                    <span className="text-sm text-muted-foreground">Sous-total heures sup approuvées</span>
                    <span className="text-sm text-muted-foreground text-right">{formatHoursToHoursMinutes(approvedRawTotal)}</span>

                    <span className="text-sm text-muted-foreground">Jours à récupérer</span>
                    <span className="text-sm text-muted-foreground text-right">{formatDays(daysHalf)}</span>

                    <span className="text-sm text-muted-foreground">Jours déjà récupérés</span>
                    <span className="text-sm text-muted-foreground text-right">{formatDays(daysRecoveredHalf)}</span>

                    <span className="text-sm text-muted-foreground">En attente</span>
                    <span className="text-sm text-muted-foreground text-right">{formatHoursToHoursMinutes(pendingTotal)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3">
              {monthlyStats.map((stat) => (
                <div key={stat.month.getTime()} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">
                      {format(stat.month, "MMMM yyyy", { locale: fr })}
                    </div>
                    <div className="text-sm text-gray-600">
                      {stat.count} entrée{stat.count > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {formatHoursToHoursMinutes(stat.totalHours)}
                    </div>
                    <div className="text-xs space-x-2">
                      {stat.approvedHours > 0 && (
                        <span className="text-green-600">
                          ✓ {formatHoursToHoursMinutes(stat.approvedHours + (stat.recoveryHours || 0))}
                        </span>
                      )}
                      {stat.pendingHours > 0 && (
                        <span className="text-orange-600">
                          ⏳ {formatHoursToHoursMinutes(stat.pendingHours)}
                        </span>
                      )}
                      {(stat.recoveryHours || 0) > 0 && (
                        <span className="text-blue-600">
                          🔄 -{formatHoursToHoursMinutes(stat.recoveryHours)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
          </CardContent>
        </Card>
      </div>

      {/* Dialog pour ajouter/modifier des heures */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOvertime ? "Modifier" : "Ajouter"} des heures supplémentaires
            </DialogTitle>
            <DialogDescription>
              Saisissez les heures supplémentaires pour la date sélectionnée.
            </DialogDescription>
            {selectedDate && (
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "PPPP", { locale: fr })}
              </p>
            )}
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hours">Heures</Label>
                <Input
                  id="hours"
                  type="number"
                  min="0"
                  max="23"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minutes">Minutes</Label>
                <Input
                  id="minutes"
                  type="number"
                  min="0"
                  max="59"
                  step="15"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recovery"
                checked={isRecovery}
                onCheckedChange={(checked) => setIsRecovery(checked as boolean)}
              />
              <Label htmlFor="recovery" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Récupération d'heures supplémentaires (négatif)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Détails sur les heures supplémentaires..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            {editingOvertime && editingOvertime.status === 'pending' && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                className="mr-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={(() => {
                const hoursValue = parseInt(hours) || 0;
                const minutesValue = parseInt(minutes) || 0;
                return hoursValue === 0 && minutesValue === 0;
              })()}
            >
              {editingOvertime ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}