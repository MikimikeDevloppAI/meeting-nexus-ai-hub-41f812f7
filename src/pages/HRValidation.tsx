import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Clock, Calendar, Check, X, AlertCircle, CheckCircle, XCircle, Users, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow, format, startOfYear, endOfYear, isWithinInterval, parseISO, eachMonthOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
        setOvertimeHours(fallbackData || []);
      } else {
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
          users(name, email)
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

  const filteredOvertimeHours = overtimeHours.filter(overtime => 
    statusFilter === "all" || overtime.status === statusFilter
  );

  const filteredVacations = vacations.filter(vacation => 
    statusFilter === "all" || vacation.status === statusFilter
  );

  // Calculer les heures de récupération à partir des vacances de type "overtime_recovery"
  const recoveryHours = vacations
    .filter(vacation => 
      vacation.vacation_type === 'overtime_recovery' && 
      vacation.status === 'approved'
    )
    .reduce((sum, vacation) => {
      // Si c'est un nombre entier (ex: 1), c'est une journée complète = 8h
      // Si c'est un décimal (ex: 0.5), c'est une demi-journée = 4h
      const hoursPerDay = vacation.days_count % 1 === 0 ? 8 : 4;
      return sum + hoursPerDay;
    }, 0);

  const overtimeStats = {
    pending: overtimeHours.filter(o => o.status === 'pending').length,
    approved: overtimeHours.filter(o => o.status === 'approved').length,
    rejected: overtimeHours.filter(o => o.status === 'rejected').length,
    totalHours: overtimeHours.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.hours, 0),
    recoveryHours: recoveryHours,
    balanceHours: overtimeHours.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.hours, 0) - recoveryHours
  };

  const vacationStats = {
    pending: vacations.filter(v => v.status === 'pending').length,
    approved: vacations.filter(v => v.status === 'approved').length,
    rejected: vacations.filter(v => v.status === 'rejected').length,
    totalDays: vacations.filter(v => v.status === 'approved').reduce((sum, v) => sum + v.days_count, 0)
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
    
    return {
      totalDays: userVacations.reduce((sum, v) => sum + v.days_count, 0),
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
        
        result[user.email][format(month, 'yyyy-MM')] = monthlyOvertimes.reduce((sum, o) => sum + o.hours, 0);
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Validation RH</h1>
          <p className="text-muted-foreground">Gestion et validation des heures supplémentaires et vacances</p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heures en attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overtimeStats.pending}</div>
            <p className="text-xs text-muted-foreground">demandes à traiter</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heures approuvées</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overtimeStats.totalHours}h</div>
            <p className="text-xs text-muted-foreground">total approuvé</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vacances en attente</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vacationStats.pending}</div>
            <p className="text-xs text-muted-foreground">demandes à traiter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jours approuvés</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vacationStats.totalDays}</div>
            <p className="text-xs text-muted-foreground">jours total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde heures sup.</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overtimeStats.balanceHours >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {overtimeStats.balanceHours.toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground">
              {overtimeStats.totalHours.toFixed(1)}h - {overtimeStats.recoveryHours.toFixed(1)}h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
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

      <Tabs defaultValue="overtime" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
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
          {filteredOvertimeHours.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">Aucune heure supplémentaire trouvée</p>
              </CardContent>
            </Card>
          ) : (
            filteredOvertimeHours.map((overtime) => (
              <Card key={overtime.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{overtime.users.name}</h3>
                        <Badge variant="outline">{overtime.users.email}</Badge>
                        <Badge variant="outline">{overtime.hours}h</Badge>
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
            ))
          )}

          {/* Sélecteur d'année pour les heures supplémentaires */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Année d'analyse :</label>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tableau mensuel des heures supplémentaires */}
          <Card>
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
                                {hours > 0 ? (
                                  <Badge variant="outline" className="font-mono">
                                    {hours.toFixed(1)}h
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                            <Badge variant="default" className="font-mono font-bold">
                              {yearTotal.toFixed(1)}h
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
          {filteredVacations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">Aucune demande de vacances trouvée</p>
              </CardContent>
            </Card>
          ) : (
            filteredVacations.map((vacation) => (
              <Card key={vacation.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{vacation.users.name}</h3>
                        <Badge variant="outline">{vacation.users.email}</Badge>
                        <Badge variant="outline">{getVacationTypeLabel(vacation.vacation_type)}</Badge>
                        <Badge variant="outline">
                          {vacation.days_count} jour{vacation.days_count > 1 ? 's' : ''}
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
            ))
          )}

          {/* Sélecteur d'année pour les vacances */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Année d'analyse :</label>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Décompte des vacances par utilisateur */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Décompte des vacances {selectedYear}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Nombre de jours de vacances approuvés depuis le début de l'année
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {specificUsers.map((user) => {
                  const summary = getVacationSummaryForUser(user.email);
                  // Trouver l'utilisateur dans la table users pour obtenir son ID
                  const userRecord = users.find(u => u.email === user.email);
                  const quota = userRecord ? getQuotaForUser(userRecord.id, selectedYear) : 0;
                  const remaining = selectedYear === 2025 ? quota - summary.totalDays : Math.max(0, quota - summary.totalDays);
                  
                  return (
                    <div key={user.email} className="p-4 border rounded-lg">
                      <h3 className="font-medium">{user.name}</h3>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <div className="mt-3 space-y-2">
                        <div className="space-y-2">
                          {selectedYear === 2025 ? (
                            <>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-primary">{summary.totalDays}</div>
                                <div className="text-sm text-muted-foreground">jours pris</div>
                              </div>
                              <div className="text-center">
                                <div className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {remaining}
                                </div>
                                <div className="text-sm text-muted-foreground">jours restants</div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-2xl font-bold">{summary.totalDays} / {quota}</span>
                              </div>
                              <div className="text-xs text-gray-500 space-y-1">
                                <p>jours pris / quota disponible</p>
                                <p className={`font-medium ${remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {remaining > 0 ? `${remaining} jours restants` : 'Quota dépassé'}
                                </p>
                                {selectedYear >= 2026 && quota > 0 && (
                                  <p className="text-blue-600 text-xs">
                                    (inclut report année précédente)
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
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

          <Card>
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
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
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
                        value={currentQuota}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value) || 0;
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
                          <div key={quota.id} className="p-3 bg-gray-50 rounded border">
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