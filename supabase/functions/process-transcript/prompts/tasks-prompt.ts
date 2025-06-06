
export function createTasksPrompt(participantNames: string, cleanedTranscript: string): string {
  return `Basé sur ce transcript de réunion, identifie et REGROUPE INTELLIGEMMENT toutes les tâches, actions et suivis par SUJETS COHÉRENTS pour éviter les doublons et minimiser le nombre de tâches.

Participants de la réunion : ${participantNames}

**RÈGLES DE REGROUPEMENT OBLIGATOIRES:**
- Regroupe toutes les actions liées au MÊME SUJET en UNE SEULE tâche concise
- Une tâche = un sujet principal avec l'essentiel seulement
- Évite absolument les doublons (ex: "contacter X" et "appeler X" = 1 seule tâche)
- Regroupe les actions séquentielles (ex: "demander devis" + "comparer prix" = 1 tâche "Obtenir devis pour X")
- Maximum 8-10 tâches au total, même pour de longues réunions

**RÈGLES DE CONCISION:**
- Description COURTE et CLAIRE (maximum 2 lignes)
- Inclus SEULEMENT l'essentiel : quoi, qui, quand si précis
- Supprime les détails de contexte excessifs
- Pas de phrases d'explication longues
- Focus sur l'ACTION principale

**EXEMPLES DE BONNES TÂCHES CONCISES:**
✅ "Installer fontaine à eau : contacter prestataires et obtenir devis (Leïla)"
✅ "Organiser visite foyer Valon - 22 mai 14h (Leïla informe participants)"
✅ "Demander porte coulissante back-office/cuisine à la régie (Leïla)"

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
      "description": "Description COURTE et CLAIRE de l'action principale (max 2 lignes)",
      "assignedTo": "Nom exact du participant tel qu'il apparaît dans la liste ou null"
    }
  ]
}`;
}
