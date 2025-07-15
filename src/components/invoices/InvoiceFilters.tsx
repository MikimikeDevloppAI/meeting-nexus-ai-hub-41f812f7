
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { X, Calendar } from "lucide-react";

interface Invoice {
  compte: string;
  supplier_name?: string;
  invoice_date?: string;
}

interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  compte?: string;
  supplier?: string;
  year?: string;
  month?: string;
}

interface InvoiceFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  invoices: Invoice[];
}

export function InvoiceFilters({ filters, onFiltersChange, invoices }: InvoiceFiltersProps) {
  const uniqueComptes = Array.from(new Set(invoices.map(inv => inv.compte).filter(Boolean)));
  const uniqueSuppliers = Array.from(new Set(
    invoices
      .map(inv => inv.supplier_name?.toUpperCase())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  
  const supplierOptions = [
    { value: 'all', label: 'Tous les fournisseurs' },
    ...uniqueSuppliers.map(supplier => ({ value: supplier, label: supplier }))
  ];

  // Extraire les années et mois disponibles des factures
  const availableYears = Array.from(new Set(
    invoices
      .filter(inv => inv.invoice_date)
      .map(inv => new Date(inv.invoice_date!).getFullYear())
      .sort((a, b) => b - a) // Tri décroissant (plus récent en premier)
  ));

  const availableMonths = Array.from(new Set(
    invoices
      .filter(inv => inv.invoice_date)
      .map(inv => {
        const date = new Date(inv.invoice_date!);
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      })
      .sort((a, b) => b.localeCompare(a)) // Tri décroissant
  ));

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split('-');
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const selectYear = (year: string) => {
    onFiltersChange({ 
      ...filters, 
      year,
      // Effacer le mois quand on change d'année
      month: undefined,
      // Ajuster les dates de début/fin
      dateFrom: `${year}-01-01`,
      dateTo: `${year}-12-31`
    });
  };

  const selectMonth = (monthString: string) => {
    const [year, month] = monthString.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    
    onFiltersChange({ 
      ...filters, 
      year,
      month: monthString,
      dateFrom: startDate.toISOString().split('T')[0],
      dateTo: endDate.toISOString().split('T')[0]
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filtres</CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="flex items-center gap-1">
              <X className="h-4 w-4" />
              Effacer
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtres rapides par année et mois */}
        <div className="space-y-4 mb-6">
          {/* Années disponibles */}
          {availableYears.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Filtres rapides par année
              </Label>
              <div className="flex flex-wrap gap-2">
                {availableYears.map(year => (
                  <Button
                    key={year}
                    variant={filters.year === year.toString() ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectYear(year.toString())}
                    className="text-sm"
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Mois disponibles */}
          {availableMonths.length > 0 && (
            <div className="space-y-2">
              <Label>Filtres rapides par mois</Label>
              <div className="flex flex-wrap gap-2">
                {availableMonths.slice(0, 12).map(month => (
                  <Button
                    key={month}
                    variant={filters.month === month ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectMonth(month)}
                    className="text-sm"
                  >
                    {formatMonth(month)}
                  </Button>
                ))}
              </div>
              {availableMonths.length > 12 && (
                <p className="text-xs text-muted-foreground">
                  Affichage des 12 mois les plus récents
                </p>
              )}
            </div>
          )}
        </div>

        {/* Filtres détaillés */}
        <div className="border-t pt-4">
          <Label className="text-sm font-medium text-muted-foreground mb-3 block">
            Filtres détaillés
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date de début</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Date de fin</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Compte</Label>
              <Select value={filters.compte || 'all'} onValueChange={(value) => onFiltersChange({ ...filters, compte: value === 'all' ? undefined : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les comptes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les comptes</SelectItem>
                  {uniqueComptes.map(compte => (
                    <SelectItem key={compte} value={compte}>{compte}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Combobox
                options={supplierOptions}
                value={filters.supplier}
                placeholder="Tous les fournisseurs"
                searchPlaceholder="Rechercher un fournisseur..."
                emptyText="Aucun fournisseur trouvé"
                onSelect={(value) => onFiltersChange({ ...filters, supplier: value === 'all' ? undefined : value })}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
