
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { createInvoiceZip } from "@/utils/invoiceZipExport";
import { toast } from "sonner";

interface InvoiceExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InvoiceExportDialog = ({ open, onOpenChange }: InvoiceExportDialogProps) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error("Veuillez sélectionner une période complète");
      return;
    }

    if (endDate < startDate) {
      toast.error("La date de fin doit être postérieure à la date de début");
      return;
    }

    setIsExporting(true);
    
    try {
      // Filtrer les factures par période
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .gte('invoice_date', startDate.toISOString())
        .lte('invoice_date', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!invoices || invoices.length === 0) {
        toast.error("Aucune facture trouvée pour cette période");
        return;
      }

      // Créer le fichier ZIP avec CSV et fichiers
      const filename = `factures_${format(startDate, 'yyyy-MM-dd', { locale: fr })}_au_${format(endDate, 'yyyy-MM-dd', { locale: fr })}.zip`;
      
      await createInvoiceZip(invoices, filename);
      
      toast.success(`${invoices.length} factures exportées avec leurs fichiers`);
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error exporting invoices:', error);
      toast.error("Erreur lors de l'export des factures");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exporter les factures</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date de début</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date de fin</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleExport}
              disabled={isExporting || !startDate || !endDate}
              className="flex items-center gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isExporting ? 'Export en cours...' : 'Exporter'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
