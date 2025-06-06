
export function createTasksPrompt(participantNames: string, cleanedTranscript: string): string {
  return `Basé sur ce transcript de réunion, identifie et REGROUPE INTELLIGEMMENT toutes les tâches, actions et suivis par SUJETS COHÉRENTS pour éviter les doublons et minimiser le nombre de tâches.

Participants de la réunion : ${participantNames}

**RÈGLES DE REGROUPEMENT OBLIGATOIRES:**
- Regroupe toutes les actions liées au MÊME SUJET/FOURNISSEUR/OUTIL en UNE SEULE tâche
- Une tâche = un sujet principal avec TOUT le contexte nécessaire
- Évite absolument les doublons (ex: "contacter X" et "appeler X" = 1 seule tâche)
- Regroupe les actions séquentielles (ex: "demander devis" + "comparer prix" + "négocier" = 1 tâche complète)
- Maximum 6-8 tâches au total pour éviter la fragmentation

**RÈGLES DE CONTEXTE ENRICHI:**
- Inclus TOUT le contexte nécessaire : dates, lieux, contraintes, objectifs
- Mentionne les détails techniques, budgétaires ou logistiques discutés
- Inclus les raisons/motivations derrière chaque action
- Spécifie les délais, échéances ou priorités mentionnées
- 2-3 phrases avec contexte complet pour être autonome

**EXEMPLES DE BONNES TÂCHES CONTEXTUALISÉES:**
✅ "Organiser installation fontaine à eau au bureau : contacter 3 prestataires pour devis installation + contrat maintenance, comparer coûts, négocier prix sans frais d'entretien si possible, prévoir budget 500-800€, installation prévue avant fin juin"
✅ "Coordonner visite foyer Valon + CIR le 22 mai 14h : confirmer présence tous participants, préparer questions sur infrastructure réseau, organiser transport collectif, prévoir documentation technique pour audit sécurité"
✅ "Résoudre problème porte coulissante back-office/cuisine : contacter régie pour réparation urgente, vérifier garantie, prévoir solution temporaire si délais longs, budget maintenance 200-300€"

**RÈGLES D'ASSIGNATION STRICTES:**
- Assigne SEULEMENT si explicitement mentionné ou clairement déductible
- Utilise les noms EXACTS : ${participantNames}
- Si une personne dit "je vais faire X" → assigne à cette personne
- Si plusieurs personnes impliquées → assigne à la personne principale ou null
- Si aucune assignation claire, laisse "assignedTo" à null

Transcript :
${cleanedTranscript}

IMPORTANT: Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "tasks": [
    {
      "description": "Action principale + contexte complet en 2-3 phrases détaillées",
      "assignedTo": "Nom exact du participant tel qu'il apparaît dans la liste ou null"
    }
  ]
}`;
}
