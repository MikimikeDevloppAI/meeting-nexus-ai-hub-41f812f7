import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, DollarSign, FileText, ArrowLeft, Users, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InvoiceFilters } from "./InvoiceFilters";
import { MonthlyExpenseChart } from "./MonthlyExpenseChart";
import { CategoryChart } from "./CategoryChart";
import { SupplierChart } from "./SupplierChart";
import { FilteredInvoiceList } from "./FilteredInvoiceList";
import { SimpleInvoiceValidationDialog } from "./SimpleInvoiceValidationDialog";
import { GrowthComparisonCard } from "./GrowthComparisonCard";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface InvoiceDashboardProps {
  onClose: () => void;
}

interface Invoice {
  id: string;
  compte: string;
  payment_date?: string;
  total_amount?: number;
  total_net?: number;
  currency?: string;
  supplier_name?: string;
  purchase_category?: string;
  invoice_type?: string;
  purchase_subcategory?: string;
  status: string;
  created_at: string;
  original_filename: string;
  file_path: string;
  error_message?: string;
  original_amount_chf?: number;
}

interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  compte?: string;
  supplier?: string;
}

interface ChartFilters {
  selectedMonth?: string;
  selectedCategory?: string;
  selectedSupplier?: string;
}

interface SearchFilters {
  dateFrom?: string;
  dateTo?: string;
  compte?: string;
  supplier?: string;
  minAmount?: number;
  maxAmount?: number;
}

