import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Calendar, Check, X, AlertCircle, CheckCircle, XCircle, Users } from "lucide-react";
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
  vacation_type: 'annual' | 'sick' | 'personal' | 'other';
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

export default function HRValidation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [overtimeHours, setOvertimeHours] = useState<OvertimeHour[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    await Promise.all([fetchOvertimeHours(), fetchVacations()]);
    setLoading(false);
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
      other: "Autre"
    };
    return types[type as keyof typeof types] || type;
  };

  const filteredOvertimeHours = overtimeHours.filter(overtime => 
    statusFilter === "all" || overtime.status === statusFilter
  );

  const filteredVacations = vacations.filter(vacation => 
    statusFilter === "all" || vacation.status === statusFilter
  );

  const overtimeStats = {
    pending: overtimeHours.filter(o => o.status === 'pending').length,
    approved: overtimeHours.filter(o => o.status === 'approved').length,
    rejected: overtimeHours.filter(o => o.status === 'rejected').length,
    totalHours: overtimeHours.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.hours, 0)
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

  const getVacationSummaryForUser = (userEmail: string) => {
    const userVacations = vacations.filter(v => 
      v.users.email === userEmail && 
      v.status === 'approved' &&
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

      {/* Sélecteur d'année */}
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

      <Tabs defaultValue="overtime" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overtime" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Heures supplémentaires ({filteredOvertimeHours.length})
          </TabsTrigger>
          <TabsTrigger value="vacations" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Vacances ({filteredVacations.length})
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
                  return (
                    <div key={user.email} className="p-4 border rounded-lg">
                      <h3 className="font-medium">{user.name}</h3>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-2xl font-bold">{summary.totalDays}</span>
                        <span className="text-sm text-gray-500">
                          {summary.count} période{summary.count > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">jours de vacances</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}