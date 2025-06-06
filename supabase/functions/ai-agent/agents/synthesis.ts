
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
    internetContext: any,
    analysis: any,
    taskContext: any
  ): Promise<string> {
    console.log('[SYNTHESIS] 🧠 Synthèse SUPER-INTELLIGENTE OphtaCare');

    const contextSummary = this.buildIntelligentContextSummary(databaseContext, embeddingContext, internetContext, taskContext);
    const confidence = analysis.confidenceLevel || 0.7;
    
    let systemPrompt = `Tu es l'assistant IA SUPER-INTELLIGENT OphtaCare du Dr Tabibian, cabinet d'ophtalmologie à Genève.

MISSION INTELLIGENTE :
- Fournir des réponses précises basées sur les DONNÉES RÉELLES du cabinet
- Toujours contextualiser pour l'ophtalmologie genevoise (CHF, système suisse)
- Être capable de répondre MÊME si les données sont limitées
- Maintenir un niveau d'expertise médicale élevé

DONNÉES DISPONIBLES ACTUELLEMENT :
${contextSummary}

NIVEAU DE CONFIANCE : ${(confidence * 100).toFixed(0)}%

RÈGLES DE RÉPONSE INTELLIGENTE :
1. **PRIORITÉ AUX DONNÉES RÉELLES** - Utilise d'abord les données OphtaCare disponibles
2. **RÉPONSES COMPLÈTES** - Fournis toujours une réponse utile, même avec données limitées  
3. **CONTEXTE MÉDICAL** - Maintiens l'expertise ophtalmologique et le contexte genevois
4. **TRANSPARENCE** - Indique clairement si tu utilises des données internes ou des recommandations générales
5. **ACTIONS STRUCTURÉES** - Utilise la syntaxe [ACTION_TACHE:...] pour les tâches

SYNTAXE ACTIONS TÂCHES :
- [ACTION_TACHE:TYPE=create,description="Description précise",assigned_to="Nom personne"]
- [ACTION_TACHE:TYPE=update,id="ID",description="Nouvelle description"]
- [ACTION_TACHE:TYPE=complete,id="ID"]
- [ACTION_TACHE:TYPE=delete,id="ID"]

STYLE INTELLIGENT :
- Professionnel mais accessible
- Spécialisé ophtalmologie Genève
- Utilise les émojis médicaux appropriés : 👁️ 🏥 📋 💊 🔍
- Montre ta compréhension du contexte suisse`;

    // Enrichissement selon le type de requête
    if (analysis.queryType === 'meeting' && databaseContext.meetings?.length > 0) {
      systemPrompt += `\n\nCONTEXTE RÉUNIONS SPÉCIAL :
- ${databaseContext.meetings.length} réunion(s) trouvée(s) dans les données
- Utilise les informations réelles des transcripts pour répondre
- Sois précis sur les dates et contenus mentionnés`;
    }

    if (analysis.queryType === 'task') {
      systemPrompt += `\n\nCONTEXTE TÂCHES SPÉCIAL :
- L'utilisateur demande une gestion de tâches
- Génère l'action appropriée avec la syntaxe [ACTION_TACHE:...]
- Confirme l'action dans ta réponse`;
    }

    // Construction du contexte conversationnel intelligent
    const conversationContext = this.buildConversationContext(conversationHistory);
    
    // Construction du contexte de données enrichi
    const dataContext = this.buildDataContext(databaseContext, embeddingContext, internetContext);

    const userPrompt = `QUESTION UTILISATEUR : "${originalQuery}"

${conversationContext ? `CONTEXTE CONVERSATION :\n${conversationContext}\n` : ''}

${dataContext ? `DONNÉES OPHTACARE DISPONIBLES :\n${dataContext}\n` : ''}

${taskContext.hasTaskContext ? `
TÂCHES EN COURS (${taskContext.currentTasks.length}) :
${taskContext.currentTasks.slice(0, 10).map(task => `- ${task.description} (${task.status}) ${task.assigned_to ? `- Assigné: ${task.assigned_to}` : ''}`).join('\n')}
` : ''}

INSTRUCTIONS INTELLIGENTES :
- Réponds directement et complètement à la question
- Utilise PRIORITAIREMENT les données OphtaCare si disponibles
- Si données limitées, fournis quand même une réponse utile avec recommandations générales
- Maintiens le contexte ophtalmologique genevois
- Sois précis sur les sources utilisées (données internes vs conseils généraux)
- Génère les actions [ACTION_TACHE:...] si demandé
- TOUJOURS donner une réponse, même si elle est partielle`;

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
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1200, // Plus de tokens pour réponses complètes
        }),
      });

      const data = await response.json();
      let finalResponse = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu traiter votre demande.';

      // Enrichissement intelligent de la réponse
      finalResponse = this.enrichResponseWithContext(finalResponse, analysis, confidence, databaseContext, embeddingContext);

      console.log('[SYNTHESIS] ✅ Réponse super-intelligente générée');
      return finalResponse;

    } catch (error) {
      console.error('[SYNTHESIS] ❌ Erreur:', error);
      
      // Réponse de fallback intelligente même en cas d'erreur
      return this.generateIntelligentFallback(originalQuery, databaseContext, embeddingContext, taskContext);
    }
  }

  private buildIntelligentContextSummary(databaseContext: any, embeddingContext: any, internetContext: any, taskContext: any): string {
    const parts = [];

    if (taskContext.hasTaskContext) {
      parts.push(`📋 Tâches: ${taskContext.currentTasks.length} en cours`);
    }

    if (databaseContext.meetings?.length > 0) {
      parts.push(`🏥 Réunions: ${databaseContext.meetings.length} trouvées`);
    }

    if (databaseContext.documents?.length > 0) {
      parts.push(`📁 Documents: ${databaseContext.documents.length} disponibles`);
    }

    if (embeddingContext.hasRelevantContext) {
      parts.push(`🎯 Données vectorielles: ${embeddingContext.chunks.length} éléments pertinents`);
    }

    if (internetContext.hasContent) {
      parts.push(`🌐 Enrichissement: Informations complémentaires disponibles`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'Base de données OphtaCare disponible';
  }

  private buildConversationContext(conversationHistory: any[]): string {
    if (!conversationHistory || conversationHistory.length === 0) return '';
    
    const recentMessages = conversationHistory.slice(-6).map(msg => 
      `${msg.isUser ? '👤 Patient/Équipe' : '🤖 OphtaCare'}: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`
    );
    
    return recentMessages.join('\n');
  }

  private buildDataContext(databaseContext: any, embeddingContext: any, internetContext: any): string {
    const dataParts = [];

    // Contexte des réunions avec détails
    if (databaseContext.meetings?.length > 0) {
      dataParts.push(`\n🏥 RÉUNIONS TROUVÉES (${databaseContext.meetings.length}) :`);
      databaseContext.meetings.slice(0, 3).forEach((meeting: any, i: number) => {
        dataParts.push(`  ${i+1}. ${meeting.title} - ${meeting.created_at ? new Date(meeting.created_at).toLocaleDateString() : 'Date inconnue'}`);
        if (meeting.summary) {
          dataParts.push(`     Résumé: ${meeting.summary.substring(0, 200)}${meeting.summary.length > 200 ? '...' : ''}`);
        }
      });
    }

    // Contexte des chunks avec relevance
    if (embeddingContext.chunks?.length > 0) {
      dataParts.push(`\n🎯 CONTENU PERTINENT (${embeddingContext.chunks.length} éléments) :`);
      embeddingContext.chunks.slice(0, 3).forEach((chunk: any, i: number) => {
        dataParts.push(`  ${i+1}. ${chunk.chunk_text?.substring(0, 150)}${chunk.chunk_text?.length > 150 ? '...' : ''}`);
        if (chunk.similarity) {
          dataParts.push(`     (Pertinence: ${(chunk.similarity * 100).toFixed(0)}%)`);
        }
      });
    }

    // Contexte des documents
    if (databaseContext.documents?.length > 0) {
      dataParts.push(`\n📁 DOCUMENTS (${databaseContext.documents.length}) :`);
      databaseContext.documents.slice(0, 2).forEach((doc: any, i: number) => {
        dataParts.push(`  ${i+1}. ${doc.ai_generated_name || doc.original_name}`);
        if (doc.ai_summary) {
          dataParts.push(`     ${doc.ai_summary.substring(0, 100)}...`);
        }
      });
    }

    return dataParts.join('\n');
  }

  private enrichResponseWithContext(response: string, analysis: any, confidence: number, databaseContext: any, embeddingContext: any): string {
    let enrichedResponse = response;

    // Ajout d'indicateurs de confiance si nécessaire
    if (confidence < 0.5 && !response.includes('données limitées')) {
      enrichedResponse += '\n\n💡 *Réponse basée sur des informations limitées du cabinet. Pour plus de précision, n\'hésitez pas à me donner plus de contexte.*';
    }

    // Ajout de contexte source si pertinent
    if (databaseContext.meetings?.length > 0 && analysis.queryType === 'meeting') {
      enrichedResponse += `\n\n📊 *Basé sur ${databaseContext.meetings.length} réunion(s) de votre cabinet.*`;
    }

    if (embeddingContext.chunks?.length > 0) {
      enrichedResponse += `\n\n🔍 *Information trouvée dans ${embeddingContext.chunks.length} élément(s) de vos données.*`;
    }

    return enrichedResponse;
  }

  private generateIntelligentFallback(originalQuery: string, databaseContext: any, embeddingContext: any, taskContext: any): string {
    const hasData = databaseContext.meetings?.length > 0 || embeddingContext.chunks?.length > 0 || taskContext.hasTaskContext;
    
    if (hasData) {
      return `🏥 Je rencontre un problème technique temporaire, mais je vois que vous avez des données dans votre cabinet OphtaCare à Genève. 

Concernant votre question "${originalQuery}", je peux vous confirmer que j'ai accès à :
${databaseContext.meetings?.length > 0 ? `- ${databaseContext.meetings.length} réunion(s) récente(s)` : ''}
${embeddingContext.chunks?.length > 0 ? `- ${embeddingContext.chunks.length} élément(s) de contenu pertinent` : ''}
${taskContext.hasTaskContext ? `- ${taskContext.currentTasks.length} tâche(s) en cours` : ''}

Pourriez-vous reformuler votre question ou être plus spécifique ? Je suis là pour vous aider avec votre pratique ophtalmologique. 👁️`;
    }

    return `🏥 Je suis l'assistant OphtaCare du Dr Tabibian à Genève et je reste disponible pour vous aider malgré ce problème technique temporaire.

Pour votre question "${originalQuery}", je peux vous assister avec :
- 📋 Gestion des tâches et planning
- 🔍 Recherche dans vos données de cabinet
- 💊 Conseils en ophtalmologie
- 📊 Organisation administrative

Pouvez-vous reformuler votre demande ou être plus précis sur ce que vous cherchez ? 👁️`;
  }
}
