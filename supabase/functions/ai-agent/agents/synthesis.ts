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
    console.log('[SYNTHESIS] 🏥 Synthèse INTELLIGENTE Cabinet Dr Tabibian');

    // PHASE 1: RÉPONSE BASÉE SUR LA RECHERCHE VECTORIELLE UNIQUEMENT
    console.log('[SYNTHESIS] 🎯 Phase 1: Réponse basée sur recherche vectorielle');
    
    if (embeddingContext.chunks && embeddingContext.chunks.length > 0) {
      const vectorBasedResponse = await this.generateVectorBasedResponse(
        originalQuery, 
        embeddingContext, 
        analysis
      );
      
      // Si la réponse vectorielle est satisfaisante, la retourner directement
      if (vectorBasedResponse && this.isResponseSatisfactory(vectorBasedResponse, originalQuery)) {
        console.log('[SYNTHESIS] ✅ Réponse vectorielle satisfaisante et concise');
        return vectorBasedResponse;
      }
    }

    // PHASE 2: UTILISATION DE LA RECHERCHE INTERNET SI NÉCESSAIRE
    if (internetContext.hasContent) {
      console.log('[SYNTHESIS] 🌐 Utilisation des données Internet disponibles');
      return this.generateInternetBasedResponse(originalQuery, internetContext, analysis);
    }

    // PHASE 3: FALLBACK - SYNTHÈSE COMPLÈTE MAIS CONCISE
    console.log('[SYNTHESIS] 🔄 Phase 3: Fallback synthèse concise');
    return this.generateConciseSynthesis(originalQuery, conversationHistory, databaseContext, embeddingContext, internetContext, analysis, taskContext);
  }

  private async generateVectorBasedResponse(
    originalQuery: string,
    embeddingContext: any,
    analysis: any
  ): Promise<string> {
    const vectorPrompt = `Tu es l'assistant IA du cabinet d'ophtalmologie Dr Tabibian à Genève.

MISSION : Répondre DIRECTEMENT et CONCISÉMENT à partir des extraits de documents trouvés.

QUESTION : "${originalQuery}"

EXTRAITS PERTINENTS TROUVÉS :
${embeddingContext.chunks.slice(0, 5).map((chunk: any, i: number) => 
  `${i+1}. ${chunk.chunk_text}`
).join('\n\n')}

INSTRUCTIONS STRICTES :
- Réponds DIRECTEMENT à la question de manière concise
- Utilise UNIQUEMENT les informations des extraits
- Sois factuel et précis
- NE mentionne PAS les sources
- Fournis les détails nécessaires selon la question
- Si la réponse est OUI/NON, commence par OUI ou NON

RÉPONSE DIRECTE :`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: vectorPrompt }],
          temperature: 0.1,
          max_tokens: 300,
        }),
      });

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('[SYNTHESIS] ❌ Erreur réponse vectorielle:', error);
      return '';
    }
  }

  private async generateInternetBasedResponse(
    originalQuery: string,
    internetContext: any,
    analysis: any
  ): Promise<string> {
    const internetPrompt = `Tu es l'assistant IA du cabinet d'ophtalmologie Dr Tabibian à Genève.

QUESTION : "${originalQuery}"

INFORMATIONS TROUVÉES SUR INTERNET :
${internetContext.content}

INSTRUCTIONS STRICTES :
- Utilise les informations trouvées pour répondre directement
- Sois concis et précis
- NE mentionne PAS que tu utilises Internet
- Contextualise pour le cabinet médical si pertinent
- Reste professionnel

RÉPONSE DIRECTE :`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: internetPrompt }],
          temperature: 0.1,
          max_tokens: 400,
        }),
      });

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Informations non disponibles.';
    } catch (error) {
      console.error('[SYNTHESIS] ❌ Erreur réponse Internet:', error);
      return `${internetContext.content}`;
    }
  }

  private isResponseSatisfactory(response: string, originalQuery: string): boolean {
    const positiveIndicators = ['oui', 'effectivement', 'dans', 'mentionné', 'parlé', 'évoqué', 'discuté'];
    const negativeIndicators = ['non', 'pas', 'aucun', 'introuvable', 'absent'];
    
    const lowerResponse = response.toLowerCase();
    const hasPositive = positiveIndicators.some(indicator => lowerResponse.includes(indicator));
    const hasNegative = negativeIndicators.some(indicator => lowerResponse.includes(indicator));
    
    return response.length > 20 && (hasPositive || !hasNegative);
  }

  private async generateConciseSynthesis(
    originalQuery: string,
    conversationHistory: any[],
    databaseContext: any,
    embeddingContext: any,
    internetContext: any,
    analysis: any,
    taskContext: any
  ): Promise<string> {
    console.log('[SYNTHESIS] 🏥 Synthèse concise Cabinet Dr Tabibian');

    const contextSummary = this.buildConciseContextSummary(databaseContext, embeddingContext, internetContext, taskContext);
    
    let systemPrompt = `Tu es l'assistant IA du cabinet d'ophtalmologie Dr Tabibian à Genève.

MISSION : Répondre de manière CONCISE et DIRECTE aux questions du cabinet.

CONTEXTE CABINET DR TABIBIAN :
${contextSummary}

RÈGLES DE RÉPONSE STRICTES :
1. **CONCISION** - Sois concis mais fournis les informations nécessaires
2. **RÉPONSE DIRECTE** - Vas droit au but
3. **PAS DE SOURCES** - Ne mentionne jamais d'où viennent les informations
4. **UTILISATION INTERNET** - Si des informations Internet sont disponibles, utilise-les
5. **CONTEXTE OPHTALMOLOGIE** - Maintiens l'expertise médicale
6. **ACTIONS STRUCTURÉES** - Utilise [ACTION_TACHE:...] pour les tâches si demandé

STYLE CABINET MÉDICAL :
- Professionnel mais direct
- Pas d'émojis sauf si vraiment pertinent
- Réponses factuelles et précises`;

    if (analysis.queryType === 'task') {
      systemPrompt += `\n\nCONTEXTE TÂCHES :
- Génère l'action [ACTION_TACHE:...] appropriée
- Confirme l'action brièvement`;
    }

    const conversationContext = this.buildConciseConversationContext(conversationHistory);
    const dataContext = this.buildConciseDataContext(databaseContext, embeddingContext, internetContext);

    const userPrompt = `QUESTION : "${originalQuery}"

${conversationContext ? `CONTEXTE : ${conversationContext}\n` : ''}

${dataContext ? `DONNÉES DISPONIBLES : ${dataContext}\n` : ''}

${taskContext.hasTaskContext ? `TÂCHES EN COURS : ${taskContext.currentTasks.length}` : ''}

INSTRUCTIONS :
- Réponds DIRECTEMENT et de manière appropriée à la question
- Utilise les données disponibles
- Sois concis mais complet selon le besoin
- Pas de mention des sources`;

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
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      let finalResponse = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu traiter votre demande.';

      console.log('[SYNTHESIS] ✅ Réponse concise générée');
      return finalResponse;

    } catch (error) {
      console.error('[SYNTHESIS] ❌ Erreur:', error);
      return this.generateConciseFallback(originalQuery, databaseContext, embeddingContext, taskContext);
    }
  }

  private buildConciseContextSummary(databaseContext: any, embeddingContext: any, internetContext: any, taskContext: any): string {
    const parts = [];

    if (taskContext.hasTaskContext) {
      parts.push(`${taskContext.currentTasks.length} tâches`);
    }

    if (databaseContext.meetings?.length > 0) {
      parts.push(`${databaseContext.meetings.length} réunions`);
    }

    if (embeddingContext.hasRelevantContext) {
      parts.push(`${embeddingContext.chunks.length} éléments trouvés`);
    }

    if (internetContext.hasContent) {
      parts.push(`informations internet disponibles`);
    }

    return parts.length > 0 ? parts.join(', ') : 'données cabinet disponibles';
  }

  private buildConciseConversationContext(conversationHistory: any[]): string {
    if (!conversationHistory || conversationHistory.length === 0) return '';
    
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    return lastMessage ? lastMessage.content.substring(0, 100) : '';
  }

  private buildConciseDataContext(databaseContext: any, embeddingContext: any, internetContext: any): string {
    const dataParts = [];

    if (databaseContext.meetings?.length > 0) {
      dataParts.push(`${databaseContext.meetings.length} réunion(s)`);
    }

    if (embeddingContext.chunks?.length > 0) {
      dataParts.push(`${embeddingContext.chunks.length} élément(s) pertinent(s)`);
    }

    if (internetContext.hasContent) {
      dataParts.push(`données internet`);
    }

    return dataParts.join(', ');
  }

  private generateConciseFallback(originalQuery: string, databaseContext: any, embeddingContext: any, taskContext: any): string {
    const hasData = databaseContext.meetings?.length > 0 || embeddingContext.chunks?.length > 0 || taskContext.hasTaskContext;
    
    if (hasData) {
      return `Je rencontre un problème technique temporaire. Pouvez-vous reformuler votre question concernant "${originalQuery}" ?`;
    }

    return `Je suis disponible pour vous aider avec votre cabinet d'ophtalmologie. Pouvez-vous préciser votre demande ?`;
  }
}
