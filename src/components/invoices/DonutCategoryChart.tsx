
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, ResponsiveContainer, LabelList } from "recharts";
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
    label: "Montant",
    color: "#3b82f6",
  },
};

export function DonutCategoryChart({ invoices }: InvoiceTypeBarChartProps) {
  const chartData = useMemo(() => {
    const dataMap = new Map<string, number>();

    invoices.forEach(invoice => {
      if (!invoice.original_amount_chf || invoice.original_amount_chf <= 0) return;
      
      let typeName = invoice.invoice_type || 'NON ASSIGNÉ';
      typeName = typeName.toUpperCase();

      dataMap.set(typeName, (dataMap.get(typeName) || 0) + invoice.original_amount_chf);
    });

    return Array.from(dataMap.entries())
      .map(([name, amount]) => ({ 
        name: name.length > 20 ? name.substring(0, 20) + '...' : name, 
        amount: Math.round(amount)
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [invoices]);

  // Composant pour les labels au-dessus des barres avec style noir
  const CustomLabel = ({ x, y, width, value }: any) => {
    const labelX = x + width / 2;
    const labelY = y - 8;
    const formattedValue = value.toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const textWidth = formattedValue.length * 6;
    
    return (
      <g>
        <rect
          x={labelX - textWidth / 2}
          y={labelY - 12}
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
          fontSize={11}
          fill="#000000"
          fontWeight="600"
        >
          {formattedValue}
        </text>
      </g>
    );
  };

  // Calculer la largeur minimum pour afficher tous les types
  const minWidth = Math.max(600, chartData.length * 80);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition par Type de Facture</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <ChartContainer config={chartConfig} className="h-[600px]" style={{ minWidth: `${minWidth}px` }}>
            <BarChart data={chartData} margin={{ top: 40, right: 30, left: 20, bottom: 80 }}>
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={120}
                interval={0}
                fontSize={10}
                fill="#000000"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="amount" fill="var(--color-amount)" name="Montant CHF">
                <LabelList content={CustomLabel} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
