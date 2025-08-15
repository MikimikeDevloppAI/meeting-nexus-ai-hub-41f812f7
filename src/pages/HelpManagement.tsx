import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const helpFormSchema = z.object({
  page_id: z.string().min(1, 'L\'ID de la page est requis'),
  page_name: z.string().min(1, 'Le nom de la page est requis'),
  help_content: z.string().min(1, 'Le contenu d\'aide est requis'),
});

type HelpFormData = z.infer<typeof helpFormSchema>;

interface HelpInfo {
  id: string;
  page_id: string;
  page_name: string;
  help_content: string;
  created_at: string;
  updated_at: string;
}

const HelpManagement: React.FC = () => {
  const [helpItems, setHelpItems] = useState<HelpInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HelpInfo | null>(null);
  const { toast } = useToast();

  const form = useForm<HelpFormData>({
    resolver: zodResolver(helpFormSchema),
    defaultValues: {
      page_id: '',
      page_name: '',
      help_content: '',
    },
  });

  const fetchHelpItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('page_help_information')
      .select('*')
      .order('page_name');

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les informations d\'aide',
        variant: 'destructive',
      });
    } else {
      setHelpItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHelpItems();
  }, []);

  const onSubmit = async (data: HelpFormData) => {
    try {
      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from('page_help_information')
          .update({
            page_id: data.page_id,
            page_name: data.page_name,
            help_content: data.help_content,
          })
          .eq('id', editingItem.id);

        if (error) throw error;

        toast({
          title: 'Succès',
          description: 'Information d\'aide mise à jour avec succès',
        });
      } else {
        // Create new item
        const { error } = await supabase
          .from('page_help_information')
          .insert({
            page_id: data.page_id,
            page_name: data.page_name,
            help_content: data.help_content,
          });

        if (error) throw error;

        toast({
          title: 'Succès',
          description: 'Information d\'aide créée avec succès',
        });
      }

      form.reset();
      setIsDialogOpen(false);
      setEditingItem(null);
      fetchHelpItems();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la sauvegarde',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: HelpInfo) => {
    setEditingItem(item);
    form.reset({
      page_id: item.page_id,
      page_name: item.page_name,
      help_content: item.help_content,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette information d\'aide ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('page_help_information')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Information d\'aide supprimée avec succès',
      });
      fetchHelpItems();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion de l'aide</h1>
          <p className="text-gray-600 mt-2">
            Gérez les informations d'aide pour chaque page de l'application
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingItem(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle aide
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Modifier l\'aide' : 'Nouvelle aide'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="page_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID de la page</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: todos, meetings, documents..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="page_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de la page</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: À faire, Réunions, Documents..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="help_content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contenu de l'aide</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Décrivez comment utiliser cette page..."
                          className="min-h-[200px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Annuler
                  </Button>
                  <Button type="submit">
                    <Save className="h-4 w-4 mr-2" />
                    {editingItem ? 'Mettre à jour' : 'Créer'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations d'aide existantes</CardTitle>
          <CardDescription>
            Liste de toutes les informations d'aide configurées
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : helpItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune information d'aide configurée
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page ID</TableHead>
                  <TableHead>Nom de la page</TableHead>
                  <TableHead>Contenu</TableHead>
                  <TableHead>Dernière modification</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {helpItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.page_id}</TableCell>
                    <TableCell className="font-medium">{item.page_name}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate text-sm text-gray-600">
                        {item.help_content.substring(0, 100)}
                        {item.help_content.length > 100 && '...'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(item.updated_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HelpManagement;