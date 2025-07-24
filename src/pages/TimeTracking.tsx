import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VacationCalendar } from "@/components/VacationCalendar";
import { OvertimeCalendar } from "@/components/OvertimeCalendar";
import { Clock, Calendar, Plus, Edit, Trash2, CheckCircle, XCircle, AlertCircle, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useForm } from "react-hook-form";
import { formatDistanceToNow, format, startOfYear, endOfYear, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatHoursToHoursMinutes } from "@/utils/timeFormatter";

interface OvertimeHour {
  id: string;
  user_id: string;
  date: string;
  hours: number;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

interface Vacation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  description?: string;
  vacation_type: 'annual' | 'sick' | 'personal' | 'overtime_recovery' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  users?: {
    name: string;
    email: string;
  };
}

interface OvertimeFormData {
  date: Date | undefined;
  hours: number;
  description: string;
}

interface VacationQuota {
  id: string;
  user_id: string;
  year: number;
  quota_days: number;
  created_at: string;
  updated_at: string;
}

interface VacationFormData {
  start_date: string;
  end_date: string;
  vacation_type: string;
  description: string;
}

export default function TimeTracking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [overtimeHours, setOvertimeHours] = useState<OvertimeHour[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [vacationQuotas, setVacationQuotas] = useState<VacationQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOvertimeDialog, setShowOvertimeDialog] = useState(false);
  const [showVacationDialog, setShowVacationDialog] = useState(false);
  const [showVacationCalendar, setShowVacationCalendar] = useState(false);
  const [editingOvertime, setEditingOvertime] = useState<OvertimeHour | null>(null);
  const [editingVacation, setEditingVacation] = useState<Vacation | null>(null);

  const overtimeForm = useForm<OvertimeFormData>({
    defaultValues: {
      date: new Date(),
      hours: 0,
      description: ""
    }
  });

  const vacationForm = useForm<VacationFormData>({
    defaultValues: {
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      vacation_type: "annual",
      description: ""
    }
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    await Promise.all([fetchOvertimeHours(), fetchVacations(), fetchVacationQuotas()]);
    setLoading(false);
  };

  const fetchVacationQuotas = async () => {
    try {
      const { data, error } = await supabase
        .from('vacation_quotas')
        .select('*')
        .eq('user_id', user?.id)
        .order('year', { ascending: false });

      if (error) throw error;
      setVacationQuotas(data || []);
    } catch (error: any) {
      console.error('Error fetching vacation quotas:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les quotas de vacances",
        variant: "destructive",
      });
    }
  };

  const getQuotaForUser = (year: number) => {
    // Quota de base pour l'année
    const baseQuota = vacationQuotas.find(q => q.year === year)?.quota_days || 0;
    
    // Si c'est 2026 ou après, on ajoute le quota non utilisé de l'année précédente
    if (year >= 2026) {
      const previousYear = year - 1;
      const previousQuota = vacationQuotas.find(q => q.year === previousYear)?.quota_days || 0;
      
      // Calculer les jours utilisés l'année précédente (SEULEMENT les congés annuels)
      const previousYearVacations = vacations.filter(vacation => {
        const vacationYear = new Date(vacation.start_date).getFullYear();
        return vacation.user_id === user?.id && 
               vacationYear === previousYear && 
               vacation.status === 'approved' &&
               vacation.vacation_type === 'annual'; // SEULEMENT les congés annuels
      });
      
      const usedDaysPreviousYear = previousYearVacations.reduce((sum, v) => sum + v.days_count, 0);
      const remainingFromPreviousYear = Math.max(0, previousQuota - usedDaysPreviousYear);
      
      return baseQuota + remainingFromPreviousYear;
    }
    
    return baseQuota;
  };

  const fetchOvertimeHours = async () => {
    try {
      const { data, error } = await supabase
        .from('overtime_hours')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setOvertimeHours(data || []);
    } catch (error: any) {
      console.error('Error fetching overtime hours:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les heures supplémentaires",
        variant: "destructive",
      });
    }
  };

  const fetchVacations = async () => {
    try {
      // D'abord récupérer les vacances avec les jours détaillés
      const { data: vacationsData, error: vacationsError } = await supabase
        .from('vacations')
        .select(`
          *,
          vacation_days (
            vacation_date,
            is_half_day,
            half_day_period
          )
        `)
        .order('start_date', { ascending: false });

      if (vacationsError) throw vacationsError;

      // Ensuite récupérer les infos utilisateurs séparément
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email');

      if (usersError) throw usersError;

      // Combiner les données
      const vacationsWithUsers = (vacationsData || []).map(vacation => {
        const user = usersData?.find(u => u.id === vacation.user_id);
        return {
          ...vacation,
          users: user ? { name: user.name, email: user.email } : null
        };
      });

      setVacations(vacationsWithUsers);
    } catch (error: any) {
      console.error('Error fetching vacations:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les vacances",
        variant: "destructive",
      });
    }
  };

  const calculateDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const onSubmitOvertime = async (data: OvertimeFormData) => {
    if (!user || !data.date) return;

    try {
      const dateString = data.date.toISOString().split('T')[0];
      
      if (editingOvertime) {
        const { error } = await supabase
          .from('overtime_hours')
          .update({
            date: dateString,
            hours: data.hours,
            description: data.description
          })
          .eq('id', editingOvertime.id);

        if (error) throw error;
        toast({
          title: "Heures supplémentaires modifiées",
          description: "Les heures supplémentaires ont été mises à jour",
        });
      } else {
        const { error } = await supabase
          .from('overtime_hours')
          .insert({
            user_id: user.id,
            date: dateString,
            hours: data.hours,
            description: data.description
          });

        if (error) throw error;
        toast({
          title: "Heures supplémentaires ajoutées",
          description: "Les heures supplémentaires ont été enregistrées",
        });
      }

      fetchOvertimeHours();
      setShowOvertimeDialog(false);
      setEditingOvertime(null);
      overtimeForm.reset();
    } catch (error: any) {
      console.error('Error saving overtime:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les heures supplémentaires",
        variant: "destructive",
      });
    }
  };

  const onSubmitVacation = async (data: VacationFormData) => {
    if (!user) return;

    // Validation côté client
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    
    if (endDate < startDate) {
      toast({
        title: "Erreur de dates",
        description: "La date de fin doit être postérieure à la date de début",
        variant: "destructive",
      });
      return;
    }

    try {
      const daysCount = calculateDays(data.start_date, data.end_date);

      if (editingVacation) {
        const { error } = await supabase
          .from('vacations')
          .update({
            start_date: data.start_date,
            end_date: data.end_date,
            days_count: daysCount,
            vacation_type: data.vacation_type,
            description: data.description
          })
          .eq('id', editingVacation.id);

        if (error) throw error;
        toast({
          title: "Vacances modifiées",
          description: "Les vacances ont été mises à jour",
        });
      } else {
        const { error } = await supabase
          .from('vacations')
          .insert({
            user_id: user.id,
            start_date: data.start_date,
            end_date: data.end_date,
            days_count: daysCount,
            vacation_type: data.vacation_type,
            description: data.description
          });

        if (error) throw error;
        toast({
          title: "Vacances ajoutées",
          description: "Les vacances ont été enregistrées",
        });
      }

      fetchVacations();
      setShowVacationDialog(false);
      setShowVacationCalendar(false);
      setEditingVacation(null);
      vacationForm.reset();
    } catch (error: any) {
      console.error('Error saving vacation:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les vacances",
        variant: "destructive",
      });
    }
  };

  // Nouvelle fonction pour gérer les dates multiples du calendrier
  const onSubmitVacationCalendar = async (data: { dates: string[]; vacation_type: string; description: string; isHalfDay: boolean; }) => {
    if (!user || data.dates.length === 0) return;

    try {
      // Trier les dates pour obtenir la première et la dernière
      const sortedDates = data.dates.sort();
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];
      const daysCount = data.isHalfDay ? data.dates.length * 0.5 : data.dates.length;

      let vacationId: string;

      if (editingVacation) {
        const { error } = await supabase
          .from('vacations')
          .update({
            start_date: startDate,
            end_date: endDate,
            days_count: daysCount,
            vacation_type: data.vacation_type,
            description: data.description
          })
          .eq('id', editingVacation.id);

        if (error) throw error;
        vacationId = editingVacation.id;

        // Supprimer les anciens jours de vacances
        await supabase
          .from('vacation_days')
          .delete()
          .eq('vacation_id', vacationId);

        toast({
          title: "Vacances modifiées",
          description: "Les vacances ont été mises à jour",
        });
      } else {
        const { data: vacation, error } = await supabase
          .from('vacations')
          .insert({
            user_id: user.id,
            start_date: startDate,
            end_date: endDate,
            days_count: daysCount,
            vacation_type: data.vacation_type,
            description: data.description
          })
          .select('id')
          .single();

        if (error) throw error;
        vacationId = vacation.id;

        const description = data.isHalfDay ? 
          `${data.dates.length} demi-journée${data.dates.length > 1 ? 's' : ''} de vacances enregistrée${data.dates.length > 1 ? 's' : ''}` :
          `${data.dates.length} jour${data.dates.length > 1 ? 's' : ''} de vacances enregistré${data.dates.length > 1 ? 's' : ''}`;
        
        toast({
          title: "Vacances ajoutées",
          description,
        });
      }

      // Créer les entrées vacation_days pour chaque date
      const vacationDaysData = data.dates.map(date => ({
        vacation_id: vacationId,
        vacation_date: date,
        is_half_day: data.isHalfDay,
        half_day_period: data.isHalfDay ? 'morning' : null
      }));

      const { error: daysError } = await supabase
        .from('vacation_days')
        .insert(vacationDaysData);

      if (daysError) throw daysError;

      fetchVacations();
      setShowVacationCalendar(false);
      setEditingVacation(null);
    } catch (error: any) {
      console.error('Error saving vacation:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les vacances",
        variant: "destructive",
      });
    }
  };

  // Fonctions pour le calendrier des heures supplémentaires
  const onAddOvertime = async (data: { date: string; hours: number; description?: string; }) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('overtime_hours')
        .insert({
          user_id: user.id,
          date: data.date,
          hours: data.hours,
          description: data.description
        });

      if (error) throw error;
      
      toast({
        title: "Heures ajoutées",
        description: `${formatHoursToHoursMinutes(data.hours)} d'heures supplémentaires enregistrées`,
      });
      
      fetchOvertimeHours();
    } catch (error: any) {
      console.error('Error adding overtime:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter les heures supplémentaires",
        variant: "destructive",
      });
    }
  };

  const onEditOvertime = async (id: string, data: { date: string; hours: number; description?: string; }) => {
    try {
      const { error } = await supabase
        .from('overtime_hours')
        .update({
          date: data.date,
          hours: data.hours,
          description: data.description
        })
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Heures modifiées",
        description: "Les heures supplémentaires ont été mises à jour",
      });
      
      fetchOvertimeHours();
    } catch (error: any) {
      console.error('Error editing overtime:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier les heures supplémentaires",
        variant: "destructive",
      });
    }
  };

  const onDeleteOvertimeCalendar = async (id: string) => {
    try {
      const { error } = await supabase
        .from('overtime_hours')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Heures supprimées",
        description: "Les heures supplémentaires ont été supprimées",
      });
      
      fetchOvertimeHours();
    } catch (error: any) {
      console.error('Error deleting overtime:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les heures supplémentaires",
        variant: "destructive",
      });
    }
  };

  const deleteOvertime = async (id: string) => {
    try {
      const { error } = await supabase
        .from('overtime_hours')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchOvertimeHours();
      toast({
        title: "Heures supprimées",
        description: "Les heures supplémentaires ont été supprimées",
      });
    } catch (error: any) {
      console.error('Error deleting overtime:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les heures supplémentaires",
        variant: "destructive",
      });
    }
  };

  const deleteVacation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vacations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchVacations();
      toast({
        title: "Vacances supprimées",
        description: "Les vacances ont été supprimées",
      });
    } catch (error: any) {
      console.error('Error deleting vacation:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les vacances",
        variant: "destructive",
      });
    }
  };

  const editOvertime = (overtime: OvertimeHour) => {
    setEditingOvertime(overtime);
    overtimeForm.reset({
      date: new Date(overtime.date),
      hours: overtime.hours,
      description: overtime.description || ""
    });
    setShowOvertimeDialog(true);
  };

  const editVacation = (vacation: Vacation) => {
    setEditingVacation(vacation);
    setShowVacationCalendar(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { 
        icon: <AlertCircle className="h-3 w-3" />, 
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        label: "En attente"
      },
      approved: { 
        icon: <CheckCircle className="h-3 w-3" />, 
        className: "bg-green-100 text-green-800 border-green-200",
        label: "Approuvé"
      },
      rejected: { 
        icon: <XCircle className="h-3 w-3" />, 
        className: "bg-red-100 text-red-800 border-red-200",
        label: "Rejeté"
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant="outline" className={`flex items-center gap-1 ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>
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

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gestion du temps</h1>
          <p className="text-muted-foreground">Gérer vos heures supplémentaires et vacances</p>
        </div>
      </div>

      <Tabs defaultValue="overtime" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overtime" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Heures supplémentaires
          </TabsTrigger>
          <TabsTrigger value="vacations" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Vacances
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overtime" className="space-y-6">
          <OvertimeCalendar
            overtimeHours={overtimeHours.filter(overtime => overtime.user_id === user?.id)}
            vacations={vacations.filter(vacation => vacation.user_id === user?.id)}
            onAddOvertime={onAddOvertime}
            onEditOvertime={onEditOvertime}
            onDeleteOvertime={onDeleteOvertimeCalendar}
          />
        </TabsContent>

        <TabsContent value="vacations" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Mes vacances</h2>
            <Button onClick={() => setShowVacationCalendar(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Demander des vacances
            </Button>
          </div>

          {/* Décompte des vacances pour l'année en cours */}
          {(() => {
            const currentYear = new Date().getFullYear();
            const yearStart = startOfYear(new Date(currentYear, 0, 1));
            const yearEnd = endOfYear(new Date(currentYear, 11, 31));
            
            const userVacations = vacations.filter(vacation => 
              vacation.user_id === user?.id && 
              vacation.status === 'approved' &&
              vacation.vacation_type === 'annual' && // SEULEMENT les congés annuels
              isWithinInterval(parseISO(vacation.start_date), { start: yearStart, end: yearEnd })
            );
            
            const totalDays = userVacations.reduce((sum, vacation) => sum + vacation.days_count, 0);
            const quota = getQuotaForUser(currentYear);
            const remainingDays = currentYear === 2025 ? quota - totalDays : Math.max(0, quota - totalDays);
            
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Décompte des vacances {currentYear}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Jours de vacances approuvés / quota disponible
                  </p>
                </CardHeader>
                <CardContent>
                   <div className={`grid ${currentYear === 2025 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'} gap-6`}>
                     <div className="text-center">
                       <div className="text-3xl font-bold text-primary">{totalDays}</div>
                       <div className="text-sm text-muted-foreground">jours pris</div>
                     </div>
                     
                     {currentYear !== 2025 && (
                       <div className="text-center">
                         <div className="text-3xl font-bold text-gray-600">{quota}</div>
                         <div className="text-sm text-muted-foreground">quota total</div>
                         {currentYear >= 2026 && quota > 0 && (
                           <div className="text-xs text-blue-600 mt-1">
                             (inclut report année précédente)
                           </div>
                         )}
                       </div>
                     )}
                     
                     <div className="text-center">
                       <div className={`text-3xl font-bold ${remainingDays > 0 ? 'text-green-600' : 'text-red-600'}`}>
                         {remainingDays}
                       </div>
                       <div className="text-sm text-muted-foreground">
                         jours restants
                       </div>
                     </div>
                   </div>
                  
                  {quota > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span>Progression</span>
                        <span>{totalDays} / {quota}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            totalDays <= quota ? 'bg-blue-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${Math.min(100, (totalDays / quota) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4 text-xs text-muted-foreground">
                    {userVacations.length} demande{userVacations.length > 1 ? 's' : ''} approuvée{userVacations.length > 1 ? 's' : ''}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <div className="grid gap-4">
            {vacations.filter(vacation => vacation.user_id === user?.id).length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">Aucune demande de vacances trouvée</p>
                </CardContent>
              </Card>
            ) : (
              vacations.filter(vacation => vacation.user_id === user?.id).map((vacation) => (
                <Card key={vacation.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium">
                            {vacation.users?.name || 'Utilisateur'}
                          </h3>
                          <Badge variant="outline">
                            {getVacationTypeLabel(vacation.vacation_type)}
                          </Badge>
                          <Badge variant="outline">
                            {vacation.days_count % 1 === 0 ? 
                              `${vacation.days_count} jour${vacation.days_count > 1 ? 's' : ''}` :
                              `${vacation.days_count} jour${vacation.days_count > 1 ? 's' : ''} (${vacation.days_count * 2} demi-journées)`
                            }
                          </Badge>
                          {getStatusBadge(vacation.status)}
                        </div>
                        <p className="text-sm">
                          Du {new Date(vacation.start_date).toLocaleDateString('fr-FR')} 
                          au {new Date(vacation.end_date).toLocaleDateString('fr-FR')}
                        </p>
                        {vacation.description && (
                          <p className="text-sm text-gray-600">{vacation.description}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          Créé {formatDistanceToNow(new Date(vacation.created_at), { 
                            addSuffix: true, 
                            locale: fr 
                          })}
                        </p>
                      </div>
                      {vacation.status === 'pending' && vacation.user_id === user?.id && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => editVacation(vacation)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteVacation(vacation.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog pour les heures supplémentaires */}
      <Dialog open={showOvertimeDialog} onOpenChange={setShowOvertimeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOvertime ? "Modifier les heures supplémentaires" : "Ajouter des heures supplémentaires"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={overtimeForm.handleSubmit(onSubmitOvertime)} className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !overtimeForm.watch("date") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {overtimeForm.watch("date") ? (
                      format(overtimeForm.watch("date") as Date, "PPP", { locale: fr })
                    ) : (
                      <span>Sélectionner une date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={overtimeForm.watch("date")}
                    onSelect={(date) => overtimeForm.setValue("date", date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">Nombre d'heures (minimum 15 minutes)</Label>
              <Input
                id="hours"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                placeholder="0.25 (15 min), 0.5 (30 min), 1 (1h)..."
                {...overtimeForm.register("hours", { required: true, valueAsNumber: true, min: 0.25 })}
              />
              <p className="text-xs text-gray-500">
                Utilisez 0.25 pour 15 minutes, 0.5 pour 30 minutes, 1 pour 1 heure, etc.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                {...overtimeForm.register("description")}
                placeholder="Détails sur les heures supplémentaires..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowOvertimeDialog(false)}>
                Annuler
              </Button>
              <Button 
                type="submit" 
                disabled={(() => {
                  const isValid = overtimeForm.formState.isValid;
                  const hasDate = !!overtimeForm.watch("date");
                  const hours = overtimeForm.watch("hours");
                  const hasValidHours = hours >= 0.25;
                  
                  console.log("Form validation:", { 
                    isValid, 
                    hasDate, 
                    hours, 
                    hasValidHours,
                    errors: overtimeForm.formState.errors 
                  });
                  
                  return !isValid || !hasDate || !hasValidHours;
                })()}
              >
                {editingOvertime ? "Modifier" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog pour les vacances */}
      <Dialog open={showVacationDialog} onOpenChange={setShowVacationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVacation ? "Modifier la demande de vacances" : "Demander des vacances"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={vacationForm.handleSubmit(onSubmitVacation)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Date de début</Label>
                <Input
                  id="start_date"
                  type="date"
                  {...vacationForm.register("start_date", { required: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Date de fin</Label>
                <Input
                  id="end_date"
                  type="date"
                  {...vacationForm.register("end_date", { required: true })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vacation_type">Type de congé</Label>
              <Select 
                value={vacationForm.watch("vacation_type")} 
                onValueChange={(value) => vacationForm.setValue("vacation_type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Congés annuels</SelectItem>
                  <SelectItem value="sick">Congé maladie</SelectItem>
                  <SelectItem value="personal">Congé personnel</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vacation_description">Description (optionnel)</Label>
              <Textarea
                id="vacation_description"
                {...vacationForm.register("description")}
                placeholder="Raison ou détails des vacances..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowVacationDialog(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {editingVacation ? "Modifier" : "Demander"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Calendrier interactif pour les vacances */}
      <Dialog open={showVacationCalendar} onOpenChange={setShowVacationCalendar}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingVacation ? "Modifier les vacances" : "Demander des vacances"}
            </DialogTitle>
          </DialogHeader>
          <VacationCalendar
            onSubmit={onSubmitVacationCalendar}
            onCancel={() => {
              setShowVacationCalendar(false);
              setEditingVacation(null);
            }}
            editingData={editingVacation ? {
              start_date: editingVacation.start_date,
              end_date: editingVacation.end_date,
              vacation_type: editingVacation.vacation_type,
              description: editingVacation.description || "",
              days_count: editingVacation.days_count
            } : undefined}
            existingVacations={vacations.filter(vacation => vacation.user_id === user?.id)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}