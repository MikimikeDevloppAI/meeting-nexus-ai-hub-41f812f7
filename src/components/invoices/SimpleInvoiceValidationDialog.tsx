import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building, Calendar, DollarSign, User, Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Invoice {
  id: string;
  original_filename: string;
  status: string;
  compte: string;
  invoice_type?: string;
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
    invoice_type: '',
    currency: 'CHF',
    compte: 'Commun',
    total_amount: 0,
    exchange_rate: 1
  });
  const [saving, setSaving] = useState(false);
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);

  // Récupérer les fournisseurs existants
  const { data: existingSuppliers = [] } = useQuery({
    queryKey: ['existing-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('supplier_name')
        .eq('status', 'validated')
        .not('supplier_name', 'is', null)
        .not('supplier_name', 'eq', '');

      if (error) throw error;

      // Récupérer les noms uniques et les nettoyer
      const uniqueSuppliers = [...new Set(data.map(s => s.supplier_name))];
      return uniqueSuppliers.sort();
    }
  });

  useEffect(() => {
    if (invoice) {
      setFormData({
        supplier_name: invoice.supplier_name || '',
        payment_date: formatDateForInput(invoice.payment_date || invoice.invoice_date),
        invoice_type: invoice.invoice_type || '',
        currency: invoice.currency || 'CHF',
        compte: invoice.compte || 'Commun',
        total_amount: invoice.total_amount || 0,
        exchange_rate: invoice.exchange_rate || 1
      });
    }
  }, [invoice]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.supplier_name || !formData.payment_date || !formData.invoice_type) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        supplier_name: formData.supplier_name,
        payment_date: formData.payment_date,
        invoice_type: formData.invoice_type,
        currency: formData.currency,
        compte: formData.compte,
        total_amount: formData.total_amount,
        exchange_rate: formData.exchange_rate,
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
                <Popover open={supplierDropdownOpen} onOpenChange={setSupplierDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={supplierDropdownOpen}
                      className="w-full justify-between"
                    >
                      {formData.supplier_name || "Sélectionner ou saisir un fournisseur"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-card border shadow-md z-[100]" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                    <Command>
                      <CommandInput 
                        placeholder="Rechercher ou saisir un fournisseur..." 
                        value={formData.supplier_name}
                        onValueChange={(value) => handleInputChange('supplier_name', value)}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-2 text-sm text-muted-foreground">
                            Aucun fournisseur trouvé. Le texte saisi sera utilisé comme nouveau fournisseur.
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {existingSuppliers.map((supplier) => (
                            <CommandItem
                              key={supplier}
                              value={supplier}
                              onSelect={(currentValue) => {
                                handleInputChange('supplier_name', currentValue);
                                setSupplierDropdownOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.supplier_name === supplier ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {supplier}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                <Select value={formData.invoice_type} onValueChange={(value) => handleInputChange('invoice_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assurance/cotisations sociales">Assurance/cotisations sociales</SelectItem>
                    <SelectItem value="contactologie">Contactologie</SelectItem>
                    <SelectItem value="déplacement/formation">Déplacement/formation</SelectItem>
                    <SelectItem value="équipement médicaux">Équipement médicaux</SelectItem>
                    <SelectItem value="fourniture de bureau">Fourniture de bureau</SelectItem>
                    <SelectItem value="fourniture injections intra-vitréennes">Fourniture injections intra-vitréennes</SelectItem>
                    <SelectItem value="fourniture médicales">Fourniture médicales</SelectItem>
                    <SelectItem value="frais bancaires/financiers">Frais bancaires/financiers</SelectItem>
                    <SelectItem value="frais de locaux">Frais de locaux</SelectItem>
                    <SelectItem value="frais de véhicule">Frais de véhicule</SelectItem>
                    <SelectItem value="informatique/logiciel">Informatique/logiciel</SelectItem>
                    <SelectItem value="investissement/amortissement">Investissement/amortissement</SelectItem>
                    <SelectItem value="marketing/communication">Marketing/communication</SelectItem>
                    <SelectItem value="nourritures">Nourritures</SelectItem>
                    <SelectItem value="télécommunication">Télécommunication</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Taux de change en dessous de catégorie */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Taux de change</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.exchange_rate}
                  onChange={(e) => handleInputChange('exchange_rate', e.target.value)}
                  placeholder="Taux de change"
                />
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

            {/* Montant TTC - Editable */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Montant TTC</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_amount}
                  onChange={(e) => handleInputChange('total_amount', e.target.value)}
                  placeholder="Montant TTC"
                />
              </CardContent>
            </Card>

            {/* Montant CHF en dessous de montant TTC */}
            {invoice.original_amount_chf && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Montant CHF</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-semibold text-blue-600">
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