
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";

interface Invoice {
  supplier_name?: string;
  total_amount?: number;
  compte: string;
}

interface ParetoSupplierChartProps {
  invoices: Invoice[];
}

const chartConfig = {
  amount: {
    label: "Montant",
    color: "#3b82f6",
  },
  cumulative: {
    label: "Pourcentage cumulé",
    color: "#1e3a8a",
  },
};

export function ParetoSupplierChart({ invoices }: ParetoSupplierChartProps) {
  const paretoData = useMemo(() => {
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

    const sortedData = Array.from(supplierMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    const totalAmount = sortedData.reduce((sum, item) => sum + item.amount, 0);
    let cumulativeAmount = 0;

    return sortedData.map(item => {
      cumulativeAmount += item.amount;
      const cumulativePercentage = (cumulativeAmount / totalAmount) * 100;
      
      return {
        name: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
        fullName: item.name,
        amount: item.amount,
        cumulativePercentage: Math.round(cumulativePercentage)
      };
    });
  }, [invoices]);

  // Afficher les 10 premiers dans le graphique
  const chartData = paretoData.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyse Pareto des Fournisseurs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ChartContainer config={chartConfig} className="h-[400px]">
            <ComposedChart data={chartData} layout="horizontal">
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="amount" fill="var(--color-amount)" name="Montant" />
              <Line 
                type="monotone" 
                dataKey="cumulativePercentage" 
                stroke="var(--color-cumulative)" 
                strokeWidth={2}
                name="% Cumulé"
                yAxisId="right"
              />
            </ComposedChart>
          </ChartContainer>
          
          {paretoData.length > 10 && (
            <div>
              <h4 className="font-medium mb-2">Tous les fournisseurs:</h4>
              <ScrollArea className="h-[200px] w-full border rounded p-2">
                <div className="space-y-1">
                  {paretoData.map((supplier, index) => (
                    <div key={index} className="flex justify-between text-sm py-1 border-b">
                      <span>{supplier.fullName}</span>
                      <span className="font-medium">
                        {supplier.amount.toFixed(2)} CHF ({supplier.cumulativePercentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
