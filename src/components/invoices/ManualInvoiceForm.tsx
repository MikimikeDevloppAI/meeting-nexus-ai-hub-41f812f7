import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface ManualInvoiceFormData {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  supplier_name: string;
  supplier_address: string;
  supplier_email: string;
  supplier_phone_number: string;
  supplier_vat_number: string;
  customer_name: string;
  customer_address: string;
  customer_vat_number: string;
  currency: string;
  total_net: number;
  total_tax: number;
  total_amount: number;
  payment_details: string;
  purchase_category: string;
  purchase_subcategory: string;
  compte: string;
  line_items: LineItem[];
}

interface ManualInvoiceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const ManualInvoiceForm: React.FC<ManualInvoiceFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ManualInvoiceFormData>({
    defaultValues: {
      currency: "EUR",
      line_items: [{ description: "", quantity: 1, unit_price: 0, total: 0 }],
      invoice_date: new Date().toISOString().split('T')[0],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  const watchedLineItems = watch("line_items");
  const watchedTotalNet = watch("total_net");
  const watchedTotalTax = watch("total_tax");

  // Calculer automatiquement les totaux
  React.useEffect(() => {
    const lineItemsTotal = watchedLineItems?.reduce((sum, item) => {
      const itemTotal = (item.quantity || 0) * (item.unit_price || 0);
      return sum + itemTotal;
    }, 0) || 0;

    setValue("total_net", lineItemsTotal);
  }, [watchedLineItems, setValue]);

  React.useEffect(() => {
    const totalAmount = (watchedTotalNet || 0) + (watchedTotalTax || 0);
    setValue("total_amount", totalAmount);
  }, [watchedTotalNet, watchedTotalTax, setValue]);

  const updateLineItemTotal = (index: number) => {
    const quantity = watchedLineItems[index]?.quantity || 0;
    const unitPrice = watchedLineItems[index]?.unit_price || 0;
    const total = quantity * unitPrice;
    setValue(`line_items.${index}.total`, total);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const uploadFileToStorage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }

    return data.path;
  };

  const onSubmit = async (data: ManualInvoiceFormData) => {
    if (!user) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour créer une facture",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let filePath = null;
      
      // Upload du fichier si présent
      if (uploadedFile) {
        filePath = await uploadFileToStorage(uploadedFile);
        if (!filePath) {
          throw new Error("Erreur lors de l'upload du fichier");
        }
      }

      // Créer la facture dans la base de données
      const { error } = await supabase.from("invoices").insert({
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        supplier_name: data.supplier_name,
        supplier_address: data.supplier_address,
        supplier_email: data.supplier_email,
        supplier_phone_number: data.supplier_phone_number,
        supplier_vat_number: data.supplier_vat_number,
        customer_name: data.customer_name,
        customer_address: data.customer_address,
        customer_vat_number: data.customer_vat_number,
        currency: data.currency,
        total_net: data.total_net,
        total_tax: data.total_tax,
        total_amount: data.total_amount,
        payment_details: data.payment_details,
        purchase_category: data.purchase_category,
        purchase_subcategory: data.purchase_subcategory,
        compte: data.compte,
        line_items: data.line_items,
        file_path: filePath,
        original_filename: uploadedFile?.name || null,
        content_type: uploadedFile?.type || null,
        file_size: uploadedFile?.size || null,
        status: "completed",
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "La facture a été créée avec succès",
      });

      onSuccess();
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la création de la facture",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Créer une facture manuellement</h2>
          <p className="text-muted-foreground">
            Saisissez toutes les informations de la facture
          </p>
        </div>
        <Badge variant="outline">Création manuelle</Badge>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="invoice_number">Numéro de facture *</Label>
              <Input
                id="invoice_number"
                {...register("invoice_number", { required: "Ce champ est requis" })}
                placeholder="F-2024-001"
              />
              {errors.invoice_number && (
                <p className="text-sm text-destructive mt-1">
                  {errors.invoice_number.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="invoice_date">Date de facture *</Label>
              <Input
                id="invoice_date"
                type="date"
                {...register("invoice_date", { required: "Ce champ est requis" })}
              />
              {errors.invoice_date && (
                <p className="text-sm text-destructive mt-1">
                  {errors.invoice_date.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="due_date">Date d'échéance</Label>
              <Input
                id="due_date"
                type="date"
                {...register("due_date")}
              />
            </div>
            <div>
              <Label htmlFor="currency">Devise</Label>
              <Input
                id="currency"
                {...register("currency")}
                placeholder="EUR"
              />
            </div>
            <div>
              <Label htmlFor="purchase_category">Catégorie</Label>
              <Input
                id="purchase_category"
                {...register("purchase_category")}
                placeholder="Fournitures"
              />
            </div>
            <div>
              <Label htmlFor="compte">Compte</Label>
              <Input
                id="compte"
                {...register("compte")}
                placeholder="60100"
              />
            </div>
          </CardContent>
        </Card>

        {/* Informations fournisseur */}
        <Card>
          <CardHeader>
            <CardTitle>Informations fournisseur</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier_name">Nom du fournisseur *</Label>
              <Input
                id="supplier_name"
                {...register("supplier_name", { required: "Ce champ est requis" })}
                placeholder="Nom de l'entreprise"
              />
              {errors.supplier_name && (
                <p className="text-sm text-destructive mt-1">
                  {errors.supplier_name.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="supplier_email">Email</Label>
              <Input
                id="supplier_email"
                type="email"
                {...register("supplier_email")}
                placeholder="contact@fournisseur.com"
              />
            </div>
            <div>
              <Label htmlFor="supplier_phone_number">Téléphone</Label>
              <Input
                id="supplier_phone_number"
                {...register("supplier_phone_number")}
                placeholder="+33 1 23 45 67 89"
              />
            </div>
            <div>
              <Label htmlFor="supplier_vat_number">Numéro TVA</Label>
              <Input
                id="supplier_vat_number"
                {...register("supplier_vat_number")}
                placeholder="FR12345678901"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="supplier_address">Adresse</Label>
              <Textarea
                id="supplier_address"
                {...register("supplier_address")}
                placeholder="123 Rue de la Paix, 75001 Paris"
              />
            </div>
          </CardContent>
        </Card>

        {/* Informations client */}
        <Card>
          <CardHeader>
            <CardTitle>Informations client</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_name">Nom du client</Label>
              <Input
                id="customer_name"
                {...register("customer_name")}
                placeholder="Nom du client"
              />
            </div>
            <div>
              <Label htmlFor="customer_vat_number">Numéro TVA client</Label>
              <Input
                id="customer_vat_number"
                {...register("customer_vat_number")}
                placeholder="FR98765432109"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="customer_address">Adresse client</Label>
              <Textarea
                id="customer_address"
                {...register("customer_address")}
                placeholder="456 Avenue de la République, 69000 Lyon"
              />
            </div>
          </CardContent>
        </Card>

        {/* Articles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Articles
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ description: "", quantity: 1, unit_price: 0, total: 0 })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un article
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                <div className="md:col-span-2">
                  <Label htmlFor={`line_items.${index}.description`}>Description</Label>
                  <Input
                    {...register(`line_items.${index}.description`)}
                    placeholder="Description de l'article"
                  />
                </div>
                <div>
                  <Label htmlFor={`line_items.${index}.quantity`}>Quantité</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`line_items.${index}.quantity`, {
                      valueAsNumber: true,
                      onChange: () => updateLineItemTotal(index)
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor={`line_items.${index}.unit_price`}>Prix unitaire</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`line_items.${index}.unit_price`, {
                      valueAsNumber: true,
                      onChange: () => updateLineItemTotal(index)
                    })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Total</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`line_items.${index}.total`, { valueAsNumber: true })}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Totaux */}
        <Card>
          <CardHeader>
            <CardTitle>Totaux</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="total_net">Total HT</Label>
              <Input
                id="total_net"
                type="number"
                step="0.01"
                {...register("total_net", { valueAsNumber: true })}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="total_tax">TVA</Label>
              <Input
                id="total_tax"
                type="number"
                step="0.01"
                {...register("total_tax", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="total_amount">Total TTC</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                {...register("total_amount", { valueAsNumber: true })}
                readOnly
                className="bg-muted font-bold"
              />
            </div>
          </CardContent>
        </Card>

        {/* Document associé */}
        <Card>
          <CardHeader>
            <CardTitle>Document associé (optionnel)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label htmlFor="document-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-4 text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Cliquez pour uploader</span> un document
                    </p>
                    <p className="text-xs text-gray-500">PDF, PNG, JPG jusqu'à 10MB</p>
                  </div>
                  <input
                    id="document-upload"
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              {uploadedFile && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">{uploadedFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploadedFile(null)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Détails de paiement */}
        <Card>
          <CardHeader>
            <CardTitle>Détails de paiement</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="payment_details">Informations de paiement</Label>
              <Textarea
                id="payment_details"
                {...register("payment_details")}
                placeholder="Conditions de paiement, informations bancaires, etc."
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Créer la facture"}
          </Button>
        </div>
      </form>
    </div>
  );
};