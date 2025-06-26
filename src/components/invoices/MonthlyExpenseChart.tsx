
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

interface Invoice {
  compte: string;
  invoice_date?: string;
  total_amount?: number;
}

interface MonthlyExpenseChartProps {
  invoices: Invoice[];
}

const chartConfig = {
  commun: {
    label: "Commun",
    color: "#10b981",
  },
  david: {
    label: "David Tabibian",
    color: "#3b82f6",
  },
};

export function MonthlyExpenseChart({ invoices }: MonthlyExpenseChartProps) {
  const monthlyData = useMemo(() => {
    const dataMap = new Map<string, { month: string; commun: number; david: number }>();

    invoices.forEach(invoice => {
      if (!invoice.invoice_date || !invoice.total_amount) return;

      const date = new Date(invoice.invoice_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });

      if (!dataMap.has(monthKey)) {
        dataMap.set(monthKey, { month: monthLabel, commun: 0, david: 0 });
      }

      const data = dataMap.get(monthKey)!;
      if (invoice.compte === 'Commun') {
        data.commun += invoice.total_amount;
      } else if (invoice.compte === 'David Tabibian') {
        data.david += invoice.total_amount;
      }
    });

    return Array.from(dataMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Derniers 12 mois
  }, [invoices]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution Mensuelle des Dépenses</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <BarChart data={monthlyData}>
            <XAxis dataKey="month" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="commun" fill="var(--color-commun)" name="Commun" />
            <Bar dataKey="david" fill="var(--color-david)" name="David Tabibian" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
