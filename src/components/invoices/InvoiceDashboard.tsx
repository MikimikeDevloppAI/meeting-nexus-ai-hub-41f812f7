import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, DollarSign, FileText, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InvoiceFilters } from "./InvoiceFilters";
import { MonthlyExpenseChart } from "./MonthlyExpenseChart";
import { DonutCategoryChart } from "./DonutCategoryChart";
import { SupplierChart } from "./SupplierChart";
import { FilteredInvoiceList } from "./FilteredInvoiceList";
import { InvoiceValidationDialog } from "./InvoiceValidationDialog";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface InvoiceDashboardProps {
  onClose: () => void;
}

interface Invoice {
  id: string;
  compte: string;
  invoice_date?: string;
  total_amount?: number;
  total_net?: number;
  currency?: string;
  supplier_name?: string;
  purchase_category?: string;
  purchase_subcategory?: string;
  status: string;
  created_at: string;
  original_filename: string;
  file_path: string;
  error_message?: string;
}

interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  compte?: string;
  category?: string;
}

export function InvoiceDashboard({ onClose }: InvoiceDashboardProps) {
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .in('status', ['completed', 'validated'])
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    }
  });

  // Fonctions pour les filtres de date
  const setDateFilter = (type: 'all' | 'mtd' | 'ytd') => {
    const now = new Date();
    let dateFrom: string | undefined;
    let dateTo: string | undefined;

    switch (type) {
      case 'mtd':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        dateTo = now.toISOString().split('T')[0];
        break;
      case 'ytd':
        dateFrom = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        dateTo = now.toISOString().split('T')[0];
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
    const currentMonth = now.getMonth();
    
    switch (type) {
      case 'all':
        return !filters.dateFrom && !filters.dateTo;
      case 'mtd':
        if (!filters.dateFrom || !filters.dateTo) return false;
        const mtdStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
        return filters.dateFrom === mtdStart;
      case 'ytd':
        if (!filters.dateFrom || !filters.dateTo) return false;
        const ytdStart = new Date(currentYear, 0, 1).toISOString().split('T')[0];
        return filters.dateFrom === ytdStart && filters.dateFrom !== new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      default:
        return false;
    }
  };

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    
    return invoices.filter(invoice => {
      // Filtre par date
      if (filters.dateFrom && invoice.invoice_date) {
        if (new Date(invoice.invoice_date) < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo && invoice.invoice_date) {
        if (new Date(invoice.invoice_date) > new Date(filters.dateTo)) return false;
      }
      
      // Filtre par compte
      if (filters.compte && invoice.compte !== filters.compte) return false;
      
      // Filtre par catégorie
      if (filters.category && invoice.purchase_category !== filters.category) return false;
      
      return true;
    });
  }, [invoices, filters]);

  const stats = useMemo(() => {
    if (!filteredInvoices?.length) return {
      totalAmount: 0,
      invoiceCount: 0,
      averageAmount: 0,
      communAmount: 0,
      davidAmount: 0
    };

    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const communAmount = filteredInvoices
      .filter(inv => inv.compte === 'Commun')
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const davidAmount = filteredInvoices
      .filter(inv => inv.compte === 'David Tabibian')
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    return {
      totalAmount,
      invoiceCount: filteredInvoices.length,
      averageAmount: totalAmount / filteredInvoices.length,
      communAmount,
      davidAmount
    };
  }, [filteredInvoices]);

  // Fonction pour formatter les montants en CHF avec séparateurs de milliers
  const formatAmount = (amount: number): string => {
    return `${Math.round(amount).toLocaleString('fr-CH')} CHF`;
  };

  // Handlers for invoice actions
  const handleValidateInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setValidationDialogOpen(true);
  };

  const handleValidationComplete = () => {
    refetch();
  };

  const downloadFile = async (filePath: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('invoices')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
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
      setDeletingInvoiceId(null);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Chargement du dashboard...</div>;
  }

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

        {/* Boutons de filtre de date */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filtres de période</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button 
                variant={isButtonActive('all') ? "default" : "outline"}
                onClick={() => setDateFilter('all')}
              >
                Toutes périodes
              </Button>
              <Button 
                variant={isButtonActive('mtd') ? "default" : "outline"}
                onClick={() => setDateFilter('mtd')}
              >
                Mois en cours
              </Button>
              <Button 
                variant={isButtonActive('ytd') ? "default" : "outline"}
                onClick={() => setDateFilter('ytd')}
              >
                Année en cours
              </Button>
            </div>
            
            {/* Filtres existants */}
            <InvoiceFilters filters={filters} onFiltersChange={setFilters} invoices={invoices || []} />
          </CardContent>
        </Card>

        {/* Statistiques principales - Seulement 2 cartes maintenant */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total TTC</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(stats.totalAmount)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.invoiceCount} facture{stats.invoiceCount > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compte Commun</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(stats.communAmount)}</div>
              <p className="text-xs text-muted-foreground">
                vs {formatAmount(stats.davidAmount)} David Tabibian
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Graphique mensuel - Pleine largeur */}
        <MonthlyExpenseChart 
          invoices={filteredInvoices} 
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
        />

        {/* Graphiques côte à côte */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DonutCategoryChart invoices={filteredInvoices} />
          <SupplierChart invoices={filteredInvoices} />
        </div>

        {/* Tableau des factures filtrées */}
        <FilteredInvoiceList 
          invoices={filteredInvoices}
          onValidateInvoice={handleValidateInvoice}
          onDeleteInvoice={deleteInvoice}
          onDownloadFile={downloadFile}
          deletingInvoiceId={deletingInvoiceId}
        />
      </div>

      {selectedInvoice && (
        <InvoiceValidationDialog
          invoice={selectedInvoice}
          open={validationDialogOpen}
          onOpenChange={setValidationDialogOpen}
          onValidated={handleValidationComplete}
        />
      )}
    </>
  );
}
