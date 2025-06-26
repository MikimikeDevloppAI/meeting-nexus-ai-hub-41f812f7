
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

interface Invoice {
  purchase_category?: string;
  total_amount?: number;
}

interface CategoryChartProps {
  invoices: Invoice[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

export function CategoryChart({ invoices }: CategoryChartProps) {
  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();

    invoices.forEach(invoice => {
      if (!invoice.total_amount) return;
      
      const category = invoice.purchase_category || 'Non catégorisé';
      categoryMap.set(category, (categoryMap.get(category) || 0) + invoice.total_amount);
    });

    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7); // Top 7 catégories
  }, [invoices]);

  const chartConfig = useMemo(() => {
    const config: any = {};
    categoryData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: COLORS[index % COLORS.length],
      };
    });
    return config;
  }, [categoryData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition par Catégorie</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
