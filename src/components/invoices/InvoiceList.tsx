import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, AlertCircle, Clock, CheckCircle, Edit, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { InvoiceValidationDialog } from "./InvoiceValidationDialog";
import { toast } from "sonner";

interface Invoice {
  id: string;
  original_filename: string;
  file_path: string;
  status: string;
  david_percentage: number;
  cabinet_percentage: number;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  total_amount?: number;
  total_net?: number;
  total_tax?: number;
  currency?: string;
  supplier_name?: string;
  supplier_address?: string;
  supplier_email?: string;
  supplier_phone_number?: string;
  supplier_iban?: string;
  customer_name?: string;
  customer_address?: string;
  payment_details?: string;
  line_items?: any;
  created_at: string;
  processed_at?: string;
  error_message?: string;
}

interface InvoiceListProps {
  refreshKey: number;
}

export function InvoiceList({ refreshKey }: InvoiceListProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['invoices', refreshKey],
    queryFn: async () => {
      console.log('Fetching invoices...');
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invoices:', error);
        throw error;
      }
      
      console.log('Invoices fetched:', data);
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
        return <Badge variant="default" className="bg-blue-500 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          À valider
        </Badge>;
      case 'validated':
        return <Badge variant="default" className="bg-green-500 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Validé
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

  const deleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la facture "${invoice.original_filename}" ?`)) {
      return;
    }

    setDeletingInvoiceId(invoice.id);
    
    try {
      // Supprimer l'enregistrement de la base de données
      const { error: dbError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (dbError) {
        throw dbError;
      }

      // Supprimer le fichier du storage (ne pas arrêter si cela échoue)
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

  const handleValidateInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setValidationDialogOpen(true);
  };

  const handleValidationComplete = () => {
    refetch();
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
    <>
      <div className="space-y-4">
        {invoices?.map((invoice) => (
          <Card key={invoice.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <CardTitle className="text-base">{invoice.original_filename}</CardTitle>
                    <div className="text-sm text-gray-500 mt-1">
                      Créé {formatDistanceToNow(new Date(invoice.created_at), { 
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
              {/* Informations essentielles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Fournisseur:</span>
                  <span className="ml-2">{invoice.supplier_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium">Date facture:</span>
                  <span className="ml-2">
                    {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('fr-FR') : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Montant HT:</span>
                  <span className="ml-2">
                    {invoice.total_net ? 
                      `${invoice.total_net.toFixed(2)} ${invoice.currency || 'EUR'}` : 
                      'N/A'
                    }
                  </span>
                </div>
                <div>
                  <span className="font-medium">Montant TTC:</span>
                  <span className="ml-2">
                    {invoice.total_amount ? 
                      `${invoice.total_amount.toFixed(2)} ${invoice.currency || 'EUR'}` : 
                      'N/A'
                    }
                  </span>
                </div>
              </div>

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
                {invoice.file_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(invoice.file_path, invoice.original_filename)}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger
                  </Button>
                )}
                
                {invoice.status === 'completed' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleValidateInvoice(invoice)}
                    className="flex items-center gap-1"
                  >
                    <Edit className="h-4 w-4" />
                    Valider/Modifier
                  </Button>
                )}
                
                {invoice.status === 'validated' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleValidateInvoice(invoice)}
                    className="flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    Voir/Modifier
                  </Button>
                )}
                
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

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteInvoice(invoice)}
                  disabled={deletingInvoiceId === invoice.id}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingInvoiceId === invoice.id ? 'Suppression...' : 'Supprimer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
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
