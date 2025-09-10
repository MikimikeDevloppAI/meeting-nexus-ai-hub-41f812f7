import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Clock, CheckCircle, AlertCircle, X, Eye, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Invoice {
  id: string;
  original_filename: string;
  file_path: string;
  status: string;
  compte: string;
  purchase_category?: string;
  invoice_type?: string;
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

interface FilteredInvoiceListFilters {
  compte: string;
  supplier: string;
  invoice_type: string;
  dateFrom: string;
  dateTo: string;
  amountMin: number;
  amountMax: number;
}

interface FilteredInvoiceListProps {
  invoices: Invoice[];
  onValidateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoice: Invoice) => void;
  deletingInvoiceId: string | null;
  editingInvoiceId?: string | null;
  originalInvoiceData?: Invoice | null;
  localTotalAmounts?: Record<string, string>;
  setLocalTotalAmounts?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateInvoiceField?: (invoiceId: string, field: string, value: any) => Promise<void>;
  cancelEditingInvoice?: () => void;
  saveEditingInvoice?: () => Promise<void>;
}

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

export function FilteredInvoiceList({ 
  invoices, 
  onValidateInvoice, 
  onDeleteInvoice, 
  deletingInvoiceId,
  editingInvoiceId,
  originalInvoiceData,
  localTotalAmounts,
  setLocalTotalAmounts,
  updateInvoiceField,
  cancelEditingInvoice,
  saveEditingInvoice
}: FilteredInvoiceListProps) {
  
  const [filters, setFilters] = useState<FilteredInvoiceListFilters>({
    compte: 'all',
    supplier: 'all',
    invoice_type: 'all',
    dateFrom: '',
    dateTo: '',
    amountMin: 0,
    amountMax: 10000
  });

  // Function to view file in bucket (signed URL because invoices bucket is private)
  const viewFile = async (filePath: string, filename?: string) => {
    try {
      const fileExtension = filename?.toLowerCase().split('.').pop() || filePath.toLowerCase().split('.').pop();
      const isPdf = fileExtension === 'pdf';
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '');

      if (isPdf) {
        // Pour les PDFs, télécharger le fichier
        const { data, error } = await supabase.storage
          .from('invoices')
          .download(filePath);

        if (error) throw error;

        if (data) {
          const url = URL.createObjectURL(data);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename || filePath.split('/').pop() || 'invoice.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      } else if (isImage) {
        // Pour les images, visualiser en ligne
        const { data, error } = await supabase.storage
          .from('invoices')
          .createSignedUrl(filePath, 60 * 5); // 5 minutes
        if (error || !data?.signedUrl) throw error || new Error('No signed URL');
        
        const url = data.signedUrl.startsWith('http') 
          ? data.signedUrl 
          : `https://ecziljpkvshvapjsxaty.supabase.co${data.signedUrl}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        console.error('Type de fichier non supporté');
      }
    } catch (err) {
      console.error('Erreur d\'ouverture du fichier:', err);
    }
  };
  
  // Préparation des options pour les filtres
  const uniqueComptes = Array.from(new Set(invoices.map(inv => inv.compte).filter(Boolean).map(c => c.trim()).filter(compte => compte !== 'David')));
  const uniqueSuppliers = Array.from(new Set(
    invoices
      .map(inv => formatSupplierName(inv.supplier_name)?.toUpperCase().trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  
  const uniqueInvoiceTypes = Array.from(new Set(invoices.map(inv => inv.invoice_type).filter(Boolean))).sort();
  
  // Filtrer les factures
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      if (filters.compte !== 'all' && invoice.compte !== filters.compte) {
        return false;
      }
      
      if (filters.supplier !== 'all' && !formatSupplierName(invoice.supplier_name)?.toUpperCase().includes(filters.supplier.toUpperCase())) {
        return false;
      }
      
      if (filters.invoice_type !== 'all' && invoice.invoice_type !== filters.invoice_type) {
        return false;
      }
      
      if (filters.dateFrom) {
        const invoiceDate = new Date(invoice.payment_date || invoice.invoice_date || '');
        const filterDate = new Date(filters.dateFrom);
        if (invoiceDate < filterDate) return false;
      }
      
      if (filters.dateTo) {
        const invoiceDate = new Date(invoice.payment_date || invoice.invoice_date || '');
        const filterDate = new Date(filters.dateTo);
        if (invoiceDate > filterDate) return false;
      }
      
      const amount = invoice.original_amount_chf || 0;
      if (amount < filters.amountMin || amount > filters.amountMax) {
        return false;
      }
      
      return true;
    });
  }, [invoices, filters]);
  
  const supplierOptions = [
    { value: 'all', label: 'Tous les fournisseurs' },
    ...uniqueSuppliers.map(supplier => ({ value: supplier, label: supplier }))
  ];
  
  const invoiceTypeOptions = [
    { value: 'all', label: 'Toutes les catégories' },
    ...uniqueInvoiceTypes.map(type => ({ value: type, label: type }))
  ];

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle>Recherche de factures</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filtres de recherche */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtre par compte */}
            <div>
              <Label htmlFor="compte-filter">Compte</Label>
              <Combobox
                options={[
                  { value: 'all', label: 'Tous les comptes' },
                  ...uniqueComptes.map(compte => ({ value: compte, label: compte }))
                ]}
                value={filters.compte}
                onSelect={(value) => setFilters(prev => ({ ...prev, compte: value }))}
                placeholder="Sélectionner un compte"
              />
            </div>

            {/* Filtre par fournisseur */}
            <div>
              <Label htmlFor="supplier-filter">Fournisseur</Label>
              <Combobox
                options={supplierOptions}
                value={filters.supplier}
                onSelect={(value) => setFilters(prev => ({ ...prev, supplier: value }))}
                placeholder="Sélectionner un fournisseur"
              />
            </div>
            
            {/* Filtre par catégorie (invoice_type) */}
            <div>
              <Label htmlFor="invoice-type-filter">Catégorie</Label>
              <Combobox
                options={invoiceTypeOptions}
                value={filters.invoice_type}
                onSelect={(value) => setFilters(prev => ({ ...prev, invoice_type: value }))}
                placeholder="Sélectionner une catégorie"
              />
            </div>
          </div>

          {/* Filtres par date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date-from">Date de</Label>
              <Input
                id="date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="date-to">Date à</Label>
              <Input
                id="date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>
          
          {/* Filtre par montant avec slider */}
          <div className="space-y-4">
            <Label>Filtrer par montant</Label>
            <div className="bg-background border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">de</span>
                <span className="text-sm text-muted-foreground">à</span>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    type="number"
                    value={filters.amountMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, amountMin: Number(e.target.value) }))}
                    placeholder="CHF 2 000"
                    className="text-center bg-muted border-2 rounded-full"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    value={filters.amountMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, amountMax: Number(e.target.value) }))}
                    placeholder="CHF 7 000"
                    className="text-center bg-muted border-2 rounded-full"
                  />
                </div>
              </div>
              <div className="px-2">
                <Slider
                  value={[filters.amountMin, filters.amountMax]}
                  onValueChange={([min, max]) => setFilters(prev => ({ ...prev, amountMin: min, amountMax: max }))}
                  max={10000}
                  min={0}
                  step={100}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>CHF 0</span>
                  <span>CHF 10 000</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tableau des factures */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Compte</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Montant (CHF)</TableHead>
              <TableHead>Date de paiement</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((invoice) => {
              const isEditing = editingInvoiceId === invoice.id;
              
              return (
                <TableRow key={invoice.id}>
                  <TableCell>{formatSupplierName(invoice.supplier_name) || 'N/A'}</TableCell>
                  <TableCell>{invoice.compte || 'N/A'}</TableCell>
                  <TableCell>{invoice.invoice_type || 'N/A'}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        type="text"
                        value={localTotalAmounts?.[invoice.id] ?? (invoice.total_amount != null ? invoice.total_amount.toString().replace('.', ',') : '')}
                        onChange={(e) => {
                          const raw = e.target.value;
                          // Autoriser chiffres, virgule et point, et permettre la saisie vide
                          if (raw === '' || /^[\d,.]*$/.test(raw)) {
                            // Stocker au format français (virgule) dans l'état local
                            const french = raw.replace(/\./g, ',');
                            setLocalTotalAmounts?.(prev => ({ ...prev, [invoice.id]: french }));
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="0,00"
                        className="h-8 w-24"
                      />
                    ) : (
                      invoice.original_amount_chf ? `${invoice.original_amount_chf.toFixed(2)} CHF` : 'N/A'
                    )}
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
                          onClick={() => viewFile(invoice.file_path, invoice.original_filename)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {isEditing ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={saveEditingInvoice}
                            className="flex items-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEditingInvoice}
                            className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        (invoice.status === 'completed' || invoice.status === 'validated') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onValidateInvoice(invoice)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )
                      )}

                      {!isEditing && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDeleteInvoice(invoice)}
                          disabled={deletingInvoiceId === invoice.id}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        {filteredInvoices.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucune facture trouvée avec ces critères
          </div>
        )}
      </CardContent>
    </Card>
  );
}