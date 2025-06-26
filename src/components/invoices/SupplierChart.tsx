
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, ResponsiveContainer, LabelList } from "recharts";
import { useMemo } from "react";

interface Invoice {
  supplier_name?: string;
  total_amount?: number;
  compte: string;
}

interface SupplierChartProps {
  invoices: Invoice[];
}

const chartConfig = {
  amount: {
    label: "Montant",
    color: "#3b82f6",
  },
};

export function SupplierChart({ invoices }: SupplierChartProps) {
  const supplierData = useMemo(() => {
    const supplierMap = new Map<string, number>();

    invoices.forEach(invoice => {
      if (!invoice.total_amount) return;
      
      // Nettoyer le nom du fournisseur
      let supplierName = invoice.supplier_name || 'Fournisseur inconnu';
      
      // Gérer l'encodage des caractères
      try {
        supplierName = supplierName
          .replace(/Ã©/g, 'é')
          .replace(/Ã¨/g, 'è')
          .replace(/Ã /g, 'à')
          .replace(/Ã§/g, 'ç')
          .replace(/Ã´/g, 'ô')
          .replace(/Ã¢/g, 'â')
          .replace(/Ã¯/g, 'ï')
          .replace(/Ã«/g, 'ë')
          .replace(/Ã¹/g, 'ù')
          .replace(/Ã»/g, 'û');
      } catch (e) {
        // En cas d'erreur, garder le nom original
      }

      supplierMap.set(supplierName, (supplierMap.get(supplierName) || 0) + invoice.total_amount);
    });

    return Array.from(supplierMap.entries())
      .map(([name, amount]) => ({ 
        name: name.length > 12 ? name.substring(0, 12) + '...' : name, 
        amount: Math.round(amount)
      }))
      .sort((a, b) => b.amount - a.amount); // Afficher tous les fournisseurs, pas seulement le top 10
  }, [invoices]);

  // Composant pour les labels au-dessus des barres avec style noir
  const CustomLabel = ({ x, y, width, value }: any) => {
    const labelX = x + width / 2;
    const labelY = y - 8;
    const formattedValue = value.toLocaleString('fr-CH');
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition des fournisseurs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <ChartContainer config={chartConfig} className="h-[400px] min-w-[600px]">
            <BarChart data={supplierData} margin={{ top: 40, right: 30, left: 20, bottom: 80 }}>
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
