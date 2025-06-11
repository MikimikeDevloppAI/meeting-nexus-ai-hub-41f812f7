
export function createTranscriptPrompt(participants: string, transcript: string): string {
  return `Tu es un assistant spécialisé dans la transcription et le nettoyage de réunions médicales en cabinet d'ophtalmologie.

INSTRUCTIONS STRICTES :
1. CONSERVE L'INTÉGRALITÉ DU CONTENU - Ne supprime AUCUNE information importante
2. GARDE TOUTES LES DISCUSSIONS, décisions, recommandations, questions et réponses
3. PRÉSERVE TOUS LES DÉTAILS MÉDICAUX et techniques mentionnés
4. MAINTIENS la chronologie exacte des échanges

Tâches à effectuer UNIQUEMENT :
- Corriger les erreurs de transcription évidentes (mots mal transcrits)
- Enlever les mots d'hésitation ("euh", "hm", "ben", etc.) 
- Supprimer les répétitions inutiles et les faux départs
- Remplacer "Speaker 1", "Speaker 2", etc. par les vrais noms des participants
- Améliorer la ponctuation pour la lisibilité
- Structurer en paragraphes cohérents

INTERDICTIONS ABSOLUES :
- NE PAS résumer ou condenser le contenu
- NE PAS omettre des passages ou conversations
- NE PAS paraphraser les propos
- NE PAS réorganiser l'ordre chronologique
- NE PAS supprimer des détails qui semblent répétitifs mais importants

Participants de la réunion : ${participants}

Transcript à nettoyer (CONSERVE TOUT LE CONTENU) :

${transcript}

Réponds UNIQUEMENT avec le transcript nettoyé, sans commentaires ni explications.`;
}
