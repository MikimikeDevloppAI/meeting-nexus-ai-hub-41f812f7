
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

interface Invoice {
  invoice_type?: string;
  original_amount_chf?: number;
}

interface InvoiceTypeBarChartProps {
  invoices: Invoice[];
}

const chartConfig = {
  amount: {
    label: "Montant (CHF)",
    color: "hsl(var(--chart-1))",
  },
};

export function DonutCategoryChart({ invoices }: InvoiceTypeBarChartProps) {
  const chartData = useMemo(() => {
    const dataMap = new Map<string, number>();

    invoices.forEach(invoice => {
      if (!invoice.original_amount_chf) return;
      
      const type = invoice.invoice_type || 'Non assigné';
      dataMap.set(type, (dataMap.get(type) || 0) + invoice.original_amount_chf);
    });

    return Array.from(dataMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [invoices]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Montant par Type de Facture</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                fontSize={12}
              />
              <YAxis 
                tickFormatter={(value) => `${value.toLocaleString()} CHF`}
                fontSize={12}
              />
              <Bar 
                dataKey="value" 
                fill="var(--color-amount)"
                radius={[4, 4, 0, 0]}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => [`${value.toLocaleString()} CHF`, 'Montant']}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
