
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts";
import { useMemo } from "react";

interface Invoice {
  compte: string;
  invoice_date?: string;
  total_amount?: number;
}

interface MonthlyExpenseChartProps {
  invoices: Invoice[];
  dateFrom?: string;
  dateTo?: string;
}

const chartConfig = {
  commun: {
    label: "Commun",
    color: "#3b82f6", // Bleu standard
  },
  david: {
    label: "David Tabibian",
    color: "#1d4ed8", // Bleu plus foncé
  },
  total: {
    label: "Tendance totale",
    color: "#1e3a8a", // Bleu très foncé pour contraste
  },
};

export function MonthlyExpenseChart({ invoices, dateFrom, dateTo }: MonthlyExpenseChartProps) {
  const monthlyData = useMemo(() => {
    const dataMap = new Map<string, { month: string; monthKey: string; commun: number; david: number }>();

    // Filtrer les factures selon la période
    const filteredInvoices = invoices.filter(invoice => {
      if (!invoice.invoice_date) return false;
      
      const invoiceDate = new Date(invoice.invoice_date);
      
      if (dateFrom && invoiceDate < new Date(dateFrom)) return false;
      if (dateTo && invoiceDate > new Date(dateTo)) return false;
      
      return true;
    });

    filteredInvoices.forEach(invoice => {
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

    // Créer une série de mois pour la période sélectionnée
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Math.min(...filteredInvoices.map(inv => new Date(inv.invoice_date!).getTime())));
    const endDate = dateTo ? new Date(dateTo) : new Date(Math.max(...filteredInvoices.map(inv => new Date(inv.invoice_date!).getTime())));
    
    const completeData = [];
    const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    
    while (currentDate <= endDate) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = currentDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
      
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
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return completeData;
  }, [invoices, dateFrom, dateTo]);

  // Fonction pour formatter les montants en CHF avec séparateurs de milliers
  const formatAmount = (value: number): string => {
    if (value === 0) return '';
    return `${Math.round(value).toLocaleString('fr-CH')} CHF`;
  };

  // Composant personnalisé pour les labels de la courbe de tendance avec background centré et alignement corrigé
  const TrendLineLabel = ({ x, y, value, viewBox }: any) => {
    if (!value || value === 0) return null;
    
    const formattedValue = formatAmount(value);
    const labelX = x;
    const labelY = y - 20; // Ajusté pour être mieux centré
    
    // Calculer la largeur du texte plus précisément
    const textWidth = formattedValue.length * 5.5;
    
    return (
      <g>
        <rect
          x={labelX - textWidth / 2}
          y={labelY - 10}
          width={textWidth}
          height={20}
          fill="#f3f4f6"
          stroke="#d1d5db"
          strokeWidth={1}
          rx={4}
          opacity={0.95}
        />
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          fontSize={10}
          fill="#1e40af"
          fontWeight="600"
        >
          {formattedValue}
        </text>
      </g>
    );
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Évolution Mensuelle des Dépenses</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <ComposedChart data={monthlyData} margin={{ top: 50, right: 30, left: 20, bottom: 5 }}>
            <XAxis dataKey="month" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="commun" fill="var(--color-commun)" name="Commun" />
            <Bar dataKey="david" fill="var(--color-david)" name="David Tabibian" />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="var(--color-total)" 
              strokeWidth={3}
              strokeDasharray="8 4"
              name="Tendance totale"
              dot={{ fill: "var(--color-total)", strokeWidth: 2, r: 5 }}
            >
              <LabelList content={TrendLineLabel} />
            </Line>
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
