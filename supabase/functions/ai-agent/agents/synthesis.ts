
export class SynthesisAgent {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  async synthesizeResponse(
    message: string,
    conversationHistory: any[],
    databaseContext: any,
    embeddingContext: any,
    internetContext: any,
    analysis: any,
    taskContext: any
  ): Promise<string> {
    console.log('[SYNTHESIS] 🏥 Synthèse INTELLIGENTE Cabinet Dr Tabibian');

    // Si une tâche vient d'être créée, réponse rapide et directe
    if (taskContext.taskCreated) {
      console.log('[SYNTHESIS] ✅ Tâche créée - réponse directe');
      const task = taskContext.taskCreated;
      const assignedName = await this.getAssignedName(task.assigned_to);
      
      let response = `✅ **Tâche créée avec succès !**\n\n`;
      response += `📋 **Description :** ${task.description}\n`;
      if (assignedName) {
        response += `👤 **Assignée à :** ${assignedName}\n`;
      }
      response += `📅 **Statut :** Confirmée\n`;
      response += `🆔 **ID :** ${task.id}\n\n`;
      response += `La tâche a été ajoutée au système et est maintenant visible dans la liste des tâches.`;
      
      // Ajouter la syntaxe d'action pour l'interface
      response += `\n\n[ACTION_TACHE: TYPE=create, id=${task.id}, description="${task.description}", status="confirmed"`;
      if (task.assigned_to) {
        response += `, assigned_to="${task.assigned_to}"`;
      }
      response += `]`;
      
      return response;
    }

    // Si tâche en attente d'assignation SEULEMENT SI EXPLICITEMENT DEMANDÉE
    if (taskContext.pendingTaskCreation?.waitingForAssignment) {
      console.log('[SYNTHESIS] ⏳ Demande d\'assignation pour tâche');
      let response = `Je vais créer une tâche pour "${taskContext.pendingTaskCreation.description}". \n\n`;
      response += `À qui devrais-je assigner cette tâche ? Vous pouvez choisir parmi les participants suivants :\n`;
      response += `• David Tabibian\n• Emilie\n• Leila\n• Parmice\n• Sybil\n\n`;
      response += `Répondez simplement avec le nom de la personne.`;
      return response;
    }

    // NOUVELLE ANALYSE APPROFONDIE DU CONTEXTE DE CONVERSATION
    const contextAnalysis = this.analyzeConversationContext(message, conversationHistory);
    console.log('[SYNTHESIS] 🧠 Analyse du contexte APPROFONDIE:', contextAnalysis);

    // EXTRACTION DU SUJET PRINCIPAL ACTIF
    const mainSubject = this.extractMainSubject(conversationHistory, message);
    console.log('[SYNTHESIS] 🎯 Sujet principal détecté:', mainSubject);

    // Déterminer le type de synthèse basé sur le contexte disponible
    let synthesisType = 'database';
    
    if (embeddingContext.hasRelevantContext) {
      synthesisType = 'embeddings';
      console.log('[SYNTHESIS] 🎯 Phase 1: Réponse basée sur recherche vectorielle');
    } else if (databaseContext.meetings?.length > 0 || databaseContext.documents?.length > 0) {
      synthesisType = 'database';
      console.log('[SYNTHESIS] 🗄️ Phase 1: Réponse basée sur données structurées');
    } else if (internetContext.hasContent) {
      synthesisType = 'internet';
      console.log('[SYNTHESIS] 🌐 Phase 1: Réponse basée sur recherche internet');
    } else if (taskContext.hasTaskContext) {
      synthesisType = 'tasks';
      console.log('[SYNTHESIS] 📋 Phase 1: Réponse basée sur gestion des tâches');
    } else {
      synthesisType = 'general';
      console.log('[SYNTHESIS] 💬 Phase 1: Réponse conversationnelle générale');
    }

    // Construction du prompt système avec priorité ABSOLUE à la continuité
    let systemPrompt = `🚨🚨🚨 INSTRUCTION CRITIQUE PRIORITÉ ABSOLUE - CONTINUITÉ DE CONVERSATION 🚨🚨🚨

Tu es l'assistant IA spécialisé du cabinet d'ophtalmologie Dr Tabibian à Genève, Suisse.

═══════════════ CONTEXTE CONVERSATION ACTUEL ═══════════════
SUJET PRINCIPAL ACTIF: ${mainSubject || 'Aucun sujet spécifique détecté'}
TYPE DE CONTINUITÉ: ${contextAnalysis.continuationType}
RÉFÉRENCE PRÉCÉDENTE: ${contextAnalysis.isReferencingPrevious ? 'OUI' : 'NON'}
CONTINUATION DÉTECTÉE: ${contextAnalysis.isContinuation ? 'OUI' : 'NON'}

`;

    // HISTORIQUE DE CONVERSATION - Section ULTRA PRIORITAIRE avec formatage amélioré
    if (conversationHistory && conversationHistory.length > 0) {
      console.log('[SYNTHESIS] 📜 Formatage de l\'historique pour continuité MAXIMALE');
      
      systemPrompt += `═══════════════ HISTORIQUE CONVERSATION COMPLET ═══════════════
UTILISE CET HISTORIQUE POUR MAINTENIR LA CONTINUITÉ ABSOLUE:

`;
      
      // Prendre les 8 derniers échanges et les formater clairement
      const recentHistory = conversationHistory.slice(-8);
      
      recentHistory.forEach((msg: any, index: number) => {
        const role = msg.isUser ? '👤 UTILISATEUR' : '🤖 ASSISTANT';
        const timestamp = new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        systemPrompt += `[${index + 1}] ${role} [${timestamp}]: "${msg.content}"\n\n`;
      });

      systemPrompt += `═══════════════ FIN HISTORIQUE ═══════════════\n\n`;
    }

    // INSTRUCTIONS CRITIQUES POUR LA CONTINUITÉ
    systemPrompt += `🔥🔥🔥 RÈGLES CRITIQUES DE CONTINUITÉ 🔥🔥🔥

MESSAGE UTILISATEUR ACTUEL: "${message}"

🎯 ANALYSE OBLIGATOIRE AVANT RÉPONSE:
1. DE QUOI parle ce message ? ${mainSubject ? `Le sujet semble être: ${mainSubject}` : 'Analyser l\'historique pour comprendre'}
2. Est-ce une CONTINUATION du sujet précédent ? ${contextAnalysis.isContinuation ? 'OUI - maintenir le sujet' : 'Vérifier l\'historique'}
3. Si l'utilisateur dit "recherche", "site", "adresse" → rechercher QUOI exactement ?

🚨 INSTRUCTIONS IMPÉRATIVES:
- Si l'utilisateur dit "recherche sur internet/web" → il parle du SUJET PRÉCÉDENT dans l'historique
- Si l'utilisateur dit "site internet", "adresse" → il veut les coordonnées du SUJET PRÉCÉDENT  
- Si l'utilisateur dit "ça", "cela", "le même" → se référer au DERNIER SUJET mentionné
- JAMAIS supposer qu'il parle du cabinet Dr Tabibian sauf s'il le mentionne explicitement
- TOUJOURS vérifier l'historique pour comprendre le CONTEXTE

`;

    // Cas spécial pour les demandes courtes avec contexte
    if (contextAnalysis.isContinuation && mainSubject) {
      systemPrompt += `🔥🔥🔥 CONTINUITÉ DÉTECTÉE - TRAITEMENT SPÉCIALISÉ 🔥🔥🔥
L'utilisateur demande: "${message}"
Concernant le sujet: "${mainSubject}"
➡️ INTERPRÉTATION: "${message}" signifie "${message} pour ${mainSubject}"
➡️ AGIR EN CONSÉQUENCE pour ${mainSubject} !

`;
    }

    // Instructions générales pour l'assistant
    systemPrompt += `
MISSION: Fournir une assistance administrative et médicale experte avec un ton professionnel et bienveillant.

CONTEXTE CABINET:
- Cabinet d'ophtalmologie Dr David Tabibian
- Situé à Genève, Suisse 
- Spécialisé en ophtalmologie et chirurgie oculaire

PARTICIPANTS DISPONIBLES POUR ASSIGNATION (SI DEMANDÉ):
- David Tabibian (ID: c04c6400-1025-4906-9823-30478123bd71)
- Emilie (ID: 9b8b37f6-ee0c-4354-be18-6a0ca0930b12)
- Leila (ID: 42445b1f-d701-4f30-b57c-48814b64a1df)
- Parmice (ID: a0c5df24-45ba-49c8-bb5e-1a6e9fc7f49d)
- Sybil (ID: 2fdb2b35-91ef-4966-93ec-9261172c31c1)

RÈGLES DE COMMUNICATION:
- Ton professionnel mais accessible
- Réponses précises et actionnables
- Toujours contextualiser par rapport au cabinet Dr Tabibian
- Pour les prix, utiliser les CHF (francs suisses)
- JAMAIS inventer de coordonnées, téléphones ou contacts
- SEULEMENT utiliser les informations trouvées via internet si disponibles
- NE PAS proposer automatiquement de créer des tâches

RÈGLES STRICTES POUR LES COORDONNÉES:
- JAMAIS inventer de numéros de téléphone
- SEULEMENT utiliser les coordonnées trouvées dans internetContext si hasContent=true
- Si pas de coordonnées trouvées via internet, dire "Je n'ai pas trouvé les coordonnées de contact"
- TOUJOURS préciser la source des informations (internet ou données internes)

GESTION DES TÂCHES (SEULEMENT SI DEMANDÉ):
- Créer une tâche SEULEMENT quand explicitement demandé par l'utilisateur
- Mots-clés pour création: "créer une tâche", "créé une tâche", "nouvelle tâche", "faire une tâche"
- Si pas d'assignation précisée, demander à qui assigner
- JAMAIS proposer automatiquement de créer une tâche
`;

    // Ajouter le contexte des tâches si disponible
    if (taskContext.hasTaskContext && taskContext.currentTasks.length > 0) {
      systemPrompt += `\nTÂCHES EN COURS (${taskContext.currentTasks.length}):\n`;
      taskContext.currentTasks.forEach((task: any, index: number) => {
        systemPrompt += `${index + 1}. ${task.description} (ID: ${task.id}, Statut: ${task.status})\n`;
      });
    }

    // Ajouter le contexte internet SEULEMENT s'il y a vraiment du contenu ET correspond au sujet
    if (internetContext.hasContent && internetContext.content) {
      console.log('[SYNTHESIS] 🌐 Utilisation des données Internet VÉRIFIÉES avec contexte');
      const searchSubject = mainSubject || 'votre demande';
      systemPrompt += `\nINFORMATIONS INTERNET VÉRIFIÉES POUR: ${searchSubject}:\n${internetContext.content}\n`;
      systemPrompt += `\nSOURCE: Recherche internet via Perplexity AI\n`;
    } else {
      systemPrompt += `\nAUCUNE INFORMATION INTERNET DISPONIBLE - ne pas inventer de coordonnées\n`;
    }

    // Ajouter le contexte des embeddings si disponible
    if (embeddingContext.hasRelevantContext) {
      console.log('[SYNTHESIS] 🎯 Utilisation des données embeddings disponibles');
      systemPrompt += `\nCONTEXTE DOCUMENTAIRE CABINET (${embeddingContext.chunks.length} éléments):\n`;
      embeddingContext.chunks.slice(0, 5).forEach((chunk: any, index: number) => {
        systemPrompt += `${index + 1}. ${chunk.chunk_text.substring(0, 200)}...\n`;
      });
    }

    // Ajouter le contexte de base de données
    if (databaseContext.meetings?.length > 0) {
      systemPrompt += `\nRÉUNIONS RÉCENTES (${databaseContext.meetings.length}):\n`;
      databaseContext.meetings.slice(0, 3).forEach((meeting: any, index: number) => {
        systemPrompt += `${index + 1}. ${meeting.title} (${meeting.meeting_date})\n`;
      });
    }

    systemPrompt += `\n🔥 QUESTION/DEMANDE ACTUELLE: ${message}

RAPPEL FINAL CRITIQUE: 
- AVANT de répondre, identifie clairement DE QUOI parle l'utilisateur
- Utilise l'historique de conversation pour comprendre le contexte COMPLET
- Si l'utilisateur dit "recherche sur internet", comprends qu'il veut chercher le sujet de la conversation précédente
- JAMAIS inventer de coordonnées ou téléphones
- SEULEMENT utiliser les informations trouvées via internet si disponibles
- Maintiens la CONTINUITÉ ABSOLUE avec la conversation précédente
- Si le message est court et fait référence à quelque chose, cherche QUOI dans l'historique`;

    console.log('[SYNTHESIS] 🚀 Envoi du prompt enrichi avec contexte RENFORCÉ');

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
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate response');
    }

