import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, ClipboardList, Pencil, Trash2, Phone, Syringe } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// NOTE: The Supabase client is strongly typed with Database, which doesn't yet include
// our new tables. We cast to any locally to avoid TS issues.
const sb: any = supabase as any;

type Produit = {
  id: string;
  produit: string;
  molecule?: string | null;
  fabricant?: string | null;
  concentration?: string | null;
  presentation?: string | null;
  prix_patient?: number | null;
  prix_achat?: number | null;
  representant?: string | null;
  telephone?: string | null;
  email?: string | null;
  seuil_alerte?: number | null;
  stock_cible?: number | null;
};

type Commande = {
  id: string;
  produit_id: string;
  numero_commande?: string | null;
  quantite_commande: number;
  date_commande: string; // ISO date
  quantite_recue?: number | null;
  date_reception?: string | null;
  montant?: number | null;
  date_paiement?: string | null;
};

type Injection = {
  id: string;
  produit_id: string;
  date_injection: string; // ISO date
  quantite?: number | null;
};

const SEO = () => {
  useEffect(() => {
    const title = "Injection | OphtaCare Hub";
    const desc = "Gestion des injections: produits, commandes et suivi des injections";

    document.title = title;

    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.setAttribute('name', 'description');
    meta.setAttribute('content', desc);
    if (!meta.parentElement) document.head.appendChild(meta);

    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    canonical.setAttribute('href', window.location.origin + '/gestion-stock');
    if (!canonical.parentElement) document.head.appendChild(canonical);
  }, []);
  return null;
};

