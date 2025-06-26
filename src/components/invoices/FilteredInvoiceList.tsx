
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Edit, Trash2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

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

interface FilteredInvoiceListProps {
  invoices: Invoice[];
  onValidateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoice: Invoice) => void;
  onDownloadFile: (filePath: string, filename: string) => void;
  deletingInvoiceId: string | null;
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
      .replace(/Ã»/g, 'û');
    
    return decoded || supplierName;
  } catch (error) {
    console.error('Error decoding supplier name:', error, 'Original:', supplierName);
    return supplierName;
  }
};

export function FilteredInvoiceList({ 
  invoices, 
  onValidateInvoice, 
  onDeleteInvoice, 
  onDownloadFile,
  deletingInvoiceId 
}: FilteredInvoiceListProps) {
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

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Aucune facture trouvée pour cette période</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Factures de la période ({invoices.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium">
                      {formatSupplierName(invoice.supplier_name)}
                    </div>
                    <div className="text-sm text-gray-500">
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

              {/* Informations essentielles */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
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
                  <span className="font-medium text-gray-700">Montant HT:</span>
                  <div className="text-gray-900">
                    {invoice.total_net ? 
                      `${invoice.total_net.toFixed(2)} ${invoice.currency || 'EUR'}` : 
                      'N/A'
                    }
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

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t">
                {invoice.file_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownloadFile(invoice.file_path, invoice.original_filename)}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger
                  </Button>
                )}
                
                {(invoice.status === 'completed' || invoice.status === 'validated') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onValidateInvoice(invoice)}
                    className="flex items-center gap-1"
                  >
                    <Edit className="h-4 w-4" />
                    {invoice.status === 'validated' ? 'Modifier' : 'Valider'}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteInvoice(invoice)}
                  disabled={deletingInvoiceId === invoice.id}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingInvoiceId === invoice.id ? 'Suppression...' : 'Supprimer'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
