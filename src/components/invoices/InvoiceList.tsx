
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Invoice {
  id: string;
  original_filename: string;
  file_path: string;
  status: string;
  david_percentage: number;
  cabinet_percentage: number;
  invoice_number?: string;
  invoice_date?: string;
  total_amount?: number;
  currency?: string;
  supplier_name?: string;
  created_at: string;
  processed_at?: string;
  error_message?: string;
}

interface InvoiceListProps {
  refreshKey: number;
}

export function InvoiceList({ refreshKey }: InvoiceListProps) {
  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['invoices', refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          En attente
        </Badge>;
      case 'processing':
        return <Badge variant="default" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Traitement
        </Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Terminé
        </Badge>;
      case 'error':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Erreur
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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

  if (isLoading) {
    return <div className="text-center py-8">Chargement des factures...</div>;
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Aucune facture trouvée</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {invoices.map((invoice) => (
        <Card key={invoice.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle className="text-base">{invoice.original_filename}</CardTitle>
                  <div className="text-sm text-gray-500 mt-1">
                    Uploadé {formatDistanceToNow(new Date(invoice.created_at), { 
                      addSuffix: true, 
                      locale: fr 
                    })}
                  </div>
                </div>
              </div>
              {getStatusBadge(invoice.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Allocation */}
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium">Répartition:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                David: {invoice.david_percentage}%
              </span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                Cabinet: {invoice.cabinet_percentage}%
              </span>
            </div>

            {/* Extracted Data */}
            {invoice.status === 'completed' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-t pt-4">
                <div>
                  <span className="font-medium">N° Facture:</span>
                  <span className="ml-2">{invoice.invoice_number || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium">Date:</span>
                  <span className="ml-2">
                    {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('fr-FR') : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Fournisseur:</span>
                  <span className="ml-2">{invoice.supplier_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium">Montant:</span>
                  <span className="ml-2">
                    {invoice.total_amount ? 
                      `${invoice.total_amount.toFixed(2)} ${invoice.currency || 'EUR'}` : 
                      'N/A'
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {invoice.status === 'error' && invoice.error_message && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Erreur de traitement</span>
                </div>
                <p>{invoice.error_message}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadFile(invoice.file_path, invoice.original_filename)}
                className="flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                Télécharger
              </Button>
              {invoice.status === 'error' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Retry processing
                    supabase.functions.invoke('process-invoice', {
                      body: { invoiceId: invoice.id }
                    }).then(() => {
                      refetch();
                    });
                  }}
                >
                  Réessayer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
