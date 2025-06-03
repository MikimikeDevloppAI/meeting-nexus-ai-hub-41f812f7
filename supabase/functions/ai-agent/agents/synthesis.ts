
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
    console.log('[SYNTHESIS] Création réponse ENRICHIE MAXIMALE avec contexte médical OphtaCare');

    // Détection d'actions avec analyse approfondie
    const actionAnalysis = this.detectActionWithContext(originalQuery, conversationHistory, databaseContext);
    
    // Construction du contexte ultra-enrichi
    const enrichedContext = this.buildUltraEnrichedContext(
      databaseContext,
      embeddingContext,
      internetContext,
      analysis
    );

    // Évaluation de la qualité des données avec validation contextuelle
    const dataQuality = this.evaluateDataQualityEnhanced(enrichedContext, analysis, actionAnalysis);
    
    // Validation contextuelle médicale
    const contextValidation = this.validateMedicalContext(originalQuery, enrichedContext, analysis);
    
    if (!dataQuality.sufficient && !actionAnalysis.isAction && contextValidation.needsClarification) {
      console.log('[SYNTHESIS] ⚠️ Données insuffisantes ET contexte ambigu, demande de clarification');
      return this.generateClarificationRequest(originalQuery, analysis, dataQuality, contextValidation);
    }

    // Génération de la réponse enrichie avec validation contextuelle
    const response = await this.generateEnrichedResponse(
      originalQuery,
      conversationHistory,
      enrichedContext,
      analysis,
      actionAnalysis,
      contextValidation
    );

    return response;
  }

  private detectActionWithContext(query: string, conversationHistory: any[], databaseContext: any): any {
    const lowerQuery = query.toLowerCase();
    
    // Détection d'actions renforcée avec contexte
    const actionPatterns = {
      create: {
        patterns: ['crée', 'créer', 'ajoute', 'ajouter', 'nouvelle', 'nouveau', 'faire', 'organiser', 'planifier'],
        targets: ['tâche', 'task', 'todo', 'action', 'rendez-vous', 'réunion', 'rappel']
      },
      update: {
        patterns: ['modifie', 'modifier', 'change', 'changer', 'update', 'mettre à jour', 'corriger'],
        targets: ['tâche', 'information', 'statut', 'date', 'description']
      },
      help: {
        patterns: ['aide', 'explique', 'comment', 'montre', 'guide', 'assistance', 'conseille'],
        targets: ['procédure', 'étapes', 'méthode', 'utilisation', 'fonctionnement']
      },
      search: {
        patterns: ['trouve', 'cherche', 'recherche', 'montre', 'affiche', 'où est'],
        targets: ['information', 'document', 'personne', 'tâche', 'réunion']
      }
    };
    
    let detectedAction = null;
    let confidence = 0;
    
    for (const [actionType, config] of Object.entries(actionPatterns)) {
      const patternMatch = config.patterns.some(pattern => lowerQuery.includes(pattern));
      const targetMatch = config.targets.some(target => lowerQuery.includes(target));
      
      if (patternMatch && (targetMatch || actionType === 'help' || actionType === 'search')) {
        const currentConfidence = patternMatch && targetMatch ? 1.0 : 0.7;
        if (currentConfidence > confidence) {
          confidence = currentConfidence;
          detectedAction = {
            type: actionType,
            confidence,
            details: this.extractActionDetails(query, actionType, databaseContext)
          };
        }
      }
    }
    
    // Détection spéciale pour tâches avec participants
    if (detectedAction?.type === 'create' && lowerQuery.includes('tâche')) {
      detectedAction.details = this.extractTaskCreationDetailsEnhanced(query, databaseContext);
    }
    
    return {
      isAction: detectedAction !== null,
      action: detectedAction,
      confidence
    };
  }

  private extractActionDetails(query: string, actionType: string, databaseContext: any): any {
    const details: any = { originalQuery: query };
    
    switch (actionType) {
      case 'create':
        if (query.toLowerCase().includes('tâche')) {
          details.taskCreation = this.extractTaskCreationDetailsEnhanced(query, databaseContext);
        }
        break;
        
      case 'help':
        details.helpType = 'procedural';
        details.context = 'medical_administrative';
        break;
        
      case 'search':
        details.searchTarget = this.identifySearchTarget(query);
        break;
    }
    
    return details;
  }

  private extractTaskCreationDetailsEnhanced(query: string, databaseContext: any): any {
    const lowerQuery = query.toLowerCase();
    
    // Extraction de la description avec patterns améliorés
    let description = query;
    const actionPrefixes = [
      'crée une tâche', 'créer une tâche', 'ajoute une tâche', 'nouvelle tâche',
      'je vais créer', 'peux-tu créer', 'fait une tâche', 'tâche pour'
    ];
    
    actionPrefixes.forEach(prefix => {
      if (lowerQuery.includes(prefix)) {
        const index = lowerQuery.indexOf(prefix);
        description = query.substring(index + prefix.length).trim();
      }
    });
    
    // Nettoyage de la description
    description = description.replace(/^[:;,\s]+/, '').trim();
    
    // Extraction d'assignation avec matching intelligent sur participants
    let assignedTo = null;
    const participants = databaseContext.participants || [];
    
    // Patterns d'assignation étendus
    const assignmentPatterns = [
      /(?:pour|à|assigné[e]?\s+à|responsable\s*:)\s+([a-záàâäéèêëíìîïóòôöúùûüç\s]+)/gi,
      /(?:demande[r]?\s+à|dis\s+à|dit\s+à)\s+([a-záàâäéèêëíìîïóòôöúùûüç\s]+)/gi,
      /([a-záàâäéèêëíìîïóòôöúùûüç]+)\s+(?:doit|va|peut|should)/gi
    ];
    
    for (const pattern of assignmentPatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        const nameCandidate = match[1].trim();
        
        // Matching avec participants existants (fuzzy)
        const foundParticipant = participants.find(p => {
          const pName = p.name.toLowerCase();
          const candidate = nameCandidate.toLowerCase();
          return pName.includes(candidate) || 
                 candidate.includes(pName) ||
                 this.fuzzyNameMatch(pName, candidate);
        });
        
        if (foundParticipant) {
          assignedTo = foundParticipant.name;
          description = description.replace(new RegExp(match[0], 'gi'), '').trim();
          break;
        } else if (nameCandidate.length > 2 && /^[a-záàâäéèêëíìîïóòôöúùûüç\s]+$/i.test(nameCandidate)) {
          assignedTo = nameCandidate;
          description = description.replace(new RegExp(match[0], 'gi'), '').trim();
        }
      }
      if (assignedTo) break;
    }
    
    // Extraction de date d'échéance
    let dueDate = null;
    const datePatterns = [
      /(avant le|pour le|d'ici le|échéance|deadline)\s*:?\s*([0-9\/\-\.]+)/i,
      /(demain|aujourd'hui|cette semaine|semaine prochaine)/i
    ];
    
    for (const pattern of datePatterns) {
      const match = query.match(pattern);
      if (match) {
        dueDate = match[2] || match[1];
        description = description.replace(match[0], '').trim();
        break;
      }
    }
    
    // Actions spécifiques détectées
    const actionTypes = {
      'acheter': /(?:achat|acheter|commander)\s+(?:de\s+|des?\s+)?([^.!?\n]+)/i,
      'contacter': /contacter\s+([^.!?\n]+)/i,
      'vérifier': /vérifier\s+([^.!?\n]+)/i,
      'préparer': /préparer\s+([^.!?\n]+)/i,
      'organiser': /organiser\s+([^.!?\n]+)/i,
      'programmer': /programmer\s+([^.!?\n]+)/i
    };
    
    let actionType = 'général';
    for (const [type, pattern] of Object.entries(actionTypes)) {
      const match = query.match(pattern);
      if (match) {
        actionType = type;
        if (!description || description.length < 10) {
          description = `${type.charAt(0).toUpperCase() + type.slice(1)} ${match[1].trim()}`;
        }
        break;
      }
    }
    
    // Nettoyage final
    description = description
      .replace(/CONTEXT_PARTICIPANTS:.*$/gi, '')
      .replace(/^\W+|\W+$/g, '')
      .trim();
    
    if (!description || description.length < 3) {
      description = 'Nouvelle tâche à définir';
    }
    
    return {
      type: 'create',
      data: {
        description,
        assigned_to: assignedTo,
        due_date: dueDate,
        action_type: actionType,
        context: 'medical_administrative'
      }
    };
  }

  private fuzzyNameMatch(name1: string, name2: string): boolean {
    const words1 = name1.split(/\s+/);
    const words2 = name2.split(/\s+/);
    
    return words1.some(w1 => 
      words2.some(w2 => 
        Math.abs(w1.length - w2.length) <= 2 && 
        (w1.includes(w2) || w2.includes(w1) || this.levenshteinDistance(w1, w2) <= 2)
      )
    );
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private identifySearchTarget(query: string): string {
    const targets = {
      'document': ['document', 'fichier', 'pdf', 'rapport'],
      'person': ['personne', 'patient', 'docteur', 'collègue', 'participant'],
      'task': ['tâche', 'todo', 'action', 'travail'],
      'meeting': ['réunion', 'meeting', 'rendez-vous', 'consultation'],
      'information': ['info', 'information', 'détail', 'donnée']
    };
    
    const lowerQuery = query.toLowerCase();
    for (const [target, keywords] of Object.entries(targets)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        return target;
      }
    }
    
    return 'general';
  }

  private buildUltraEnrichedContext(databaseContext: any, embeddingContext: any, internetContext: any, analysis: any): any {
    const enriched = {
      // Données de base
      meetings: databaseContext.meetings || [],
      documents: databaseContext.documents || [],
      todos: databaseContext.todos || [],
      participants: databaseContext.participants || [],
      chunks: embeddingContext.chunks || [],
      sources: embeddingContext.sources || [],
      
      // Enrichissements
      fuzzyMatches: databaseContext.fuzzyMatches || [],
      targetedExtracts: databaseContext.targetedExtracts || null,
      internetContent: internetContext.content || '',
      internetSources: internetContext.sources || [],
      
      // Métriques de qualité
      hasEmbeddingContext: embeddingContext.hasRelevantContext || false,
      hasInternetContext: internetContext.hasContent || false,
      searchQuality: {
        embeddingIterations: embeddingContext.searchIterations || 0,
        expansionLevel: embeddingContext.expansionLevel || 0,
        chunksFound: embeddingContext.chunks?.length || 0,
        totalDataPoints: (databaseContext.meetings?.length || 0) + 
                        (databaseContext.documents?.length || 0) + 
                        (databaseContext.todos?.length || 0) + 
                        (embeddingContext.chunks?.length || 0)
      },
      
      // Contexte médical
      medicalContext: {
        cabinetName: 'OphtaCare',
        doctor: 'Dr Tabibian',
        location: 'Genève',
        specialty: 'Ophtalmologie',
        userRole: 'Responsable Administratif'
      }
    };
    
    return enriched;
  }

  private evaluateDataQualityEnhanced(contextData: any, analysis: any, actionAnalysis: any): any {
    const quality = {
      sufficient: false,
      score: 0,
      details: {},
      recommendations: []
    };
    
    // Scoring basé sur la richesse des données
    const dataPoints = {
      meetings: contextData.meetings.length,
      documents: contextData.documents.length,
      todos: contextData.todos.length,
      participants: contextData.participants.length,
      chunks: contextData.chunks.length
    };
    
    // Calcul du score de qualité
    Object.entries(dataPoints).forEach(([type, count]) => {
      if (count > 0) quality.score += 20;
      if (count > 3) quality.score += 10;
      if (count > 8) quality.score += 10;
    });
    
    // Bonus pour correspondance avec analyse
    if (contextData.hasEmbeddingContext) quality.score += 30;
    if (contextData.targetedExtracts?.sections?.length > 0) quality.score += 20;
    if (contextData.fuzzyMatches?.length > 0) quality.score += 15;
    
    // Évaluation spéciale pour actions
    if (actionAnalysis.isAction) {
      quality.sufficient = true; // Actions nécessitent moins de contexte
      quality.score += 50;
    } else {
      quality.sufficient = quality.score >= 60; // Seuil pour questions générales
    }
    
    quality.details = dataPoints;
    
    if (!quality.sufficient) {
      quality.recommendations = [
        'Préciser le contexte temporel (récent, cette semaine, etc.)',
        'Mentionner des noms de personnes ou entités spécifiques',
        'Utiliser des termes liés au cabinet médical OphtaCare'
      ];
    }
    
    return quality;
  }

  private validateMedicalContext(query: string, contextData: any, analysis: any): any {
    const validation = {
      isRelevant: true,
      needsClarification: false,
      context: 'medical_administrative',
      suggestions: []
    };
    
    const lowerQuery = query.toLowerCase();
    
    // Vérification du contexte médical/administratif
    const medicalTerms = ['patient', 'consultation', 'traitement', 'médical', 'cabinet', 'ophtalmologie', 'docteur'];
    const adminTerms = ['tâche', 'planning', 'gestion', 'organisation', 'administratif', 'réunion'];
    const ophtalmoTerms = ['ophtacare', 'tabibian', 'genève', 'fischer', 'dupixent'];
    
    const hasMedicalContext = medicalTerms.some(term => lowerQuery.includes(term));
    const hasAdminContext = adminTerms.some(term => lowerQuery.includes(term));
    const hasOphtalmoContext = ophtalmoTerms.some(term => lowerQuery.includes(term));
    
    // Demande de clarification si contexte trop général
    if (!hasMedicalContext && !hasAdminContext && !hasOphtalmoContext && 
        contextData.searchQuality.totalDataPoints < 3) {
      validation.needsClarification = true;
      validation.suggestions = [
        'Préciser le contexte du cabinet OphtaCare',
        'Mentionner s\'il s\'agit d\'une question administrative ou médicale',
        'Indiquer des noms de patients, collaborateurs ou équipements spécifiques'
      ];
    }
    
    return validation;
  }

  private generateClarificationRequest(originalQuery: string, analysis: any, dataQuality: any, contextValidation: any): string {
    return `Je voudrais vous aider au mieux avec votre demande : "${originalQuery}"

**Pour vous fournir une réponse précise, j'aurais besoin de plus de contexte :**

${contextValidation.suggestions.map((s: string) => `• ${s}`).join('\n')}

**Données disponibles dans OphtaCare :**
• ${dataQuality.details.meetings} réunions récentes
• ${dataQuality.details.documents} documents
• ${dataQuality.details.todos} tâches en cours
• ${dataQuality.details.participants} participants/collaborateurs

**Suggestions pour affiner votre demande :**
${dataQuality.recommendations.map((r: string) => `• ${r}`).join('\n')}

Pouvez-vous reformuler votre question en précisant le contexte administratif ou médical du cabinet OphtaCare ?`;
  }

  private async generateEnrichedResponse(
    originalQuery: string,
    conversationHistory: any[],
    contextData: any,
    analysis: any,
    actionAnalysis: any,
    contextValidation: any
  ): Promise<string> {
    const hasRichContext = contextData.searchQuality.totalDataPoints > 5;

    let systemPrompt = `Tu es l'assistant IA spécialisé du cabinet d'ophtalmologie OphtaCare du Dr Tabibian à Genève.

CONTEXTE OPHTACARE RENFORCÉ :
- Cabinet : OphtaCare, dirigé par Dr Tabibian, Genève
- Utilisateur : Responsable administratif du cabinet
- Spécialité : Ophtalmologie et gestion administrative médicale
- Mission : Assistance administrative complète et gestion du cabinet

DONNÉES ENRICHIES DISPONIBLES :
- Réunions : ${contextData.meetings.length} (avec transcripts détaillés)
- Documents : ${contextData.documents.length} (avec contenus analysés)
- Tâches : ${contextData.todos.length} (avec participants et statuts)
- Participants/Collaborateurs : ${contextData.participants.length}
- Extraits sémantiques : ${contextData.chunks.length} chunks pertinents
${contextData.targetedExtracts ? `- Extractions ciblées : ${contextData.targetedExtracts.sections.length} sections` : ''}
${contextData.fuzzyMatches?.length > 0 ? `- Correspondances approximatives : ${contextData.fuzzyMatches.length}` : ''}

QUALITÉ DE RECHERCHE ULTRA-ENRICHIE :
- Itérations de recherche : ${contextData.searchQuality.embeddingIterations}
- Niveau d'expansion : ${contextData.searchQuality.expansionLevel}
- Points de données total : ${contextData.searchQuality.totalDataPoints}
- Recherche vectorielle ${contextData.hasEmbeddingContext ? 'RÉUSSIE' : 'limitée'}

${actionAnalysis.isAction ? `
ACTION DÉTECTÉE :
Type : ${actionAnalysis.action.type}
Confiance : ${(actionAnalysis.confidence * 100).toFixed(0)}%
${actionAnalysis.action.type === 'create' && actionAnalysis.action.details?.taskCreation ? `
CRÉATION DE TÂCHE REQUISE :
Description : "${actionAnalysis.action.details.taskCreation.data.description}"
${actionAnalysis.action.details.taskCreation.data.assigned_to ? `Assignée à : ${actionAnalysis.action.details.taskCreation.data.assigned_to}` : ''}
${actionAnalysis.action.details.taskCreation.data.due_date ? `Échéance : ${actionAnalysis.action.details.taskCreation.data.due_date}` : ''}

SYNTAXE REQUISE POUR TÂCHE :
[ACTION_TACHE: TYPE=CREATE, description="${actionAnalysis.action.details.taskCreation.data.description}", assigned_to="${actionAnalysis.action.details.taskCreation.data.assigned_to || ''}", due_date="${actionAnalysis.action.details.taskCreation.data.due_date || ''}"]
` : ''}
` : ''}

INSTRUCTIONS ULTRA-ENRICHIES :
1. TOUJOURS maintenir le contexte cabinet OphtaCare dans tes réponses
2. Utiliser TOUTES les données disponibles pour enrichir au maximum
3. Prioriser les informations internes sur les données externes
4. Faire des liens entre différentes sources de données quand pertinent
5. Proposer des actions complémentaires basées sur le contexte
6. Garder un ton professionnel médical/administratif
7. ${actionAnalysis.isAction ? 'INCLURE la syntaxe d\'action requise' : 'Répondre de manière informative'}

${contextValidation.needsClarification ? 'Si le contexte reste insuffisant, demander des précisions spécifiques.' : ''}

Réponds de manière professionnelle, précise et dans le contexte OphtaCare Genève.`;

    const userMessage = `DEMANDE ADMINISTRATIVE ENRICHIE : ${originalQuery}

${hasRichContext ? `
CONTEXTE INTERNE OPHTACARE ULTRA-ENRICHI :

📋 RÉUNIONS RÉCENTES (${contextData.meetings.length}) :
${contextData.meetings.slice(0, 3).map((m: any) => `• "${m.title}" - ${(m.summary || m.transcript || '').substring(0, 200)}...`).join('\n')}

📁 DOCUMENTS PERTINENTS (${contextData.documents.length}) :
${contextData.documents.slice(0, 3).map((d: any) => `• "${d.ai_generated_name || d.original_name}" - ${(d.ai_summary || d.extracted_text || '').substring(0, 150)}...`).join('\n')}

✅ TÂCHES EN COURS (${contextData.todos.length}) :
${contextData.todos.slice(0, 5).map((t: any) => `• [${t.status}] ${t.description}${t.assigned_to ? ` (${t.assigned_to})` : ''}${t.due_date ? ` - Échéance: ${new Date(t.due_date).toLocaleDateString()}` : ''}`).join('\n')}

👥 PARTICIPANTS/COLLABORATEURS (${contextData.participants.length}) :
${contextData.participants.slice(0, 8).map((p: any) => `• ${p.name} (${p.email})`).join('\n')}

🔍 EXTRAITS SÉMANTIQUES PERTINENTS (${contextData.chunks.length}) :
${contextData.chunks.slice(0, 4).map((c: any, i: number) => `${i+1}. [Score: ${c.similarity?.toFixed(3)}] ${(c.chunk_text || '').substring(0, 200)}...`).join('\n')}

${contextData.targetedExtracts ? `
🎯 EXTRACTIONS CIBLÉES pour "${contextData.targetedExtracts.entity}" :
${contextData.targetedExtracts.sections.slice(0, 2).map((s: string) => `• ${s.substring(0, 150)}...`).join('\n')}
` : ''}

${contextData.fuzzyMatches?.length > 0 ? `
🔄 CORRESPONDANCES APPROXIMATIVES :
${contextData.fuzzyMatches.slice(0, 2).map((fm: any) => `• "${fm.originalTerm}" → ${fm.matches.length} résultats`).join('\n')}
` : ''}
` : 'Contexte limité - utiliser les données disponibles.'}

${contextData.hasInternetContext ? `
🌐 INFORMATIONS COMPLÉMENTAIRES EXTERNES :
${(contextData.internetContent || '').substring(0, 300)}...
` : ''}

Utilise TOUTES ces informations pour fournir la réponse la plus complète et précise possible dans le contexte OphtaCare.`;

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
          max_tokens: 1500, // Plus de tokens pour réponses enrichies
        }),
      });

      const data = await response.json();
      let finalResponse = data.choices[0]?.message?.content || 
                         'Désolé, je ne peux pas traiter votre demande pour le moment.';
      
      // Nettoyage final
      finalResponse = finalResponse.replace(/\s*CONTEXT_PARTICIPANTS:.*$/gi, '').trim();
      
      return finalResponse;
      
    } catch (error) {
      console.error('[SYNTHESIS] Error generating enriched response:', error);
      
      // Fallback enrichi avec action si applicable
      if (actionAnalysis.isAction && actionAnalysis.action.type === 'create') {
        const taskData = actionAnalysis.action.details.taskCreation.data;
        const actionSyntax = `[ACTION_TACHE: TYPE=CREATE, description="${taskData.description}", assigned_to="${taskData.assigned_to || ''}", due_date="${taskData.due_date || ''}"]`;
        
        return `Je vais créer cette tâche pour le cabinet OphtaCare selon votre demande :

**Nouvelle tâche administrative :**
- Description : ${taskData.description}
${taskData.assigned_to ? `- Assignée à : ${taskData.assigned_to}` : ''}
${taskData.due_date ? `- Échéance : ${taskData.due_date}` : ''}
- Contexte : Gestion administrative cabinet OphtaCare

${actionSyntax}

Cette tâche sera intégrée dans le système de gestion du cabinet.`;
      }
      
      return `Je rencontre un problème technique temporaire. Les données OphtaCare sont disponibles (${contextData.searchQuality.totalDataPoints} éléments trouvés), mais je ne peux pas générer la réponse complète actuellement. 

Pouvez-vous reformuler votre demande ou réessayer dans quelques instants ?`;
    }
  }
}
