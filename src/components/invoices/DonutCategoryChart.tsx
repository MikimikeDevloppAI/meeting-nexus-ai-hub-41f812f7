
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

interface Invoice {
  compte: string;
  purchase_category?: string;
  purchase_subcategory?: string;
  total_amount?: number;
  original_amount_chf?: number;
}

interface DonutCategoryChartProps {
  invoices: Invoice[];
}

const COLORS = ['#3b82f6', '#1d4ed8', '#1e3a8a', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];

type ChartMode = 'compte' | 'category' | 'subcategory';

export function DonutCategoryChart({ invoices }: DonutCategoryChartProps) {
  const [mode, setMode] = useState<ChartMode>('compte');

  const chartData = useMemo(() => {
    const dataMap = new Map<string, number>();

    invoices.forEach(invoice => {
      if (!invoice.original_amount_chf) return;
      
      let key = '';
      switch (mode) {
        case 'compte':
          key = invoice.compte || 'Non défini';
          break;
        case 'category':
          key = invoice.purchase_category || 'Non catégorisé';
          break;
        case 'subcategory':
          key = invoice.purchase_subcategory || 'Non catégorisé';
          break;
      }
      
      dataMap.set(key, (dataMap.get(key) || 0) + invoice.original_amount_chf);
    });

    return Array.from(dataMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [invoices, mode]);

  const chartConfig = useMemo(() => {
    const config: any = {};
    chartData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: COLORS[index % COLORS.length],
      };
    });
    return config;
  }, [chartData]);

  const getModeTitle = () => {
    switch (mode) {
      case 'compte': return 'Répartition par Compte';
      case 'category': return 'Répartition par Catégorie';
      case 'subcategory': return 'Répartition par Sous-catégorie';
      default: return 'Répartition';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getModeTitle()}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
          
          <div className="flex gap-2 justify-center mt-4">
            <Button 
              variant={mode === 'compte' ? "default" : "outline"}
              size="sm"
              onClick={() => setMode('compte')}
            >
              Compte
            </Button>
            <Button 
              variant={mode === 'category' ? "default" : "outline"}
              size="sm"
              onClick={() => setMode('category')}
            >
              Catégorie
            </Button>
            <Button 
              variant={mode === 'subcategory' ? "default" : "outline"}
              size="sm"
              onClick={() => setMode('subcategory')}
            >
              Sous-catégorie
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
