
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, ResponsiveContainer, LabelList } from "recharts";
import { useMemo } from "react";

interface Invoice {
  supplier_name?: string;
  total_amount?: number;
  original_amount_chf?: number;
  compte: string;
}

interface SupplierChartProps {
  invoices: Invoice[];
  onSupplierClick?: (supplier: string) => void;
  selectedSupplier?: string;
}

const chartConfig = {
  amount: {
    label: "Montant",
    color: "#3b82f6",
  },
};

export function SupplierChart({ invoices, onSupplierClick, selectedSupplier }: SupplierChartProps) {
  const supplierData = useMemo(() => {
    const supplierMap = new Map<string, number>();

    invoices.forEach(invoice => {
      if (!invoice.original_amount_chf) return;
      
      // Nettoyer le nom du fournisseur et le mettre en majuscules
      let supplierName = invoice.supplier_name || 'FOURNISSEUR INCONNU';
      
      // Gérer l'encodage des caractères puis convertir en majuscules
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
          .replace(/Ã»/g, 'û')
          .toUpperCase();
      } catch (e) {
        // En cas d'erreur, garder le nom original en majuscules
        supplierName = (invoice.supplier_name || 'FOURNISSEUR INCONNU').toUpperCase();
      }

      supplierMap.set(supplierName, (supplierMap.get(supplierName) || 0) + invoice.original_amount_chf);
    });

    return Array.from(supplierMap.entries())
      .map(([name, amount]) => ({ 
        name: name.length > 12 ? name.substring(0, 12) + '...' : name, 
        amount: Math.round(amount)
      }))
      .sort((a, b) => b.amount - a.amount); // Trier par montant décroissant
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

  // Calculer la largeur minimum pour afficher 10 fournisseurs
  const minWidth = Math.max(600, supplierData.length * 80);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition des fournisseurs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <ChartContainer config={chartConfig} className="h-[600px]" style={{ minWidth: `${minWidth}px` }}>
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
              <Bar 
                dataKey="amount" 
                fill="var(--color-amount)" 
                radius={[4, 4, 0, 0]}
                onClick={(data: any) => onSupplierClick?.(data.name)}
                style={{ 
                  cursor: onSupplierClick ? 'pointer' : 'default'
                }}
              >
                <LabelList content={CustomLabel} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
