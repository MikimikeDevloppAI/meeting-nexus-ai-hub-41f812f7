
export function createTasksPrompt(participantNames: string, cleanedTranscript: string): string {
  return `Basé sur ce transcript de réunion, identifie et REGROUPE INTELLIGEMMENT toutes les tâches, actions et suivis par SUJETS COHÉRENTS pour éviter les doublons. Privilégie le regroupement pour minimiser le nombre de tâches.

Participants de la réunion : ${participantNames}

**RÈGLES DE REGROUPEMENT OBLIGATOIRES:**
- Regroupe toutes les actions liées au MÊME SUJET/FOURNISSEUR/OUTIL en UNE SEULE tâche
- Une tâche = un sujet principal avec TOUT le contexte nécessaire
- Évite absolument les doublons (ex: "contacter X" et "appeler X" = 1 seule tâche)
- Regroupe les actions séquentielles (ex: "demander devis" + "comparer prix" + "négocier" = 1 tâche complète)
- Privilégie les macro-tâches sur les micro-actions

**RÈGLES DE CONTEXTE ENRICHI:**
- Inclus TOUT le contexte nécessaire pour comprendre et exécuter la tâche
- Mentionne les détails techniques, budgétaires ou logistiques discutés
- Inclus les raisons/motivations derrière chaque action
- Spécifie les délais, échéances ou priorités mentionnées
- Sois concis mais avec tout le contexte nécessaire pour être autonome

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
      "description": "Action principale + contexte complet concis mais détaillé",
      "assignedTo": "Nom exact du participant tel qu'il apparaît dans la liste ou null"
    }
  ]
}`;
}