const GestionStock: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [injections, setInjections] = useState<Injection[]>([]);

  // Forms state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [produitForm, setProduitForm] = useState<Partial<Produit>>({ produit: "", seuil_alerte: 0 });

  const [commandeForm, setCommandeForm] = useState<Partial<Commande>>({
    produit_id: "",
    quantite_commande: 0,
    date_commande: new Date().toISOString().slice(0, 10),
    quantite_recue: 0,
  });

  const [injectionForm, setInjectionForm] = useState<Partial<Injection>>({
    produit_id: "",
    date_injection: new Date().toISOString().slice(0, 10),
    quantite: 1,
  });

  const [openProduit, setOpenProduit] = useState(false);
  const [openCommande, setOpenCommande] = useState(false);
  const [openInjectionEdit, setOpenInjectionEdit] = useState(false);
  const [openContact, setOpenContact] = useState(false);
  const [contactProduit, setContactProduit] = useState<Produit | null>(null);
  const [editingCommandeId, setEditingCommandeId] = useState<string | null>(null);
  const [editingInjectionId, setEditingInjectionId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'produit'|'commande'|'injection'; id: string; label?: string } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: p }, { data: c }, { data: i }] = await Promise.all([
      sb.from("produit_injection").select("*"),
      sb.from("commande_injection").select("*"),
      sb.from("injection").select("*"),
    ]);
    setProduits(p || []);
    setCommandes(c || []);
    setInjections(i || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const formatDateShort = (d?: string | null) => {
    if (!d) return "-";
    const s = d.toString();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, day] = s.slice(0, 10).split("-");
      return `${day}.${m}.${y.slice(2)}`;
    }
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return s;
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = String(dt.getFullYear()).slice(2);
    return `${dd}.${mm}.${yy}`;
  };

  const stockParProduit = useMemo(() => {
    const recu: Record<string, number> = {};
    const consomme: Record<string, number> = {};
    commandes.forEach((c) => {
      const q = Number(c.quantite_recue || 0);
      recu[c.produit_id] = (recu[c.produit_id] || 0) + (isNaN(q) ? 0 : q);
    });
    injections.forEach((inj) => {
      const q = Number(inj.quantite ?? 1);
      consomme[inj.produit_id] = (consomme[inj.produit_id] || 0) + (isNaN(q) ? 0 : q);
    });
    const out: Record<string, number> = {};
    produits.forEach((p) => {
      out[p.id] = (recu[p.id] || 0) - (consomme[p.id] || 0);
    });
    return out;
  }, [commandes, injections, produits]);

  const moyenneInjections3Mois = useMemo(() => {
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    const sums: Record<string, number> = {};
    injections.forEach((inj) => {
      const d = new Date(inj.date_injection);
      if (!isNaN(d.getTime()) && d >= start) {
        const q = Number(inj.quantite ?? 1);
        sums[inj.produit_id] = (sums[inj.produit_id] || 0) + (isNaN(q) ? 0 : q);
      }
    });
    const avg: Record<string, number> = {};
    Object.keys(sums).forEach((pid) => {
      avg[pid] = sums[pid] / 3;
    });
    return avg;
  }, [injections]);

  const commandeEnCoursParProduit = useMemo(() => {
    const enCours: Record<string, number> = {};
    commandes.forEach((c) => {
      const commande = Number(c.quantite_commande || 0);
      const recue = Number(c.quantite_recue || 0);
      const difference = commande - recue;
      if (difference > 0) {
        enCours[c.produit_id] = (enCours[c.produit_id] || 0) + difference;
      }
    });
    return enCours;
  }, [commandes]);

  // Préparer les données pour le graphique des 6 derniers mois
  const monthsData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    // Générer les 6 derniers mois
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      
      months.push({
        month: monthKey,
        monthLabel,
        data: {}
      });
    }

    // Compter les injections par mois et par produit
    injections.forEach((inj) => {
      const injectionMonth = inj.date_injection.slice(0, 7);
      const monthData = months.find(m => m.month === injectionMonth);
      
      if (monthData) {
        const prod = produits.find(p => p.id === inj.produit_id);
        const produitName = prod?.produit || 'Inconnu';
        
        if (!monthData.data[produitName]) {
          monthData.data[produitName] = 0;
        }
        monthData.data[produitName] += inj.quantite ?? 1;
      }
    });

    // Obtenir tous les produits utilisés
    const allProducts = [...new Set(injections.map(inj => {
      const prod = produits.find(p => p.id === inj.produit_id);
      return prod?.produit || 'Inconnu';
    }))];

    // Transformer les données pour le graphique
    return months.map(m => {
      const result = { month: m.monthLabel };
      allProducts.forEach(product => {
        result[product] = m.data[product] || 0;
      });
      return result;
    });
  }, [injections, produits]);

  const resetProduitForm = () => {
    setEditingId(null);
    setProduitForm({ produit: "", molecule: "", fabricant: "", concentration: "", presentation: "", prix_patient: undefined, prix_achat: undefined, representant: "", telephone: "", email: "", seuil_alerte: 0, stock_cible: 0 });
  };

  const handleSaveProduit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await sb.from("produit_injection").update(produitForm).eq("id", editingId);
    } else {
      await sb.from("produit_injection").insert({
        produit: produitForm.produit,
        molecule: produitForm.molecule,
        fabricant: produitForm.fabricant,
        concentration: produitForm.concentration,
        presentation: produitForm.presentation,
        prix_patient: produitForm.prix_patient,
        prix_achat: produitForm.prix_achat,
        representant: produitForm.representant,
        telephone: produitForm.telephone,
        email: produitForm.email,
        seuil_alerte: produitForm.seuil_alerte ?? 0,
        stock_cible: produitForm.stock_cible ?? 0,
      });
    }
    await fetchAll();
    resetProduitForm();
    setOpenProduit(false);
  };

  const handleEditProduit = (p: Produit) => {
    setEditingId(p.id);
    setProduitForm(p);
    setOpenProduit(true);
  };

  const handleEditCommande = (c: Commande) => {
    setEditingCommandeId(c.id);
    setCommandeForm({
      produit_id: c.produit_id,
      numero_commande: c.numero_commande ?? "",
      quantite_commande: c.quantite_commande,
      date_commande: c.date_commande,
      quantite_recue: c.quantite_recue ?? 0,
      date_reception: c.date_reception ?? null,
      montant: c.montant ?? null,
      date_paiement: c.date_paiement ?? null,
    });
    setOpenCommande(true);
  };

  const handleEditInjection = (inj: Injection) => {
    setEditingInjectionId(inj.id);
    setInjectionForm({
      produit_id: inj.produit_id,
      date_injection: inj.date_injection,
      quantite: inj.quantite ?? 1,
    });
    setOpenInjectionEdit(true);
  };

  const handleSaveCommande = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandeForm.produit_id) return;
    if (editingCommandeId) {
      await sb.from("commande_injection").update({
        produit_id: commandeForm.produit_id,
        numero_commande: commandeForm.numero_commande,
        quantite_commande: Number(commandeForm.quantite_commande || 0),
        date_commande: commandeForm.date_commande,
        quantite_recue: Number(commandeForm.quantite_recue || 0),
        date_reception: commandeForm.date_reception || null,
        montant: commandeForm.montant ?? null,
        date_paiement: commandeForm.date_paiement || null,
      }).eq("id", editingCommandeId);
    } else {
      await sb.from("commande_injection").insert({
        produit_id: commandeForm.produit_id,
        numero_commande: commandeForm.numero_commande,
        quantite_commande: Number(commandeForm.quantite_commande || 0),
        date_commande: commandeForm.date_commande,
        quantite_recue: Number(commandeForm.quantite_recue || 0),
        date_reception: commandeForm.date_reception || null,
        montant: commandeForm.montant ?? null,
        date_paiement: commandeForm.date_paiement || null,
      });
    }
    await fetchAll();
    setCommandeForm({ produit_id: "", quantite_commande: 0, date_commande: new Date().toISOString().slice(0, 10), quantite_recue: 0 });
    setEditingCommandeId(null);
    setOpenCommande(false);
  };

  const handleSaveInjection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!injectionForm.produit_id) return;
    if (editingInjectionId) {
      await sb.from("injection").update({
        produit_id: injectionForm.produit_id,
        date_injection: injectionForm.date_injection,
        quantite: Number(injectionForm.quantite || 1),
      }).eq("id", editingInjectionId);
    } else {
      await sb.from("injection").insert({
        produit_id: injectionForm.produit_id,
        date_injection: injectionForm.date_injection,
        quantite: Number(injectionForm.quantite || 1),
      });
    }
    await fetchAll();
    setInjectionForm({ produit_id: "", date_injection: new Date().toISOString().slice(0, 10), quantite: 1 });
    if (editingInjectionId) setOpenInjectionEdit(false);
    setEditingInjectionId(null);
  };

  const requestDelete = (type: 'produit'|'commande'|'injection', id: string, label?: string) => {
    setDeleteTarget({ type, id, label });
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'produit') {
        await sb.from('produit_injection').delete().eq('id', deleteTarget.id);
      } else if (deleteTarget.type === 'commande') {
        await sb.from('commande_injection').delete().eq('id', deleteTarget.id);
      } else {
        await sb.from('injection').delete().eq('id', deleteTarget.id);
      }
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeleteOpen(false);
      setDeleteTarget(null);
      await fetchAll();
    }
  };

  return (
    <>
      <SEO />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Injection</h1>
        <p className="text-muted-foreground">Suivi des produits, commandes et injections</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => { resetProduitForm(); setOpenProduit(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter un produit
          </Button>
          <Button variant="outline" onClick={() => { setCommandeForm({ produit_id: "", quantite_commande: 0, date_commande: new Date().toISOString().slice(0, 10), quantite_recue: 0 }); setOpenCommande(true); }}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Enregistrer une commande
          </Button>
        </div>
      </header>

      <main className="mt-6 space-y-6">
        <Dialog open={openProduit} onOpenChange={setOpenProduit}>
          <DialogContent className="sm:max-w-5xl max-w-[95vw]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier un produit" : "Ajouter un produit"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveProduit} className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Informations produit</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label>Produit</Label>
                    <Input value={produitForm.produit || ""} onChange={(e) => setProduitForm({ ...produitForm, produit: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Molécule</Label>
                    <Input value={produitForm.molecule || ""} onChange={(e) => setProduitForm({ ...produitForm, molecule: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fabricant</Label>
                    <Input value={produitForm.fabricant || ""} onChange={(e) => setProduitForm({ ...produitForm, fabricant: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Concentration</Label>
                    <Input value={produitForm.concentration || ""} onChange={(e) => setProduitForm({ ...produitForm, concentration: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Présentation</Label>
                    <Input value={produitForm.presentation || ""} onChange={(e) => setProduitForm({ ...produitForm, presentation: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tarifs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Prix patient</Label>
                    <Input type="number" step="0.01" value={produitForm.prix_patient ?? ""} onChange={(e) => setProduitForm({ ...produitForm, prix_patient: parseFloat(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Prix d'achat</Label>
                    <Input type="number" step="0.01" value={produitForm.prix_achat ?? ""} onChange={(e) => setProduitForm({ ...produitForm, prix_achat: parseFloat(e.target.value) })} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Contact représentant</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label>Représentant</Label>
                    <Input value={produitForm.representant || ""} onChange={(e) => setProduitForm({ ...produitForm, representant: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Téléphone</Label>
                    <Input value={produitForm.telephone || ""} onChange={(e) => setProduitForm({ ...produitForm, telephone: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input type="email" value={produitForm.email || ""} onChange={(e) => setProduitForm({ ...produitForm, email: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Gestion des injections</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Seuil d'alerte</Label>
                    <Input type="number" value={produitForm.seuil_alerte ?? 0} onChange={(e) => setProduitForm({ ...produitForm, seuil_alerte: parseInt(e.target.value || "0") })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Stock cible</Label>
                    <Input type="number" value={produitForm.stock_cible ?? 0} onChange={(e) => setProduitForm({ ...produitForm, stock_cible: parseInt(e.target.value || "0") })} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit">{editingId ? "Enregistrer" : "Ajouter"}</Button>
                <Button type="button" variant="outline" onClick={() => { setOpenProduit(false); resetProduitForm(); }}>Annuler</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={openCommande} onOpenChange={(o) => { setOpenCommande(o); if (!o) { setEditingCommandeId(null); } }}>
          <DialogContent className="sm:max-w-5xl max-w-[95vw]">
            <DialogHeader>
              <DialogTitle>{editingCommandeId ? "Modifier une commande" : "Enregistrer une commande"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveCommande} className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Produit</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1 md:col-span-3">
                    <Label>Produit commandé</Label>
                    <select className="border rounded-md px-3 py-2 w-full" value={commandeForm.produit_id || ""} onChange={(e) => setCommandeForm({ ...commandeForm, produit_id: e.target.value })} required>
                      <option value="">Sélectionner un produit</option>
                      {produits.map((p) => (
                        <option key={p.id} value={p.id}>{p.produit}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Détails commande</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label>Numéro de commande</Label>
                    <Input value={commandeForm.numero_commande || ""} onChange={(e) => setCommandeForm({ ...commandeForm, numero_commande: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Quantité commandée</Label>
                    <Input type="number" value={commandeForm.quantite_commande ?? 0} onChange={(e) => setCommandeForm({ ...commandeForm, quantite_commande: parseInt(e.target.value || "0") })} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Date commande</Label>
                    <Input type="date" value={commandeForm.date_commande || ""} onChange={(e) => setCommandeForm({ ...commandeForm, date_commande: e.target.value })} required />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Réception</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Quantité reçue</Label>
                    <Input type="number" value={commandeForm.quantite_recue ?? 0} onChange={(e) => setCommandeForm({ ...commandeForm, quantite_recue: parseInt(e.target.value || "0") })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Date réception</Label>
                    <Input type="date" value={commandeForm.date_reception || ""} onChange={(e) => setCommandeForm({ ...commandeForm, date_reception: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Paiement</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Montant</Label>
                    <Input type="number" step="0.01" value={commandeForm.montant ?? ""} onChange={(e) => setCommandeForm({ ...commandeForm, montant: parseFloat(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Date paiement</Label>
                    <Input type="date" value={commandeForm.date_paiement || ""} onChange={(e) => setCommandeForm({ ...commandeForm, date_paiement: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <Button type="submit">Enregistrer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={openInjectionEdit} onOpenChange={setOpenInjectionEdit}>
          <DialogContent className="sm:max-w-lg max-w-[95vw]">
            <DialogHeader>
              <DialogTitle>Modifier une injection</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveInjection} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3 space-y-1">
                  <Label>Produit</Label>
                  <select
                    className="border rounded-md px-3 py-2 w-full"
                    value={injectionForm.produit_id || ""}
                    onChange={(e) => setInjectionForm({ ...injectionForm, produit_id: e.target.value })}
                    required
                  >
                    <option value="">Sélectionner un produit</option>
                    {produits.map((p) => (
                      <option key={p.id} value={p.id}>{p.produit}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Quantité</Label>
                  <Input
                    type="number"
                    value={injectionForm.quantite ?? 1}
                    onChange={(e) => setInjectionForm({ ...injectionForm, quantite: parseInt(e.target.value || "1") })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Date d'injection</Label>
                  <Input
                    type="date"
                    value={injectionForm.date_injection || ""}
                    onChange={(e) => setInjectionForm({ ...injectionForm, date_injection: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit">Enregistrer</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setOpenInjectionEdit(false); setEditingInjectionId(null); }}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={openContact} onOpenChange={setOpenContact}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Informations de contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground">Représentant</div>
                <div className="text-strong">{contactProduit?.representant || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Fabricant</div>
                <div className="text-strong">{contactProduit?.fabricant || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Téléphone</div>
                <div className="text-strong">
                  {contactProduit?.telephone ? (
                    <a className="underline underline-offset-2" href={`tel:${contactProduit.telephone}`}>{contactProduit.telephone}</a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Email</div>
                <div className="text-strong">
                  {contactProduit?.email ? (
                    <a className="underline underline-offset-2" href={`mailto:${contactProduit.email}`}>{contactProduit.email}</a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer {deleteTarget?.type === 'produit' ? 'ce produit' : deleteTarget?.type === 'commande' ? 'cette commande' : 'cette injection'} ? Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Form for quick injection entry */}
        <section aria-labelledby="injection-form-section">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle id="injection-form-section" className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Syringe className="h-5 w-5 text-blue-600" />
                Enregistrer une injection
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <form onSubmit={handleSaveInjection} className="w-full md:max-w-4xl grid grid-cols-1 md:grid-cols-5 gap-4">
                <select className="border rounded-md px-3 py-2 w-full md:w-auto md:col-span-2 min-w-[220px] shadow-sm" value={injectionForm.produit_id || ""} onChange={(e) => setInjectionForm({ ...injectionForm, produit_id: e.target.value })} required>
                  <option value="">Sélectionner un produit</option>
                  {produits.map((p) => (
                    <option key={p.id} value={p.id}>{p.produit}</option>
                  ))}
                </select>
                <Input type="number" placeholder="Quantité" value={injectionForm.quantite ?? 1} onChange={(e) => setInjectionForm({ ...injectionForm, quantite: parseInt(e.target.value || "1") })} required className="shadow-sm" />
                <div className="flex items-center gap-2 md:col-span-2">
                  <Input type="date" placeholder="Date injection" value={injectionForm.date_injection || ""} onChange={(e) => setInjectionForm({ ...injectionForm, date_injection: e.target.value })} required className="shadow-sm" />
                  <Button type="submit" className="shadow-sm">Ajouter</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>


        {/* History section with improved layout */}
        <section aria-labelledby="historique-section">
          <div className="modern-table shadow-md hover:shadow-lg transition-shadow">
            <div className="space-y-4 p-6">
              {/* Stock table */}
              <div className="modern-table shadow-md hover:shadow-lg transition-shadow">
                <div className="px-6 py-3 border-b" style={{ borderBottomColor: 'hsl(var(--table-separator))' }}>
                  <h3 className="text-base font-semibold">Stocks par produit</h3>
                </div>
                <div className="overflow-x-auto">
                  <Table className="font-inter text-sm">
                    <TableHeader className="modern-table-header">
                      <TableRow>
                          <TableHead className="modern-table-header-cell">Produit</TableHead>
                          <TableHead className="modern-table-header-cell hidden md:table-cell">Fabricant</TableHead>
                          <TableHead className="modern-table-header-cell text-center">Seuil alerte</TableHead>
                          <TableHead className="modern-table-header-cell text-center">Stock cible</TableHead>
                          <TableHead className="modern-table-header-cell text-center">Moy. inj/mois (3m)</TableHead>
                          <TableHead className="modern-table-header-cell text-center">Stock</TableHead>
                          <TableHead className="modern-table-header-cell text-center">Commande en cours</TableHead>
                          <TableHead className="modern-table-header-cell text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!loading && produits
                          .slice()
                          .sort((a, b) => (moyenneInjections3Mois[b.id] ?? 0) - (moyenneInjections3Mois[a.id] ?? 0))
                          .map((p) => {
                            const stock = stockParProduit[p.id] ?? 0;
                            const seuil = p.seuil_alerte ?? 0;
                            const below = seuil > 0 && stock <= seuil;
                            const commandeEnCours = commandeEnCoursParProduit[p.id] ?? 0;
                            return (
                              <TableRow key={p.id} className="modern-table-row">
                                <TableCell className="modern-table-cell font-medium">{p.produit}</TableCell>
                                <TableCell className="modern-table-cell text-muted-foreground hidden md:table-cell">{p.fabricant}</TableCell>
                                <TableCell className="modern-table-cell text-center text-muted-foreground">{seuil}</TableCell>
                                <TableCell className="modern-table-cell text-center text-muted-foreground">{p.stock_cible ?? 0}</TableCell>
                                <TableCell className="modern-table-cell text-center text-muted-foreground">{(moyenneInjections3Mois[p.id] ?? 0).toFixed(1)}</TableCell>
                                <TableCell className="modern-table-cell text-center">
                                  <div className="inline-flex items-center gap-2">
                                    {stock > 0 && (
                                      <span className={below ? 'text-danger-strong font-semibold' : 'font-medium'}>{stock}</span>
                                    )}
                                    {stock === 0 && (
                                      <span className="inline-flex items-center rounded-full bg-danger-soft text-danger-strong px-2 py-0.5 text-xs font-medium">
                                        Rupture
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="modern-table-cell text-center">
                                  {commandeEnCours > 0 ? (
                                    <span className="text-foreground font-medium">{commandeEnCours}</span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="modern-table-cell text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => { setContactProduit(p); setOpenContact(true); }} aria-label="Contacts" className="shadow-sm hover:shadow-md transition-shadow">
                                      <Phone className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleEditProduit(p)} aria-label="Modifier" className="shadow-sm hover:shadow-md transition-shadow">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => requestDelete('produit', p.id, p.produit)} aria-label="Supprimer" className="shadow-sm hover:shadow-md transition-shadow">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                </div>
              </div>

              {/* Commands table */}
              <div className="modern-table shadow-md hover:shadow-lg transition-shadow">
                <div className="px-6 py-3 border-b" style={{ borderBottomColor: 'hsl(var(--table-separator))' }}>
                  <h3 className="text-base font-semibold">Commandes récentes</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <Table className="font-calibri text-sm">
                    <TableHeader className="modern-table-header sticky top-0">
                      <TableRow>
                            <TableHead className="modern-table-header-cell">Produit</TableHead>
                            <TableHead className="modern-table-header-cell">N°</TableHead>
                            <TableHead className="modern-table-header-cell">Qté cmd</TableHead>
                            <TableHead className="modern-table-header-cell">Qté reçue</TableHead>
                            <TableHead className="modern-table-header-cell">Date cmd</TableHead>
                            <TableHead className="modern-table-header-cell">Date réception</TableHead>
                            <TableHead className="modern-table-header-cell">Montant</TableHead>
                            <TableHead className="modern-table-header-cell">Date paiement</TableHead>
                            <TableHead className="modern-table-header-cell text-center">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                           {commandes
                             .slice()
                             .sort((a, b) => new Date(b.date_commande).getTime() - new Date(a.date_commande).getTime())
                             .slice(0, 8)
                             .map((c) => {
                               const prod = produits.find((p) => p.id === c.produit_id);
                               // Vérifier si la commande a des informations manquantes
                               const isIncomplete = !c.numero_commande || !c.date_reception || !c.montant || !c.date_paiement;
                               return (
                                   <TableRow 
                                     key={c.id} 
                                     className={`modern-table-row ${
                                       isIncomplete ? 'border-l-4 border-l-orange-300' : ''
                                     }`}
                                   >
                                   <TableCell className="modern-table-cell font-medium">{prod?.produit || ""}</TableCell>
                                   <TableCell className="modern-table-cell text-muted-foreground">{c.numero_commande}</TableCell>
                                   <TableCell className="modern-table-cell font-medium">{c.quantite_commande}</TableCell>
                                   <TableCell className="modern-table-cell">{c.quantite_recue ?? 0}</TableCell>
                                   <TableCell className="modern-table-cell text-muted-foreground">{formatDateShort(c.date_commande)}</TableCell>
                                   <TableCell className="modern-table-cell text-muted-foreground">{formatDateShort(c.date_reception)}</TableCell>
                                   <TableCell className="modern-table-cell font-medium">{c.montant ? `CHF ${Number(c.montant).toFixed(2)}` : "-"}</TableCell>
                                   <TableCell className="modern-table-cell text-muted-foreground">{formatDateShort(c.date_paiement)}</TableCell>
                                   <TableCell className="modern-table-cell text-center">
                                     <div className="flex items-center justify-center gap-1">
                                       <Button variant="ghost" size="icon" onClick={() => handleEditCommande(c)} aria-label="Modifier" className="shadow-sm hover:shadow-md transition-shadow">
                                         <Pencil className="h-4 w-4" />
                                       </Button>
                                       <Button variant="ghost" size="icon" onClick={() => requestDelete('commande', c.id)} aria-label="Supprimer" className="shadow-sm hover:shadow-md transition-shadow">
                                         <Trash2 className="h-4 w-4" />
                                       </Button>
                                     </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                  </div>
                </div>

                {/* Two column layout: Recent injections left, Chart right */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Injections table on the left */}
                  <div className="modern-table shadow-md hover:shadow-lg transition-shadow">
                    <div className="px-6 py-3 border-b" style={{ borderBottomColor: 'hsl(var(--table-separator))' }}>
                      <h3 className="text-base font-semibold">Injections récentes</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <Table className="font-calibri text-sm">
                        <TableHeader className="modern-table-header sticky top-0">
                          <TableRow>
                              <TableHead className="modern-table-header-cell">Produit</TableHead>
                              <TableHead className="modern-table-header-cell">Quantité</TableHead>
                              <TableHead className="modern-table-header-cell">Date</TableHead>
                              <TableHead className="modern-table-header-cell text-center">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {injections
                              .slice()
                              .sort((a, b) => new Date(b.date_injection).getTime() - new Date(a.date_injection).getTime())
                              .slice(0, 8)
                              .map((inj) => {
                                const prod = produits.find((p) => p.id === inj.produit_id);
                                return (
                                  <TableRow key={inj.id} className="modern-table-row">
                                    <TableCell className="modern-table-cell font-medium">{prod?.produit || ""}</TableCell>
                                    <TableCell className="modern-table-cell font-medium">{inj.quantite ?? 1}</TableCell>
                                    <TableCell className="modern-table-cell text-muted-foreground">{formatDateShort(inj.date_injection)}</TableCell>
                                    <TableCell className="modern-table-cell text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditInjection(inj)} aria-label="Modifier" className="shadow-sm hover:shadow-md transition-shadow">
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => requestDelete('injection', inj.id)} aria-label="Supprimer" className="shadow-sm hover:shadow-md transition-shadow">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                    </div>
                  </div>

                  {/* Chart section on the right */}
                  <div className="modern-table shadow-md hover:shadow-lg transition-shadow">
                    <div className="px-6 py-3 border-b" style={{ borderBottomColor: 'hsl(var(--table-separator))' }}>
                      <h3 className="text-base font-semibold">Tendance des injections - 6 derniers mois</h3>
                    </div>
                    <div className="p-6 pt-8 flex items-center justify-start">
                      <div className="h-64 w-full flex items-center justify-start">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthsData}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis 
                              dataKey="month" 
                              tick={{ fontSize: 12 }}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px'
                              }}
                            />
                            <Legend />
                            {(() => {
                              const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316'];
                              const products = Object.keys(monthsData[0] || {}).filter(key => key !== 'month');
                              return products.slice(0, 6).map((product, index) => (
                                <Line
                                  key={product}
                                  type="monotone"
                                  dataKey={product}
                                  stroke={colors[index % colors.length]}
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  activeDot={{ r: 5 }}
                                />
                              ));
                            })()}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </section>
      </main>
    </>
  );
};

export default GestionStock;
