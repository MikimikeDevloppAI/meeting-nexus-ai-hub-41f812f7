
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

export function InvoiceValidationDialog({ 
  invoice, 
  open, 
  onOpenChange, 
  onValidated 
}: InvoiceValidationDialogProps) {
  const [formData, setFormData] = useState<Partial<Invoice>>({});
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (invoice) {
      setFormData({
        invoice_number: invoice.invoice_number || '',
        invoice_date: formatDateForInput(invoice.invoice_date),
        due_date: formatDateForInput(invoice.due_date),
        total_amount: invoice.total_amount || 0,
        total_net: invoice.total_net || 0,
        total_tax: invoice.total_tax || 0,
        currency: invoice.currency || 'EUR',
        exchange_rate: invoice.exchange_rate || 1,
        original_amount_chf: invoice.original_amount_chf || 0,
        compte: invoice.compte || 'Commun',
        purchase_category: invoice.purchase_category || '',
        purchase_subcategory: invoice.purchase_subcategory || '',
        supplier_name: invoice.supplier_name || '',
        supplier_address: invoice.supplier_address || '',
        supplier_email: invoice.supplier_email || '',
        supplier_phone_number: invoice.supplier_phone_number || '',
        supplier_iban: invoice.supplier_iban || '',
        supplier_website: invoice.supplier_website || '',
        supplier_company_registration: invoice.supplier_company_registration || '',
        supplier_vat_number: invoice.supplier_vat_number || '',
        customer_name: invoice.customer_name || '',
        customer_address: invoice.customer_address || '',
        customer_company_registration: invoice.customer_company_registration || '',
        customer_vat_number: invoice.customer_vat_number || '',
        payment_details: invoice.payment_details || '',
      });
    }
  }, [invoice]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      let processedValue = value;
      
      // Traitement spécial pour le taux de change : accepter les virgules
      if (field === 'exchange_rate') {
        if (typeof value === 'string') {
          // Remplacer les virgules par des points pour la conversion en nombre
          const normalizedValue = value.replace(',', '.');
          // Garder la valeur comme string si elle est en cours de saisie (ex: "0.", "0,5")
          if (normalizedValue === '' || normalizedValue === '.' || normalizedValue === '0.' || normalizedValue === '0') {
            processedValue = normalizedValue;
          } else {
            const parsedValue = parseFloat(normalizedValue);
            processedValue = !isNaN(parsedValue) ? parsedValue : value;
          }
        }
      }
      
      const newData = { ...prev, [field]: processedValue };
      
      // Si la devise est CHF, forcer le taux de change à 1
      if (field === 'currency' && value === 'CHF') {
        newData.exchange_rate = 1;
      }
      
      // Si on modifie la devise vers CHF, fixer le taux à 1
      if (newData.currency === 'CHF') {
        newData.exchange_rate = 1;
      }
      
      // Recalculer original_amount_chf si le taux de change ou le montant TTC change
      // Utiliser typeof et > 0 au lieu de truthy check pour permettre les valeurs < 1
      if ((field === 'exchange_rate' || field === 'total_amount' || field === 'currency') && 
          typeof newData.exchange_rate === 'number' && newData.exchange_rate > 0 && 
          newData.total_amount) {
        newData.original_amount_chf = newData.total_amount * newData.exchange_rate;
      }
      
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
    if (!formData.supplier_name || formData.supplier_name.trim() === '') {
      errors.push('Le nom du fournisseur est obligatoire');
    }

    // Vérifier la date de facture
    if (!formData.invoice_date || formData.invoice_date === '') {
      errors.push('La date de facture est obligatoire');
    }

    // Vérifier le montant TTC
    if (!formData.total_amount || formData.total_amount <= 0) {
      errors.push('Le montant TTC doit être supérieur à 0');
    }

    // Vérifier la devise
    if (!formData.currency || formData.currency.trim() === '') {
      errors.push('La devise est obligatoire');
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
      // Utiliser le taux de change du formulaire (modifié par l'utilisateur)
      let finalExchangeRate = typeof formData.exchange_rate === 'number' ? formData.exchange_rate : 1;
      let finalOriginalAmountChf = formData.original_amount_chf || 0;

      // Détecter si la devise a changé par rapport à la facture originale
      const currencyChanged = invoice.currency !== formData.currency;
      
      // Appeler l'API uniquement si :
      // 1. La devise n'est pas CHF
      // 2. ET (la devise a changé OU pas de taux de change défini)
      // 3. ET le taux de change est toujours à 1 (pas modifié manuellement)
      const shouldCallAPI = formData.currency !== 'CHF' && 
                           (currencyChanged || !formData.exchange_rate) && 
                           formData.exchange_rate === 1;

      if (shouldCallAPI) {
        console.log('Calling currency API for:', formData.currency, 'amount:', formData.total_amount);
        
        const currencyConversion = await convertCurrency(
          formData.currency || 'EUR', 
          formData.total_amount || 0, 
          formData.invoice_date || new Date().toISOString().split('T')[0]
        );
        
        if (currencyConversion.exchange_rate) {
          finalExchangeRate = currencyConversion.exchange_rate;
          console.log('API returned exchange rate:', finalExchangeRate);
        } else {
          console.warn('API did not return a valid exchange rate, keeping default');
        }
      } else {
        console.log('Skipping API call - Currency:', formData.currency, 'Rate:', formData.exchange_rate, 'Changed:', currencyChanged);
      }

      // Toujours recalculer le montant CHF avec le taux final
      if (formData.total_amount) {
        finalOriginalAmountChf = formData.total_amount * finalExchangeRate;
      }

      const updateData = {
        ...formData,
        exchange_rate: finalExchangeRate,
        original_amount_chf: finalOriginalAmountChf,
        status: 'validated',
        processed_at: new Date().toISOString(),
        invoice_date: formData.invoice_date === '' ? null : formData.invoice_date,
        due_date: formData.due_date === '' ? null : formData.due_date,
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
                <Input
                  id="currency"
                  value={formData.currency || ''}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  placeholder="EUR"
                  className={validationErrors.some(e => e.includes('devise')) ? 'border-red-500' : ''}
                />
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
                <Label htmlFor="compte">Compte</Label>
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

              <div className="space-y-2 md:col-span-2">
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
