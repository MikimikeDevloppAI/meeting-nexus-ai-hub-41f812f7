
import { useState } from "react";
import { InvoiceUploadForm } from "@/components/invoices/InvoiceUploadForm";
import { InvoiceList } from "@/components/invoices/InvoiceList";

const Invoices = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gestion des factures</h1>
        <p className="text-muted-foreground">
          Uploadez vos factures PDF ou images pour un traitement automatique
        </p>
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
