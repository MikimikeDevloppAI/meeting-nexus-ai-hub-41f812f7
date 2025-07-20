import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, Download, Eye, AlertCircle, Clock, CheckCircle, Edit, Trash2, Check, Calendar, ChevronDown } from "lucide-react";
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
  payment_date?: string;
  total_amount?: number;
  total_net?: number;
  total_tax?: number;
  currency?: string;
  exchange_rate?: number;
  original_amount_chf?: number;
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
  invoice_type?: string;
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
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [originalInvoiceData, setOriginalInvoiceData] = useState<Invoice | null>(null);

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

  // Helper function for currency conversion
  const convertCurrency = async (currency: string, amount: number, invoiceDate: string) => {
    if (currency === 'CHF') {
      return { exchange_rate: 1, original_amount_chf: amount };
    }

    try {
      const { data, error } = await supabase.functions.invoke('currency-converter', {
        body: {
          currency,
          amount,
          date: invoiceDate
        }
      });

      if (error) {
        console.warn('Currency conversion failed:', error);
        return { exchange_rate: null, original_amount_chf: null };
      }

      return {
        exchange_rate: data.exchange_rate,
        original_amount_chf: data.converted_amount
      };
    } catch (error) {
      console.warn('Currency conversion error:', error);
      return { exchange_rate: null, original_amount_chf: null };
    }
  };

  // Fonction pour valider les champs obligatoires
  const validateRequiredFields = (invoice: Invoice): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Vérifier le nom du fournisseur
    if (!invoice.supplier_name || invoice.supplier_name.trim() === '') {
      errors.push('Le nom du fournisseur est obligatoire');
    }

    // Vérifier la date de paiement
    if (!invoice.payment_date || invoice.payment_date === '') {
      errors.push('La date de paiement est obligatoire');
    }

    // Vérifier la devise
    if (!invoice.currency || invoice.currency.trim() === '') {
      errors.push('La devise est obligatoire');
    }

    // Vérifier le montant total (doit être différent de 0 et non null)
    if (!invoice.total_amount || invoice.total_amount === 0) {
      errors.push('Le montant total ne peut pas être égal à 0');
    }

    // Vérifier le compte
    if (!invoice.compte || invoice.compte === '') {
      errors.push('Le compte est obligatoire');
    }

    // Vérifier la catégorie
    if (!invoice.invoice_type || invoice.invoice_type.trim() === '' || invoice.invoice_type === 'non assigné') {
      errors.push('La catégorie doit être assignée');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleQuickValidate = async (invoice: Invoice) => {
    // Vérifier les champs obligatoires
    const validation = validateRequiredFields(invoice);
    
    if (!validation.isValid) {
      toast.error('Validation impossible : ' + validation.errors.join(', '));
      return;
    }

    try {
      // Convert currency ONLY if no valid exchange rate exists
      let updateData: any = { 
        status: 'validated',
        processed_at: new Date().toISOString()
      };

      // Only call API if exchange_rate is null or 0 AND currency is not CHF
      if (invoice.currency !== 'CHF' && (!invoice.exchange_rate || invoice.exchange_rate <= 0) && invoice.total_amount) {
        console.log('Quick validate: calling currency API for', invoice.currency);
        const currencyConversion = await convertCurrency(
          invoice.currency || 'EUR', 
          invoice.total_amount, 
          invoice.invoice_date ? new Date(invoice.invoice_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        );
        
        updateData.exchange_rate = currencyConversion.exchange_rate;
        updateData.original_amount_chf = currencyConversion.original_amount_chf;
      } else {
        console.log('Quick validate: preserving existing exchange rate', invoice.exchange_rate);
        // Don't modify exchange rate if it already has a valid value
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
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

  // Séparer les factures en deux groupes: à valider et validées
  const { invoicesToValidate, validatedInvoices } = useMemo(() => {
    if (!invoices) return { invoicesToValidate: [], validatedInvoices: [] };
    
    const toValidate = invoices.filter(invoice => 
      invoice.status === 'completed' || invoice.status === 'pending' || invoice.status === 'processing' || invoice.status === 'error'
    );
    
    const validated = invoices.filter(invoice => 
      invoice.status === 'validated'
    );
    
    return { invoicesToValidate: toValidate, validatedInvoices: validated };
  }, [invoices]);

  // Organiser les factures validées par années et mois
  const organizedValidatedInvoices = useMemo(() => {
    if (!validatedInvoices.length) return {};
    
    const organized: Record<string, Record<string, Invoice[]>> = {};
    
    validatedInvoices.forEach(invoice => {
      // Utiliser la date de facture si disponible, sinon la date de création
      const dateToUse = invoice.invoice_date || invoice.created_at;
      const date = new Date(dateToUse);
      
      // Vérifier que la date est valide
      if (isNaN(date.getTime())) return;
      
      const year = date.getFullYear().toString();
      const month = date.toLocaleDateString('fr-FR', { month: 'long' });
      const monthKey = `${date.getMonth() + 1}-${month}`; // Pour le tri
      
      if (!organized[year]) {
        organized[year] = {};
      }
      
      if (!organized[year][monthKey]) {
        organized[year][monthKey] = [];
      }
      
      organized[year][monthKey].push(invoice);
    });
    
    // Trier les années et mois
    Object.keys(organized).forEach(year => {
      Object.keys(organized[year]).forEach(monthKey => {
        organized[year][monthKey].sort((a, b) => {
          const dateA = new Date(a.invoice_date || a.created_at);
          const dateB = new Date(b.invoice_date || b.created_at);
          return dateB.getTime() - dateA.getTime(); // Plus récent en premier
        });
      });
    });
    
    return organized;
  }, [validatedInvoices]);

  // Calculer les totaux par compte
  const calculateTotals = (invoicesList: Invoice[]) => {
    const communTotal = invoicesList
      .filter(inv => inv.compte === 'Commun')
      .reduce((sum, inv) => sum + (inv.original_amount_chf || 0), 0);
    
    const davidTotal = invoicesList
      .filter(inv => inv.compte === 'David Tabibian')
      .reduce((sum, inv) => sum + (inv.original_amount_chf || 0), 0);
    
    return { communTotal, davidTotal };
  };

  const formatAmount = (amount: number): string => {
    return `${Math.round(amount).toLocaleString('fr-CH')} CHF`;
  };

  // Créer un badge uniforme avec nombre de factures et totaux par compte
  const createSummaryBadge = (invoicesList: Invoice[], variant: "default" | "secondary" | "outline" = "outline") => {
    const { communTotal, davidTotal } = calculateTotals(invoicesList);
    const parts = [`${invoicesList.length} facture(s)`];
    
    if (communTotal > 0) {
      parts.push(`Commun: ${formatAmount(communTotal)}`);
    }
    if (davidTotal > 0) {
      parts.push(`David: ${formatAmount(davidTotal)}`);
    }
    
    return (
      <Badge variant={variant} className="text-xs">
        {parts.join(' | ')}
      </Badge>
    );
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

  // Fonction pour mettre à jour un champ directement
  const updateInvoiceField = async (invoiceId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ [field]: value })
        .eq('id', invoiceId);

      if (error) throw error;
      await refetch();
    } catch (error) {
      console.error('Error updating invoice field:', error);
      toast.error(`Erreur lors de la mise à jour du champ ${field}`);
    }
  };

  // Fonctions pour gérer l'édition des factures validées
  const startEditingInvoice = (invoice: Invoice) => {
    console.log('Starting edit for invoice:', invoice.id);
    console.log('Current compte value:', `"${invoice.compte}"`);
    console.log('Compte type:', typeof invoice.compte);
    console.log('Full invoice data:', invoice);
    setEditingInvoiceId(invoice.id);
    setOriginalInvoiceData(invoice);
  };

  const cancelEditingInvoice = () => {
    if (originalInvoiceData) {
      // Restaurer les données originales
      updateInvoiceField(originalInvoiceData.id, 'supplier_name', originalInvoiceData.supplier_name);
      updateInvoiceField(originalInvoiceData.id, 'payment_date', originalInvoiceData.payment_date);
      updateInvoiceField(originalInvoiceData.id, 'currency', originalInvoiceData.currency);
      updateInvoiceField(originalInvoiceData.id, 'total_amount', originalInvoiceData.total_amount);
      updateInvoiceField(originalInvoiceData.id, 'invoice_type', originalInvoiceData.invoice_type);
      updateInvoiceField(originalInvoiceData.id, 'compte', originalInvoiceData.compte);
    }
    setEditingInvoiceId(null);
    setOriginalInvoiceData(null);
  };

  const saveEditingInvoice = async () => {
    if (!editingInvoiceId) return;
    
    const currentInvoice = invoices?.find(inv => inv.id === editingInvoiceId);
    if (!currentInvoice) return;

    // Valider les champs obligatoires
    const validation = validateRequiredFields(currentInvoice);
    
    if (!validation.isValid) {
      toast.error('Validation impossible : ' + validation.errors.join(', '));
      return;
    }

    try {
      // Si la devise n'est pas CHF et qu'on n'a pas de taux de change, calculer
      if (currentInvoice.currency !== 'CHF' && (!currentInvoice.exchange_rate || currentInvoice.exchange_rate <= 0) && currentInvoice.total_amount) {
        const dateToUse = currentInvoice.payment_date || currentInvoice.invoice_date;
        const currencyConversion = await convertCurrency(
          currentInvoice.currency || 'EUR', 
          currentInvoice.total_amount, 
          dateToUse ? new Date(dateToUse).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        );
        
        if (currencyConversion.exchange_rate !== null) {
          await updateInvoiceField(currentInvoice.id, 'exchange_rate', currencyConversion.exchange_rate);
          await updateInvoiceField(currentInvoice.id, 'original_amount_chf', currencyConversion.original_amount_chf);
        }
      }

      toast.success('Facture modifiée avec succès');
      setEditingInvoiceId(null);
      setOriginalInvoiceData(null);
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  // Fonction pour afficher une facture à valider avec champs modifiables
  const renderInvoiceToValidate = (invoice: Invoice) => (
    <Card key={invoice.id} className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-base">
                {invoice.original_filename}
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
        {/* Champs modifiables directement */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-700">Fournisseur</span>
              <span className="text-red-500">*</span>
              {!invoice.supplier_name && <AlertCircle className="h-3 w-3 text-red-500" />}
            </div>
            <Input
              value={invoice.supplier_name || ''}
              onChange={(e) => updateInvoiceField(invoice.id, 'supplier_name', e.target.value)}
              placeholder="Nom du fournisseur"
              className={`h-8 ${!invoice.supplier_name ? 'border-red-300 bg-red-50' : ''}`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-700">Date de paiement</span>
              <span className="text-red-500">*</span>
              {!invoice.payment_date && <AlertCircle className="h-3 w-3 text-red-500" />}
            </div>
            <Input
              type="date"
              value={invoice.payment_date ? new Date(invoice.payment_date).toISOString().split('T')[0] : ''}
              onChange={(e) => updateInvoiceField(invoice.id, 'payment_date', e.target.value)}
              className={`h-8 ${!invoice.payment_date ? 'border-red-300 bg-red-50' : ''}`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-700">Devise</span>
              <span className="text-red-500">*</span>
              {!invoice.currency && <AlertCircle className="h-3 w-3 text-red-500" />}
            </div>
            <Select 
              value={invoice.currency || 'EUR'} 
              onValueChange={async (value) => {
                updateInvoiceField(invoice.id, 'currency', value);
                
                // Si on a un montant et une date, calculer automatiquement le taux de change
                if (invoice.total_amount && (invoice.invoice_date || invoice.payment_date)) {
                  try {
                    const dateToUse = invoice.payment_date || invoice.invoice_date;
                    const currencyConversion = await convertCurrency(
                      value, 
                      invoice.total_amount, 
                      dateToUse ? new Date(dateToUse).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                    );
                    
                    if (currencyConversion.exchange_rate !== null) {
                      updateInvoiceField(invoice.id, 'exchange_rate', currencyConversion.exchange_rate);
                      updateInvoiceField(invoice.id, 'original_amount_chf', currencyConversion.original_amount_chf);
                      toast.success(`Taux de change mis à jour: 1 ${value} = ${currencyConversion.exchange_rate?.toFixed(4)} CHF`);
                    }
                  } catch (error) {
                    console.error('Erreur lors du calcul du taux de change:', error);
                    toast.error('Erreur lors du calcul du taux de change');
                  }
                }
              }}
            >
              <SelectTrigger className={`h-8 ${!invoice.currency ? 'border-red-300 bg-red-50' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CHF">CHF</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="JPY">JPY</SelectItem>
                <SelectItem value="CNY">CNY</SelectItem>
                <SelectItem value="AUD">AUD</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="SEK">SEK</SelectItem>
                <SelectItem value="NOK">NOK</SelectItem>
                <SelectItem value="DKK">DKK</SelectItem>
                <SelectItem value="INR">INR</SelectItem>
                <SelectItem value="BRL">BRL</SelectItem>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="ZAR">ZAR</SelectItem>
                <SelectItem value="SGD">SGD</SelectItem>
                <SelectItem value="HKD">HKD</SelectItem>
                <SelectItem value="NZD">NZD</SelectItem>
                <SelectItem value="KRW">KRW</SelectItem>
                <SelectItem value="TRY">TRY</SelectItem>
                <SelectItem value="RUB">RUB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-700">Montant TTC</span>
              <span className="text-red-500">*</span>
              {(!invoice.total_amount || invoice.total_amount === 0) && <AlertCircle className="h-3 w-3 text-red-500" />}
            </div>
            <Input
               type="text"
               step="0.01"
               value={invoice.total_amount ? invoice.total_amount.toString().replace('.', ',') : ''}
               onChange={(e) => {
                 const value = e.target.value;
                 console.log('Input value:', value);
                 
                 // Permettre point et virgule, convertir point en virgule pour l'affichage français
                 let processedValue = value.replace('.', ',');
                 console.log('Processed value:', processedValue);
                 
                 // Vérifier si la valeur est valide (vide, virgule seule, ou nombre avec virgule)
                 if (processedValue === '' || processedValue === ',' || /^\d*,?\d*$/.test(processedValue)) {
                   console.log('Value is valid, processing...');
                   
                   // Pour le parsing, reconvertir en format anglais (point)
                   const valueForParsing = processedValue.replace(',', '.');
                   console.log('Value for parsing:', valueForParsing);
                   
                   let numericValue = null;
                   if (valueForParsing !== '' && valueForParsing !== '.') {
                     numericValue = parseFloat(valueForParsing);
                     console.log('Parsed numeric value:', numericValue);
                   }
                   
                   updateInvoiceField(invoice.id, 'total_amount', numericValue);
                 } else {
                   console.log('Value rejected:', processedValue);
                 }
               }}
              placeholder="0.00"
              className={`h-8 ${(!invoice.total_amount || invoice.total_amount === 0) ? 'border-red-300 bg-red-50' : ''}`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-700">Catégorie</span>
              <span className="text-red-500">*</span>
              {(!invoice.invoice_type || invoice.invoice_type === 'non assigné') && <AlertCircle className="h-3 w-3 text-red-500" />}
            </div>
            <Select 
              value={invoice.invoice_type || 'non assigné'} 
              onValueChange={(value) => updateInvoiceField(invoice.id, 'invoice_type', value)}
            >
              <SelectTrigger className={`h-8 ${(!invoice.invoice_type || invoice.invoice_type === 'non assigné') ? 'border-red-300 bg-red-50' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="équipement médicaux">Équipement médicaux</SelectItem>
                <SelectItem value="fourniture médicales">Fourniture médicales</SelectItem>
                <SelectItem value="fourniture injections intra-vitréennes">Fourniture injections intra-vitréennes</SelectItem>
                <SelectItem value="fourniture de bureau">Fourniture de bureau</SelectItem>
                <SelectItem value="informatique/logiciel">Informatique/logiciel</SelectItem>
                <SelectItem value="télécommunication">Télécommunication</SelectItem>
                <SelectItem value="assurance/cotisations sociales">Assurance/cotisations sociales</SelectItem>
                <SelectItem value="marketing/communication">Marketing/communication</SelectItem>
                <SelectItem value="déplacement/formation">Déplacement/formation</SelectItem>
                <SelectItem value="frais bancaires/financiers">Frais bancaires/financiers</SelectItem>
                <SelectItem value="investissement/amortissement">Investissement/amortissement</SelectItem>
                <SelectItem value="nourritures">Nourritures</SelectItem>
                <SelectItem value="non assigné">Non assigné</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-700">Compte</span>
              <span className="text-red-500">*</span>
              {!invoice.compte && <AlertCircle className="h-3 w-3 text-red-500" />}
            </div>
            <Select 
              value={invoice.compte || 'Commun'} 
              onValueChange={(value) => updateInvoiceField(invoice.id, 'compte', value)}
            >
              <SelectTrigger className={`h-8 ${!invoice.compte ? 'border-red-300 bg-red-50' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Commun">Commun</SelectItem>
                <SelectItem value="David">David</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Informations supplémentaires en lecture seule */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm pt-2 border-t">
          <div>
            <span className="font-medium text-gray-700">Compte:</span>
            <div className="text-gray-900">{invoice.compte || 'Commun'}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Montant TTC:</span>
            <div className="text-gray-900 font-semibold">
              {invoice.total_amount ? (
                <div className="space-y-1">
                  <div>
                    {invoice.total_amount.toFixed(2)} {invoice.currency || 'EUR'}
                  </div>
                  {invoice.original_amount_chf && invoice.currency !== 'CHF' && (
                    <div className="text-sm text-blue-600">
                      ≈ {invoice.original_amount_chf.toFixed(2)} CHF
                      {invoice.exchange_rate && (
                        <span className="text-xs text-gray-500 ml-1">
                          (taux: {invoice.exchange_rate.toFixed(4)})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : 'N/A'}
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
                onClick={() => handleValidateInvoice(invoice)}
                className="flex items-center gap-1"
              >
                <Edit className="h-4 w-4" />
                Modifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickValidate(invoice)}
                className="flex items-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Check className="h-4 w-4" />
                Valider
              </Button>
            </>
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
  );

  // Fonction pour afficher une facture validée (lecture seule ou éditable)
  const renderValidatedInvoice = (invoice: Invoice) => {
    const isEditing = editingInvoiceId === invoice.id;
    
    return (
      <Card key={invoice.id} className="mb-4">
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
          {/* Informations modifiables ou en lecture seule selon l'état */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Fournisseur:</span>
              {isEditing ? (
                <Input
                  value={invoice.supplier_name || ''}
                  onChange={(e) => updateInvoiceField(invoice.id, 'supplier_name', e.target.value)}
                  placeholder="Nom du fournisseur"
                  className="h-8 mt-1"
                />
              ) : (
                <div className="text-gray-900 mt-1 p-2 bg-gray-50 rounded border">
                  {invoice.supplier_name || 'N/A'}
                </div>
              )}
            </div>

            <div>
              <span className="font-medium text-gray-700">Date de paiement:</span>
              {isEditing ? (
                <Input
                  type="date"
                  value={invoice.payment_date ? new Date(invoice.payment_date).toISOString().split('T')[0] : ''}
                  onChange={(e) => updateInvoiceField(invoice.id, 'payment_date', e.target.value)}
                  className="h-8 mt-1"
                />
              ) : (
                <div className="text-gray-900 mt-1 p-2 bg-gray-50 rounded border">
                  {invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString('fr-FR') : 'N/A'}
                </div>
              )}
            </div>

            <div>
              <span className="font-medium text-gray-700">Devise:</span>
              {isEditing ? (
                <Select 
                  value={invoice.currency || 'EUR'} 
                  onValueChange={async (value) => {
                    updateInvoiceField(invoice.id, 'currency', value);
                    
                    // Si on a un montant et une date, calculer automatiquement le taux de change
                    if (invoice.total_amount && (invoice.invoice_date || invoice.payment_date)) {
                      try {
                        const dateToUse = invoice.payment_date || invoice.invoice_date;
                        const currencyConversion = await convertCurrency(
                          value, 
                          invoice.total_amount, 
                          dateToUse ? new Date(dateToUse).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                        );
                        
                        if (currencyConversion.exchange_rate !== null) {
                          updateInvoiceField(invoice.id, 'exchange_rate', currencyConversion.exchange_rate);
                          updateInvoiceField(invoice.id, 'original_amount_chf', currencyConversion.original_amount_chf);
                          toast.success(`Taux de change mis à jour: 1 ${value} = ${currencyConversion.exchange_rate?.toFixed(4)} CHF`);
                        }
                      } catch (error) {
                        console.error('Erreur lors du calcul du taux de change:', error);
                        toast.error('Erreur lors du calcul du taux de change');
                      }
                    }
                  }}
                >
                  <SelectTrigger className="h-8 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="SEK">SEK</SelectItem>
                    <SelectItem value="NOK">NOK</SelectItem>
                    <SelectItem value="DKK">DKK</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="BRL">BRL</SelectItem>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="ZAR">ZAR</SelectItem>
                    <SelectItem value="SGD">SGD</SelectItem>
                    <SelectItem value="HKD">HKD</SelectItem>
                    <SelectItem value="NZD">NZD</SelectItem>
                    <SelectItem value="KRW">KRW</SelectItem>
                    <SelectItem value="TRY">TRY</SelectItem>
                    <SelectItem value="RUB">RUB</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-gray-900 mt-1 p-2 bg-gray-50 rounded border">
                  {invoice.currency || 'EUR'}
                </div>
              )}
            </div>

            <div>
              <span className="font-medium text-gray-700">Montant TTC:</span>
              {isEditing ? (
                <Input
                  type="text"
                  value={invoice.total_amount ? invoice.total_amount.toString().replace('.', ',') : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    let processedValue = value.replace('.', ',');
                    
                    if (processedValue === '' || processedValue === ',' || /^\d*,?\d*$/.test(processedValue)) {
                      const valueForParsing = processedValue.replace(',', '.');
                      let numericValue = null;
                      if (valueForParsing !== '' && valueForParsing !== '.') {
                        numericValue = parseFloat(valueForParsing);
                      }
                      updateInvoiceField(invoice.id, 'total_amount', numericValue);
                    }
                  }}
                  placeholder="0.00"
                  className="h-8 mt-1"
                />
              ) : (
                <div className="text-gray-900 mt-1 p-2 bg-gray-50 rounded border font-semibold">
                  {invoice.total_amount ? (
                    <div className="space-y-1">
                      <div>
                        {invoice.total_amount.toFixed(2)} {invoice.currency || 'EUR'}
                      </div>
                      {invoice.original_amount_chf && invoice.currency !== 'CHF' && (
                        <div className="text-sm text-blue-600">
                          ≈ {invoice.original_amount_chf.toFixed(2)} CHF
                          {invoice.exchange_rate && (
                            <span className="text-xs text-gray-500 ml-1">
                              (taux: {invoice.exchange_rate.toFixed(4)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : 'N/A'}
                </div>
              )}
            </div>

            <div>
              <span className="font-medium text-gray-700">Catégorie:</span>
              {isEditing ? (
                <Select 
                  value={invoice.invoice_type || 'non assigné'} 
                  onValueChange={(value) => updateInvoiceField(invoice.id, 'invoice_type', value)}
                >
                  <SelectTrigger className="h-8 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="équipement médicaux">Équipement médicaux</SelectItem>
                    <SelectItem value="fourniture médicales">Fourniture médicales</SelectItem>
                    <SelectItem value="fourniture injections intra-vitréennes">Fourniture injections intra-vitréennes</SelectItem>
                    <SelectItem value="fourniture de bureau">Fourniture de bureau</SelectItem>
                    <SelectItem value="informatique/logiciel">Informatique/logiciel</SelectItem>
                    <SelectItem value="télécommunication">Télécommunication</SelectItem>
                    <SelectItem value="assurance/cotisations sociales">Assurance/cotisations sociales</SelectItem>
                    <SelectItem value="marketing/communication">Marketing/communication</SelectItem>
                    <SelectItem value="déplacement/formation">Déplacement/formation</SelectItem>
                    <SelectItem value="frais bancaires/financiers">Frais bancaires/financiers</SelectItem>
                    <SelectItem value="investissement/amortissement">Investissement/amortissement</SelectItem>
                    <SelectItem value="nourritures">Nourritures</SelectItem>
                    <SelectItem value="non assigné">Non assigné</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-gray-900 mt-1 p-2 bg-gray-50 rounded border">
                  {invoice.invoice_type || 'Non assigné'}
                </div>
              )}
            </div>

            <div>
              <span className="font-medium text-gray-700">Compte:</span>
              {isEditing ? (
                <Select 
                  value={invoice.compte || 'Commun'} 
                  onValueChange={(value) => {
                    console.log('Changing compte from', invoice.compte, 'to', value);
                    updateInvoiceField(invoice.id, 'compte', value);
                  }}
                >
                  <SelectTrigger className="h-8 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Commun">Commun</SelectItem>
                    <SelectItem value="David Tabibian">David Tabibian</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-gray-900 mt-1 p-2 bg-gray-50 rounded border">
                  {invoice.compte || 'Commun'}
                </div>
              )}
            </div>
          </div>

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
            
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveEditingInvoice}
                  className="flex items-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <Check className="h-4 w-4" />
                  Valider
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEditingInvoice}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Annuler
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEditingInvoice(invoice)}
                  className="flex items-center gap-1"
                >
                  <Edit className="h-4 w-4" />
                  Modifier
                </Button>
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
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Section: Factures à valider */}
        {invoicesToValidate.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-orange-600">À valider</h2>
              {createSummaryBadge(invoicesToValidate, "outline")}
            </div>
            
            <div className="space-y-4">
              {invoicesToValidate.map((invoice) => renderInvoiceToValidate(invoice))}
            </div>
          </div>
        )}

        {/* Section: Factures validées avec organisation par date */}
        {validatedInvoices.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Factures validées</h2>
              {createSummaryBadge(validatedInvoices, "outline")}
            </div>
            
            <Accordion type="multiple" className="w-full space-y-4">
              {Object.keys(organizedValidatedInvoices)
                .sort((a, b) => parseInt(b) - parseInt(a)) // Années décroissantes
                .map((year) => (
                  <AccordionItem key={year} value={year} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span className="text-lg font-semibold">{year}</span>
                        {createSummaryBadge(Object.values(organizedValidatedInvoices[year]).flat(), "secondary")}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <Accordion type="multiple" className="w-full space-y-2">
                        {Object.keys(organizedValidatedInvoices[year])
                          .sort((a, b) => parseInt(b.split('-')[0]) - parseInt(a.split('-')[0])) // Mois décroissants
                          .map((monthKey) => {
                            const month = monthKey.split('-')[1];
                            const invoicesList = organizedValidatedInvoices[year][monthKey];
                            return (
                              <AccordionItem key={`${year}-${monthKey}`} value={`${year}-${monthKey}`} className="border rounded-md">
                                <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <ChevronDown className="h-4 w-4" />
                                    <span className="font-medium capitalize">{month}</span>
                                    {createSummaryBadge(invoicesList, "outline")}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-3 pb-3">
                                  <div className="space-y-4">
                                    {invoicesList.map((invoice) => renderValidatedInvoice(invoice))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </div>
        )}
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