export function InvoiceDashboard({ onClose }: InvoiceDashboardProps) {
  // Fonction pour créer une date au format YYYY-MM-DD sans problème de fuseau horaire
  const formatDateForInput = (year: number, month: number, day: number): string => {
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };
  
  // Initialiser avec "année en cours" par défaut
  const getDefaultFilters = (): DashboardFilters => {
    const now = new Date();
    const dateFrom = formatDateForInput(now.getFullYear(), 1, 1);
    const dateTo = formatDateForInput(now.getFullYear(), now.getMonth() + 1, now.getDate());
    
    return { dateFrom, dateTo };
  };

  const [filters, setFilters] = useState<DashboardFilters>(getDefaultFilters());
  const [chartFilters, setChartFilters] = useState<ChartFilters>({});
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string>('');

  // Reset chart filters function
  const resetChartFilters = () => {
    setChartFilters({});
  };

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .in('status', ['completed', 'validated'])
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    }
  });

  // Helper function to format supplier names
  const formatSupplierName = (supplierName?: string): string => {
    if (!supplierName) return '';
    
    try {
      return supplierName
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
    } catch (error) {
      return supplierName;
    }
  };

  // Fonctions pour les filtres de date
  const setDateFilter = (type: 'all' | 'mtd' | 'ytd') => {
    const now = new Date();
    let dateFrom: string | undefined;
    let dateTo: string | undefined;

    switch (type) {
      case 'mtd':
        dateFrom = formatDateForInput(now.getFullYear(), now.getMonth() + 1, 1);
        dateTo = formatDateForInput(now.getFullYear(), now.getMonth() + 1, now.getDate());
        break;
      case 'ytd':
        dateFrom = formatDateForInput(now.getFullYear(), 1, 1);
        dateTo = formatDateForInput(now.getFullYear(), now.getMonth() + 1, now.getDate());
        break;
      case 'all':
      default:
        dateFrom = undefined;
        dateTo = undefined;
        break;
    }

    setFilters(prev => ({ ...prev, dateFrom, dateTo }));
  };

  // Fonction pour vérifier si un bouton est actif
  const isButtonActive = (type: 'all' | 'mtd' | 'ytd') => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    switch (type) {
      case 'all':
        return !filters.dateFrom && !filters.dateTo;
      case 'mtd':
        if (!filters.dateFrom || !filters.dateTo) return false;
        const expectedMtdStart = formatDateForInput(currentYear, currentMonth, 1);
        return filters.dateFrom === expectedMtdStart;
      case 'ytd':
        if (!filters.dateFrom || !filters.dateTo) return false;
        const expectedYtdStart = formatDateForInput(currentYear, 1, 1);
        return filters.dateFrom === expectedYtdStart;
      default:
        return false;
    }
  };

  // Filtered invoices for statistics and main charts (based on dashboard filters)
  const filteredInvoices = useMemo(() => {
    return invoices?.filter(invoice => {
      if (filters.dateFrom && invoice.payment_date) {
        const invoiceDate = new Date(invoice.payment_date);
        const filterDate = new Date(filters.dateFrom);
        if (invoiceDate < filterDate) return false;
      }
      
      if (filters.dateTo && invoice.payment_date) {
        const invoiceDate = new Date(invoice.payment_date);
        const filterDate = new Date(filters.dateTo);
        if (invoiceDate > filterDate) return false;
      }
      
      if (filters.compte && filters.compte !== 'all' && invoice.compte !== filters.compte) {
        return false;
      }
      
      if (filters.supplier && filters.supplier !== 'all') {
        const supplierName = formatSupplierName(invoice.supplier_name);
        if (!supplierName?.toLowerCase().includes(filters.supplier.toLowerCase())) {
          return false;
        }
      }
      
      return true;
    }) || [];
  }, [invoices, filters]);

  // Chart filtered invoices (based on dashboard filters + chart interactions)
  const chartFilteredInvoices = useMemo(() => {
    return filteredInvoices.filter(invoice => {
      // Filter by selected month
      if (chartFilters.selectedMonth && invoice.payment_date) {
        const invoiceDate = new Date(invoice.payment_date);
        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthKey !== chartFilters.selectedMonth) return false;
      }
      
      // Filter by selected category
      if (chartFilters.selectedCategory && invoice.invoice_type !== chartFilters.selectedCategory) {
        return false;
      }
      
      // Filter by selected supplier
      if (chartFilters.selectedSupplier) {
        const supplierName = formatSupplierName(invoice.supplier_name);
        if (supplierName !== chartFilters.selectedSupplier) return false;
      }
      
      return true;
    });
  }, [filteredInvoices, chartFilters]);

  // Statistics calculations (based on chart filtered data)
  const totalInvoices = chartFilteredInvoices.length;
  const totalAmount = chartFilteredInvoices.reduce((sum, invoice) => sum + (invoice.original_amount_chf || 0), 0);
  const pendingInvoices = chartFilteredInvoices.filter(invoice => invoice.status === 'pending').length;
  const validatedInvoices = chartFilteredInvoices.filter(invoice => invoice.status === 'validated').length;

  // Fonction pour formatter les montants en CHF avec séparateurs de milliers
  const formatAmount = (amount: number): string => {
    return `${Math.round(amount).toLocaleString('fr-CH')} CHF`;
  };

  // Handlers for invoice actions
  const handleValidateInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
  };

  const handleValidationComplete = () => {
    refetch();
  };

  const deleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la facture "${invoice.original_filename}" ?`)) {
      return;
    }

    setDeletingInvoiceId(invoice.id);
    
    try {
      const { error: dbError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (dbError) {
        throw dbError;
      }

      if (invoice.file_path) {
        try {
          const { error: storageError } = await supabase.storage
            .from('invoices')
            .remove([invoice.file_path]);

          if (storageError) {
            console.warn('Storage deletion warning (continuing anyway):', storageError);
          }
        } catch (storageError) {
          console.warn('Storage deletion error (continuing anyway):', storageError);
        }
      }

      toast.success(`Facture "${invoice.original_filename}" supprimée avec succès`);
      await refetch();
      
    } catch (error) {
      console.error('Error during deletion process:', error);
      toast.error(`Erreur lors de la suppression de la facture: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setDeletingInvoiceId('');
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Chargement du dashboard...</div>;
  }

  const communAmount = chartFilteredInvoices
    .filter(inv => inv.compte === 'Commun')
    .reduce((sum, inv) => sum + (inv.original_amount_chf || 0), 0);
  const davidAmount = chartFilteredInvoices
    .filter(inv => inv.compte === 'David Tabibian')
    .reduce((sum, inv) => sum + (inv.original_amount_chf || 0), 0);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Dashboard Factures</h2>
            <p className="text-muted-foreground">
              Analyse et statistiques de vos factures
            </p>
          </div>
          <Button variant="outline" onClick={onClose} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        </div>

        {/* Filtres */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filtres de période</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button 
                variant={isButtonActive('ytd') ? "default" : "outline"}
                onClick={() => setDateFilter('ytd')}
              >
                Année en cours
              </Button>
              <Button 
                variant={isButtonActive('mtd') ? "default" : "outline"}
                onClick={() => setDateFilter('mtd')}
              >
                Mois en cours
              </Button>
              <Button 
                variant={isButtonActive('all') ? "default" : "outline"}
                onClick={() => setDateFilter('all')}
              >
                Toute période
              </Button>
            </div>
            
            <InvoiceFilters filters={filters} onFiltersChange={setFilters} invoices={invoices || []} />
        
            {/* Chart Filter Indicator & Reset */}
            {(chartFilters.selectedMonth || chartFilters.selectedCategory || chartFilters.selectedSupplier) && (
              <Card className="bg-blue-50 border-blue-200 mt-4">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <span>Filtres graphiques actifs:</span>
                      {chartFilters.selectedMonth && <Badge variant="secondary">Mois: {chartFilters.selectedMonth}</Badge>}
                      {chartFilters.selectedCategory && <Badge variant="secondary">Catégorie: {chartFilters.selectedCategory}</Badge>}
                      {chartFilters.selectedSupplier && <Badge variant="secondary">Fournisseur: {chartFilters.selectedSupplier}</Badge>}
                    </div>
                    <Button variant="outline" size="sm" onClick={resetChartFilters}>
                      Réinitialiser les filtres
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Statistiques principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total TTC</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(totalAmount)}</div>
              <p className="text-xs text-muted-foreground">
                {totalInvoices} facture{totalInvoices > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <GrowthComparisonCard 
            allInvoices={invoices || []}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compte Commun</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(communAmount)}</div>
              <p className="text-xs text-muted-foreground">
                {totalAmount > 0 ? Math.round((communAmount / totalAmount) * 100) : 0}% du total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">David Tabibian</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(davidAmount)}</div>
              <p className="text-xs text-muted-foreground">
                {totalAmount > 0 ? Math.round((davidAmount / totalAmount) * 100) : 0}% du total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <MonthlyExpenseChart 
            invoices={chartFilteredInvoices} 
            dateFrom={filters.dateFrom} 
            dateTo={filters.dateTo}
            onMonthClick={(month) => setChartFilters(prev => ({ ...prev, selectedMonth: month }))}
            selectedMonth={chartFilters.selectedMonth}
          />
          <CategoryChart 
            invoices={chartFilteredInvoices}
            onCategoryClick={(category) => setChartFilters(prev => ({ ...prev, selectedCategory: category }))}
            selectedCategory={chartFilters.selectedCategory}
          />
          <SupplierChart 
            invoices={chartFilteredInvoices}
            onSupplierClick={(supplier) => setChartFilters(prev => ({ ...prev, selectedSupplier: supplier }))}
            selectedSupplier={chartFilters.selectedSupplier}
          />
        </div>

        {/* Tableau des factures */}
        <FilteredInvoiceList 
          invoices={invoices || []}
          onValidateInvoice={handleValidateInvoice}
          onDeleteInvoice={deleteInvoice}
          deletingInvoiceId={deletingInvoiceId}
        />
      </div>

      {editingInvoice && (
        <SimpleInvoiceValidationDialog
          invoice={editingInvoice}
          open={!!editingInvoice}
          onOpenChange={(open) => !open && setEditingInvoice(null)}
          onValidated={handleValidationComplete}
        />
      )}
    </>
  );
}