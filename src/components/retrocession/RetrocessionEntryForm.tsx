import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const retrocessionSchema = z.object({
  doctor: z.string().min(1, "Le docteur est obligatoire"),
  period_month: z.string().min(1, "La période est obligatoire"),
  chiffre_affaires: z.number().min(0, "Le chiffre d'affaires doit être positif"),
  retrocession: z.number().min(0, "La rétrocession doit être positive"),
});

type RetrocessionFormData = z.infer<typeof retrocessionSchema>;

interface RetrocessionData {
  id?: string;
  doctor: string;
  period_month: string;
  chiffre_affaires: number;
  retrocession: number;
}

interface RetrocessionEntryFormProps {
  editData?: RetrocessionData | null;
  onSuccess: () => void;
  onCancel: () => void;
  existingDoctors: string[];
}

export function RetrocessionEntryForm({
  editData,
  onSuccess,
  onCancel,
  existingDoctors,
}: RetrocessionEntryFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<RetrocessionFormData>({
    resolver: zodResolver(retrocessionSchema),
    defaultValues: {
      doctor: editData?.doctor || "",
      period_month: editData?.period_month || "",
      chiffre_affaires: editData?.chiffre_affaires || 0,
      retrocession: editData?.retrocession || 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RetrocessionFormData) => {
      // Vérifier les doublons pour une nouvelle entrée
      if (!editData) {
        const { data: existing } = await supabase
          .from("retrocessions")
          .select("id")
          .eq("doctor", data.doctor)
          .eq("period_month", `${data.period_month}-01`);
        
        if (existing && existing.length > 0) {
          throw new Error("Une entrée existe déjà pour ce docteur et cette période");
        }
      }

      const payload = {
        doctor: data.doctor,
        period_month: `${data.period_month}-01`,
        chiffre_affaires: data.chiffre_affaires,
        retrocession: data.retrocession,
      };

      if (editData?.id) {
        const { error } = await supabase
          .from("retrocessions")
          .update(payload)
          .eq("id", editData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("retrocessions")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retrocessions"] });
      toast({
        title: "Succès",
        description: editData 
          ? "L'entrée a été modifiée avec succès"
          : "L'entrée a été créée avec succès",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
      });
    },
  });

  const onSubmit = (data: RetrocessionFormData) => {
    createMutation.mutate(data);
  };

  // Générer les options de mois (janvier 2024 au mois en cours)
  const monthOptions = React.useMemo(() => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // getMonth() retourne 0-11
    
    // Commencer en janvier 2024
    const startYear = 2024;
    const startMonth = 1;
    
    for (let year = startYear; year <= currentYear; year++) {
      const monthStart = year === startYear ? startMonth : 1;
      const monthEnd = year === currentYear ? currentMonth : 12;
      
      for (let month = monthStart; month <= monthEnd; month++) {
        const value = `${year}-${month.toString().padStart(2, '0')}`;
        const label = new Date(year, month - 1).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long'
        });
        options.push({ value, label });
      }
    }
    
    return options.reverse(); // Plus récent en premier (ordre descendant)
  }, []);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="doctor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Docteur</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un docteur" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingDoctors.map((doctor) => (
                      <SelectItem key={doctor} value={doctor}>
                        {doctor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="period_month"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Période</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une période" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="chiffre_affaires"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chiffre d'affaires (CHF)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="retrocession"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rétrocession (CHF)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending}
          >
            {createMutation.isPending 
              ? "Enregistrement..." 
              : editData 
                ? "Modifier" 
                : "Créer"
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}