    const aiData = await response.json();
    return aiData.choices[0].message.content;
  }

  private analyzeConversationContext(message: string, conversationHistory: any[]): any {
    if (!conversationHistory || conversationHistory.length === 0) {
      return { 
        isReferencingPrevious: false, 
        isContinuation: false,
        context: '',
        continuationType: 'none',
        previousSubject: null
      };
    }

    const lowerMessage = message.toLowerCase().trim();
    
    // Mots clés qui indiquent une référence au contexte précédent (RENFORCÉS)
    const referenceKeywords = [
      'ça', 'cela', 'cette', 'celui', 'celle', 'ceci', 'celui-ci', 'celle-ci',
      'la même', 'le même', 'les mêmes', 'comme ça', 'pareille', 'similaire',
      'pour ça', 'avec ça', 'de ça', 'du premier', 'le premier', 'la première',
      'premier que', 'mentionné', 'dit', 'parlé', 'évoqué', 'discuté',
      'précédent', 'précédente', 'avant', 'tantôt', 'plus haut', 'ci-dessus'
    ];

    // Mots clés pour continuité d'action (RENFORCÉS)
    const continuationKeywords = [
      'recherche sur internet', 'cherche sur internet', 'trouve sur internet',
      'recherche internet', 'cherche internet', 'trouve internet',
      'recherche sur le web', 'cherche sur le web', 'trouve sur le web',
      'recherche web', 'cherche web', 'trouve web',
      'recherche', 'cherche', 'trouve', 'contact', 'coordonnées',
      'site internet', 'site web', 'adresse internet', 'adresse web',
      'numéro', 'téléphone', 'email', 'mail', 'informations',
      'pour moi', 'stp', 's\'il te plaît', 'aide moi'
    ];

    const isReferencingPrevious = referenceKeywords.some(keyword => lowerMessage.includes(keyword));
    const isContinuation = continuationKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // Analyser les derniers messages pour extraire le contexte
    let previousSubject = null;
    let continuationType = 'none';
    let contextDescription = '';

    if (isReferencingPrevious || isContinuation) {
      // Chercher dans les 6 derniers messages pour identifier le sujet
      const recentMessages = conversationHistory.slice(-6);
      
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msg = recentMessages[i];
        if (msg.isUser && msg.content.toLowerCase() !== lowerMessage) {
          const content = msg.content.toLowerCase();
          
          // Identifier des sujets spécifiques avec plus de patterns
          if (content.includes('nespresso') || content.includes('café')) {
            previousSubject = 'Nespresso Professionnel';
            contextDescription = 'Référence à la recherche de contacts Nespresso Professionnel';
            continuationType = 'contact_search';
            break;
          }
          if (content.includes('fontaine') && content.includes('eau')) {
            previousSubject = 'fontaine à eau';
            contextDescription = 'Référence à la fontaine à eau discutée précédemment';
            continuationType = 'equipment_search';
            break;
          }
          if (content.includes('fournisseur') || content.includes('prestataire') || content.includes('entreprise')) {
            previousSubject = this.extractCompanyName(content) || 'fournisseur mentionné précédemment';
            contextDescription = 'Référence aux fournisseurs discutés précédemment';
            continuationType = 'supplier_search';
            break;
          }
          if (content.includes('contact') || content.includes('coordonnées') || content.includes('trouve')) {
            // Extraire le sujet de la recherche de contact plus précisément
            previousSubject = this.extractSearchSubject(content);
            contextDescription = 'Référence à une recherche de contact précédente';
            continuationType = 'contact_search';
            break;
          }
          // Nouveau: détecter les noms de produits/services
          const productMatches = content.match(/(?:contact|trouve|cherche|recherche)\s+(?:moi\s+)?(?:les?\s+)?(?:contact|coordonnées|info|information)?\s*(?:de|pour|sur)?\s+([a-zà-ÿ\s]+)/i);
          if (productMatches && productMatches[1]) {
            previousSubject = productMatches[1].trim();
            contextDescription = `Référence à la recherche pour ${previousSubject}`;
            continuationType = 'product_search';
            break;
          }
        }
      }

      // Si c'est une demande de recherche internet sans sujet précis identifié
      if (isContinuation && (lowerMessage.includes('recherche') || lowerMessage.includes('web') || lowerMessage.includes('internet')) && !previousSubject) {
        // Chercher le dernier sujet mentionné dans la conversation
        for (let i = recentMessages.length - 1; i >= 0; i--) {
          const msg = recentMessages[i];
          if (msg.isUser) {
            // Extraire le sujet principal du message
            const extractedSubject = this.extractSearchSubject(msg.content);
            if (extractedSubject) {
              previousSubject = extractedSubject;
              contextDescription = 'Demande de recherche internet pour le sujet précédent';
              continuationType = 'internet_search';
              break;
            }
          }
        }
      }
    }

    return { 
      isReferencingPrevious,
      isContinuation,
      context: contextDescription,
      continuationType,
      previousSubject
    };
  }

  private extractMainSubject(conversationHistory: any[], currentMessage: string): string | null {
    if (!conversationHistory || conversationHistory.length === 0) return null;

    // Analyser les 5 derniers messages pour extraire le sujet principal
    const recentMessages = conversationHistory.slice(-5);
    
    // Rechercher dans l'ordre inverse pour trouver le dernier sujet mentionné
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      if (msg.isUser) {
        const subject = this.extractSearchSubject(msg.content);
        if (subject) {
          console.log(`[SYNTHESIS] 🎯 Sujet extrait du message ${i}: "${subject}"`);
          return subject;
        }
      }
    }

    return null;
  }

  private extractSearchSubject(content: string): string | null {
    const lowerContent = content.toLowerCase();
    
    // Patterns pour extraire le sujet de recherche
    const patterns = [
      /(?:contact|trouve|cherche|recherche)\s+(?:moi\s+)?(?:les?\s+)?(?:contact|coordonnées|info|information)?\s*(?:de|pour|sur)?\s+([a-zà-ÿ\s]{3,30})/i,
      /(?:adresse|site|numéro|téléphone|email)\s+(?:de|pour|sur)?\s+([a-zà-ÿ\s]{3,30})/i,
      /([a-zà-ÿ\s]{3,30})\s+(?:professionnel|entreprise|société|contact|coordonnées)/i
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        let subject = match[1].trim();
        // Nettoyer le sujet extrait
        subject = subject.replace(/\b(les|des|pour|sur|avec|sans|dans|par)\b/gi, '').trim();
        if (subject.length > 2) {
          return subject;
        }
      }
    }

    return null;
  }

  private extractCompanyName(content: string): string | null {
    // Patterns pour extraire des noms d'entreprise
    const companyPatterns = [
      /([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)\s+(?:SA|SARL|AG|GmbH|Sàrl|Ltd|Inc|Corp)/i,
      /([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)\s+(?:professionnel|entreprise|société)/i
    ];

    for (const pattern of companyPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private getLastAssistantMessage(conversationHistory: any[]): string {
    if (!conversationHistory || conversationHistory.length === 0) return '';
    
    // Chercher le dernier message de l'assistant
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (!msg.isUser) {
        return msg.content;
      }
    }
    return '';
  }

  private isShortResponseToQuestion(currentMessage: string, lastAssistantMessage: string): boolean {
    // Vérifier si le message actuel est court (moins de 20 caractères)
    const isShort = currentMessage.trim().length < 20;
    
    // Vérifier si le dernier message de l'assistant contenait une question
    const hasQuestion = lastAssistantMessage.includes('?') || 
                       lastAssistantMessage.toLowerCase().includes('qui') ||
                       lastAssistantMessage.toLowerCase().includes('comment') ||
                       lastAssistantMessage.toLowerCase().includes('assigner') ||
                       lastAssistantMessage.toLowerCase().includes('préciser') ||
                       lastAssistantMessage.toLowerCase().includes('quel') ||
                       lastAssistantMessage.toLowerCase().includes('quelle');
    
    return isShort && hasQuestion;
  }

  private async getAssignedName(assignedId: string | null): Promise<string | null> {
    if (!assignedId) return null;
    
    // Cette méthode devrait récupérer le nom du participant depuis la base de données
    // Pour l'instant, on retourne l'ID - peut être amélioré plus tard
    return assignedId;
  }
}
