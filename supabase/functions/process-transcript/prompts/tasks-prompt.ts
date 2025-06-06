
export function createTasksPrompt(participantNames: string, cleanedTranscript: string): string {
  return `Basé sur ce transcript de réunion, identifie et REGROUPE INTELLIGEMMENT toutes les tâches, actions et suivis par SUJETS COHÉRENTS pour éviter les doublons et minimiser le nombre de tâches.

Participants de la réunion : ${participantNames}

**RÈGLES DE REGROUPEMENT OBLIGATOIRES:**
- Regroupe toutes les actions liées au MÊME SUJET en UNE SEULE tâche concise
- Une tâche = un sujet principal avec l'essentiel seulement
- Évite absolument les doublons (ex: "contacter X" et "appeler X" = 1 seule tâche)
- Regroupe les actions séquentielles (ex: "demander devis" + "comparer prix" = 1 tâche "Obtenir devis pour X")
- Maximum 8-10 tâches au total, même pour de longues réunions

**RÈGLES DE CONCISION AVEC CONTEXTE:**
- Description COURTE et PRÉCISE avec contexte essentiel
- Inclus SEULEMENT l'action principale + le contexte nécessaire
- Supprime les noms des participants (ils seront assignés automatiquement)
- Focus sur QUOI faire, pas QUI le fait
- Maximum 1 phrase courte avec contexte essentiel
- Assez de détails pour comprendre l'action sans être verbeux

**EXEMPLES DE BONNES TÂCHES CONCISES:**
✅ "Installer fontaine à eau : contacter prestataires et obtenir devis"
✅ "Organiser visite foyer Valon - 22 mai 14h"  
✅ "Demander porte coulissante back-office/cuisine à la régie"
✅ "Réparer imprimante bureau : contacter technicien maintenance"

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
      "description": "Action principale + contexte essentiel en 1 phrase courte",
      "assignedTo": "Nom exact du participant tel qu'il apparaît dans la liste ou null"
    }
  ]
}`;
}
