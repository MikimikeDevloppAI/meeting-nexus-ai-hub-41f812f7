
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface Invoice {
  compte: string;
  purchase_category?: string;
}

interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  compte?: string;
  category?: string;
}

interface InvoiceFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  invoices: Invoice[];
}

export function InvoiceFilters({ filters, onFiltersChange, invoices }: InvoiceFiltersProps) {
  const uniqueComptes = Array.from(new Set(invoices.map(inv => inv.compte).filter(Boolean)));
  const uniqueCategories = Array.from(new Set(invoices.map(inv => inv.purchase_category).filter(Boolean)));

  const clearFilters = () => {
    onFiltersChange({});
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
            <Label>Catégorie</Label>
            <Select value={filters.category || 'all'} onValueChange={(value) => onFiltersChange({ ...filters, category: value === 'all' ? undefined : value })}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {uniqueCategories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
