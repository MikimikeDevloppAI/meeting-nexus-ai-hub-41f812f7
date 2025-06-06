
export function createTasksPrompt(participantNames: string, cleanedTranscript: string): string {
  return `Basé sur ce transcript de réunion, identifie TOUTES les tâches, actions et suivis mentionnés ou impliqués, sans exception.

Participants de la réunion : ${participantNames}

**RÈGLES D'EXTRACTION EXHAUSTIVE:**
- Extrais CHAQUE action, décision, tâche ou suivi mentionné dans le transcript
- Inclus les actions implicites (ex: "on doit faire X" = tâche à créer)
- Inclus les suivis (ex: "vérifier que Y fonctionne" = tâche de suivi)
- Inclus les contacts à faire (ex: "contacter Z" = tâche de contact)
- Inclus les demandes d'informations (ex: "demander des infos sur A" = tâche)
- Ne rate AUCUNE action même si elle semble mineure

**RÈGLES D'ASSIGNATION STRICTES:**
- Assigne une tâche à un participant SEULEMENT si c'est explicitement mentionné ou clairement déductible
- Utilise les noms EXACTS des participants : ${participantNames}
- Si une personne dit "je vais faire X" ou "je peux m'occuper de Y" → assigne à cette personne
- Si quelqu'un demande à une autre personne de faire quelque chose → assigne à la personne désignée
- Recherche les variations de noms (prénom seul, nom seul, diminutifs)
- Si aucune assignation claire, laisse "assignedTo" à null

**RÈGLES DE CONTEXTE ET CLARTÉ:**
- Inclus TOUJOURS assez de contexte pour que la tâche soit compréhensible
- Mentionne pourquoi, pour qui, quand (si mentionné), quel objectif
- Inclus les détails importants mentionnés dans la discussion
- Garde les tâches spécifiques et actionnables

**EXEMPLES D'ASSIGNATION:**
- "David, tu peux contacter le prestataire ?" → assignedTo: "David Tabibian"
- "Émilie s'occupera des invitations" → assignedTo: "emilie" 
- "Leïla va vérifier les emails" → assignedTo: "leila"
- "Il faut quelqu'un pour..." → assignedTo: null

Transcript :
${cleanedTranscript}

IMPORTANT: Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "tasks": [
    {
      "description": "Description précise et contextuelle de la tâche avec tous les détails nécessaires",
      "assignedTo": "Nom exact du participant tel qu'il apparaît dans la liste ou null"
    }
  ]
}`;
}
