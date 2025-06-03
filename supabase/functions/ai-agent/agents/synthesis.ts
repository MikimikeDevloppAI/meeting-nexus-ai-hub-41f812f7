
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
    analysis: any
  ): Promise<string> {
    console.log('[SYNTHESIS] Creating enhanced comprehensive response');

    // Detect if this is a task-related request
    const taskAction = this.detectTaskAction(originalQuery, conversationHistory);
    
    // Build comprehensive context
    const contextData = this.buildComprehensiveContext(
      databaseContext,
      embeddingContext,
      internetContext
    );

    // Determine if we have sufficient data
    const hasSufficientData = this.evaluateDataQuality(contextData, analysis);
    
    if (!hasSufficientData && !taskAction) {
      console.log('[SYNTHESIS] ⚠️ Insufficient data quality, requesting more specific search');
      return this.generateInsufficientDataResponse(originalQuery, analysis);
    }

    // Generate comprehensive response with task action if needed
    const response = await this.generateResponse(
      originalQuery,
      conversationHistory,
      contextData,
      analysis,
      taskAction
    );

    return response;
  }

  private detectTaskAction(query: string, conversationHistory: any[]): any {
    const lowerQuery = query.toLowerCase();
    
    // Enhanced detection for task creation requests
    if (lowerQuery.includes('crée') || lowerQuery.includes('créer') || 
        lowerQuery.includes('ajoute') || lowerQuery.includes('ajouter') ||
        lowerQuery.includes('nouvelle tâche') || lowerQuery.includes('new task') ||
        lowerQuery.includes('faire une tâche') || lowerQuery.includes('créé une tâche') ||
        (lowerQuery.includes('tâche') && (lowerQuery.includes('pour') || lowerQuery.includes('à')))) {
      
      return this.extractTaskCreationDetails(query);
    }

    // Detect task modification requests
    if (lowerQuery.includes('modifie') || lowerQuery.includes('modifier') ||
        lowerQuery.includes('change') || lowerQuery.includes('update')) {
      return this.extractTaskModificationDetails(query);
    }

    // Detect task completion requests
    if (lowerQuery.includes('termine') || lowerQuery.includes('terminer') ||
        lowerQuery.includes('complet') || lowerQuery.includes('fini')) {
      return this.extractTaskCompletionDetails(query);
    }

    return null;
  }

  private extractTaskCreationDetails(query: string): any {
    const lowerQuery = query.toLowerCase();
    
    // Extract description - try to find the main action
    let description = query;
    
    // Clean up the description by removing task creation keywords
    description = description.replace(/crée une tâche|créer une tâche|ajoute une tâche|ajouter une tâche|nouvelle tâche|faire une tâche/gi, '');
    description = description.replace(/peux tu|pourrais tu|il faut|on doit/gi, '');
    description = description.trim();

    // Extract assignee (à + name or pour + name)
    let assignedTo = null;
    const assigneeMatch = query.match(/(?:à|pour)\s+([a-záàâäéèêëíìîïóòôöúùûüç]+)/i);
    if (assigneeMatch) {
      assignedTo = assigneeMatch[1];
      // Remove "à [name]" or "pour [name]" from description
      description = description.replace(/(?:à|pour)\s+[a-záàâäéèêëíìîïóòôöúùûüç]+/i, '').trim();
    }

    // Extract due date if mentioned
    let dueDate = null;
    const dateMatch = query.match(/(avant le|pour le|d'ici le)\s+([0-9\/\-]+)/i);
    if (dateMatch) {
      dueDate = dateMatch[2];
    }

    // If description is still generic, extract the actual task
    if (description.length < 10) {
      const taskMatch = query.match(/(?:acheter|commander|vérifier|contacter|faire|préparer)\s+(.+?)(?:\s+(?:à|pour|avant|d'ici)|$)/i);
      if (taskMatch) {
        description = taskMatch[0];
      }
    }

    return {
      type: 'create',
      data: {
        description: description || 'Nouvelle tâche',
        assigned_to: assignedTo,
        due_date: dueDate
      }
    };
  }

  private extractTaskModificationDetails(query: string): any {
    return {
      type: 'update',
      data: {
        description: query
      }
    };
  }

  private extractTaskCompletionDetails(query: string): any {
    return {
      type: 'complete',
      data: {
        status: 'completed'
      }
    };
  }

  private buildComprehensiveContext(databaseContext: any, embeddingContext: any, internetContext: any): any {
    return {
      meetings: databaseContext.meetings || [],
      documents: databaseContext.documents || [],
      todos: databaseContext.todos || [],
      chunks: embeddingContext.chunks || [],
      sources: embeddingContext.sources || [],
      internetContent: internetContext.content || '',
      internetSources: internetContext.sources || [],
      hasEmbeddingContext: embeddingContext.hasRelevantContext || false,
      hasInternetContext: internetContext.hasContent || false
    };
  }

  private evaluateDataQuality(contextData: any, analysis: any): boolean {
    const hasRelevantMeetings = contextData.meetings.length > 0;
    const hasRelevantDocuments = contextData.documents.length > 0;
    const hasEmbeddingResults = contextData.chunks.length > 0;
    const hasInternetResults = contextData.internetContent.length > 0;
    
    // For task-related queries, we don't need extensive context
    if (analysis.queryType === 'task') {
      return true;
    }

    return hasRelevantMeetings || hasRelevantDocuments || hasEmbeddingResults || hasInternetResults;
  }

  private generateInsufficientDataResponse(originalQuery: string, analysis: any): string {
    const missingContext = [];
    
    if (analysis.specificEntities && analysis.specificEntities.length > 0) {
      missingContext.push(`Information spécifique sur "${analysis.specificEntities.join(', ')}"`);
    }

    const suggestions = [];
    if (analysis.searchTerms && analysis.searchTerms.length > 0) {
      suggestions.push(`Recherche plus ciblée sur "${analysis.searchTerms.join(', ')}"`);
    }

    return `Je n'ai pas trouvé suffisamment d'informations spécifiques dans les données du cabinet OphtaCare pour répondre complètement à votre question : "${originalQuery}"

**Éléments manquants dans nos données internes :**
${missingContext.map(item => `• ${item}`).join('\n')}

**Suggestions pour améliorer la recherche :**
${suggestions.map(item => `• ${item}`).join('\n')}

Pouvez-vous reformuler votre question dans le contexte administratif du cabinet ? Par exemple :
• Préciser une période ou un contexte spécifique
• Mentionner des noms de patients, médecins ou collaborateurs
• Utiliser des termes liés à la gestion administrative du cabinet`;
  }

  private async generateResponse(
    originalQuery: string,
    conversationHistory: any[],
    contextData: any,
    analysis: any,
    taskAction: any
  ): Promise<string> {
    const hasContext = contextData.meetings.length > 0 || 
                     contextData.documents.length > 0 || 
                     contextData.chunks.length > 0;

    let systemPrompt = `Tu es l'assistant IA spécialisé du cabinet d'ophtalmologie OphtaCare du Dr Tabibian à Genève.
L'utilisateur qui te parle est RESPONSABLE ADMINISTRATIF du cabinet.

CONTEXTE OPHTACARE GENÈVE :
- Cabinet d'ophtalmologie dirigé par Dr Tabibian
- Utilisateur = gestionnaire administratif du cabinet  
- Tu aides avec : organisation, planification, gestion des tâches, documents administratifs
- Tu restes TOUJOURS dans le contexte administratif médical
- Tu évites les conseils médicaux (pas ton rôle)

DONNÉES DISPONIBLES :
${hasContext ? `
- Réunions récentes : ${contextData.meetings.length}
- Documents internes : ${contextData.documents.length} 
- Extraits pertinents : ${contextData.chunks.length}
` : 'Données limitées disponibles pour cette requête'}

${contextData.hasInternetContext ? 'Informations complémentaires d\'actualité disponibles.' : ''}

TÂCHES ET ACTIONS :
${taskAction ? `
IMPORTANT : Cette demande nécessite une ACTION sur les tâches.
Action détectée : ${taskAction.type}
Détails : ${JSON.stringify(taskAction.data)}

Tu DOIS inclure dans ta réponse cette syntaxe EXACTE :
[ACTION_TACHE: TYPE=${taskAction.type.toUpperCase()}, ${Object.entries(taskAction.data).map(([key, value]) => `${key}="${value || ''}"`).join(', ')}]

Exemple : [ACTION_TACHE: TYPE=CREATE, description="Acheter matériel de bureau", assigned_to="Linda"]
` : 'Aucune action de tâche requise pour cette demande.'}

Réponds de manière professionnelle et dans le contexte OphtaCare Genève.`;

    const userMessage = `QUESTION ADMINISTRATIVE : ${originalQuery}

${hasContext ? `
DONNÉES INTERNES DISPONIBLES :
${contextData.meetings.map((m: any) => `• Réunion "${m.title || 'Sans titre'}" - ${(m.summary || '').substring(0, 200)}...`).join('\n')}
${contextData.chunks.map((c: any) => `• Extrait : ${(c.content || '').substring(0, 150)}...`).join('\n')}
` : ''}

${contextData.hasInternetContext ? `
INFORMATIONS COMPLÉMENTAIRES :
${(contextData.internetContent || '').substring(0, 500)}...
` : ''}

Réponds en tant qu'assistant administratif OphtaCare et inclus l'action de tâche si nécessaire.`;

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
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      return data.choices[0]?.message?.content || 
             'Désolé, je ne peux pas traiter votre demande pour le moment.';
      
    } catch (error) {
      console.error('[SYNTHESIS] Error generating response:', error);
      
      // Fallback response with task action if applicable
      if (taskAction) {
        const actionSyntax = `[ACTION_TACHE: TYPE=${taskAction.type.toUpperCase()}, ${Object.entries(taskAction.data).map(([key, value]) => `${key}="${value || ''}"`).join(', ')}]`;
        
        if (taskAction.type === 'create') {
          return `Je vais créer cette tâche pour le cabinet OphtaCare :

**Tâche à créer :**
- Description : ${taskAction.data.description}
${taskAction.data.assigned_to ? `- Assignée à : ${taskAction.data.assigned_to}` : ''}
${taskAction.data.due_date ? `- Échéance : ${taskAction.data.due_date}` : ''}

${actionSyntax}

Cette tâche sera ajoutée au système de gestion des tâches du cabinet.`;
        }
      }
      
      return 'Je rencontre un problème technique. Pouvez-vous reformuler votre demande ?';
    }
  }
}
