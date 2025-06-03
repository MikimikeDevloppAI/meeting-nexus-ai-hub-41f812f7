
export interface SynthesisRequest {
  originalQuery: string;
  conversationHistory: any[];
  databaseContext: any;
  embeddingContext: any;
  internetContext: any;
  analysis: any;
}

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
    analysis?: any
  ): Promise<string> {
    console.log('[SYNTHESIS] Creating enhanced comprehensive response');

    // Critical evaluation of available data
    const dataQuality = this.evaluateDataQuality(databaseContext, embeddingContext, internetContext, analysis);
    
    if (!dataQuality.sufficient) {
      console.log('[SYNTHESIS] ⚠️ Insufficient data quality, requesting more specific search');
      return this.generateInsufficientDataResponse(originalQuery, dataQuality);
    }

    // Build comprehensive context
    const contextText = this.buildEnhancedContext(
      conversationHistory,
      databaseContext,
      embeddingContext,
      internetContext,
      analysis
    );

    const systemPrompt = this.buildEnhancedSystemPrompt(dataQuality, analysis);

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
            { role: 'user', content: `${originalQuery}\n\n${contextText}` }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI response');
      }

      const data = await response.json();
      const finalResponse = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';

      console.log('[SYNTHESIS] ✅ Enhanced response generated successfully');
      return finalResponse;

    } catch (error) {
      console.error('[SYNTHESIS] ❌ Error generating response:', error);
      return 'Désolé, je rencontre un problème technique pour synthétiser ma réponse.';
    }
  }

  private evaluateDataQuality(databaseContext: any, embeddingContext: any, internetContext: any, analysis: any): any {
    const quality = {
      sufficient: false,
      hasTargetedContent: false,
      hasGeneralContent: false,
      missingElements: [] as string[],
      suggestions: [] as string[]
    };

    // Check for targeted extraction if needed
    if (analysis?.targetedExtraction) {
      quality.hasTargetedContent = databaseContext.targetedExtracts?.sections?.length > 0 ||
                                   embeddingContext.chunks?.some((chunk: any) => 
                                     chunk.chunk_text.toLowerCase().includes(analysis.targetedExtraction.entity.toLowerCase())
                                   );
      
      if (!quality.hasTargetedContent) {
        quality.missingElements.push(`Information spécifique sur "${analysis.targetedExtraction.entity}"`);
        quality.suggestions.push(`Recherche plus ciblée sur "${analysis.targetedExtraction.entity}"`);
      }
    }

    // Check for general content
    quality.hasGeneralContent = (databaseContext.meetings?.length > 0 || 
                                databaseContext.documents?.length > 0 || 
                                embeddingContext.chunks?.length > 0 || 
                                internetContext.hasContent);

    // Determine sufficiency
    if (analysis?.targetedExtraction) {
      quality.sufficient = quality.hasTargetedContent || quality.hasGeneralContent;
    } else {
      quality.sufficient = quality.hasGeneralContent;
    }

    return quality;
  }

  private generateInsufficientDataResponse(originalQuery: string, dataQuality: any): string {
    let response = `Je n'ai pas trouvé suffisamment d'informations spécifiques dans les données du cabinet OphtaCare pour répondre complètement à votre question : "${originalQuery}"\n\n`;
    
    if (dataQuality.missingElements.length > 0) {
      response += `**Éléments manquants dans nos données internes :**\n`;
      dataQuality.missingElements.forEach((element: string) => {
        response += `• ${element}\n`;
      });
      response += '\n';
    }

    if (dataQuality.suggestions.length > 0) {
      response += `**Suggestions pour améliorer la recherche :**\n`;
      dataQuality.suggestions.forEach((suggestion: string) => {
        response += `• ${suggestion}\n`;
      });
      response += '\n';
    }

    response += `Pouvez-vous reformuler votre question dans le contexte administratif du cabinet ? Par exemple :\n`;
    response += `• Préciser une période ou un contexte spécifique\n`;
    response += `• Mentionner des noms de patients, médecins ou collaborateurs\n`;
    response += `• Utiliser des termes liés à la gestion administrative du cabinet\n`;

    return response;
  }

  private buildEnhancedContext(
    conversationHistory: any[],
    databaseContext: any,
    embeddingContext: any,
    internetContext: any,
    analysis: any
  ): string {
    let contextText = '';

    // Conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      contextText += `\n\n**💬 HISTORIQUE DE LA CONVERSATION:**\n${
        conversationHistory.slice(-5).map((msg, index) => 
          `${index + 1}. [${msg.isUser ? 'UTILISATEUR' : 'ASSISTANT'}] ${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}`
        ).join('\n')
      }\n\n`;
    }

    // Targeted extracts (highest priority)
    if (databaseContext.targetedExtracts?.sections?.length > 0) {
      contextText += `\n\n**🎯 EXTRAITS CIBLÉS POUR "${databaseContext.targetedExtracts.entity.toUpperCase()}" (PRIORITÉ ABSOLUE):**\n${
        databaseContext.targetedExtracts.sections.map((section: string, index: number) => 
          `${index + 1}. ${section}`
        ).join('\n\n')
      }\n\n`;
    }

    // Enhanced embeddings context
    if (embeddingContext.hasRelevantContext && embeddingContext.chunks.length > 0) {
      contextText += `\n\n**🔍 DOCUMENTS PERTINENTS OPHTACARE (Recherche en ${embeddingContext.searchIterations} itérations):**\n${
        embeddingContext.chunks.map((result: any, index: number) => 
          `${index + 1}. [Similarité: ${(result.similarity * 100).toFixed(1)}%] ${result.metadata?.title || result.document_type}\nContenu: ${result.chunk_text}`
        ).join('\n\n')
      }\n\n`;
    }

    // Database context
    if (databaseContext.meetings && databaseContext.meetings.length > 0) {
      contextText += `\n\n**📋 TRANSCRIPTS DES RÉUNIONS OPHTACARE:**\n${
        databaseContext.meetings.map((m: any) => 
          `Réunion: ${m.title} (${new Date(m.created_at).toLocaleDateString()})\n${
            m.transcript ? `Transcript: ${m.transcript.substring(0, 1500)}...` : `Résumé: ${m.summary || 'Pas de résumé'}`
          }`
        ).join('\n\n')
      }\n\n`;
    }

    // Documents context
    if (databaseContext.documents && databaseContext.documents.length > 0) {
      contextText += `\n\n**📁 DOCUMENTS OPHTACARE:**\n${
        databaseContext.documents.map((d: any) => 
          `Document: ${d.ai_generated_name || d.original_name}\nTexte: ${
            d.extracted_text ? d.extracted_text.substring(0, 1000) + '...' : 'Pas de texte extrait'
          }`
        ).join('\n\n')
      }\n\n`;
    }

    // Todos context
    if (databaseContext.todos && databaseContext.todos.length > 0) {
      contextText += `\n\n**✅ TÂCHES OPHTACARE:**\n${
        databaseContext.todos.map((t: any) => 
          `- [${t.status}] ${t.description}${t.due_date ? ` (échéance: ${new Date(t.due_date).toLocaleDateString()})` : ''}`
        ).join('\n')
      }\n\n`;
    }

    // Internet enrichment
    if (internetContext.hasContent) {
      contextText += `\n\n**🌐 ENRICHISSEMENT INTERNET (${internetContext.enrichmentType.toUpperCase()}):**\n${internetContext.content}\n\n`;
    }

    return contextText;
  }

  private buildEnhancedSystemPrompt(dataQuality: any, analysis: any): string {
    return `Tu es l'assistant IA spécialisé du cabinet d'ophtalmologie OphtaCare à Genève, dirigé par le Dr Tabibian.

