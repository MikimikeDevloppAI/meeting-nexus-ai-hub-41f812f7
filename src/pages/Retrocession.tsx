import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Legend, Line, LabelList } from "recharts";

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

  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const doctorOptions = useMemo(() => Array.from(new Set((data || []).map(r => r.doctor))).sort(), [data]);

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

  const palette = ['hsl(var(--primary) / 0.85)', 'hsl(var(--secondary) / 0.85)', 'hsl(var(--accent) / 0.85)', 'hsl(var(--destructive) / 0.85)', 'hsl(var(--muted) / 0.85)'];

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
          <Card key={d.doctor} className="shadow-sm">
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

      <Card>
        <CardHeader>
          <CardTitle>Rétrocessions par mois (par docteur)</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.data}>
              <XAxis dataKey="month" />
              <Tooltip
                formatter={(value: any, name) => [formatCHF(Number(value)), String(name)]}
                labelFormatter={(label) => `Mois: ${label}`}
              />
              <Legend
                formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{String(value)}</span>}
              />
              {chartData.doctors.map((doc, idx) => (
                <Bar key={doc} dataKey={doc} fill={palette[idx % palette.length]}>
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
