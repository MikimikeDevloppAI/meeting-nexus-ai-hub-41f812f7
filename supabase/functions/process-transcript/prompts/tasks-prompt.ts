
export function createTasksPrompt(participantNames: string, cleanedTranscript: string): string {
  return `Basé sur ce transcript de réunion, identifie et REGROUPE INTELLIGEMMENT toutes les tâches, actions et suivis par SUJETS COHÉRENTS pour éviter les doublons. Privilégie le regroupement pour minimiser le nombre de tâches.

Participants disponibles dans le système : ${participantNames}

**RÈGLES DE REGROUPEMENT OBLIGATOIRES:**
- Regroupe toutes les actions liées au MÊME SUJET/FOURNISSEUR/OUTIL en UNE SEULE tâche
- Une tâche = un sujet principal avec un contexte CONCIS et ACTIONNABLE
- Évite absolument les doublons (ex: "contacter X" et "appeler X" = 1 seule tâche)
- Regroupe les actions séquentielles (ex: "demander devis" + "comparer prix" + "négocier" = 1 tâche complète)
- Privilégie les macro-tâches sur les micro-actions

**RÈGLES DE DESCRIPTION CONCISE:**
- Maximum 100 caractères par description
- Utilise un verbe d'action clair (Contacter, Organiser, Vérifier, Finaliser, etc.)
- Inclus seulement les détails ESSENTIELS
- Format: "Action + Objet + Contexte minimal"
- Exemples: "Contacter Fischer pour intervention du 3 avril", "Organiser planning congés cabinet été"

**RÈGLES D'ASSIGNATION STRICTES:**
- Utilise SEULEMENT les noms EXACTS de cette liste : ${participantNames}
- Variantes acceptées pour correspondance :
  • Leïla / leila / Leila
  • Émilie / emilie / Emilie  
  • David / david / David Tabibian / Tabibian
  • Parmice / parmice / Parmis
  • Sybil / sybil
- Si une personne dit "je vais faire X" → assigne à cette personne
- Si plusieurs personnes impliquées → assigne à la personne principale
- Si aucune assignation claire, laisse "assigned_to" à null
- Tu peux assigner à N'IMPORTE QUEL participant de la liste, même s'il n'était pas présent à la réunion

Transcript :
${cleanedTranscript}

IMPORTANT: Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "tasks": [
    {
      "description": "Action concise et claire avec contexte minimal",
      "assigned_to": ["Nom exact du participant tel qu'il apparaît dans la liste"] ou null
    }
  ]
}`;
}
