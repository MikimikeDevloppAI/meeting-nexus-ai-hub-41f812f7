
export function createTasksPrompt(participantNames: string, cleanedTranscript: string): string {
  return `Basé sur ce transcript de réunion, identifie et REGROUPE INTELLIGEMMENT toutes les tâches, actions et suivis par SUJETS COHÉRENTS pour éviter les doublons et minimiser le nombre de tâches.

Participants de la réunion : ${participantNames}

**RÈGLES DE REGROUPEMENT OBLIGATOIRES:**
- Regroupe toutes les actions liées au MÊME SUJET en UNE SEULE tâche détaillée
- Une tâche = un sujet principal avec toutes ses sous-actions
- Évite absolument les doublons (ex: "contacter X" et "appeler X" = 1 seule tâche)
- Regroupe les actions séquentielles (ex: "demander devis" + "comparer prix" = 1 tâche "Obtenir et comparer devis pour X")
- Maximum 8-10 tâches au total, même pour de longues réunions

**RÈGLES DE CONTEXTUALISATION:**
- Inclus TOUS les détails mentionnés : pourquoi, pour qui, quand, objectif, contraintes
- Mentionne les décisions prises et le contexte de discussion
- Inclus les références aux personnes/entreprises mentionnées
- Ajoute assez de contexte pour que ce soit clair plusieurs jours plus tard
- Reste concis mais informatif

**EXEMPLES DE REGROUPEMENT:**
❌ Mauvais (doublons):
- "Contacter prestataire fontaine"  
- "Demander devis fontaine"
- "Voir options entretien fontaine"

✅ Bon (regroupé):
- "Gérer l'installation de la fontaine à eau : contacter prestataires, demander devis détaillés, comparer options d'entretien (suite discussion problèmes hydratation patients)"

**RÈGLES D'ASSIGNATION STRICTES:**
- Assigne SEULEMENT si explicitement mentionné ou clairement déductible
- Utilise les noms EXACTS : ${participantNames}
- Si une personne dit "je vais faire X" → assigne à cette personne
- Si plusieurs personnes impliquées dans le même sujet → assigne à la personne principale ou null
- Si aucune assignation claire, laisse "assignedTo" à null

**EXEMPLES D'ASSIGNATION:**
- "David, tu peux t'occuper de toute la partie fontaine ?" → assignedTo: "David Tabibian"
- "Émilie et moi on va voir pour les invitations" → assignedTo: "emilie" (personne principale)
- "Il faut que quelqu'un..." → assignedTo: null

Transcript :
${cleanedTranscript}

IMPORTANT: Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "tasks": [
    {
      "description": "Description détaillée et contextuelle regroupant toutes les actions du même sujet avec tous les détails nécessaires pour comprendre sans relire le transcript",
      "assignedTo": "Nom exact du participant tel qu'il apparaît dans la liste ou null"
    }
  ]
}`;
}
