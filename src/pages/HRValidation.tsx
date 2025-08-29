import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock, Calendar, Check, X, AlertCircle, CheckCircle, XCircle, Users, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow, format, startOfYear, endOfYear, isWithinInterval, parseISO, eachMonthOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatHoursToHoursMinutes } from "@/utils/timeFormatter";
import { TeamVacationCalendar } from "@/components/TeamVacationCalendar";

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
  is_recovery?: boolean;
  users: {
    name: string;
    email: string;
  };
}

interface Vacation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  description?: string;
  vacation_type: 'annual' | 'sick' | 'personal' | 'other' | 'overtime_recovery';
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  users: {
    name: string;
    email: string;
  };
  vacation_days?: Array<{
    vacation_date: string;
    is_half_day: boolean;
    half_day_period: string | null;
  }>;
}

interface VacationQuota {
  id: string;
  user_id: string;
  year: number;
  quota_days: number;
  created_at: string;
  updated_at: string;
}

export default function HRValidation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [overtimeHours, setOvertimeHours] = useState<OvertimeHour[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [vacationQuotas, setVacationQuotas] = useState<VacationQuota[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [quotaYear, setQuotaYear] = useState<number>(new Date().getFullYear());
  const [quotaValues, setQuotaValues] = useState<{ [userId: string]: number }>({});

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    await Promise.all([fetchOvertimeHours(), fetchVacations(), fetchVacationQuotas(), fetchUsers()]);
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('email', ['contacto@eyung.ch', 'emilie.eyung@gmail.com', 'leila.eyung@gmail.com']);

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les utilisateurs",
        variant: "destructive",
      });
    }
  };

  const fetchVacationQuotas = async () => {
    try {
      const { data, error } = await supabase
        .from('vacation_quotas')
        .select('*')
        .order('year', { ascending: false });

      if (error) throw error;
      setVacationQuotas(data || []);
      
      // Initialiser les valeurs de quota pour l'interface
      const quotasMap: { [userId: string]: number } = {};
      data?.forEach(quota => {
        if (quota.year === quotaYear) {
          quotasMap[quota.user_id] = quota.quota_days;
        }
      });
      setQuotaValues(quotasMap);
    } catch (error: any) {
      console.error('Error fetching vacation quotas:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les quotas de vacances",
        variant: "destructive",
      });
    }
  };

  const updateVacationQuota = async (userId: string, quotaDays: number) => {
    try {
      const { error } = await supabase
        .from('vacation_quotas')
        .upsert({
          user_id: userId,
          year: quotaYear,
          quota_days: quotaDays
        }, {
          onConflict: 'user_id,year'
        });

      if (error) throw error;

      fetchVacationQuotas();
      toast({
        title: "Quota mis à jour",
        description: `Le quota de vacances a été défini à ${quotaDays} jours pour ${quotaYear}`,
      });
    } catch (error: any) {
      console.error('Error updating vacation quota:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le quota",
        variant: "destructive",
      });
    }
  };

  const fetchOvertimeHours = async () => {
    try {
      // Utiliser une fonction PostgreSQL pour bypasser les RLS
      const { data, error } = await supabase.rpc('get_all_overtime_hours');
      
      console.log('RPC data:', data);
      console.log('RPC error:', error);

      if (error) {
        // Fallback: essayer avec une requête normale
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('overtime_hours')
          .select(`
            *,
            users(name, email)
          `)
          .order('date', { ascending: false });

        if (fallbackError) throw fallbackError;
        
        console.log('Fallback data:', fallbackData);
        
        // Transformer les données pour correspondre à l'interface attendue
        const transformedData = (fallbackData || []).map(item => ({
          ...item,
          users: item.users || { name: '', email: '' }
        }));
        
        setOvertimeHours(transformedData);
      } else {
        console.log('Setting data from RPC:', data);
        setOvertimeHours(data || []);
      }
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
      const { data, error } = await supabase
        .from('vacations')
        .select(`
          *,
          users(name, email),
          vacation_days(
            vacation_date,
            is_half_day,
            half_day_period
          )
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setVacations(data || []);
    } catch (error: any) {
      console.error('Error fetching vacations:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les vacances",
        variant: "destructive",
      });
    }
  };

  const updateOvertimeStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('overtime_hours')
        .update({
          status,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      fetchOvertimeHours();
      toast({
        title: status === 'approved' ? "Heures approuvées" : "Heures rejetées",
        description: `Les heures supplémentaires ont été ${status === 'approved' ? 'approuvées' : 'rejetées'}`,
      });
    } catch (error: any) {
      console.error('Error updating overtime status:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    }
  };

  const updateVacationStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('vacations')
        .update({
          status,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      fetchVacations();
      toast({
        title: status === 'approved' ? "Vacances approuvées" : "Vacances rejetées",
        description: `Les vacances ont été ${status === 'approved' ? 'approuvées' : 'rejetées'}`,
      });
    } catch (error: any) {
      console.error('Error updating vacation status:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    }
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
      other: "Autre",
      overtime_recovery: "Récupération heures supplémentaires"
    };
    return types[type as keyof typeof types] || type;
  };

  const filteredOvertimeHours = overtimeHours.filter(overtime => {
    const overtimeYear = new Date(overtime.date).getFullYear();
    const statusMatch = statusFilter === "all" || overtime.status === statusFilter;
    return statusMatch && overtimeYear === selectedYear;
  });

  const filteredVacations = vacations.filter(vacation => {
    const vacationYear = new Date(vacation.start_date).getFullYear();
    const statusMatch = statusFilter === "all" || vacation.status === statusFilter;
    return statusMatch && vacationYear === selectedYear;
  });

  // Calculer les heures de récupération à partir des vacances de type "overtime_recovery"
  const recoveryHours = vacations
    .filter(vacation => {
      const vacationYear = new Date(vacation.start_date).getFullYear();
      return vacation.vacation_type === 'overtime_recovery' && 
             vacation.status === 'approved' &&
             vacationYear === selectedYear;
    })
    .reduce((sum, vacation) => {
      // Calculer les heures basées sur vacation_days
      if (vacation.vacation_days && vacation.vacation_days.length > 0) {
        return sum + vacation.vacation_days.reduce((daySum, day) => {
          return daySum + (day.is_half_day ? 4 : 8);
        }, 0);
      }
      // Fallback sur l'ancien calcul si pas de vacation_days
      const hoursPerDay = vacation.days_count % 1 === 0 ? 8 : 4;
      return sum + hoursPerDay;
    }, 0);

  const overtimeStats = {
    pending: overtimeHours.filter(o => o.status === 'pending' && new Date(o.date).getFullYear() === selectedYear).length,
    approved: overtimeHours.filter(o => o.status === 'approved' && new Date(o.date).getFullYear() === selectedYear).length,
    rejected: overtimeHours.filter(o => o.status === 'rejected' && new Date(o.date).getFullYear() === selectedYear).length,
    totalHours: overtimeHours.filter(o => o.status === 'approved' && new Date(o.date).getFullYear() === selectedYear).reduce((sum, o) => sum + (o.is_recovery ? -o.hours : o.hours), 0),
    recoveryHours: recoveryHours,
    balanceHours: overtimeHours.filter(o => o.status === 'approved' && new Date(o.date).getFullYear() === selectedYear).reduce((sum, o) => sum + (o.is_recovery ? -o.hours : o.hours), 0) - recoveryHours
  };

  const vacationStats = {
    pending: vacations.filter(v => v.status === 'pending' && new Date(v.start_date).getFullYear() === selectedYear).length,
    approved: vacations.filter(v => v.status === 'approved' && new Date(v.start_date).getFullYear() === selectedYear).length,
    rejected: vacations.filter(v => v.status === 'rejected' && new Date(v.start_date).getFullYear() === selectedYear).length,
    totalDays: vacations.filter(v => v.status === 'approved' && new Date(v.start_date).getFullYear() === selectedYear).reduce((sum, v) => sum + v.days_count, 0)
  };

  // Utilisateurs spécifiques à analyser
  const specificUsers = [
    { name: "Sybille Peguiron", email: "contacto@eyung.ch" },
    { name: "Emilie Doy", email: "emilie.eyung@gmail.com" },
    { name: "Leila Burnier-Framboret", email: "leila.eyung@gmail.com" }
  ];

  // Calculer les décomptes de vacances pour l'année sélectionnée
  const yearStart = startOfYear(new Date(selectedYear, 0, 1));
  const yearEnd = endOfYear(new Date(selectedYear, 11, 31));

  const getQuotaForUser = (userId: string, year: number) => {
    // Quota de base pour l'année
    const baseQuota = vacationQuotas.find(q => q.user_id === userId && q.year === year)?.quota_days || 0;
    
    // Si c'est 2026 ou après, on ajoute le quota non utilisé de l'année précédente
    if (year >= 2026) {
      const previousYear = year - 1;
      const previousQuota = vacationQuotas.find(q => q.user_id === userId && q.year === previousYear)?.quota_days || 0;
      
      // Calculer les jours utilisés l'année précédente (SEULEMENT les congés annuels)
      const previousYearVacations = vacations.filter(vacation => {
        const vacationYear = new Date(vacation.start_date).getFullYear();
        return vacation.user_id === userId && 
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

  const getVacationSummaryForUser = (userEmail: string) => {
    const userVacations = vacations.filter(v => 
      v.users.email === userEmail && 
      v.status === 'approved' &&
      v.vacation_type === 'annual' && // SEULEMENT les congés annuels
      isWithinInterval(parseISO(v.start_date), { start: yearStart, end: yearEnd })
    );
    
    // Calculer le total des jours basé sur vacation_days si disponible
    const totalDays = userVacations.reduce((sum, v) => {
      if (v.vacation_days && v.vacation_days.length > 0) {
        return sum + v.vacation_days.reduce((daySum, day) => {
          return daySum + (day.is_half_day ? 0.5 : 1);
        }, 0);
      }
      // Fallback sur l'ancien calcul
      return sum + v.days_count;
    }, 0);
    
    return {
      totalDays,
      count: userVacations.length
    };
  };

  // Calculer les heures supplémentaires par mois pour chaque utilisateur
  const monthsOfYear = eachMonthOfInterval({
    start: yearStart,
    end: yearEnd
  });

  const getOvertimeByUserAndMonth = () => {
    const result: { [key: string]: { [key: string]: number } } = {};
    
    specificUsers.forEach(user => {
      result[user.email] = {};
      monthsOfYear.forEach(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        const monthlyOvertimes = overtimeHours.filter(overtime => 
          overtime.users.email === user.email &&
          overtime.status === 'approved' &&
          isWithinInterval(parseISO(overtime.date), { start: monthStart, end: monthEnd })
        );
        
        result[user.email][format(month, 'yyyy-MM')] = monthlyOvertimes.reduce((sum, o) => {
          return sum + (o.is_recovery ? -o.hours : o.hours);
        }, 0);
      });
    });
    
    return result;
  };

  const overtimeByUserAndMonth = getOvertimeByUserAndMonth();

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
    <div className="space-y-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Validation RH</h1>
          <p className="text-muted-foreground">Gestion et validation des heures supplémentaires et vacances</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="year-select">Année :</Label>
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                const currentYear = new Date().getFullYear();
                const years = [];
                for (let year = 2025; year <= currentYear; year++) {
                  years.push(year);
                }
                return years.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Statistiques par personne */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {specificUsers.map((person) => {
          const matched = users.find(u => u.email === person.email);
          const taken = getVacationSummaryForUser(person.email).totalDays;
          const quota = matched ? getQuotaForUser(matched.id, selectedYear) : 0;
          const remaining = Math.max(0, quota - taken);
          const approvedOvertime = overtimeHours
            .filter(o => o.users.email === person.email && o.status === 'approved' && isWithinInterval(parseISO(o.date), { start: yearStart, end: yearEnd }))
            .reduce((sum, o) => sum + (o.is_recovery ? -o.hours : o.hours), 0);

          // Calcul des jours récupérés (récupération heures sup approuvées)
          const recoveryVacations = vacations.filter(v => 
            v.users.email === person.email && 
            v.status === 'approved' && 
            v.vacation_type === 'overtime_recovery' &&
            isWithinInterval(parseISO(v.start_date), { start: yearStart, end: yearEnd })
          );
          const recoveredDays = recoveryVacations.reduce((sum, v) => {
            if (v.vacation_days && v.vacation_days.length > 0) {
              return sum + v.vacation_days.reduce((ds, d) => ds + (d.is_half_day ? 0.5 : 1), 0);
            }
            return sum + v.days_count;
          }, 0);

          // Jours à récupérer (arrondi au 1/2 jour)
          const recoveredHoursUsed = recoveredDays * 8;
          const daysToRecoverRaw = Math.max(0, (approvedOvertime - recoveredHoursUsed) / 8);
          const daysToRecover = Math.floor(daysToRecoverRaw * 2) / 2;
          const daysToRecoverDisplay = daysToRecover.toString().replace('.', ',');

          const firstName = person.name.split(' ')[0];
          return (
            <Card key={person.email} className="shadow-md hover:shadow-lg transition-shadow bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{firstName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Quota</span>
                  <span className="font-semibold">{quota} j</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Vacances posées</span>
                  <span className="font-semibold">{taken} j</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Jours récupérés</span>
                  <span className="font-semibold">{Math.max(0, taken - quota)} j</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Heures supplémentaires</span>
                  <span className="font-semibold">{formatHoursToHoursMinutes(approvedOvertime)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Heures sup. restantes</span>
                  <span className="font-semibold">{formatHoursToHoursMinutes(approvedOvertime - (Math.max(0, taken - quota) * 8))}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="overtime" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-white hover:bg-gray-50 transition-colors">
          <TabsTrigger value="overtime" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Heures supplémentaires ({filteredOvertimeHours.length})
          </TabsTrigger>
          <TabsTrigger value="vacations" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Vacances ({filteredVacations.length})
          </TabsTrigger>
          <TabsTrigger value="quotas" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Quotas de vacances
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overtime" className="space-y-4">
          <Card className="shadow-md hover:shadow-lg transition-shadow bg-white">
            <CardContent className="pt-6">
              {/* Filtres */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={statusFilter === "pending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("pending")}
                >
                  En attente
                </Button>
                <Button
                  variant={statusFilter === "approved" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("approved")}
                >
                  Approuvé
                </Button>
                <Button
                  variant={statusFilter === "rejected" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("rejected")}
                >
                  Rejeté
                </Button>
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  Tout
                </Button>
              </div>

              {filteredOvertimeHours.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Aucune heure supplémentaire trouvée</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOvertimeHours.map((overtime) => (
                    <Card key={overtime.id} className="border bg-white">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-medium">{overtime.users.name}</h3>
                              <Badge variant="outline">{overtime.users.email}</Badge>
                              <Badge variant="outline" className={overtime.is_recovery ? "text-blue-600" : ""}>
                                {overtime.is_recovery ? '-' : ''}{formatHoursToHoursMinutes(overtime.hours)} {overtime.is_recovery ? '(Récup)' : ''}
                              </Badge>
                              {getStatusBadge(overtime.status)}
                            </div>
                            <p className="text-sm">
                              Date: {new Date(overtime.date).toLocaleDateString('fr-FR')}
                            </p>
                            {overtime.description && (
                              <p className="text-sm text-gray-600">{overtime.description}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              Demandé {formatDistanceToNow(new Date(overtime.created_at), { 
                                addSuffix: true, 
                                locale: fr 
                              })}
                            </p>
                          </div>
                          {overtime.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateOvertimeStatus(overtime.id, 'approved')}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approuver
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateOvertimeStatus(overtime.id, 'rejected')}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Rejeter
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tableau mensuel des heures supplémentaires */}
          <Card className="shadow-md hover:shadow-lg transition-shadow bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Heures supplémentaires par mois {selectedYear}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Heures supplémentaires approuvées par mois pour chaque utilisateur
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      {monthsOfYear.map((month) => (
                        <TableHead key={format(month, 'yyyy-MM')} className="text-center min-w-20">
                          {format(month, 'MMM', { locale: fr })}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {specificUsers.map((user) => {
                      const userOvertimes = overtimeByUserAndMonth[user.email] || {};
                      const yearTotal = Object.values(userOvertimes).reduce((sum: number, hours) => sum + (hours as number), 0);
                      
                      return (
                        <TableRow key={user.email}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{user.name}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </TableCell>
                          {monthsOfYear.map((month) => {
                            const monthKey = format(month, 'yyyy-MM');
                            const hours = userOvertimes[monthKey] || 0;
                            return (
                               <TableCell key={monthKey} className="text-center">
                                 {hours !== 0 ? (
                                    <Badge variant="outline" className={`font-mono ${hours < 0 ? "text-blue-600" : ""}`}>
                                      {hours < 0 ? '-' : ''}{formatHoursToHoursMinutes(Math.abs(hours))}
                                    </Badge>
                                 ) : (
                                   <span className="text-gray-400">-</span>
                                 )}
                               </TableCell>
                            );
                          })}
                           <TableCell className="text-center">
                             <Badge variant="default" className={`font-mono font-bold ${yearTotal < 0 ? "text-blue-600" : ""}`}>
                               {yearTotal < 0 ? '-' : ''}{formatHoursToHoursMinutes(Math.abs(yearTotal))}
                             </Badge>
                           </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vacations" className="space-y-4">
          <Card className="shadow-md hover:shadow-lg transition-shadow bg-white">
            <CardContent className="pt-6">
              {/* Filtres */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={statusFilter === "pending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("pending")}
                >
                  En attente
                </Button>
                <Button
                  variant={statusFilter === "approved" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("approved")}
                >
                  Approuvé
                </Button>
                <Button
                  variant={statusFilter === "rejected" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("rejected")}
                >
                  Rejeté
                </Button>
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  Tout
                </Button>
              </div>

              {filteredVacations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Aucune demande de vacances trouvée</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredVacations.map((vacation) => {
                    // Calculer le nombre de jours réel basé sur vacation_days
                    const actualDaysCount = vacation.vacation_days && vacation.vacation_days.length > 0 
                      ? vacation.vacation_days.reduce((sum, day) => sum + (day.is_half_day ? 0.5 : 1), 0)
                      : vacation.days_count;

                    return (
                      <Card key={vacation.id} className="border bg-white">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <h3 className="font-medium">{vacation.users.name}</h3>
                                <Badge variant="outline">{vacation.users.email}</Badge>
                                <Badge variant="outline">{getVacationTypeLabel(vacation.vacation_type)}</Badge>
                                <Badge variant="outline">
                                  {actualDaysCount} jour{actualDaysCount > 1 ? 's' : ''}
                                </Badge>
                                {getStatusBadge(vacation.status)}
                              </div>
                              <p className="text-sm">
                                Du {new Date(vacation.start_date).toLocaleDateString('fr-FR')} au {new Date(vacation.end_date).toLocaleDateString('fr-FR')}
                              </p>
                              
                              {/* Affichage détaillé des jours */}
                              {vacation.vacation_days && vacation.vacation_days.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-sm font-medium text-gray-700 mb-2">Détail des jours :</p>
                                  <div className="flex flex-wrap gap-1">
                                    {vacation.vacation_days
                                      .sort((a, b) => new Date(a.vacation_date).getTime() - new Date(b.vacation_date).getTime())
                                      .map((day, index) => (
                                      <Badge 
                                        key={index} 
                                        variant="secondary" 
                                        className={`text-xs ${day.is_half_day ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}
                                      >
                                        {new Date(day.vacation_date).toLocaleDateString('fr-FR', { 
                                          day: '2-digit', 
                                          month: '2-digit' 
                                        })}
                                        {day.is_half_day && ' (½j)'}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {vacation.description && (
                                <p className="text-sm text-gray-600">{vacation.description}</p>
                              )}
                              <p className="text-xs text-gray-500">
                                Demandé {formatDistanceToNow(new Date(vacation.created_at), { 
                                  addSuffix: true, 
                                  locale: fr 
                                })}
                              </p>
                            </div>
                            {vacation.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateVacationStatus(vacation.id, 'approved')}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approuver
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateVacationStatus(vacation.id, 'rejected')}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Rejeter
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <TeamVacationCalendar vacations={vacations} />
        </TabsContent>

        <TabsContent value="quotas" className="space-y-4">
          {/* Sélecteur d'année pour les quotas */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Année de gestion des quotas :</label>
            <Select value={quotaYear.toString()} onValueChange={(value) => {
              const newYear = parseInt(value);
              setQuotaYear(newYear);
              
              // Mettre à jour les valeurs de quota pour la nouvelle année
              const quotasMap: { [userId: string]: number } = {};
              vacationQuotas.forEach(quota => {
                if (quota.year === newYear) {
                  quotasMap[quota.user_id] = quota.quota_days;
                }
              });
              setQuotaValues(quotasMap);
            }}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
                <SelectItem value="2028">2028</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="shadow-md hover:shadow-lg transition-shadow bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quotas de vacances {quotaYear}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Définir le nombre de jours de vacances autorisés par année pour chaque employé
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Utiliser directement les données de la table users */}
              {users.map((user) => {
                const currentQuota = quotaValues[user.id] || 0;
                
                return (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                    <div>
                      <h3 className="font-medium">{user.name}</h3>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm">Quota:</label>
                      <Input
                        type="number"
                        min="0"
                        max="50"
                        step="0.5"
                        value={currentQuota}
                        onChange={(e) => {
                          const newValue = parseFloat(e.target.value) || 0;
                          setQuotaValues(prev => ({
                            ...prev,
                            [user.id]: newValue
                          }));
                        }}
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-gray-500">jours</span>
                      <Button
                        size="sm"
                        onClick={() => updateVacationQuota(user.id, quotaValues[user.id] || 0)}
                        className="ml-2"
                      >
                        Sauvegarder
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {/* Affichage des quotas existants pour l'année sélectionnée */}
              <div className="mt-6">
                <h4 className="font-medium mb-3">Quotas configurés pour {quotaYear}</h4>
                {vacationQuotas.filter(quota => quota.year === quotaYear).length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Aucun quota configuré pour cette année</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {vacationQuotas
                      .filter(quota => quota.year === quotaYear)
                      .map((quota) => {
                        const user = users.find(u => u.id === quota.user_id);
                        
                        if (!user) return null;
                        
                        return (
                          <div key={quota.id} className="p-3 bg-white rounded border">
                            <div className="text-sm font-medium">{user.name}</div>
                            <div className="text-lg font-bold text-blue-600">{quota.quota_days} jours</div>
                            <div className="text-xs text-gray-500">
                              Mis à jour le {new Date(quota.updated_at).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}