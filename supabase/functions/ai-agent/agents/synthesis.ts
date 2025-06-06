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
      
      // Si la réponse vectorielle est satisfaisante, l'enrichir avec les détails du meeting
      if (vectorBasedResponse && this.isResponseSatisfactory(vectorBasedResponse, originalQuery)) {
        console.log('[SYNTHESIS] ✅ Réponse vectorielle satisfaisante, enrichissement avec détails meeting');
        
        const enrichedResponse = await this.enrichWithMeetingDetails(
          vectorBasedResponse,
          originalQuery,
          databaseContext,
          embeddingContext,
          analysis
        );
        
        return this.finalizeResponse(enrichedResponse, analysis, embeddingContext, databaseContext);
      }
    }

    // PHASE 2: FALLBACK - SYNTHÈSE COMPLÈTE CLASSIQUE
    console.log('[SYNTHESIS] 🔄 Phase 2: Fallback synthèse complète');
    return this.generateFullSynthesis(originalQuery, conversationHistory, databaseContext, embeddingContext, internetContext, analysis, taskContext);
  }

  private async generateVectorBasedResponse(
    originalQuery: string,
    embeddingContext: any,
    analysis: any
  ): Promise<string> {
    const vectorPrompt = `Tu es l'assistant IA du cabinet d'ophtalmologie Dr Tabibian à Genève.

MISSION PRIORITAIRE : Répondre directement à partir des extraits de documents trouvés.

QUESTION : "${originalQuery}"

EXTRAITS PERTINENTS TROUVÉS DANS LES DONNÉES CABINET :
${embeddingContext.chunks.slice(0, 5).map((chunk: any, i: number) => 
  `${i+1}. [Similarité: ${(chunk.similarity * 100).toFixed(0)}%] ${chunk.chunk_text}`
).join('\n\n')}

INSTRUCTIONS :
- Réponds DIRECTEMENT à la question en utilisant les extraits fournis
- Si la réponse est dans les extraits, dis OUI et explique
- Si la réponse n'est PAS dans les extraits, dis NON clairement
- Sois précis et factuel
- Cite les éléments pertinents trouvés
- N'invente rien qui n'est pas dans les extraits

RÉPONSE COURTE ET PRÉCISE :`;

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
          temperature: 0.1, // Très faible pour réponses factuelles
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('[SYNTHESIS] ❌ Erreur réponse vectorielle:', error);
      return '';
    }
  }

  private isResponseSatisfactory(response: string, originalQuery: string): boolean {
    // Vérifier si la réponse contient des éléments positifs
    const positiveIndicators = ['oui', 'effectivement', 'dans', 'mentionné', 'parlé', 'évoqué', 'discuté'];
    const negativeIndicators = ['non', 'pas', 'aucun', 'introuvable', 'absent'];
    
    const lowerResponse = response.toLowerCase();
    const hasPositive = positiveIndicators.some(indicator => lowerResponse.includes(indicator));
    const hasNegative = negativeIndicators.some(indicator => lowerResponse.includes(indicator));
    
    // La réponse est satisfaisante si elle est suffisamment longue et contient des éléments factuels
    return response.length > 50 && (hasPositive || !hasNegative);
  }

  private async enrichWithMeetingDetails(
    baseResponse: string,
    originalQuery: string,
    databaseContext: any,
    embeddingContext: any,
    analysis: any
  ): Promise<string> {
    console.log('[SYNTHESIS] 📋 Enrichissement avec détails meeting');

    // Identifier les meetings pertinents à partir des chunks
    const relevantMeetings = this.extractRelevantMeetings(embeddingContext.chunks, databaseContext.meetings);
    
    if (relevantMeetings.length === 0) {
      return baseResponse;
    }

    const enrichmentPrompt = `Tu es l'assistant IA du cabinet d'ophtalmologie Dr Tabibian.

RÉPONSE DE BASE : 
${baseResponse}

DÉTAILS DES RÉUNIONS PERTINENTES :
${relevantMeetings.map((meeting: any, i: number) => `
${i+1}. RÉUNION: ${meeting.title} (${new Date(meeting.created_at).toLocaleDateString('fr-FR')})
   RÉSUMÉ: ${meeting.summary || 'Pas de résumé'}
   ${meeting.transcript ? `TRANSCRIPT DISPONIBLE (${meeting.transcript.length} caractères)` : 'Pas de transcript'}
`).join('\n')}

MISSION : Enrichir la réponse de base avec les détails spécifiques des réunions.

RÈGLES :
- Garde la réponse de base comme fondation
- Ajoute les détails pertinents des réunions (dates, contexte, participants)
- Si un transcript complet est demandé, fournis-le
- Reste factuel et précis
- Mentionne les sources (quelle réunion)

RÉPONSE ENRICHIE :`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: enrichmentPrompt }],
          temperature: 0.2,
          max_tokens: 1200,
        }),
      });

      const data = await response.json();
      return data.choices[0]?.message?.content || baseResponse;
    } catch (error) {
      console.error('[SYNTHESIS] ❌ Erreur enrichissement:', error);
      return baseResponse;
    }
  }

  private extractRelevantMeetings(chunks: any[], meetings: any[]): any[] {
    if (!chunks || !meetings) return [];
    
    // Extraire les meeting_ids des chunks
    const meetingIds = [...new Set(chunks
      .filter(chunk => chunk.meeting_id)
      .map(chunk => chunk.meeting_id)
    )];
    
    // Trouver les meetings correspondants
    return meetings.filter(meeting => meetingIds.includes(meeting.id));
  }

  private async generateFullSynthesis(
    originalQuery: string,
    conversationHistory: any[],
    databaseContext: any,
    embeddingContext: any,
    internetContext: any,
    analysis: any,
    taskContext: any
  ): Promise<string> {
    console.log('[SYNTHESIS] 🏥 Synthèse INTELLIGENTE Cabinet Dr Tabibian');

    const contextSummary = this.buildIntelligentContextSummary(databaseContext, embeddingContext, internetContext, taskContext);
    const confidence = analysis.confidenceLevel || 0.7;
    
    let systemPrompt = `Tu es l'assistant IA SUPER-INTELLIGENT du cabinet d'ophtalmologie Dr Tabibian à Genève.

MISSION CABINET MÉDICAL :
- Assistant administratif et médical spécialisé en ophtalmologie
- Priorité ABSOLUE : Recherche sémantique dans les données internes AVANT tout enrichissement
- Accès complet aux transcripts de réunions, documents, tâches administratives
- Compréhension intelligente des références temporelles (dernière réunion, réunion de juin, etc.)
- Enrichissement internet seulement après recherche interne

CONTEXTE CABINET DR TABIBIAN :
${contextSummary}

NIVEAU DE CONFIANCE : ${(confidence * 100).toFixed(0)}%

RÉFÉRENCES TEMPORELLES INTELLIGENTES :
${analysis.temporalReference ? `- Référence détectée: ${analysis.temporalReference.type} ${analysis.temporalReference.value || ''}` : '- Aucune référence temporelle spécifique'}

RÈGLES DE RÉPONSE CABINET MÉDICAL :
1. **PRIORITÉ RECHERCHE SÉMANTIQUE** - Utilise d'abord les données internes trouvées
2. **COMPRÉHENSION TEMPORELLE** - Identifie correctement les références aux réunions
3. **RÉPONSES COMPLÈTES** - Fournis toujours une réponse utile, même avec données limitées  
4. **CONTEXTE OPHTALMOLOGIE** - Maintiens l'expertise médicale et le contexte genevois
5. **TRANSPARENCE SOURCES** - Indique clairement les sources utilisées (interne vs externe)
6. **ACCÈS TRANSCRIPTS** - Fournis les transcripts si demandés explicitement
7. **ACTIONS STRUCTURÉES** - Utilise la syntaxe [ACTION_TACHE:...] pour les tâches

SYNTAXE ACTIONS TÂCHES :
- [ACTION_TACHE:TYPE=create,description="Description précise",assigned_to="Nom personne"]
- [ACTION_TACHE:TYPE=update,id="ID",description="Nouvelle description"]
- [ACTION_TACHE:TYPE=complete,id="ID"]
- [ACTION_TACHE:TYPE=delete,id="ID"]

STYLE CABINET MÉDICAL :
- Professionnel et expert en ophtalmologie
- Contextualisation genevoise (CHF, système suisse)
- Émojis médicaux appropriés : 👁️ 🏥 📋 💊 🔍 📅
- Démonstration de compréhension du contexte cabinet`;

    // Enrichissement selon le type de requête et contexte temporel
    if (analysis.queryType === 'meeting' && databaseContext.meetings?.length > 0) {
      systemPrompt += `\n\nCONTEXTE RÉUNIONS SPÉCIAL :
- ${databaseContext.meetings.length} réunion(s) trouvée(s) dans les données cabinet
- Utilise les informations réelles des transcripts pour répondre
- Sois précis sur les dates et contenus mentionnés
- Si transcript demandé explicitement, fournis-le intégralement`;
    }

    if (analysis.temporalReference?.needs_database_lookup) {
      systemPrompt += `\n\nCONTEXTE TEMPOREL INTELLIGENT :
- Référence temporelle détectée: ${analysis.temporalReference.type}
- ${analysis.temporalReference.value ? `Valeur: ${analysis.temporalReference.value}` : ''}
- Utilise les données trouvées pour cette période spécifique
- Explique quelle réunion correspond à la demande`;
    }

    if (analysis.queryType === 'task') {
      systemPrompt += `\n\nCONTEXTE TÂCHES ADMINISTRATIVES :
- L'utilisateur demande une gestion de tâches cabinet
- Génère l'action appropriée avec la syntaxe [ACTION_TACHE:...]
- Confirme l'action dans ta réponse`;
    }

    if (analysis.administrativeContext) {
      systemPrompt += `\n\nCONTEXTE ADMINISTRATIF CABINET :
- Focus sur la gestion administrative du cabinet Dr Tabibian
- Utilise les données internes en priorité
- Contextualise pour l'ophtalmologie genevoise`;
    }

    // Construction du contexte conversationnel intelligent
    const conversationContext = this.buildConversationContext(conversationHistory);
    
    // Construction du contexte de données enrichi
    const dataContext = this.buildDataContext(databaseContext, embeddingContext, internetContext);

    const userPrompt = `QUESTION UTILISATEUR : "${originalQuery}"

${conversationContext ? `CONTEXTE CONVERSATION :\n${conversationContext}\n` : ''}

${dataContext ? `DONNÉES CABINET DR TABIBIAN DISPONIBLES :\n${dataContext}\n` : ''}

${taskContext.hasTaskContext ? `
TÂCHES CABINET EN COURS (${taskContext.currentTasks.length}) :
${taskContext.currentTasks.slice(0, 10).map(task => `- ${task.description} (${task.status}) ${task.assigned_to ? `- Assigné: ${task.assigned_to}` : ''}`).join('\n')}
` : ''}

INSTRUCTIONS INTELLIGENTES CABINET :
- Réponds directement et complètement à la question
- Utilise PRIORITAIREMENT les données internes du cabinet trouvées
- Si données limitées, fournis quand même une réponse utile
- Maintiens le contexte ophtalmologie cabinet Dr Tabibian Genève
- Sois précis sur les sources utilisées (données cabinet vs informations générales)
- Si transcript demandé, fournis-le intégralement
- Génère les actions [ACTION_TACHE:...] si demandé
- TOUJOURS donner une réponse, même si elle est partielle
- Démontre ta compréhension du contexte temporel si applicable`;

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
          max_tokens: 1500, // Plus de tokens pour réponses complètes avec transcripts
        }),
      });

      const data = await response.json();
      let finalResponse = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu traiter votre demande.';

      // Enrichissement intelligent de la réponse
      finalResponse = this.enrichResponseWithContext(finalResponse, analysis, confidence, databaseContext, embeddingContext, internetContext);

      console.log('[SYNTHESIS] ✅ Réponse cabinet médical intelligente générée');
      return finalResponse;

    } catch (error) {
      console.error('[SYNTHESIS] ❌ Erreur:', error);
      
      // Réponse de fallback intelligente même en cas d'erreur
      return this.generateIntelligentFallback(originalQuery, databaseContext, embeddingContext, taskContext);
    }
  }

  private finalizeResponse(response: string, analysis: any, embeddingContext: any, databaseContext: any): string {
    let finalizedResponse = response;

    // Ajout d'indicateurs de source
    if (embeddingContext.chunks?.length > 0) {
      finalizedResponse += `\n\n🔍 *Basé sur ${embeddingContext.chunks.length} élément(s) trouvé(s) dans vos données cabinet.*`;
    }

    if (databaseContext.meetings?.length > 0) {
      finalizedResponse += `\n\n📊 *Sources: ${databaseContext.meetings.length} réunion(s) de votre cabinet Dr Tabibian.*`;
    }

    return finalizedResponse;
  }

  private buildIntelligentContextSummary(databaseContext: any, embeddingContext: any, internetContext: any, taskContext: any): string {
    const parts = [];

    if (taskContext.hasTaskContext) {
      parts.push(`📋 Tâches cabinet: ${taskContext.currentTasks.length} en cours`);
    }

    if (databaseContext.meetings?.length > 0) {
      parts.push(`🏥 Réunions cabinet: ${databaseContext.meetings.length} trouvées`);
    }

    if (databaseContext.documents?.length > 0) {
      parts.push(`📁 Documents cabinet: ${databaseContext.documents.length} disponibles`);
    }

    if (embeddingContext.hasRelevantContext) {
      parts.push(`🎯 Données sémantiques: ${embeddingContext.chunks.length} éléments pertinents`);
    }

    if (internetContext.hasContent) {
      parts.push(`🌐 Enrichissement: Informations complémentaires disponibles`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'Base de données cabinet Dr Tabibian disponible';
  }

  private buildConversationContext(conversationHistory: any[]): string {
    if (!conversationHistory || conversationHistory.length === 0) return '';
    
    const recentMessages = conversationHistory.slice(-6).map(msg => 
      `${msg.isUser ? '👤 Cabinet/Équipe' : '🤖 Assistant Dr Tabibian'}: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`
    );
    
    return recentMessages.join('\n');
  }

  private buildDataContext(databaseContext: any, embeddingContext: any, internetContext: any): string {
    const dataParts = [];

    // Contexte des réunions avec détails temporels
    if (databaseContext.meetings?.length > 0) {
      dataParts.push(`\n🏥 RÉUNIONS CABINET TROUVÉES (${databaseContext.meetings.length}) :`);
      databaseContext.meetings.slice(0, 3).forEach((meeting: any, i: number) => {
        const meetingDate = meeting.created_at ? new Date(meeting.created_at).toLocaleDateString('fr-FR') : 'Date inconnue';
        dataParts.push(`  ${i+1}. ${meeting.title} - ${meetingDate}`);
        if (meeting.summary) {
          dataParts.push(`     Résumé: ${meeting.summary.substring(0, 200)}${meeting.summary.length > 200 ? '...' : ''}`);
        }
        if (meeting.transcript) {
          dataParts.push(`     📝 Transcript disponible (${meeting.transcript.length} caractères)`);
        }
      });
    }

    // Contexte des chunks avec relevance
    if (embeddingContext.chunks?.length > 0) {
      dataParts.push(`\n🎯 CONTENU SÉMANTIQUE PERTINENT (${embeddingContext.chunks.length} éléments) :`);
      embeddingContext.chunks.slice(0, 3).forEach((chunk: any, i: number) => {
        dataParts.push(`  ${i+1}. ${chunk.chunk_text?.substring(0, 150)}${chunk.chunk_text?.length > 150 ? '...' : ''}`);
        if (chunk.similarity) {
          dataParts.push(`     (Pertinence: ${(chunk.similarity * 100).toFixed(0)}%)`);
        }
      });
    }

    // Contexte des documents cabinet
    if (databaseContext.documents?.length > 0) {
      dataParts.push(`\n📁 DOCUMENTS CABINET (${databaseContext.documents.length}) :`);
      databaseContext.documents.slice(0, 2).forEach((doc: any, i: number) => {
        dataParts.push(`  ${i+1}. ${doc.ai_generated_name || doc.original_name}`);
        if (doc.ai_summary) {
          dataParts.push(`     ${doc.ai_summary.substring(0, 100)}...`);
        }
      });
    }

    // Contexte enrichissement internet
    if (internetContext.hasContent) {
      dataParts.push(`\n🌐 ENRICHISSEMENT EXTERNE :`);
      dataParts.push(`  Informations complémentaires trouvées pour le contexte cabinet`);
    }

    return dataParts.join('\n');
  }

  private enrichResponseWithContext(
    response: string, 
    analysis: any, 
    confidence: number, 
    databaseContext: any, 
    embeddingContext: any, 
    internetContext: any
  ): string {
    let enrichedResponse = response;

    // Ajout d'indicateurs de confiance si nécessaire
    if (confidence < 0.5 && !response.includes('données limitées')) {
      enrichedResponse += '\n\n💡 *Réponse basée sur des informations limitées du cabinet. Pour plus de précision, n\'hésitez pas à me donner plus de contexte.*';
    }

    // Ajout de contexte source si pertinent
    if (databaseContext.meetings?.length > 0 && analysis.queryType === 'meeting') {
      enrichedResponse += `\n\n📊 *Basé sur ${databaseContext.meetings.length} réunion(s) de votre cabinet Dr Tabibian.*`;
    }

    if (embeddingContext.chunks?.length > 0) {
      enrichedResponse += `\n\n🔍 *Information trouvée dans ${embeddingContext.chunks.length} élément(s) de vos données cabinet.*`;
    }

    if (internetContext.hasContent) {
      enrichedResponse += `\n\n🌐 *Enrichi avec des informations externes complémentaires.*`;
    }

    // Ajout contexte temporel si pertinent
    if (analysis.temporalReference?.needs_database_lookup && databaseContext.meetings?.length > 0) {
      enrichedResponse += `\n\n📅 *Réunion identifiée selon votre référence temporelle: ${analysis.temporalReference.type}.*`;
    }

    return enrichedResponse;
  }

  private generateIntelligentFallback(originalQuery: string, databaseContext: any, embeddingContext: any, taskContext: any): string {
    const hasData = databaseContext.meetings?.length > 0 || embeddingContext.chunks?.length > 0 || taskContext.hasTaskContext;
    
    if (hasData) {
      return `🏥 Je rencontre un problème technique temporaire, mais je vois que vous avez des données dans votre cabinet Dr Tabibian à Genève. 

Concernant votre question "${originalQuery}", je peux vous confirmer que j'ai accès à :
${databaseContext.meetings?.length > 0 ? `- ${databaseContext.meetings.length} réunion(s) récente(s) avec transcripts` : ''}
${embeddingContext.chunks?.length > 0 ? `- ${embeddingContext.chunks.length} élément(s) de contenu pertinent` : ''}
${taskContext.hasTaskContext ? `- ${taskContext.currentTasks.length} tâche(s) administratives en cours` : ''}

Pourriez-vous reformuler votre question ou être plus spécifique ? Je suis là pour vous aider avec votre cabinet d'ophtalmologie. 👁️`;
    }

    return `🏥 Je suis l'assistant du cabinet Dr Tabibian à Genève et je reste disponible pour vous aider malgré ce problème technique temporaire.

Pour votre question "${originalQuery}", je peux vous assister avec :
- 📋 Gestion des tâches administratives et planning
- 🔍 Recherche dans vos données de cabinet (réunions, transcripts)
- 💊 Conseils en ophtalmologie et gestion cabinet
- 📊 Organisation administrative cabinet médical
- 📅 Accès aux transcripts de réunions (dernière réunion, réunion de juin, etc.)

Pouvez-vous reformuler votre demande ou être plus précis sur ce que vous cherchez ? 👁️`;
  }
}
