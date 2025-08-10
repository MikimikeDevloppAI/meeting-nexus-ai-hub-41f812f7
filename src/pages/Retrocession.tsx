import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

interface RetroRow {
  id: string;
  doctor: string;
  chiffre_affaires: number;
  retrocession: number;
  period_month: string; // ISO date string (YYYY-MM-DD)
}

const formatCHF = (n: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 2 }).format(n || 0);

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
  useEffect(() => {
    document.title = "Rétrocession | OphtaCare";
  }, []);

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

  const allMonths = useMemo(() => {
    const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 35, 1));
    let min = rangeStart;
    let max = new Date(Date.UTC(defaultEnd.getUTCFullYear(), defaultEnd.getUTCMonth(), 1));
    if (data && data.length > 0) {
      const earliest = new Date(data[0].period_month);
      const latest = new Date(data[data.length - 1].period_month);
      const earliestMonth = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1));
      const latestMonth = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
      if (earliestMonth < min) min = earliestMonth;
      if (latestMonth > max) max = latestMonth;
    }
    return monthsRange(min, max);
  }, [data]);

  const byDoctor = useMemo(() => {
    const map = new Map<string, { ca: number; retro: number }>();
    (data || []).forEach((r) => {
      const agg = map.get(r.doctor) || { ca: 0, retro: 0 };
      agg.ca += Number(r.chiffre_affaires || 0);
      agg.retro += Number(r.retrocession || 0);
      map.set(r.doctor, agg);
    });
    return Array.from(map.entries()).map(([doctor, vals]) => ({ doctor, ...vals, pct: vals.ca ? vals.retro / vals.ca : 0 }));
  }, [data]);

  const chartData = useMemo(() => {
    const months = new Set<string>();
    const doctors = new Set<string>();
    (data || []).forEach((r) => {
      months.add(formatYYYYMM(r.period_month));
      doctors.add(r.doctor);
    });
    const monthList = Array.from(months).sort();
    const result = monthList.map((m) => {
      const row: any = { month: m };
      (data || [])
        .filter((r) => formatYYYYMM(r.period_month) === m)
        .forEach((r) => {
          row[r.doctor] = (row[r.doctor] || 0) + Number(r.retrocession || 0);
        });
      return row;
    });
    return { data: result, doctors: Array.from(doctors) };
  }, [data]);

  const history = useMemo(() => {
    return [...(data || [])].sort((a, b) => (a.period_month < b.period_month ? 1 : -1));
  }, [data]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Rétrocession</h1>
      </header>

      <Card>
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
          <div className="flex items-end text-sm text-muted-foreground">
            Par défaut: YTD ({startMonth} → {endMonth})
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {byDoctor.map((d) => (
          <Card key={d.doctor} className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{d.doctor}</span>
                <span className="text-sm text-muted-foreground">{(d.pct * 100).toFixed(1)}%</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Rétrocession sur la période</div>
              <div className="text-2xl font-semibold">{formatCHF(d.retro)}</div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Chiffre d'affaires</div>
                  <div className="font-medium">{formatCHF(d.ca)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pourcentage</div>
                  <div className="font-medium">{(d.pct * 100).toFixed(1)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Rétrocessions par mois (par docteur)</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartData.doctors.map((doc, idx) => (
                <Bar key={doc} dataKey={doc} stackId="retro" fill={`hsl(var(--primary) / ${0.6 + (idx % 3) * 0.1})`} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des rétrocessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Docteur</TableHead>
                  <TableHead>Chiffre d'affaires</TableHead>
                  <TableHead>Rétrocession</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={4}>Chargement…</TableCell>
                  </TableRow>
                )}
                {!isLoading && history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>Aucune donnée</TableCell>
                  </TableRow>
                )}
                {history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatYYYYMM(r.period_month)}</TableCell>
                    <TableCell>{r.doctor}</TableCell>
                    <TableCell>{formatCHF(Number(r.chiffre_affaires || 0))}</TableCell>
                    <TableCell>{formatCHF(Number(r.retrocession || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Retrocession;
