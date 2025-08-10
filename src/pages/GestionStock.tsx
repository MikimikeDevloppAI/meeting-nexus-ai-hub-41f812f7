import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
};

const SEO = () => {
  useEffect(() => {
    const title = "Gestion du stock | OphtaCare Hub";
    const desc = "Gestion du stock des produits d'injection: produits, commandes et injections";

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
  });

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

  const stockParProduit = useMemo(() => {
    const recu: Record<string, number> = {};
    const consomme: Record<string, number> = {};
    commandes.forEach((c) => {
      const q = Number(c.quantite_recue || 0);
      recu[c.produit_id] = (recu[c.produit_id] || 0) + (isNaN(q) ? 0 : q);
    });
    injections.forEach((inj) => {
      consomme[inj.produit_id] = (consomme[inj.produit_id] || 0) + 1;
    });
    const out: Record<string, number> = {};
    produits.forEach((p) => {
      out[p.id] = (recu[p.id] || 0) - (consomme[p.id] || 0);
    });
    return out;
  }, [commandes, injections, produits]);

  const resetProduitForm = () => {
    setEditingId(null);
    setProduitForm({ produit: "", molecule: "", fabricant: "", concentration: "", presentation: "", prix_patient: undefined, prix_achat: undefined, representant: "", telephone: "", email: "", seuil_alerte: 0 });
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
      });
    }
    await fetchAll();
    resetProduitForm();
  };

  const handleEditProduit = (p: Produit) => {
    setEditingId(p.id);
    setProduitForm(p);
  };

  const handleSaveCommande = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandeForm.produit_id) return;
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
    await fetchAll();
    setCommandeForm({ produit_id: "", quantite_commande: 0, date_commande: new Date().toISOString().slice(0, 10), quantite_recue: 0 });
  };

  const handleSaveInjection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!injectionForm.produit_id) return;
    await sb.from("injection").insert({
      produit_id: injectionForm.produit_id,
      date_injection: injectionForm.date_injection,
    });
    await fetchAll();
    setInjectionForm({ produit_id: "", date_injection: new Date().toISOString().slice(0, 10) });
  };

  return (
    <>
      <SEO />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Gestion du stock</h1>
        <p className="text-muted-foreground">Suivi des produits, commandes et injections</p>
      </header>
      <main className="mt-6 space-y-10">
        <section aria-labelledby="stock-section">
          <h2 id="stock-section" className="text-xl font-medium">Stocks par produit</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Molécule</TableHead>
                <TableHead>Fabricant</TableHead>
                <TableHead>Seuil alerte</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && produits.map((p) => {
                const stock = stockParProduit[p.id] ?? 0;
                const below = (p.seuil_alerte ?? 0) > 0 && stock <= (p.seuil_alerte ?? 0);
                return (
                  <TableRow key={p.id} className={below ? "bg-red-50" : undefined}>
                    <TableCell>{p.produit}</TableCell>
                    <TableCell>{p.molecule}</TableCell>
                    <TableCell>{p.fabricant}</TableCell>
                    <TableCell>{p.seuil_alerte ?? 0}</TableCell>
                    <TableCell>{stock}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleEditProduit(p)}>Modifier</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableCaption>Stock calculé = quantité reçue - nombre d'injections</TableCaption>
          </Table>
        </section>

        <section aria-labelledby="produit-form-section">
          <h2 id="produit-form-section" className="text-xl font-medium">{editingId ? "Modifier un produit" : "Ajouter un produit"}</h2>
          <form onSubmit={handleSaveProduit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder="Produit" value={produitForm.produit || ""} onChange={(e) => setProduitForm({ ...produitForm, produit: e.target.value })} required />
            <Input placeholder="Molécule" value={produitForm.molecule || ""} onChange={(e) => setProduitForm({ ...produitForm, molecule: e.target.value })} />
            <Input placeholder="Fabricant" value={produitForm.fabricant || ""} onChange={(e) => setProduitForm({ ...produitForm, fabricant: e.target.value })} />
            <Input placeholder="Concentration" value={produitForm.concentration || ""} onChange={(e) => setProduitForm({ ...produitForm, concentration: e.target.value })} />
            <Input placeholder="Présentation" value={produitForm.presentation || ""} onChange={(e) => setProduitForm({ ...produitForm, presentation: e.target.value })} />
            <Input type="number" step="0.01" placeholder="Prix patient" value={produitForm.prix_patient ?? ""} onChange={(e) => setProduitForm({ ...produitForm, prix_patient: parseFloat(e.target.value) })} />
            <Input type="number" step="0.01" placeholder="Prix d'achat" value={produitForm.prix_achat ?? ""} onChange={(e) => setProduitForm({ ...produitForm, prix_achat: parseFloat(e.target.value) })} />
            <Input placeholder="Représentant" value={produitForm.representant || ""} onChange={(e) => setProduitForm({ ...produitForm, representant: e.target.value })} />
            <Input placeholder="Téléphone" value={produitForm.telephone || ""} onChange={(e) => setProduitForm({ ...produitForm, telephone: e.target.value })} />
            <Input type="email" placeholder="Email" value={produitForm.email || ""} onChange={(e) => setProduitForm({ ...produitForm, email: e.target.value })} />
            <Input type="number" placeholder="Seuil d'alerte" value={produitForm.seuil_alerte ?? 0} onChange={(e) => setProduitForm({ ...produitForm, seuil_alerte: parseInt(e.target.value || "0") })} />
            <div className="flex items-center gap-2">
              <Button type="submit">{editingId ? "Enregistrer" : "Ajouter"}</Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetProduitForm}>Annuler</Button>
              )}
            </div>
          </form>
        </section>

        <section aria-labelledby="commande-form-section">
          <h2 id="commande-form-section" className="text-xl font-medium">Enregistrer une commande</h2>
          <form onSubmit={handleSaveCommande} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select className="border rounded-md px-3 py-2" value={commandeForm.produit_id || ""} onChange={(e) => setCommandeForm({ ...commandeForm, produit_id: e.target.value })} required>
              <option value="">Sélectionner un produit</option>
              {produits.map((p) => (
                <option key={p.id} value={p.id}>{p.produit}</option>
              ))}
            </select>
            <Input placeholder="Numéro de commande" value={commandeForm.numero_commande || ""} onChange={(e) => setCommandeForm({ ...commandeForm, numero_commande: e.target.value })} />
            <Input type="number" placeholder="Quantité commandée" value={commandeForm.quantite_commande ?? 0} onChange={(e) => setCommandeForm({ ...commandeForm, quantite_commande: parseInt(e.target.value || "0") })} required />
            <Input type="date" placeholder="Date commande" value={commandeForm.date_commande || ""} onChange={(e) => setCommandeForm({ ...commandeForm, date_commande: e.target.value })} required />
            <Input type="number" placeholder="Quantité reçue" value={commandeForm.quantite_recue ?? 0} onChange={(e) => setCommandeForm({ ...commandeForm, quantite_recue: parseInt(e.target.value || "0") })} />
            <Input type="date" placeholder="Date réception" value={commandeForm.date_reception || ""} onChange={(e) => setCommandeForm({ ...commandeForm, date_reception: e.target.value })} />
            <Input type="number" step="0.01" placeholder="Montant" value={commandeForm.montant ?? ""} onChange={(e) => setCommandeForm({ ...commandeForm, montant: parseFloat(e.target.value) })} />
            <Input type="date" placeholder="Date paiement" value={commandeForm.date_paiement || ""} onChange={(e) => setCommandeForm({ ...commandeForm, date_paiement: e.target.value })} />
            <div className="flex items-center">
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </section>

        <section aria-labelledby="injection-form-section">
          <h2 id="injection-form-section" className="text-xl font-medium">Enregistrer une injection</h2>
          <form onSubmit={handleSaveInjection} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select className="border rounded-md px-3 py-2" value={injectionForm.produit_id || ""} onChange={(e) => setInjectionForm({ ...injectionForm, produit_id: e.target.value })} required>
              <option value="">Sélectionner un produit</option>
              {produits.map((p) => (
                <option key={p.id} value={p.id}>{p.produit}</option>
              ))}
            </select>
            <Input type="date" placeholder="Date injection" value={injectionForm.date_injection || ""} onChange={(e) => setInjectionForm({ ...injectionForm, date_injection: e.target.value })} required />
            <div className="flex items-center">
              <Button type="submit">Ajouter</Button>
            </div>
          </form>
        </section>

        <section aria-labelledby="historique-section">
          <h2 id="historique-section" className="text-xl font-medium">Historique</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Commandes récentes</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>N°</TableHead>
                    <TableHead>Qté cmd</TableHead>
                    <TableHead>Qté reçue</TableHead>
                    <TableHead>Date cmd</TableHead>
                    <TableHead>Date réception</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commandes.slice().reverse().slice(0, 10).map((c) => {
                    const prod = produits.find((p) => p.id === c.produit_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>{prod?.produit || ""}</TableCell>
                        <TableCell>{c.numero_commande || "-"}</TableCell>
                        <TableCell>{c.quantite_commande}</TableCell>
                        <TableCell>{c.quantite_recue ?? 0}</TableCell>
                        <TableCell>{c.date_commande}</TableCell>
                        <TableCell>{c.date_reception || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div>
              <h3 className="font-medium mb-2">Injections récentes</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {injections.slice().reverse().slice(0, 10).map((inj) => {
                    const prod = produits.find((p) => p.id === inj.produit_id);
                    return (
                      <TableRow key={inj.id}>
                        <TableCell>{prod?.produit || ""}</TableCell>
                        <TableCell>{inj.date_injection}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default GestionStock;
