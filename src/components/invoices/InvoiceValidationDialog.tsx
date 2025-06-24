
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarIcon, CheckCircle } from "lucide-react";

interface Invoice {
  id: string;
  original_filename: string;
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
  customer_name?: string;
  customer_address?: string;
  payment_details?: string;
}

interface InvoiceValidationDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidated: () => void;
}

export function InvoiceValidationDialog({ 
  invoice, 
  open, 
  onOpenChange, 
  onValidated 
}: InvoiceValidationDialogProps) {
  const [formData, setFormData] = useState<Partial<Invoice>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setFormData({
        invoice_number: invoice.invoice_number || '',
        invoice_date: invoice.invoice_date || '',
        due_date: invoice.due_date || '',
        total_amount: invoice.total_amount || 0,
        total_net: invoice.total_net || 0,
        total_tax: invoice.total_tax || 0,
        currency: invoice.currency || 'EUR',
        supplier_name: invoice.supplier_name || '',
        supplier_address: invoice.supplier_address || '',
        supplier_email: invoice.supplier_email || '',
        supplier_phone_number: invoice.supplier_phone_number || '',
        customer_name: invoice.customer_name || '',
        customer_address: invoice.customer_address || '',
        payment_details: invoice.payment_details || '',
      });
    }
  }, [invoice]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          ...formData,
          status: 'validated',
          processed_at: new Date().toISOString()
        })
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Validation de la facture - {invoice.original_filename}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Document Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Informations document</h3>
            
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Numéro de facture</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number || ''}
                onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                placeholder="N° facture"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Date facture</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date || ''}
                  onChange={(e) => handleInputChange('invoice_date', e.target.value)}
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
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                <Label htmlFor="total_amount">Montant TTC</Label>
                <Input
                  id="total_amount"
                  type="number"
                  step="0.01"
                  value={formData.total_amount || ''}
                  onChange={(e) => handleInputChange('total_amount', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Devise</Label>
              <Input
                id="currency"
                value={formData.currency || ''}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                placeholder="EUR"
              />
            </div>
          </div>

          {/* Supplier and Customer Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Fournisseur</h3>
            
            <div className="space-y-2">
              <Label htmlFor="supplier_name">Nom du fournisseur</Label>
              <Input
                id="supplier_name"
                value={formData.supplier_name || ''}
                onChange={(e) => handleInputChange('supplier_name', e.target.value)}
                placeholder="Nom du fournisseur"
              />
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

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <h3 className="font-semibold text-lg border-b pb-2 mt-6">Client</h3>
            
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
              <Label htmlFor="customer_address">Adresse client</Label>
              <Textarea
                id="customer_address"
                value={formData.customer_address || ''}
                onChange={(e) => handleInputChange('customer_address', e.target.value)}
                placeholder="Adresse complète"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_details">Détails de paiement</Label>
              <Textarea
                id="payment_details"
                value={formData.payment_details || ''}
                onChange={(e) => handleInputChange('payment_details', e.target.value)}
                placeholder="IBAN, références..."
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Allocation Display */}
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">Répartition actuelle</h3>
          <div className="flex gap-4">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm">
              David: {invoice.david_percentage}%
            </span>
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm">
              Cabinet: {invoice.cabinet_percentage}%
            </span>
          </div>
        </div>

        <DialogFooter>
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
