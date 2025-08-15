import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Edit, Trash2, Clock, CheckCircle, AlertCircle, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Invoice {
  id: string;
  original_filename: string;
  file_path: string;
  status: string;
  compte: string;
  purchase_category?: string;
  purchase_subcategory?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  total_amount?: number;
  total_net?: number;
  total_tax?: number;
  currency?: string;
  supplier_name?: string;
  supplier_address?: string;
  supplier_email?: string;
  supplier_phone_number?: string;
  supplier_iban?: string;
  customer_name?: string;
  customer_address?: string;
  payment_details?: string;
  line_items?: any;
  created_at: string;
  processed_at?: string;
  error_message?: string;
  original_amount_chf?: number;
  payment_date?: string;
}

interface SearchFilters {
  dateFrom?: string;
  dateTo?: string;
  compte?: string;
  supplier?: string;
  minAmount?: number;
  maxAmount?: number;
}

interface FilteredInvoiceListProps {
  invoices: Invoice[];
  searchFilters: SearchFilters;
  onSearchFiltersChange: (filters: SearchFilters) => void;
  onValidateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoice: Invoice) => void;
  onDownloadFile: (filePath: string, filename: string) => void;
  deletingInvoiceId: string | null;
}

// Helper function to properly decode and display supplier names
const formatSupplierName = (supplierName?: string): string => {
  if (!supplierName) return 'N/A';
  
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
    return supplierName;
  }
};

export function FilteredInvoiceList({ 
  invoices, 
  searchFilters, 
  onSearchFiltersChange, 
  onValidateInvoice, 
  onDeleteInvoice, 
  onDownloadFile, 
  deletingInvoiceId 
}: FilteredInvoiceListProps) {
  
  // Préparation des options pour les filtres
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

  const clearSearchFilters = () => {
    onSearchFiltersChange({});
  };

  const hasActiveSearchFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '' && value !== null);

  // Appliquer les filtres de recherche
  const searchFilteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      // Filtre par date - utilise payment_date
      if (searchFilters.dateFrom && invoice.payment_date) {
        if (new Date(invoice.payment_date) < new Date(searchFilters.dateFrom)) return false;
      }
      if (searchFilters.dateTo && invoice.payment_date) {
        if (new Date(invoice.payment_date) > new Date(searchFilters.dateTo)) return false;
      }
      
      // Filtre par compte
      if (searchFilters.compte && invoice.compte !== searchFilters.compte) return false;
      
      // Filtre par fournisseur (insensible à la casse)
      if (searchFilters.supplier && invoice.supplier_name?.toLowerCase() !== searchFilters.supplier.toLowerCase()) return false;
      
      // Filtre par montant minimum
      if (searchFilters.minAmount && invoice.original_amount_chf && invoice.original_amount_chf < searchFilters.minAmount) return false;
      
      // Filtre par montant maximum
      if (searchFilters.maxAmount && invoice.original_amount_chf && invoice.original_amount_chf > searchFilters.maxAmount) return false;
      
      return true;
    });
  }, [invoices, searchFilters]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          En attente
        </Badge>;
      case 'processing':
        return <Badge variant="default" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Traitement
        </Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-blue-500 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          À valider
        </Badge>;
      case 'validated':
        return <Badge variant="default" className="bg-green-500 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Validé
        </Badge>;
      case 'error':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Erreur
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-600">Aucune facture trouvée pour cette période</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recherche de factures</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filtres de recherche */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filtres de recherche</CardTitle>
              {hasActiveSearchFilters && (
                <Button variant="ghost" size="sm" onClick={clearSearchFilters} className="flex items-center gap-1">
                  <X className="h-4 w-4" />
                  Effacer
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Première ligne : dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="searchDateFrom">Date de début</Label>
                  <Input
                    id="searchDateFrom"
                    type="date"
                    value={searchFilters.dateFrom || ''}
                    onChange={(e) => onSearchFiltersChange({ ...searchFilters, dateFrom: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="searchDateTo">Date de fin</Label>
                  <Input
                    id="searchDateTo"
                    type="date"
                    value={searchFilters.dateTo || ''}
                    onChange={(e) => onSearchFiltersChange({ ...searchFilters, dateTo: e.target.value })}
                  />
                </div>
              </div>

              {/* Deuxième ligne : fournisseur et compte */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fournisseur</Label>
                  <Combobox
                    options={supplierOptions}
                    value={searchFilters.supplier}
                    placeholder="Tous les fournisseurs"
                    searchPlaceholder="Rechercher un fournisseur..."
                    emptyText="Aucun fournisseur trouvé"
                    onSelect={(value) => onSearchFiltersChange({ ...searchFilters, supplier: value === 'all' ? undefined : value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Compte</Label>
                  <Select value={searchFilters.compte || 'all'} onValueChange={(value) => onSearchFiltersChange({ ...searchFilters, compte: value === 'all' ? undefined : value })}>
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
              </div>

              {/* Troisième ligne : montants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minAmount">Montant minimum (CHF)</Label>
                  <Input
                    id="minAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={searchFilters.minAmount || ''}
                    onChange={(e) => onSearchFiltersChange({ ...searchFilters, minAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="De..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxAmount">Montant maximum (CHF)</Label>
                  <Input
                    id="maxAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={searchFilters.maxAmount || ''}
                    onChange={(e) => onSearchFiltersChange({ ...searchFilters, maxAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="À..."
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tableau des factures */}
        <div className="text-sm text-muted-foreground mb-4">
          {searchFilteredInvoices.length} facture{searchFilteredInvoices.length !== 1 ? 's' : ''} trouvée{searchFilteredInvoices.length !== 1 ? 's' : ''}
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fichier</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Compte</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date de paiement</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {searchFilteredInvoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  {invoice.original_filename}
                </TableCell>
                <TableCell>
                  {formatSupplierName(invoice.supplier_name)}
                </TableCell>
                <TableCell className="font-semibold">
                  {invoice.original_amount_chf ? 
                    `${invoice.original_amount_chf.toFixed(2)} CHF` : 
                    (invoice.total_amount ? `${invoice.total_amount.toFixed(2)} ${invoice.currency || 'EUR'}` : 'N/A')
                  }
                </TableCell>
                <TableCell>{invoice.compte || 'Commun'}</TableCell>
                <TableCell>
                  {getStatusBadge(invoice.status)}
                </TableCell>
                <TableCell>
                  {invoice.payment_date ? 
                    new Date(invoice.payment_date).toLocaleDateString('fr-FR') : 
                    'N/A'
                  }
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {invoice.file_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDownloadFile(invoice.file_path, invoice.original_filename)}
                        className="flex items-center gap-1"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {(invoice.status === 'completed' || invoice.status === 'validated') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onValidateInvoice(invoice)}
                        className="flex items-center gap-1"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteInvoice(invoice)}
                      disabled={deletingInvoiceId === invoice.id}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {searchFilteredInvoices.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucune facture trouvée avec ces critères
          </div>
        )}
      </CardContent>
    </Card>
  );
}