🏥 **CONTEXTE OPHTACARE GENÈVE :**
- Tu travailles EXCLUSIVEMENT pour OphtaCare, cabinet d'ophtalmologie situé à Genève
- Le Dr Tabibian est le médecin responsable du cabinet
- Tu assistes la personne qui s'occupe de la partie ADMINISTRATIVE du cabinet
- Tu as accès à toutes les données internes : réunions, documents, tâches, transcripts
- Tu dois TOUJOURS rester dans ce contexte médical et administratif spécifique

👤 **TON UTILISATEUR :**
- Il/elle gère l'administration du cabinet OphtaCare
- Ses besoins concernent : planning, tâches, suivi administratif, organisation
- Il/elle a besoin d'informations pratiques pour la gestion quotidienne du cabinet

🎯 **QUALITÉ DES DONNÉES DISPONIBLES :**
- Contenu ciblé : ${dataQuality.hasTargetedContent ? '✅' : '❌'}
- Contenu général : ${dataQuality.hasGeneralContent ? '✅' : '❌'}
- Suffisance globale : ${dataQuality.sufficient ? '✅' : '❌'}

📊 **RÈGLES STRICTES DE SYNTHÈSE :**
1. **CONTEXTE OBLIGATOIRE** : Toujours rester dans le cadre d'OphtaCare Genève
2. **FOCUS ADMINISTRATIF** : Priorité aux aspects de gestion et organisation
3. **PRIORISE ABSOLUMENT** les extraits ciblés s'ils existent
4. Utilise l'historique pour maintenir la continuité de conversation
5. Complète avec les embeddings OphtaCare (indique le score de similarité si pertinent)
6. Enrichis avec les données de la base de données OphtaCare
7. Utilise l'enrichissement internet selon son type (supplement/complement/verification)
8. **SOIS PRÉCIS ET COMPLET** - évite les réponses trop courtes
9. Cite TOUJOURS tes sources en précisant leur origine
10. Si extraction ciblée demandée, fournis le contexte complet autour de l'entité

🔧 **GESTION DES TÂCHES :**
Si tu veux créer/modifier/supprimer une tâche, utilise : [ACTION_TACHE: TYPE=create/update/delete/complete, DESCRIPTION="description", ASSIGNED_TO="nom_utilisateur", DUE_DATE="YYYY-MM-DD", ID="id_tache"]

🧠 **INTELLIGENCE CONTEXTUELLE :**
- Pour des entités spécifiques (noms, concepts), fournis le contexte complet OphtaCare
- Pour des demandes techniques, sois détaillé dans le contexte du cabinet
- Pour des questions générales, enrichis avec des informations pertinentes pour l'ophtalmologie
- Adapte ta réponse selon le type de recherche effectuée (${analysis?.searchIterations || 1} itération(s))
- **JAMAIS de conseils médicaux** - tu es un assistant administratif, pas un médecin

🌍 **CONTEXTE GÉOGRAPHIQUE :**
- Cabinet situé à Genève, Suisse
- Adaptation aux spécificités suisses si pertinent (réglementation, horaires, etc.)
- Mentions des aspects locaux quand approprié`;
  }
}
