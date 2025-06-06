
export function createTasksPrompt(participantNames: string, cleanedTranscript: string): string {
  return `Basé sur ce transcript de réunion, identifie TOUTES les tâches, actions et suivis mentionnés ou impliqués.

Participants de la réunion : ${participantNames}

**RÈGLES D'ASSIGNATION STRICTES:**
- Assigne une tâche à un participant SEULEMENT si c'est explicitement mentionné ou clairement déductible du contexte
- Utilise les noms EXACTS des participants tels qu'ils apparaissent dans la liste : ${participantNames}
- Si aucune assignation claire n'est possible, laisse "assignedTo" à null
- Pour l'assignation, utilise le nom complet du participant tel qu'il apparaît dans la liste
- Exemples d'assignations valides : si les participants sont "Jean Dupont, Marie Martin", utilise exactement "Jean Dupont" ou "Marie Martin"

**RÈGLES DE REGROUPEMENT POUR MINIMISER LES TÂCHES:**
- REGROUPE les tâches similaires par sujet, fournisseur, ou domaine
- Une seule tâche pour un même fournisseur (ex: "Contacter Infomaniak pour configuration email ET support technique")
- Une seule tâche par domaine thématique (ex: "Organiser formation : réservation salle + matériel + participants")
- Une seule tâche pour des actions liées au même projet (ex: "Site web : choisir prestataire + définir budget + planning")
- Privilégier les tâches globales avec sous-actions plutôt que des tâches séparées

**RÈGLES DE CONTEXTE ET CLARTÉ:**
- Inclus TOUJOURS assez de contexte pour que la tâche soit compréhensible sans relire le transcript
- Mentionne les éléments clés : pourquoi, pour qui, quand (si mentionné), quel objectif
- Reste concis mais informatif (évite les phrases trop longues)
- Inclus les détails importants mentionnés dans la discussion

**EXEMPLES DE BON REGROUPEMENT AVEC ASSIGNATION:**
- Au lieu de : "Contacter Infomaniak", "Configurer SMTP", "Tester email" 
- Faire : { "description": "Configuration complète email professionnel Infomaniak : contacter commercial pour devis + configurer SMTP sur serveur + tester envoi emails patients", "assignedTo": "Jean Dupont" }
- Au lieu de : "Réserver salle", "Commander matériel", "Inviter participants"
- Faire : { "description": "Organisation formation staff ophtalmologie : réserver salle pour 15 personnes + commander matériel pédagogique + envoyer invitations avec programme", "assignedTo": "Marie Martin" }

Transcript :
${cleanedTranscript}

IMPORTANT: Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "tasks": [
    {
      "description": "Description précise et contextuelle de la tâche REGROUPÉE avec toutes les sous-actions",
      "assignedTo": "Nom exact du participant tel qu'il apparaît dans la liste ou null"
    }
  ]
}`;
}
