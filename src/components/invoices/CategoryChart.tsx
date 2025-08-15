
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

interface Invoice {
  invoice_type?: string;
  original_amount_chf?: number;
}

interface InvoiceTypeChartProps {
  invoices: Invoice[];
}

const chartConfig = {
  amount: {
    label: "Montant",
    color: "hsl(var(--chart-1))",
  },
};

export function CategoryChart({ invoices }: InvoiceTypeChartProps) {
  const invoiceTypeData = useMemo(() => {
    const typeMap = new Map<string, number>();

    invoices.forEach(invoice => {
      if (!invoice.original_amount_chf) return;
      
      const type = invoice.invoice_type || 'Non assigné';
      typeMap.set(type, (typeMap.get(type) || 0) + invoice.original_amount_chf);
    });

    return Array.from(typeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [invoices]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition par Type de Facture</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <BarChart data={invoiceTypeData}>
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis />
            <Bar 
              dataKey="value" 
              fill="var(--color-amount)"
              radius={[4, 4, 0, 0]}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              formatter={(value: number) => [`${value.toFixed(2)} CHF`, 'Montant']}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
