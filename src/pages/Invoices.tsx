
import { useState } from "react";
import { InvoiceUploadForm } from "@/components/invoices/InvoiceUploadForm";
import { InvoiceList } from "@/components/invoices/InvoiceList";
import { InvoiceExportButton } from "@/components/invoices/InvoiceExportButton";
import { InvoiceDashboard } from "@/components/invoices/InvoiceDashboard";
import { ManualInvoiceForm } from "@/components/invoices/ManualInvoiceForm";
import { Button } from "@/components/ui/button";
import { BarChart3, Plus, Upload } from "lucide-react";

const Invoices = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Gestion des factures</h1>
          <p className="text-muted-foreground">
            Uploadez vos factures PDF ou images, ou créez-les manuellement
          </p>
        </header>
        <div className="flex gap-2">
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
        {/* Upload Form - Full Width */}
        <div className="w-full">
          <InvoiceUploadForm onUploadSuccess={handleUploadSuccess} />
        </div>

        {/* Invoice List - Below */}
        <div className="w-full">
          <InvoiceList refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
};

export default Invoices;
