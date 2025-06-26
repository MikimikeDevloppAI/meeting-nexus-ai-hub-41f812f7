
import { useState } from "react";
import { InvoiceUploadForm } from "@/components/invoices/InvoiceUploadForm";
import { InvoiceList } from "@/components/invoices/InvoiceList";
import { InvoiceExportButton } from "@/components/invoices/InvoiceExportButton";
import { InvoiceDashboard } from "@/components/invoices/InvoiceDashboard";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

const Invoices = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

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
            Uploadez vos factures PDF ou images pour un traitement automatique
          </p>
        </div>
        <div className="flex gap-2">
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
