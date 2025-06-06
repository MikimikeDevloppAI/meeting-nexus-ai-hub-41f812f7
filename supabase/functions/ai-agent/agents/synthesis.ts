
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

    // Si tâche en attente d'assignation
    if (taskContext.pendingTaskCreation?.waitingForAssignment) {
      console.log('[SYNTHESIS] ⏳ Demande d\'assignation pour tâche');
      let response = `Je vais créer une tâche pour "${taskContext.pendingTaskCreation.description}". \n\n`;
      response += `À qui devrais-je assigner cette tâche ? Vous pouvez choisir parmi les participants suivants :\n`;
      response += `• David Tabibian\n• Emilie\n• Leila\n• Parmice\n• Sybil\n\n`;
      response += `Répondez simplement avec le nom de la personne.`;
      return response;
    }

    // Analyser l'historique pour comprendre le contexte
    const contextAnalysis = this.analyzeConversationContext(message, conversationHistory);

    // Reste de la logique de synthèse existante
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

    // Construction du prompt système amélioré avec historique AU DÉBUT
    let systemPrompt = `🚨🚨🚨 PRIORITÉ ABSOLUE - CONTEXTE CONVERSATIONNEL 🚨🚨🚨

Tu es l'assistant IA spécialisé du cabinet d'ophtalmologie Dr Tabibian à Genève, Suisse.

INSTRUCTION CRITIQUE NUMÉRO 1 - HISTORIQUE DE CONVERSATION:
Voici la conversation en cours. Tu DOIS absolument utiliser cet historique pour comprendre le contexte de la demande actuelle:

`;

    // HISTORIQUE DE CONVERSATION - Section ULTRA PRIORITAIRE
    if (conversationHistory && conversationHistory.length > 0) {
      systemPrompt += `═══════════════ CONVERSATION EN COURS ═══════════════\n`;
      
      // Prendre les 10 derniers échanges et les formater clairement
      const recentHistory = conversationHistory.slice(-10);
      
      recentHistory.forEach((msg: any, index: number) => {
        const role = msg.isUser ? '👤 UTILISATEUR' : '🤖 TOI';
        const timestamp = new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        systemPrompt += `\n${role} [${timestamp}]: "${msg.content}"\n`;
      });

      systemPrompt += `\n═══════════════ FIN CONVERSATION ═══════════════\n\n`;

      // Analyse contextuelle spéciale
      if (contextAnalysis.isReferencingPrevious) {
        systemPrompt += `🔥🔥🔥 ATTENTION CRITIQUE 🔥🔥🔥
L'utilisateur fait référence à quelque chose de la conversation précédente !
Message actuel: "${message}"
Contexte détecté: ${contextAnalysis.context}
➡️ Tu DOIS utiliser l'historique ci-dessus pour comprendre de quoi il parle !

`;
      }

      // Cas spécial pour les réponses courtes à des questions
      const lastAssistantMessage = this.getLastAssistantMessage(conversationHistory);
      const isShortResponse = this.isShortResponseToQuestion(message, lastAssistantMessage);
      
      if (isShortResponse) {
        systemPrompt += `🔥🔥🔥 RÉPONSE COURTE DÉTECTÉE 🔥🔥🔥
L'utilisateur donne une réponse courte ("${message}") à ta dernière question.
Ta dernière question était: "${lastAssistantMessage}"
➡️ Traite "${message}" comme une RÉPONSE DIRECTE à cette question !

`;
      }
    }

    systemPrompt += `
🔥 RÈGLES ABSOLUES D'UTILISATION DE L'HISTORIQUE :
1. TOUJOURS lire l'historique complet avant de répondre
2. Si l'utilisateur dit "fournisseur", "ça", "cela", "cette chose" → regarder l'historique pour comprendre DE QUOI il parle
3. Si l'utilisateur donne juste un nom après une question → c'est une réponse à ta question
4. Maintenir la CONTINUITÉ absolue de la conversation
5. JAMAIS demander des précisions si l'information est dans l'historique

MISSION: Fournir une assistance administrative et médicale experte avec un ton professionnel et bienveillant.

CONTEXTE CABINET:
- Cabinet d'ophtalmologie Dr David Tabibian
- Situé à Genève, Suisse 
- Spécialisé en ophtalmologie et chirurgie oculaire
- Équipe administrative et médicale

PARTICIPANTS DISPONIBLES POUR ASSIGNATION:
- David Tabibian (ID: c04c6400-1025-4906-9823-30478123bd71)
- Emilie (ID: 9b8b37f6-ee0c-4354-be18-6a0ca0930b12)
- Leila (ID: 42445b1f-d701-4f30-b57c-48814b64a1df)
- Parmice (ID: a0c5df24-45ba-49c8-bb5e-1a6e9fc7f49d)
- Sybil (ID: 2fdb2b35-91ef-4966-93ec-9261172c31c1)

CAPACITÉS PRINCIPALES:
- Gestion administrative (rendez-vous, dossiers patients, facturation)
- Assistance aux procédures médicales et chirurgicales
- Recherche dans les transcripts de réunions et documents
- Gestion des tâches et follow-up administratif
- Recommandations basées sur l'historique du cabinet
- Consultation de données externes pour informations récentes

RÈGLES DE COMMUNICATION:
- Ton professionnel mais accessible
- Réponses précises et actionnables
- Toujours contextualiser par rapport au cabinet Dr Tabibian
- Pour les prix, utiliser les CHF (francs suisses)
- Mentionner les sources quand tu utilises des données spécifiques
- 🔥 UTILISER L'HISTORIQUE pour comprendre les références et maintenir le contexte
- JAMAIS demander de clarification si l'information est dans l'historique de conversation

GESTION DES TÂCHES:
- Quand on te demande de créer une tâche, utilise cette syntaxe à la fin de ta réponse:
  [ACTION_TACHE: TYPE=create, description="description de la tâche", assigned_to="id_participant"]
- Pour les autres actions: TYPE=update|delete|complete avec les paramètres appropriés
- Toujours confirmer la création/modification des tâches
- Si pas d'assignation précisée, demander à qui assigner la tâche
`;

    // Ajouter le contexte des tâches si disponible
    if (taskContext.hasTaskContext && taskContext.currentTasks.length > 0) {
      systemPrompt += `\nTÂCHES EN COURS (${taskContext.currentTasks.length}):\n`;
      taskContext.currentTasks.forEach((task: any, index: number) => {
        systemPrompt += `${index + 1}. ${task.description} (ID: ${task.id}, Statut: ${task.status})\n`;
      });
    }

    // Ajouter le contexte des embeddings si disponible
    if (embeddingContext.hasRelevantContext) {
      console.log('[SYNTHESIS] 🎯 Utilisation des données embeddings disponibles');
      systemPrompt += `\nCONTEXTE DOCUMENTAIRE CABINET (${embeddingContext.chunks.length} éléments):\n`;
      embeddingContext.chunks.slice(0, 5).forEach((chunk: any, index: number) => {
        systemPrompt += `${index + 1}. ${chunk.chunk_text.substring(0, 200)}...\n`;
      });
    }

    // Ajouter le contexte internet si disponible
    if (internetContext.hasContent) {
      console.log('[SYNTHESIS] 🌐 Utilisation des données Internet disponibles');
      systemPrompt += `\nINFORMATIONS INTERNET ENRICHIES:\n${internetContext.content.substring(0, 1000)}...\n`;
    }

    // Ajouter le contexte de base de données
    if (databaseContext.meetings?.length > 0) {
      systemPrompt += `\nRÉUNIONS RÉCENTES (${databaseContext.meetings.length}):\n`;
      databaseContext.meetings.slice(0, 3).forEach((meeting: any, index: number) => {
        systemPrompt += `${index + 1}. ${meeting.title} (${meeting.meeting_date})\n`;
      });
    }

    systemPrompt += `\n🔥 QUESTION/DEMANDE ACTUELLE: ${message}

RAPPEL FINAL: Utilise l'historique de conversation ci-dessus pour comprendre le contexte et les références. Si l'utilisateur fait référence à quelque chose mentionné précédemment, utilise ces informations pour donner une réponse contextuelle appropriée.`;

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
      return { isReferencingPrevious: false, context: '' };
    }

    const lowerMessage = message.toLowerCase();
    
    // Mots clés qui indiquent une référence au contexte précédent
    const referenceKeywords = [
      'fournisseur', 'ça', 'cela', 'cette', 'celui', 'celle', 'ceci',
      'la même', 'le même', 'comme ça', 'pareille', 'similaire',
      'pour ça', 'avec ça', 'de ça'
    ];

    const isReferencingPrevious = referenceKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (isReferencingPrevious) {
      // Analyser les derniers messages pour extraire le contexte
      const recentMessages = conversationHistory.slice(-5);
      const lastAssistantMessage = recentMessages.reverse().find(msg => !msg.isUser);
      
      if (lastAssistantMessage) {
        // Extraire des sujets clés du dernier message de l'assistant
        const content = lastAssistantMessage.content.toLowerCase();
        if (content.includes('fontaine') && content.includes('eau')) {
          return { 
            isReferencingPrevious: true, 
            context: 'Référence à la fontaine à eau discutée précédemment' 
          };
        }
        if (content.includes('café')) {
          return { 
            isReferencingPrevious: true, 
            context: 'Référence à l\'achat de café discuté précédemment' 
          };
        }
        if (content.includes('tâche')) {
          return { 
            isReferencingPrevious: true, 
            context: 'Référence à la gestion de tâches discutée précédemment' 
          };
        }
      }
      
      return { 
        isReferencingPrevious: true, 
        context: 'Référence à quelque chose mentionné dans la conversation précédente' 
      };
    }

    return { isReferencingPrevious: false, context: '' };
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
