
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { X } from "lucide-react";

interface Invoice {
  compte: string;
  supplier_name?: string;
}

interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  compte?: string;
  supplier?: string;
}

interface InvoiceFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  invoices: Invoice[];
}

export function InvoiceFilters({ filters, onFiltersChange, invoices }: InvoiceFiltersProps) {
  const uniqueComptes = Array.from(new Set(invoices.map(inv => inv.compte).filter(Boolean).map(c => c.trim()).filter(compte => compte !== 'David')));
  const uniqueSuppliers = Array.from(new Set(
    invoices
      .map(inv => formatSupplierName(inv.supplier_name)?.toUpperCase().trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

// Helper function to properly decode and display supplier names
function formatSupplierName(supplierName?: string): string {
  if (!supplierName) return '';
  
  try {
    let decoded = supplierName;
    
    // First handle common UTF-8 encoding issues
    decoded = decoded
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
    
    return decoded || supplierName;
  } catch (error) {
    console.error('Error decoding supplier name:', error, 'Original:', supplierName);
    return supplierName || '';
  }
}
  
  const supplierOptions = [
    { value: 'all', label: 'Tous les fournisseurs' },
    ...uniqueSuppliers.map(supplier => ({ value: supplier, label: supplier }))
  ];

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
      </CardContent>
    </Card>
  );
}
