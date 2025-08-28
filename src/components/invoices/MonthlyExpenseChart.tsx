
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, LabelList, Tooltip, Legend } from "recharts";
import { useMemo } from "react";

interface Invoice {
  compte: string;
  payment_date?: string;
  total_amount?: number;
  original_amount_chf?: number;
}

interface MonthlyExpenseChartProps {
  invoices: Invoice[];
  dateFrom?: string;
  dateTo?: string;
}

const palette = ['hsl(var(--primary) / 0.85)', 'hsl(var(--secondary) / 0.85)', 'hsl(var(--accent) / 0.85)'];

const chartConfig = {
  commun: {
    label: "Commun",
    color: palette[0],
  },
  david: {
    label: "David Tabibian", 
    color: palette[1],
  },
  total: {
    label: "Tendance totale",
    color: "hsl(var(--primary))",
  },
};

export function MonthlyExpenseChart({ invoices, dateFrom, dateTo }: MonthlyExpenseChartProps) {
  const monthlyData = useMemo(() => {
    const dataMap = new Map<string, { month: string; monthKey: string; commun: number; david: number }>();

    // Filtrer les factures selon la période - utilise payment_date au lieu de invoice_date
    const filteredInvoices = invoices.filter(invoice => {
      if (!invoice.payment_date) return false;
      
      const invoiceDate = new Date(invoice.payment_date);
      
      if (dateFrom && invoiceDate < new Date(dateFrom)) return false;
      if (dateTo && invoiceDate > new Date(dateTo)) return false;
      
      return true;
    });

    filteredInvoices.forEach(invoice => {
      if (!invoice.payment_date || !invoice.original_amount_chf) return;

      const date = new Date(invoice.payment_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });

      if (!dataMap.has(monthKey)) {
        dataMap.set(monthKey, { month: monthLabel, monthKey, commun: 0, david: 0 });
      }

      const data = dataMap.get(monthKey)!;
      if (invoice.compte === 'Commun') {
        data.commun += invoice.original_amount_chf;
      } else if (invoice.compte === 'David Tabibian') {
        data.david += invoice.original_amount_chf;
      }
    });

    // Créer une série de mois pour la période sélectionnée - utilise payment_date au lieu de invoice_date
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Math.min(...filteredInvoices.map(inv => new Date(inv.payment_date!).getTime())));
    const endDate = dateTo ? new Date(dateTo) : new Date(Math.max(...filteredInvoices.map(inv => new Date(inv.payment_date!).getTime())));
    
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

  return (
    <Card className="col-span-full shadow-md">
      <CardHeader>
        <CardTitle>Évolution Mensuelle des Dépenses</CardTitle>
      </CardHeader>
      <CardContent className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={monthlyData} margin={{ top: 60, right: 30, left: 20, bottom: 20 }}>
            <XAxis 
              dataKey="month"
              axisLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                
                return (
                  <div style={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 12px hsla(0, 0%, 0%, 0.15)',
                    minWidth: '180px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: 'hsl(var(--foreground))',
                      marginBottom: '8px',
                      textAlign: 'center',
                      padding: '4px 8px',
                      backgroundColor: 'hsl(var(--muted))',
                      borderRadius: '6px'
                    }}>
                      {label}
                    </div>
                    {payload.map((entry, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px'
                      }}>
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: entry.color,
                        }} />
                        <span style={{
                          fontSize: '13px',
                          color: 'hsl(var(--foreground))',
                          flex: 1
                        }}>
                          {entry.name}
                        </span>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: 'hsl(var(--foreground))'
                        }}>
                          {formatAmount(Number(entry.value))}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="bottom"
              align="center" 
              iconType="circle"
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{String(value)}</span>}
            />
            <Bar 
              dataKey="commun" 
              fill={chartConfig.commun.color} 
              name="Commun"
              radius={[4, 4, 0, 0]}
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
            <Bar 
              dataKey="david" 
              fill={chartConfig.david.color} 
              name="David Tabibian"
              radius={[4, 4, 0, 0]}
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke={chartConfig.total.color}
              strokeWidth={3}
              strokeDasharray="8 4"
              name="Tendance totale"
              dot={{ fill: chartConfig.total.color, strokeWidth: 2, r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
