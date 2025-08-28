
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, ResponsiveContainer, LabelList, Tooltip, Legend } from "recharts";
import { useMemo } from "react";

interface Invoice {
  invoice_type?: string;
  original_amount_chf?: number;
}

interface InvoiceTypeBarChartProps {
  invoices: Invoice[];
}

const palette = ['hsl(var(--primary) / 0.85)', 'hsl(var(--secondary) / 0.85)', 'hsl(var(--accent) / 0.85)', 'hsl(var(--destructive) / 0.85)', 'hsl(var(--muted) / 0.85)'];

const chartConfig = {
  amount: {
    label: "Montant",
    color: palette[0],
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

  // Fonction pour formatter les montants
  const formatAmount = (value: number): string => {
    return `${Math.round(value).toLocaleString('fr-CH')} CHF`;
  };

  // Calculer la largeur minimum pour afficher tous les types
  const minWidth = Math.max(600, chartData.length * 80);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Répartition par Type de Facture</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <div className="h-[360px]" style={{ minWidth: `${minWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 60, right: 30, left: 20, bottom: 80 }}>
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  interval={0}
                  fontSize={10}
                  axisLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 }}
                  tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                />
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
                              Montant CHF
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
                <Bar 
                  dataKey="amount" 
                  fill={chartConfig.amount.color} 
                  name="Montant CHF"
                  radius={[4, 4, 0, 0]}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                >
                  <LabelList 
                    dataKey="amount" 
                    position="top"
                    content={({ x, y, width, value }) => {
                      if (!value || value === 0) return null;
                      const xPos = Number(x) || 0;
                      const yPos = Number(y) || 0;
                      const barWidth = Number(width) || 0;
                      
                      return (
                        <g>
                          <rect
                            x={xPos + barWidth/2 - 35}
                            y={yPos - 25}
                            width="70"
                            height="20"
                            rx="10"
                            ry="10"
                            fill="hsla(var(--background) / 0.95)"
                            stroke="hsl(var(--border))"
                            strokeWidth="1"
                            style={{ filter: 'drop-shadow(0 2px 4px hsla(0, 0%, 0%, 0.1))' }}
                          />
                          <text
                            x={xPos + barWidth/2}
                            y={yPos - 12}
                            textAnchor="middle"
                            fill="hsl(var(--foreground))"
                            fontSize="11"
                            fontWeight="500"
                          >
                            {Math.round(Number(value)).toLocaleString('fr-CH')}
                          </text>
                        </g>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
