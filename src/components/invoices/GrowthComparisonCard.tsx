
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useMemo } from "react";

interface Invoice {
  invoice_date?: string;
  total_amount?: number;
}

interface GrowthComparisonCardProps {
  invoices: Invoice[];
  dateFrom?: string;
  dateTo?: string;
}

export function GrowthComparisonCard({ invoices, dateFrom, dateTo }: GrowthComparisonCardProps) {
  const growthData = useMemo(() => {
    if (!dateFrom || !dateTo) {
      return { currentAmount: 0, previousAmount: 0, growth: 0, periodDays: 0 };
    }

    const currentStart = new Date(dateFrom);
    const currentEnd = new Date(dateTo);
    const periodDays = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));

    // Calculer la période précédente
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - periodDays + 1);

    // Calculer les montants pour chaque période
    let currentAmount = 0;
    let previousAmount = 0;

    invoices.forEach(invoice => {
      if (!invoice.invoice_date || !invoice.total_amount) return;
      
      const invoiceDate = new Date(invoice.invoice_date);
      
      // Période actuelle
      if (invoiceDate >= currentStart && invoiceDate <= currentEnd) {
        currentAmount += invoice.total_amount;
      }
      
      // Période précédente
      if (invoiceDate >= previousStart && invoiceDate <= previousEnd) {
        previousAmount += invoice.total_amount;
      }
    });

    const growth = previousAmount > 0 ? ((currentAmount - previousAmount) / previousAmount) * 100 : 0;

    return { currentAmount, previousAmount, growth, periodDays };
  }, [invoices, dateFrom, dateTo]);

  const formatAmount = (amount: number): string => {
    return `${Math.round(amount).toLocaleString('fr-CH')} CHF`;
  };

  const getGrowthIcon = () => {
    if (growthData.growth > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (growthData.growth < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getGrowthColor = () => {
    if (growthData.growth > 0) return "text-green-600";
    if (growthData.growth < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getPeriodText = () => {
    if (growthData.periodDays <= 31) {
      return `${growthData.periodDays} jours précédents`;
    } else if (growthData.periodDays <= 366) {
      const months = Math.round(growthData.periodDays / 30);
      return `${months} mois précédents`;
    } else {
      const years = Math.round(growthData.periodDays / 365);
      return `${years} année${years > 1 ? 's' : ''} précédente${years > 1 ? 's' : ''}`;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Croissance</CardTitle>
        {getGrowthIcon()}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${getGrowthColor()}`}>
          {growthData.growth > 0 ? '+' : ''}{growthData.growth.toFixed(1)}%
        </div>
        <p className="text-xs text-muted-foreground">
          vs {getPeriodText()}
        </p>
        <div className="text-xs text-muted-foreground mt-1">
          Précédent: {formatAmount(growthData.previousAmount)}
        </div>
      </CardContent>
    </Card>
  );
}
