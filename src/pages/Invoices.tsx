
import { useState } from "react";
import { InvoiceUploadForm } from "@/components/invoices/InvoiceUploadForm";
import { InvoiceList } from "@/components/invoices/InvoiceList";
import { InvoiceExportButton } from "@/components/invoices/InvoiceExportButton";
import { InvoiceDashboard } from "@/components/invoices/InvoiceDashboard";
import { ManualInvoiceForm } from "@/components/invoices/ManualInvoiceForm";
import { InvoiceFilters } from "@/components/invoices/InvoiceFilters";
import { Button } from "@/components/ui/button";
import { BarChart3, Plus, Upload, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Invoices = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    dateFrom?: string;
    dateTo?: string;
    compte?: string;
    supplier?: string;
    year?: string;
    month?: string;
  }>({});

  // Récupérer toutes les factures pour les filtres
  const { data: allInvoices } = useQuery({
    queryKey: ['all-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleManualSuccess = () => {
    setRefreshKey(prev => prev + 1);
    setShowManualForm(false);
  };

  if (showManualForm) {
    return (
      <div className="animate-fade-in">
        <ManualInvoiceForm 
          onSuccess={handleManualSuccess}
          onCancel={() => setShowManualForm(false)}
        />
      </div>
    );
  }

  if (showDashboard) {
    return (
      <div className="animate-fade-in">
        <InvoiceDashboard onClose={() => setShowDashboard(false)} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gestion des factures</h1>
          <p className="text-muted-foreground">
            Uploadez vos factures PDF ou images, ou créez-les manuellement
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtres
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowManualForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Créer manuellement
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowDashboard(true)}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </Button>
          <InvoiceExportButton />
        </div>
      </div>

      <div className="space-y-6">
        {/* Filtres */}
        {showFilters && allInvoices && (
          <div className="w-full">
            <InvoiceFilters 
              filters={filters}
              onFiltersChange={setFilters}
              invoices={allInvoices}
            />
          </div>
        )}

        {/* Upload Form - Full Width */}
        <div className="w-full">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Upload automatique</h2>
          </div>
          <InvoiceUploadForm onUploadSuccess={handleUploadSuccess} />
        </div>

        {/* Invoice List - Below */}
        <div className="w-full">
          <InvoiceList refreshKey={refreshKey} filters={filters} />
        </div>
      </div>
    </div>
  );
};

export default Invoices;
