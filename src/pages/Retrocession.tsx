import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Legend, Line, LabelList } from "recharts";
import { Plus, Edit, Trash2 } from "lucide-react";
import { RetrocessionEntryDialog } from "@/components/retrocession/RetrocessionEntryDialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RetroRow {
  id: string;
  doctor: string;
  chiffre_affaires: number;
  retrocession: number;
  period_month: string; // ISO date string (YYYY-MM-DD)
}

const formatCHF = (n: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 2 }).format(n || 0);

const formatCHF0 = (n: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(Math.round(n || 0));
const formatYYYYMM = (dateStr: string) => {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const monthsRange = (from: Date, to: Date) => {
  const res: string[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    res.push(`${y}-${m}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return res;
};

const toFirstOfMonth = (yyyyMm: string) => new Date(`${yyyyMm}-01T00:00:00.000Z`);

const Retrocession: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    document.title = "Rétrocession | OphtaCare";
  }, []);

  // États pour les dialogs
  const [showDialog, setShowDialog] = useState(false);
  const [editData, setEditData] = useState<RetroRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)); // YTD
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [startMonth, setStartMonth] = useState<string>(`${defaultStart.getUTCFullYear()}-${String(defaultStart.getUTCMonth() + 1).padStart(2, "0")}`);
  const [endMonth, setEndMonth] = useState<string>(`${defaultEnd.getUTCFullYear()}-${String(defaultEnd.getUTCMonth() + 1).padStart(2, "0")}`);

  const { data, isLoading } = useQuery({
    queryKey: ["retrocessions", startMonth, endMonth],
    queryFn: async () => {
      const fromDate = toFirstOfMonth(startMonth).toISOString().slice(0, 10);
      const endFirst = toFirstOfMonth(endMonth);
      const endNext = new Date(Date.UTC(endFirst.getUTCFullYear(), endFirst.getUTCMonth() + 1, 1));
      const toDateExclusive = endNext.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("retrocessions")
        .select("*")
        .gte("period_month", fromDate)
        .lt("period_month", toDateExclusive)
        .order("period_month", { ascending: true });
      if (error) throw error;
      return (data as any[] as RetroRow[]) || [];
    },
  });

  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const doctorOptions = useMemo(() => Array.from(new Set((data || []).map(r => r.doctor))).sort(), [data]);

  const allMonths = useMemo(() => {
    const minDate = new Date(Date.UTC(2024, 0, 1)); // Janvier 2024
    const currentDate = new Date();
    const maxDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1));
    
    // Étendre la plage si les données vont au-delà
    let actualMin = minDate;
    let actualMax = maxDate;
    
    if (data && data.length > 0) {
      const earliest = new Date(data[0].period_month);
      const latest = new Date(data[data.length - 1].period_month);
      const earliestMonth = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1));
      const latestMonth = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
      
      // Ne descendre en dessous de janvier 2024 que s'il y a des données antérieures
      if (earliestMonth < minDate) actualMin = earliestMonth;
      if (latestMonth > maxDate) actualMax = latestMonth;
    }
    
    return monthsRange(actualMin, actualMax).reverse(); // Ordre descendant
  }, [data]);

  const byDoctor = useMemo(() => {
    const map = new Map<string, { ca: number; retro: number; lastEntry?: RetroRow }>();
    
    // Trier les données par date pour identifier la dernière entrée de chaque docteur
    const sortedData = [...(data || [])].sort((a, b) => 
      new Date(b.period_month).getTime() - new Date(a.period_month).getTime()
    );
    
    (data || []).forEach((r) => {
      const agg = map.get(r.doctor) || { ca: 0, retro: 0 };
      agg.ca += Number(r.chiffre_affaires || 0);
      agg.retro += Number(r.retrocession || 0);
      
      // Identifier la dernière entrée chronologique pour ce docteur
      if (!agg.lastEntry || new Date(r.period_month) > new Date(agg.lastEntry.period_month)) {
        agg.lastEntry = r;
      }
      
      map.set(r.doctor, agg);
    });
    
    return Array.from(map.entries()).map(([doctor, vals]) => {
      // Utiliser le % de la dernière entrée chronologique
      const lastEntryPct = vals.lastEntry 
        ? (vals.lastEntry.chiffre_affaires ? vals.lastEntry.retrocession / vals.lastEntry.chiffre_affaires : 0)
        : 0;
      
      return { 
        doctor, 
        ca: vals.ca, 
        retro: vals.retro, 
        pct: lastEntryPct 
      };
    });
  }, [data]);

  const chartData = useMemo(() => {
    const start = toFirstOfMonth(startMonth);
    const end = toFirstOfMonth(endMonth);
    const monthList = monthsRange(
      new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)),
      new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
    );
    const doctorsAll = Array.from(new Set((data || []).map(r => r.doctor))).sort();
    const doctors = doctorFilter === 'all' ? doctorsAll : doctorsAll.filter((d) => d === doctorFilter);

    const result = monthList.map((m) => {
      const row: any = { month: m };
      let total = 0;
      doctors.forEach((doc) => {
        const sum = (data || [])
          .filter((r) => r.doctor === doc && formatYYYYMM(r.period_month) === m)
          .reduce((acc, r) => acc + Number(r.retrocession || 0), 0);
        row[doc] = sum;
        total += sum;
      });
      row.total = total;
      return row;
    });

    return { data: result, doctors };
  }, [data, startMonth, endMonth, doctorFilter]);

  const history = useMemo(() => {
    return [...(data || [])]
      .filter((r) => doctorFilter === "all" || r.doctor === doctorFilter)
      .sort((a, b) => (a.period_month < b.period_month ? 1 : -1));
  }, [data, doctorFilter]);

  // Mutation pour supprimer une entrée
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("retrocessions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retrocessions"] });
      toast({
        title: "Succès",
        description: "L'entrée a été supprimée avec succès",
      });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la suppression",
      });
    },
  });

  const handleEdit = (row: RetroRow) => {
    setEditData(row);
    setShowDialog(true);
  };

  const handleNew = () => {
    setEditData(null);
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  const handleDialogSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["retrocessions"] });
  };

  const palette = ['hsl(var(--primary) / 0.85)', 'hsl(var(--secondary) / 0.85)', 'hsl(var(--accent) / 0.85)', 'hsl(var(--destructive) / 0.85)', 'hsl(var(--muted) / 0.85)'];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Rétrocession</h1>
        <Button onClick={handleNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle entrée
        </Button>
      </header>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Période</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm text-muted-foreground mb-2">Mois de début</div>
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {allMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-2">Mois de fin</div>
            <Select value={endMonth} onValueChange={setEndMonth}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {allMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-2">Docteur</div>
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tous les docteurs" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all">Tous les docteurs</SelectItem>
                {doctorOptions.map((doc) => (
                  <SelectItem key={doc} value={doc}>
                    {doc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {byDoctor.filter(d => doctorFilter === "all" || d.doctor === doctorFilter).map((d) => (
          <Card key={d.doctor} className="shadow-md border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{d.doctor}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Rétrocession sur la période</div>
              <div className="text-2xl font-semibold">{formatCHF0(d.retro)}</div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Chiffre d'affaires</div>
                  <div className="font-medium">{formatCHF0(d.ca)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pourcentage</div>
                  <div className="font-medium">{Math.round(d.pct * 100)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Rétrocessions par mois (par docteur)</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.data} margin={{ top: 30, right: 30, left: 20, bottom: 20 }}>
              <XAxis 
                dataKey="month" 
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tick={(props) => {
                  const { x, y, payload, index } = props;
                  const isFirstOrLast = index === 0 || index === chartData.data.length - 1;
                  
                  if (!isFirstOrLast) return null;
                  
                  return (
                    <text 
                      x={x} 
                      y={y + 15} 
                      textAnchor="middle" 
                      fill="hsl(var(--muted-foreground))" 
                      fontSize="12"
                    >
                      {payload.value}
                    </text>
                  );
                }}
              />
              <Tooltip
                formatter={(value: any, name) => [formatCHF(Number(value)), String(name)]}
                labelFormatter={(label) => `Mois: ${label}`}
                itemStyle={{ color: 'hsl(0 0% 0%)' }}
                contentStyle={{ color: 'hsl(0 0% 0%)' }}
                labelStyle={{ color: 'hsl(0 0% 0%)' }}
              />
              <Legend
                formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{String(value)}</span>}
              />
              {chartData.doctors.map((doc, idx) => (
                <Bar 
                  key={doc} 
                  dataKey={doc} 
                  fill={palette[idx % palette.length]}
                  radius={[4, 4, 0, 0]}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                >
                  <LabelList dataKey={doc} position="top" formatter={(val: any) => (Number(val) ? formatCHF0(Number(val)) : '')} />
                </Bar>
              ))}
              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot>
                <LabelList dataKey="total" position="top" formatter={(val: any) => (Number(val) ? formatCHF0(Number(val)) : '')} />
              </Line>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Historique des rétrocessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <Table className="font-calibri text-[15px] md:text-base table-fixed w-full">
              <TableHeader className="bg-table-header">
                <TableRow className="border-row">
                  <TableHead className="w-1/6 px-3 py-2 font-semibold text-strong">Période</TableHead>
                  <TableHead className="w-1/6 px-3 py-2 font-semibold text-strong">Docteur</TableHead>
                  <TableHead className="w-1/6 px-3 py-2 font-semibold text-strong text-right">Chiffre d'affaires</TableHead>
                  <TableHead className="w-1/6 px-3 py-2 font-semibold text-strong text-right">Rétrocession</TableHead>
                  <TableHead className="w-1/6 px-3 py-2 font-semibold text-strong text-right">%</TableHead>
                  <TableHead className="w-1/6 px-3 py-2 font-semibold text-strong text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6}>Chargement…</TableCell>
                  </TableRow>
                )}
                {!isLoading && history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>Aucune donnée</TableCell>
                  </TableRow>
                )}
                {history.map((r) => {
                  const percentage = r.chiffre_affaires ? (r.retrocession / r.chiffre_affaires * 100) : 0;
                  return (
                    <TableRow key={r.id} className="border-row even:bg-row-alt">
                      <TableCell className="px-3 py-2">{formatYYYYMM(r.period_month)}</TableCell>
                      <TableCell className="px-3 py-2">{r.doctor}</TableCell>
                      <TableCell className="px-3 py-2 text-right">{formatCHF(Number(r.chiffre_affaires || 0))}</TableCell>
                      <TableCell className="px-3 py-2 text-right">{formatCHF(Number(r.retrocession || 0))}</TableCell>
                      <TableCell className="px-3 py-2 text-right">{Math.round(percentage)}%</TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(r)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(r.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RetrocessionEntryDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editData={editData}
        onSuccess={handleDialogSuccess}
        existingDoctors={doctorOptions}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette entrée ? Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Retrocession;
