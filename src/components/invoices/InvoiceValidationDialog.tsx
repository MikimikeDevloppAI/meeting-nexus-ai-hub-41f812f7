
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Building, User, FileText, CreditCard, Tag, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface Invoice {
  id: string;
  original_filename: string;
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
  supplier_website?: string;
  supplier_company_registration?: string;
  supplier_vat_number?: string;
  customer_name?: string;
  customer_address?: string;
  customer_company_registration?: string;
  customer_vat_number?: string;
  payment_details?: string;
  line_items?: any;
  invoice_type?: string;
}

interface InvoiceValidationDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidated: () => void;
}

// Helper function to convert ISO date to yyyy-MM-dd format
const formatDateForInput = (isoDate?: string): string => {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

// Utility functions for currency calculations
const calculateOriginalAmountChf = (amount: number, rate: number): number => {
  return amount * rate;
};

const shouldCallCurrencyAPI = (currentCurrency: string, newCurrency: string, currentRate: number | null): boolean => {
  console.log('shouldCallCurrencyAPI check:', { currentCurrency, newCurrency, currentRate });
  
  if (newCurrency === 'CHF') return false;
  
  // Call API if currency changed to non-CHF or if no rate is set
  const shouldCall = (currentCurrency !== newCurrency) || (currentRate === null || currentRate === 1);
  console.log('shouldCallCurrencyAPI result:', shouldCall);
  return shouldCall;
};

const getExchangeRateForCurrency = (currency: string, currentRate: number | null): number | null => {
  if (currency === 'CHF') return 1;
  return currentRate;
};

export function InvoiceValidationDialog({ 
  invoice, 
  open, 
  onOpenChange, 
  onValidated 
}: InvoiceValidationDialogProps) {
  const [formData, setFormData] = useState<Partial<Invoice>>({});
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Function to recalculate amounts when needed
  const recalculateAmounts = (data: Partial<Invoice>) => {
    console.log('recalculateAmounts called with:', { currency: data.currency, rate: data.exchange_rate, amount: data.total_amount });
    
    if (data.currency === 'CHF') {
      return {
        ...data,
        exchange_rate: 1,
        original_amount_chf: data.total_amount || 0
      };
    }
    
    if (typeof data.exchange_rate === 'number' && data.exchange_rate > 0 && data.total_amount) {
      const newChfAmount = calculateOriginalAmountChf(data.total_amount, data.exchange_rate);
      console.log('Calculated CHF amount:', newChfAmount);
      
      return {
        ...data,
        original_amount_chf: newChfAmount
      };
    }
    
    return data;
  };

  useEffect(() => {
    if (invoice) {
      setFormData({
        invoice_number: invoice.invoice_number || null,
        invoice_date: formatDateForInput(invoice.invoice_date),
        due_date: formatDateForInput(invoice.due_date),
        payment_date: formatDateForInput(invoice.payment_date || invoice.invoice_date),
        total_amount: invoice.total_amount || 0,
        total_net: invoice.total_net || 0,
        total_tax: invoice.total_tax || 0,
        currency: invoice.currency || 'EUR',
        exchange_rate: invoice.exchange_rate || 1,
        original_amount_chf: invoice.original_amount_chf || 0,
        compte: invoice.compte || 'Commun',
        purchase_category: invoice.purchase_category || null,
        purchase_subcategory: invoice.purchase_subcategory || null,
        supplier_name: invoice.supplier_name || null,
        supplier_address: invoice.supplier_address || null,
        supplier_email: invoice.supplier_email || null,
        supplier_phone_number: invoice.supplier_phone_number || null,
        supplier_iban: invoice.supplier_iban || null,
        supplier_website: invoice.supplier_website || null,
        supplier_company_registration: invoice.supplier_company_registration || null,
        supplier_vat_number: invoice.supplier_vat_number || null,
        customer_name: invoice.customer_name || null,
        customer_address: invoice.customer_address || null,
        customer_company_registration: invoice.customer_company_registration || null,
        customer_vat_number: invoice.customer_vat_number || null,
        payment_details: invoice.payment_details || null,
        invoice_type: invoice.invoice_type || 'non assigné',
      });
    }
  }, [invoice]);

  const handleInputChange = (field: string, value: any) => {
    console.log('handleInputChange called:', { field, value, currentCurrency: formData.currency });
    
    setFormData(prev => {
      let processedValue = value;
      
      // Convertir les chaînes vides en null pour tous les champs texte
      if (typeof value === 'string' && value.trim() === '') {
        processedValue = null;
      }
      
      // Traitement spécial pour le taux de change : accepter les virgules
      if (field === 'exchange_rate') {
        if (typeof value === 'string') {
          const normalizedValue = value.replace(',', '.');
          if (normalizedValue === '' || normalizedValue === '.' || normalizedValue === '0.' || normalizedValue === '0') {
            processedValue = normalizedValue;
          } else {
            const parsedValue = parseFloat(normalizedValue);
            processedValue = !isNaN(parsedValue) ? parsedValue : value;
          }
        }
      }
      
      let newData = { ...prev, [field]: processedValue };
      
      // Gestion spéciale pour le changement de devise
      if (field === 'currency') {
        console.log('Currency change detected:', { from: prev.currency, to: value });
        
        if (value === 'CHF') {
          // Si on passe à CHF, forcer le taux à 1
          newData.exchange_rate = 1;
          console.log('Set exchange rate to 1 for CHF');
        } else if (value !== prev.currency) {
          // Si on change vers une autre devise, marquer pour appel API
          newData.exchange_rate = null;
          console.log('Set exchange rate to null for API call');
        }
      }
      
      // Recalculer les montants uniquement si nécessaire
      if (field === 'total_amount' || field === 'exchange_rate') {
        newData = recalculateAmounts(newData);
      }
      
      console.log('handleInputChange result:', { newData: newData });
      return newData;
    });
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const validateRequiredFields = (): boolean => {
    const errors: string[] = [];

    // Vérifier le nom du fournisseur
    if (!formData.supplier_name || (typeof formData.supplier_name === 'string' && formData.supplier_name.trim() === '')) {
      errors.push('Le nom du fournisseur est obligatoire');
    }

    // Vérifier la date de paiement
    if (!formData.payment_date || formData.payment_date === '') {
      errors.push('La date de paiement est obligatoire');
    }

    // Vérifier la devise
    if (!formData.currency || formData.currency.trim() === '') {
      errors.push('La devise est obligatoire');
    }

    // Vérifier le montant total (doit être différent de 0 et non null)
    if (!formData.total_amount || formData.total_amount === 0) {
      errors.push('Le montant total ne peut pas être égal à 0');
    }

    // Vérifier le compte
    if (!formData.compte || formData.compte === '') {
      errors.push('Le compte est obligatoire');
    }

    // Vérifier la catégorie
    if (!formData.invoice_type || formData.invoice_type.trim() === '' || formData.invoice_type === 'non assigné') {
      errors.push('La catégorie doit être assignée');
    }

    setValidationErrors(errors);
    return errors.length === 0;
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

  const handleSave = async () => {
    if (!validateRequiredFields()) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSaving(true);
    try {
      console.log('handleSave started with formData:', formData);
      
      let finalExchangeRate = formData.exchange_rate;
      let finalOriginalAmountChf = formData.original_amount_chf || 0;

      // Si l'utilisateur a saisi manuellement un taux, le respecter
      if (typeof formData.exchange_rate === 'number' && formData.exchange_rate > 0) {
        console.log('=== Using manually set exchange rate ===');
        console.log('Manual rate:', formData.exchange_rate);
        finalExchangeRate = formData.exchange_rate;
      } else {
        // Sinon, utiliser la logique d'API pour les nouveaux cas
        const needsAPICall = shouldCallCurrencyAPI(
          invoice.currency || 'EUR', 
          formData.currency || 'EUR', 
          formData.exchange_rate
        );

        if (needsAPICall && formData.currency !== 'CHF') {
          console.log('=== Calling currency API ===');
          console.log('Currency:', formData.currency);
          console.log('Amount:', formData.total_amount);
          console.log('Date:', formData.invoice_date);
          
          const currencyConversion = await convertCurrency(
            formData.currency || 'EUR', 
            formData.total_amount || 0, 
            formData.invoice_date || new Date().toISOString().split('T')[0]
          );
          
          if (currencyConversion.exchange_rate) {
            finalExchangeRate = currencyConversion.exchange_rate;
            console.log('=== API SUCCESS ===');
            console.log('New exchange rate from API:', finalExchangeRate);
          } else {
            console.warn('=== API FAILED ===');
            console.warn('API did not return a valid exchange rate');
            finalExchangeRate = 1; // Fallback
          }
        } else {
          console.log('=== Using default/CHF rate ===');
          finalExchangeRate = formData.currency === 'CHF' ? 1 : (formData.exchange_rate || 1);
        }
      }

      // Calculer le montant CHF final
      finalOriginalAmountChf = calculateOriginalAmountChf(formData.total_amount || 0, finalExchangeRate);
      
      console.log('=== Final values before save ===');
      console.log('Final exchange rate:', finalExchangeRate);
      console.log('Final CHF amount:', finalOriginalAmountChf);

      const updateData = {
        ...formData,
        exchange_rate: finalExchangeRate,
        original_amount_chf: finalOriginalAmountChf,
        status: 'validated',
        processed_at: new Date().toISOString(),
        invoice_date: formData.invoice_date === '' ? null : formData.invoice_date,
        due_date: formData.due_date === '' ? null : formData.due_date,
        // Convertir les chaînes vides en null pour tous les champs optionnels
        invoice_number: formData.invoice_number === '' ? null : formData.invoice_number,
        purchase_category: formData.purchase_category === '' ? null : formData.purchase_category,
        purchase_subcategory: formData.purchase_subcategory === '' ? null : formData.purchase_subcategory,
        supplier_address: formData.supplier_address === '' ? null : formData.supplier_address,
        supplier_email: formData.supplier_email === '' ? null : formData.supplier_email,
        supplier_phone_number: formData.supplier_phone_number === '' ? null : formData.supplier_phone_number,
        supplier_iban: formData.supplier_iban === '' ? null : formData.supplier_iban,
        supplier_website: formData.supplier_website === '' ? null : formData.supplier_website,
        supplier_company_registration: formData.supplier_company_registration === '' ? null : formData.supplier_company_registration,
        supplier_vat_number: formData.supplier_vat_number === '' ? null : formData.supplier_vat_number,
        customer_name: formData.customer_name === '' ? null : formData.customer_name,
        customer_address: formData.customer_address === '' ? null : formData.customer_address,
        customer_company_registration: formData.customer_company_registration === '' ? null : formData.customer_company_registration,
        customer_vat_number: formData.customer_vat_number === '' ? null : formData.customer_vat_number,
        payment_details: formData.payment_details === '' ? null : formData.payment_details,
      };

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id);

      if (error) throw error;

      toast.success('Facture validée avec succès');
      onValidated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error validating invoice:', error);
      toast.error('Erreur lors de la validation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Validation de la facture - {invoice.original_filename}
          </DialogTitle>
          
          {/* Informations principales affichées en haut */}
          <div className="flex flex-wrap gap-2 mt-2">
            {invoice.supplier_name && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Building className="h-3 w-3" />
                {invoice.supplier_name}
              </Badge>
            )}
            {invoice.purchase_category && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {invoice.purchase_category}
              </Badge>
            )}
            {invoice.total_amount && (
              <Badge variant="outline">
                {invoice.total_amount} {invoice.currency || 'EUR'}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {validationErrors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-2">Champs obligatoires manquants :</div>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Section principale avec les champs demandés */}
        <div className="space-y-4 border-b pb-6">
          <h3 className="font-semibold text-lg">Informations principales</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_name_main">
                Fournisseur <span className="text-red-500">*</span>
              </Label>
              <Input
                id="supplier_name_main"
                value={formData.supplier_name || ''}
                onChange={(e) => handleInputChange('supplier_name', e.target.value)}
                placeholder="Nom du fournisseur"
                className={validationErrors.some(e => e.includes('fournisseur')) ? 'border-red-500' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date_main">
                Date de paiement <span className="text-red-500">*</span>
              </Label>
              <Input
                id="payment_date_main"
                type="date"
                value={formData.payment_date || ''}
                onChange={(e) => handleInputChange('payment_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency_main">
                Devise <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.currency || ''} onValueChange={(value) => handleInputChange('currency', value)}>
                <SelectTrigger className={validationErrors.some(e => e.includes('devise')) ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Sélectionner une devise" />
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
              <Label htmlFor="total_net_main">Montant HT</Label>
              <Input
                id="total_net_main"
                type="number"
                step="0.01"
                value={formData.total_net || ''}
                onChange={(e) => handleInputChange('total_net', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_type_main">Catégorie</Label>
              <Select value={formData.invoice_type || 'non assigné'} onValueChange={(value) => handleInputChange('invoice_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
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
          </div>
        </div>

        <Tabs defaultValue="document" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="document" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Catégories
            </TabsTrigger>
            <TabsTrigger value="supplier" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Fournisseur
            </TabsTrigger>
            <TabsTrigger value="customer" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Client
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Paiement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="document" className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Informations du document</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="compte_doc">Compte</Label>
                <Select value={formData.compte || ''} onValueChange={(value) => handleInputChange('compte', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un compte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="David Tabibian">David Tabibian</SelectItem>
                    <SelectItem value="Commun">Commun</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier_name_doc">
                  Nom du fournisseur <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="supplier_name_doc"
                  value={formData.supplier_name || ''}
                  onChange={(e) => handleInputChange('supplier_name', e.target.value)}
                  placeholder="Nom du fournisseur"
                  className={validationErrors.some(e => e.includes('fournisseur')) ? 'border-red-500' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase_category_doc">Catégorie d'achat</Label>
                <Input
                  id="purchase_category_doc"
                  value={formData.purchase_category || ''}
                  onChange={(e) => handleInputChange('purchase_category', e.target.value)}
                  placeholder="Ex: Matériel informatique, Fournitures bureau..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_number">Numéro de facture</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number || ''}
                  onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                  placeholder="N° facture"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">
                  Devise <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.currency || ''} onValueChange={(value) => handleInputChange('currency', value)}>
                  <SelectTrigger className={validationErrors.some(e => e.includes('devise')) ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Sélectionner une devise" />
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
                <Label htmlFor="invoice_date">
                  Date facture <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date || ''}
                  onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                  className={validationErrors.some(e => e.includes('date de facture')) ? 'border-red-500' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Date d'échéance</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date || ''}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_date">
                  Date de paiement <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={formData.payment_date || ''}
                  onChange={(e) => handleInputChange('payment_date', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_net">Montant HT</Label>
                <Input
                  id="total_net"
                  type="number"
                  step="0.01"
                  value={formData.total_net || ''}
                  onChange={(e) => handleInputChange('total_net', parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_tax">TVA</Label>
                <Input
                  id="total_tax"
                  type="number"
                  step="0.01"
                  value={formData.total_tax || ''}
                  onChange={(e) => handleInputChange('total_tax', parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_amount">
                  Montant TTC <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="total_amount"
                  type="number"
                  step="0.01"
                  value={formData.total_amount || ''}
                  onChange={(e) => handleInputChange('total_amount', parseFloat(e.target.value) || 0)}
                  className={validationErrors.some(e => e.includes('montant TTC')) ? 'border-red-500' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exchange_rate">Taux de change</Label>
                <Input
                  id="exchange_rate"
                  type="text"
                  value={formData.exchange_rate || ''}
                  onChange={(e) => handleInputChange('exchange_rate', e.target.value)}
                  placeholder="1,0000"
                  disabled={formData.currency === 'CHF'}
                  className={formData.currency === 'CHF' ? 'bg-muted' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="original_amount_chf">Montant en CHF</Label>
                <Input
                  id="original_amount_chf"
                  type="number"
                  step="0.01"
                  value={formData.original_amount_chf || ''}
                  onChange={(e) => handleInputChange('original_amount_chf', parseFloat(e.target.value) || 0)}
                  placeholder="Calculé automatiquement"
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>

            {/* Line Items Display */}
            {invoice.line_items && Array.isArray(invoice.line_items) && invoice.line_items.length > 0 && (
              <div className="space-y-2">
                <Label>Articles de la facture</Label>
                <div className="max-h-40 overflow-y-auto space-y-2 border p-3 rounded">
                  {invoice.line_items.map((item: any, index: number) => (
                    <div key={index} className="text-sm bg-gray-50 p-3 rounded">
                      <div className="font-medium">{item.description}</div>
                      <div className="grid grid-cols-2 gap-2 mt-1 text-gray-600">
                        {item.quantity && <div>Quantité: {item.quantity}</div>}
                        {item.unit_price && <div>Prix unitaire: {item.unit_price}</div>}
                        {item.total_amount && <div>Montant: {item.total_amount} {invoice.currency || 'EUR'}</div>}
                        {item.tax_rate && <div>Taux TVA: {item.tax_rate}%</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Attribution et catégories</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_subcategory">Sous-catégorie d'achat</Label>
                <Input
                  id="purchase_subcategory"
                  value={formData.purchase_subcategory || ''}
                  onChange={(e) => handleInputChange('purchase_subcategory', e.target.value)}
                  placeholder="Ex: Ordinateurs portables, Stylos..."
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="supplier" className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Informations fournisseur</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_email">Email</Label>
                <Input
                  id="supplier_email"
                  type="email"
                  value={formData.supplier_email || ''}
                  onChange={(e) => handleInputChange('supplier_email', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier_phone_number">Téléphone</Label>
                <Input
                  id="supplier_phone_number"
                  value={formData.supplier_phone_number || ''}
                  onChange={(e) => handleInputChange('supplier_phone_number', e.target.value)}
                  placeholder="01 23 45 67 89"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier_website">Site web</Label>
                <Input
                  id="supplier_website"
                  value={formData.supplier_website || ''}
                  onChange={(e) => handleInputChange('supplier_website', e.target.value)}
                  placeholder="https://example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier_company_registration">N° d'enregistrement</Label>
                <Input
                  id="supplier_company_registration"
                  value={formData.supplier_company_registration || ''}
                  onChange={(e) => handleInputChange('supplier_company_registration', e.target.value)}
                  placeholder="Numéro SIRET/SIREN"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier_vat_number">N° TVA</Label>
                <Input
                  id="supplier_vat_number"
                  value={formData.supplier_vat_number || ''}
                  onChange={(e) => handleInputChange('supplier_vat_number', e.target.value)}
                  placeholder="FR12345678901"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_address">Adresse fournisseur</Label>
              <Textarea
                id="supplier_address"
                value={formData.supplier_address || ''}
                onChange={(e) => handleInputChange('supplier_address', e.target.value)}
                placeholder="Adresse complète"
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="customer" className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Informations client</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Nom du client</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name || ''}
                  onChange={(e) => handleInputChange('customer_name', e.target.value)}
                  placeholder="Nom du client"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_company_registration">N° d'enregistrement client</Label>
                <Input
                  id="customer_company_registration"
                  value={formData.customer_company_registration || ''}
                  onChange={(e) => handleInputChange('customer_company_registration', e.target.value)}
                  placeholder="Numéro SIRET/SIREN"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_vat_number">N° TVA client</Label>
                <Input
                  id="customer_vat_number"
                  value={formData.customer_vat_number || ''}
                  onChange={(e) => handleInputChange('customer_vat_number', e.target.value)}
                  placeholder="FR12345678901"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_address">Adresse client</Label>
              <Textarea
                id="customer_address"
                value={formData.customer_address || ''}
                onChange={(e) => handleInputChange('customer_address', e.target.value)}
                placeholder="Adresse complète"
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="payment" className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Informations de paiement</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_iban">IBAN du fournisseur</Label>
                <Input
                  id="supplier_iban"
                  value={formData.supplier_iban || ''}
                  onChange={(e) => handleInputChange('supplier_iban', e.target.value)}
                  placeholder="CH37 3000 0001 1200 4870 8"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_details">Détails de paiement</Label>
                <Textarea
                  id="payment_details"
                  value={formData.payment_details || ''}
                  onChange={(e) => handleInputChange('payment_details', e.target.value)}
                  placeholder="IBAN, références, instructions de paiement..."
                  rows={4}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Validation...' : 'Valider la facture'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
