import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterX } from "lucide-react";

export interface InvoiceListFilters {
  supplierName: string;
  amountMin: string;
  amountMax: string;
  dateFrom: string;
  dateTo: string;
  sortBy: 'date' | 'amount';
  sortOrder: 'desc' | 'asc';
}

interface InvoiceListFiltersProps {
  filters: InvoiceListFilters;
  onFiltersChange: (filters: InvoiceListFilters) => void;
  supplierNames: string[];
}

export function InvoiceListFilters({ filters, onFiltersChange, supplierNames }: InvoiceListFiltersProps) {
  const updateFilter = (field: keyof InvoiceListFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value
    });
  };

  const resetFilters = () => {
    onFiltersChange({
      supplierName: '',
      amountMin: '',
      amountMax: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'date',
      sortOrder: 'desc'
    });
  };

  const sortedSuppliers = supplierNames.sort((a, b) => a.localeCompare(b, 'fr'));

  return (
    <Card className="mb-6 bg-card border shadow-sm">
      <CardContent className="p-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Fournisseur */}
          <div>
            <Label htmlFor="supplier" className="text-sm font-medium">
              Fournisseur
            </Label>
            <Select value={filters.supplierName} onValueChange={(value) => updateFilter('supplierName', value)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Tous les fournisseurs" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="">Tous les fournisseurs</SelectItem>
                {sortedSuppliers.map((supplier) => (
                  <SelectItem key={supplier} value={supplier}>
                    {supplier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Montant */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Montant (€)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.amountMin}
                onChange={(e) => updateFilter('amountMin', e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Max"
                value={filters.amountMax}
                onChange={(e) => updateFilter('amountMax', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date de facture</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
                className="flex-1"
              />
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Tri */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Trier par</Label>
            <div className="space-y-2">
              <Select value={filters.sortBy} onValueChange={(value: 'date' | 'amount') => updateFilter('sortBy', value)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="amount">Montant</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.sortOrder} onValueChange={(value: 'desc' | 'asc') => updateFilter('sortOrder', value)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  {filters.sortBy === 'date' ? (
                    <>
                      <SelectItem value="desc">Plus récent d'abord</SelectItem>
                      <SelectItem value="asc">Plus ancien d'abord</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="desc">Plus grand d'abord</SelectItem>
                      <SelectItem value="asc">Plus petit d'abord</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Bouton Reset */}
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={resetFilters} className="flex items-center gap-2">
            <FilterX className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}