
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/utils/csvExport";
import { toast } from "sonner";

export const InvoiceExportButton = () => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!invoices || invoices.length === 0) {
        toast.error("Aucune facture à exporter");
        return;
      }

      // Format the filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `invoices_export_${currentDate}.csv`;
      
      exportToCSV(invoices, filename);
      
      toast.success(`${invoices.length} factures exportées en CSV`);
    } catch (error) {
      console.error('Error exporting invoices:', error);
      toast.error("Erreur lors de l'export des factures");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      variant="outline"
      className="flex items-center gap-2"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isExporting ? 'Export en cours...' : 'Exporter en CSV'}
    </Button>
  );
};
