import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building, Calendar, DollarSign, User } from "lucide-react";

interface Invoice {
  id: string;
  original_filename: string;
  status: string;
  compte: string;
  purchase_category?: string;
  invoice_date?: string;
  payment_date?: string;
  total_amount?: number;
  currency?: string;
  exchange_rate?: number;
  original_amount_chf?: number;
  supplier_name?: string;
}

interface SimpleInvoiceValidationDialogProps {
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

export function SimpleInvoiceValidationDialog({ 
  invoice, 
  open, 
  onOpenChange, 
  onValidated 
}: SimpleInvoiceValidationDialogProps) {
  const [formData, setFormData] = useState({
    supplier_name: '',
    payment_date: '',
    purchase_category: '',
    currency: 'CHF',
    compte: 'Commun'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setFormData({
        supplier_name: invoice.supplier_name || '',
        payment_date: formatDateForInput(invoice.payment_date || invoice.invoice_date),
        purchase_category: invoice.purchase_category || '',
        currency: invoice.currency || 'CHF',
        compte: invoice.compte || 'Commun'
      });
    }
  }, [invoice]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.supplier_name || !formData.payment_date || !formData.purchase_category) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        supplier_name: formData.supplier_name,
        payment_date: formData.payment_date,
        purchase_category: formData.purchase_category,
        currency: formData.currency,
        compte: formData.compte,
        status: 'validated'
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {invoice.original_filename}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Form Fields */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Fournisseur
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={formData.supplier_name}
                  onChange={(e) => handleInputChange('supplier_name', e.target.value)}
                  placeholder="Nom du fournisseur"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Date de paiement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => handleInputChange('payment_date', e.target.value)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={formData.purchase_category} onValueChange={(value) => handleInputChange('purchase_category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="télécommunication">télécommunication</SelectItem>
                    <SelectItem value="fournitures de bureau">fournitures de bureau</SelectItem>
                    <SelectItem value="informatique">informatique</SelectItem>
                    <SelectItem value="marketing">marketing</SelectItem>
                    <SelectItem value="frais de port">frais de port</SelectItem>
                    <SelectItem value="assurance">assurance</SelectItem>
                    <SelectItem value="comptabilité">comptabilité</SelectItem>
                    <SelectItem value="formation">formation</SelectItem>
                    <SelectItem value="déplacement">déplacement</SelectItem>
                    <SelectItem value="représentation">représentation</SelectItem>
                    <SelectItem value="maintenance et réparation">maintenance et réparation</SelectItem>
                    <SelectItem value="location">location</SelectItem>
                    <SelectItem value="énergie">énergie</SelectItem>
                    <SelectItem value="investissement/amortissement">investissement/amortissement</SelectItem>
                    <SelectItem value="sous-traitance">sous-traitance</SelectItem>
                    <SelectItem value="charges sociales">charges sociales</SelectItem>
                    <SelectItem value="autres charges">autres charges</SelectItem>
                    <SelectItem value="nourritures">nourritures</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Invoice Details */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Devise
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={formData.currency} onValueChange={(value) => handleInputChange('currency', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Compte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={formData.compte} onValueChange={(value) => handleInputChange('compte', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Commun">Commun</SelectItem>
                    <SelectItem value="David Tabibian">David Tabibian</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Display invoice amount */}
            {invoice.original_amount_chf && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Montant TTC</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {invoice.original_amount_chf.toFixed(2)} CHF
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? 'Validation...' : 'Valider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}