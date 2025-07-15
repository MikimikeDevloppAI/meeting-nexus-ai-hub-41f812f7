import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, Edit, X, TrendingUp } from "lucide-react";
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";

interface OvertimeHour {
  id: string;
  user_id: string;
  date: string;
  hours: number;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface OvertimeCalendarProps {
  overtimeHours: OvertimeHour[];
  onAddOvertime: (data: {
    date: string;
    hours: number;
    description?: string;
  }) => Promise<void>;
  onEditOvertime: (id: string, data: {
    date: string;
    hours: number;
    description?: string;
  }) => Promise<void>;
  onDeleteOvertime: (id: string) => Promise<void>;
}

export function OvertimeCalendar({ 
  overtimeHours, 
  onAddOvertime, 
  onEditOvertime, 
  onDeleteOvertime 
}: OvertimeCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [showDialog, setShowDialog] = useState(false);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [editingOvertime, setEditingOvertime] = useState<OvertimeHour | null>(null);

  // Créer la liste des jours avec heures supplémentaires
  const overtimeDates = overtimeHours.map(overtime => ({
    date: parseISO(overtime.date),
    overtime
  }));

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
      // Modifier les heures existantes
      setEditingOvertime(existingOvertime);
      const totalMinutes = existingOvertime.hours * 60;
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      setHours(hrs.toString());
      setMinutes(mins.toString());
      setDescription(existingOvertime.description || "");
    } else {
      // Ajouter de nouvelles heures
      setEditingOvertime(null);
      setHours("");
      setMinutes("");
      setDescription("");
    }
    
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedDate) return;
    
    const totalHours = (parseInt(hours) || 0) + (parseInt(minutes) || 0) / 60;
    
    if (totalHours <= 0) return;

    const data = {
      date: selectedDate.toISOString().split('T')[0],
      hours: totalHours,
      description: description.trim() || undefined
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
    
    const totalHours = monthlyOvertimes.reduce((sum, overtime) => sum + overtime.hours, 0);
    const approvedHours = monthlyOvertimes
      .filter(overtime => overtime.status === 'approved')
      .reduce((sum, overtime) => sum + overtime.hours, 0);
    const pendingHours = monthlyOvertimes
      .filter(overtime => overtime.status === 'pending')
      .reduce((sum, overtime) => sum + overtime.hours, 0);

    return {
      month,
      totalHours,
      approvedHours,
      pendingHours,
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
              className="rounded-md border pointer-events-auto"
              locale={fr}
              disabled={(date) => date > new Date()}
              modifiers={{
                overtime: overtimeDates.map(item => item.date)
              }}
              modifiersStyles={{
                overtime: { 
                  position: 'relative'
                }
              }}
              components={{
                DayContent: ({ date }) => {
                  const overtime = getOvertimeForDate(date);
                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {date.getDate()}
                      {overtime && (
                        <div 
                          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${getStatusColor(overtime.status)}`}
                          title={`${overtime.hours}h - ${overtime.status}`}
                        />
                      )}
                    </div>
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
                      <Badge variant="outline">{overtime.hours}h</Badge>
                      {overtime.description && (
                        <span className="text-sm text-gray-600 truncate max-w-32">{overtime.description}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDateClick(parseISO(overtime.date))}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
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
                      {stat.totalHours.toFixed(1)}h
                    </div>
                    <div className="text-xs space-x-2">
                      {stat.approvedHours > 0 && (
                        <span className="text-green-600">
                          ✓ {stat.approvedHours.toFixed(1)}h
                        </span>
                      )}
                      {stat.pendingHours > 0 && (
                        <span className="text-orange-600">
                          ⏳ {stat.pendingHours.toFixed(1)}h
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Résumé annuel */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total {currentYear}</span>
                <span className="font-bold text-xl">
                  {monthlyStats.reduce((sum, stat) => sum + stat.totalHours, 0).toFixed(1)}h
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>Approuvées: {monthlyStats.reduce((sum, stat) => sum + stat.approvedHours, 0).toFixed(1)}h</span>
                <span>En attente: {monthlyStats.reduce((sum, stat) => sum + stat.pendingHours, 0).toFixed(1)}h</span>
              </div>
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
              disabled={!hours || parseInt(hours) === 0}
            >
              {editingOvertime ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}