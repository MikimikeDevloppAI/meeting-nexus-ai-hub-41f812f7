import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, AlertCircle, Clock, CheckCircle, Edit, Trash2, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { InvoiceValidationDialog } from "./InvoiceValidationDialog";
import { toast } from "sonner";

interface Invoice {
  id: string;
  original_filename: string;
  file_path: string;
  status: string;
  compte: string;
  purchase_category?: string;
  purchase_subcategory?: string;
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

// Helper function to properly decode and display supplier names
const formatSupplierName = (supplierName?: string): string => {
  if (!supplierName) return 'N/A';
  
  try {
    let decoded = supplierName;
    
    // First handle common UTF-8 encoding issues
    decoded = decoded
      .replace(/Ã©/g, 'é')
      .replace(/Ã¨/g, 'è')
      .replace(/Ã /g, 'à')
      .replace(/Ã§/g, 'ç')
      .replace(/Ã´/g, 'ô')
      .replace(/Ã¢/g, 'â')
      .replace(/Ã¯/g, 'ï')
      .replace(/Ã«/g, 'ë')
      .replace(/Ã¹/g, 'ù')
      .replace(/Ã»/g, 'û')
      .replace(/Ã\u00AD/g, 'í')
      .replace(/Ã\u00A9/g, 'é')
      .replace(/Ã\u00A8/g, 'è')
      .replace(/Ã\u00A0/g, 'à');
    
    // Handle question marks that should be é
    if (decoded.includes('?') && supplierName.includes('é')) {
      decoded = decoded.replace(/\?/g, 'é');
    }
    
    // Try HTML entity decoding
    const textarea = document.createElement('textarea');
    textarea.innerHTML = decoded;
    const htmlDecoded = textarea.value;
    
    // If HTML decoding changed something, use it
    if (htmlDecoded !== decoded) {
      decoded = htmlDecoded;
    }
    
    // Try URL decoding if there are % signs
    if (decoded.includes('%')) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch (e) {
        // If URL decoding fails, keep the current value
        console.warn('URL decoding failed for:', decoded);
      }
    }
    
    return decoded || supplierName;
  } catch (error) {
    console.error('Error decoding supplier name:', error, 'Original:', supplierName);
    return supplierName;
  }
};

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

  const getCompteBadge = (compte: string) => {
    if (compte === 'David Tabibian') {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        David Tabibian
      </Badge>;
    } else if (compte === 'Commun') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        Commun
      </Badge>;
    }
    return <Badge variant="outline">{compte}</Badge>;
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

  const handleQuickValidate = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'validated',
          processed_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (error) throw error;

      toast.success(`Facture "${invoice.original_filename}" validée avec succès`);
      await refetch();
    } catch (error) {
      console.error('Error validating invoice:', error);
      toast.error('Erreur lors de la validation de la facture');
    }
  };

  const viewFile = async (filePath: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('invoices')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
      
      // Clean up the URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Error viewing file:', error);
      toast.error('Impossible d\'ouvrir le fichier');
    }
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
                    <CardTitle className="text-base">
                      {formatSupplierName(invoice.supplier_name)}
                    </CardTitle>
                    <div className="text-sm text-gray-500 mt-1">
                      Créé {formatDistanceToNow(new Date(invoice.created_at), { 
                        addSuffix: true, 
                        locale: fr 
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(invoice.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Informations essentielles en format texte - SANS le montant HT */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Compte:</span>
                  <div className="text-gray-900">{invoice.compte || 'Commun'}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Date facture:</span>
                  <div className="text-gray-900">
                    {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('fr-FR') : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Montant TTC:</span>
                  <div className="text-gray-900 font-semibold">
                    {invoice.total_amount ? 
                      `${invoice.total_amount.toFixed(2)} ${invoice.currency || 'EUR'}` : 
                      'N/A'
                    }
                  </div>
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
                    onClick={() => viewFile(invoice.file_path, invoice.original_filename)}
                    className="flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    Visualiser
                  </Button>
                )}
                
                {invoice.status === 'completed' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickValidate(invoice)}
                      className="flex items-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4" />
                      Valider
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleValidateInvoice(invoice)}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      Modifier
                    </Button>
                  </>
                )}
                
                {invoice.status === 'validated' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleValidateInvoice(invoice)}
                    className="flex items-center gap-1"
                  >
                    <Edit className="h-4 w-4" />
                    Modifier
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
