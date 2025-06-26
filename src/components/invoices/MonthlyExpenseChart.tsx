
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts";
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
  total: {
    label: "Tendance totale",
    color: "#f97316", // Couleur plus pastel (orange)
  },
};

export function MonthlyExpenseChart({ invoices }: MonthlyExpenseChartProps) {
  const monthlyData = useMemo(() => {
    const dataMap = new Map<string, { month: string; monthKey: string; commun: number; david: number }>();

    invoices.forEach(invoice => {
      if (!invoice.invoice_date || !invoice.total_amount) return;

      const date = new Date(invoice.invoice_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });

      if (!dataMap.has(monthKey)) {
        dataMap.set(monthKey, { month: monthLabel, monthKey, commun: 0, david: 0 });
      }

      const data = dataMap.get(monthKey)!;
      if (invoice.compte === 'Commun') {
        data.commun += invoice.total_amount;
      } else if (invoice.compte === 'David Tabibian') {
        data.david += invoice.total_amount;
      }
    });

    // Créer une série complète de mois pour les 12 derniers mois
    const now = new Date();
    const completeData = [];
    
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = targetDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
      
      const existingData = dataMap.get(monthKey);
      if (existingData) {
        completeData.push({
          ...existingData,
          total: existingData.commun + existingData.david
        });
      } else {
        completeData.push({
          month: monthLabel,
          monthKey,
          commun: 0,
          david: 0,
          total: 0
        });
      }
    }

    return completeData;
  }, [invoices]);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Évolution Mensuelle des Dépenses</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <ComposedChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis dataKey="month" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="commun" fill="var(--color-commun)" name="Commun">
              <LabelList dataKey="commun" position="top" formatter={(value: number) => value > 0 ? `${value.toFixed(0)}€` : ''} />
            </Bar>
            <Bar dataKey="david" fill="var(--color-david)" name="David Tabibian">
              <LabelList dataKey="david" position="top" formatter={(value: number) => value > 0 ? `${value.toFixed(0)}€` : ''} />
            </Bar>
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="var(--color-total)" 
              strokeWidth={3}
              strokeDasharray="8 4"
              name="Tendance totale"
              dot={{ fill: "var(--color-total)", strokeWidth: 2, r: 5 }}
            >
              <LabelList dataKey="total" position="top" formatter={(value: number) => value > 0 ? `${value.toFixed(0)}€` : ''} />
            </Line>
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
