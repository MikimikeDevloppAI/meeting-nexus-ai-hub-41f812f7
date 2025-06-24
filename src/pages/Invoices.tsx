
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form */}
        <div className="lg:col-span-1">
          <InvoiceUploadForm onUploadSuccess={handleUploadSuccess} />
        </div>

        {/* Invoice List */}
        <div className="lg:col-span-2">
          <InvoiceList refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
};

export default Invoices;
