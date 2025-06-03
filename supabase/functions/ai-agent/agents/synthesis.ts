
export class SynthesisAgent {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  async synthesizeResponse(
    originalQuery: string,
    conversationHistory: any[],
    databaseContext: any,
    embeddingContext: any,
    internetContext: any
  ): Promise<string> {
    console.log('[SYNTHESIS] Creating comprehensive response');

    // Construire le contexte de conversation
    let conversationContextText = '';
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContextText = `\n\n**💬 HISTORIQUE DE LA CONVERSATION (${conversationHistory.length} derniers messages):**\n${
        conversationHistory.map((msg, index) => 
          `${index + 1}. [${msg.isUser ? 'UTILISATEUR' : 'ASSISTANT'}] ${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}`
        ).join('\n')
      }\n\n`;
    }

    // Construire le contexte des embeddings
    let embeddingContextText = '';
    if (embeddingContext.hasRelevantContext && embeddingContext.chunks.length > 0) {
      embeddingContextText = `\n\n**🎯 DOCUMENTS PERTINENTS OPHTACARE (PRIORITÉ ABSOLUE):**\n${
        embeddingContext.chunks.map((result: any) => 
          `Document: ${result.metadata?.title || result.document_type}\nContenu: ${result.chunk_text}`
        ).join('\n\n')
      }`;
    }

    // Construire le contexte de la base de données
    let databaseContextText = '';
    if (databaseContext.meetings && databaseContext.meetings.length > 0) {
      databaseContextText += `\n\n**📋 TRANSCRIPTS DES RÉUNIONS OPHTACARE:**\n${
        databaseContext.meetings.map((m: any) => 
          `Réunion: ${m.title} (${new Date(m.created_at).toLocaleDateString()})\n${
            m.transcript ? `Transcript: ${m.transcript.substring(0, 1000)}...` : `Résumé: ${m.summary || 'Pas de résumé'}`
          }`
        ).join('\n\n')
      }\n\n`;
    }

    if (databaseContext.documents && databaseContext.documents.length > 0) {
      databaseContextText += `\n\n**📁 DOCUMENTS OPHTACARE:**\n${
        databaseContext.documents.map((d: any) => 
          `Document: ${d.ai_generated_name || d.original_name}\nTexte: ${
            d.extracted_text ? d.extracted_text.substring(0, 1000) + '...' : 'Pas de texte extrait'
          }`
        ).join('\n\n')
      }\n\n`;
    }

    if (databaseContext.todos && databaseContext.todos.length > 0) {
      databaseContextText += `\n\n**✅ TÂCHES OPHTACARE:**\n${
        databaseContext.todos.map((t: any) => 
          `- [${t.status}] ${t.description}${t.due_date ? ` (échéance: ${new Date(t.due_date).toLocaleDateString()})` : ''}`
        ).join('\n')
      }\n\n`;
    }

    // Construire le contexte internet
    let internetContextText = '';
    if (internetContext.hasContent) {
      internetContextText = `\n\n**🌐 INFORMATIONS RÉCENTES (ENRICHISSEMENT):**\n${internetContext.content}`;
    }

    const systemPrompt = `Tu es l'assistant IA du cabinet d'ophtalmologie OphtaCare du Dr Tabibian. Tu es spécialisé dans l'assistance pour ce cabinet médical spécifique.

🏥 **CONTEXTE OPHTACARE :**
Tu travailles pour OphtaCare, cabinet d'ophtalmologie dirigé par le Dr Tabibian. Tu as accès à toutes les données internes du cabinet et tu dois prioritairement utiliser ces informations.

📊 **SOURCES DISPONIBLES (par ordre de priorité) :**
1. **HISTORIQUE CONVERSATION** : Pour maintenir la continuité des échanges
2. **EMBEDDINGS OPHTACARE** : ${embeddingContext.hasRelevantContext ? `✅ ${embeddingContext.chunks.length} chunks trouvés` : '❌ Aucune information trouvée'}
3. **BASE DE DONNÉES OPHTACARE** : ${databaseContext.meetings?.length || 0} réunions, ${databaseContext.documents?.length || 0} documents, ${databaseContext.todos?.length || 0} tâches
4. **ENRICHISSEMENT INTERNET** : ${internetContext.hasContent ? '✅ Informations récentes disponibles' : '❌ Non utilisé'}

🎯 **RÈGLES STRICTES :**
- Utilise l'historique pour maintenir la continuité de la conversation
- Privilégie TOUJOURS les informations des embeddings OphtaCare si disponibles
- Complète avec les données de la base de données OphtaCare
- Utilise l'enrichissement internet pour contextualiser ou mettre à jour les informations
- Cite TOUJOURS tes sources en précisant leur origine (OphtaCare interne vs externe)
- Reste dans le contexte médical ophtalmologique
- Si tu veux créer/modifier/supprimer une tâche, utilise : [ACTION_TACHE: TYPE=create/update/delete/complete, DESCRIPTION="description", ASSIGNED_TO="nom_utilisateur", DUE_DATE="YYYY-MM-DD", ID="id_tache"]

**CONTEXTE DISPONIBLE :**${conversationContextText}${embeddingContextText}${databaseContextText}${internetContextText}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: originalQuery }
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI response');
      }

      const data = await response.json();
      const finalResponse = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';

      console.log('[SYNTHESIS] ✅ Response generated successfully');
      return finalResponse;

    } catch (error) {
      console.error('[SYNTHESIS] ❌ Error generating response:', error);
      return 'Désolé, je rencontre un problème technique pour synthétiser ma réponse.';
    }
  }
}
