export class SynthesisAgent {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesizeResponse(
    userMessage: string,
    conversationHistory: any[],
    databaseContext: any,
    embeddingsResult: any,
    internetContext: any,
    analysis: any,
    taskContext: any,
    meetingPreparationResult: any = null
  ): Promise<string> {
    console.log('[SYNTHESIS] 🏥 Synthèse INTELLIGENTE Cabinet Dr Tabibian');

    const isReferencingPrevious = this.detectReferencePattern(userMessage);
    const isContinuation = conversationHistory.length > 0 && this.detectContinuation(userMessage);
    const contextInfo = this.analyzeContextType(userMessage, conversationHistory);
    const previousSubject = this.extractPreviousSubject(conversationHistory);

    console.log(`[SYNTHESIS] 🧠 Analyse du contexte APPROFONDIE: ${JSON.stringify({
      isReferencingPrevious,
      isContinuation,
      context: contextInfo.context,
      continuationType: contextInfo.continuationType,
      previousSubject
    })}`);

    console.log(`[SYNTHESIS] 🎯 Sujet principal détecté: ${previousSubject}`);

    const conversationContext = this.formatConversationHistory(conversationHistory);
    console.log('[SYNTHESIS] 📜 Formatage de l\'historique pour continuité MAXIMALE');

    let contextBuilder = '';
    let primarySource = 'general';

    if (embeddingsResult?.chunks?.length > 0) {
      console.log('[SYNTHESIS] 🎯 Utilisation des données embeddings disponibles');
      primarySource = 'embeddings';
      
      const embeddingsContext = embeddingsResult.chunks.slice(0, 10).map((chunk: any, index: number) => {
        return `Document: ${chunk.document_name || 'Inconnu'}\nContenu: ${chunk.chunk_text}`;
      }).join('\n\n---\n\n');
      
      contextBuilder += `CONTEXTE DOCUMENTS VECTORISÉS:\n${embeddingsContext}\n\n`;
    }

    if (databaseContext?.meetings?.length > 0 || databaseContext?.todos?.length > 0 || databaseContext?.participants?.length > 0) {
      console.log('[SYNTHESIS] 🗄️ Utilisation des données base de données');
      
      if (databaseContext.meetings?.length > 0) {
        const meetingsContext = databaseContext.meetings.slice(0, 8).map((meeting: any) => {
          return `Réunion: ${meeting.title}\nRésumé: ${meeting.summary || 'Pas de résumé'}\nDate: ${meeting.created_at}`;
        }).join('\n\n---\n\n');
        contextBuilder += `CONTEXTE RÉUNIONS:\n${meetingsContext}\n\n`;
      }

      if (databaseContext.todos?.length > 0) {
        // CORRECTION : Afficher TOUTES les tâches au lieu de se limiter à 8
        const todosContext = databaseContext.todos.map((todo: any, index: number) => {
          const participants = todo.participants?.map((tp: any) => tp.participant?.name).join(', ') || 'Aucun participant assigné';
          const priority = todo.priority || 'Non définie';
          const dueDate = todo.due_date ? new Date(todo.due_date).toLocaleDateString('fr-FR') : 'Pas d\'échéance';
          const createdDate = new Date(todo.created_at).toLocaleDateString('fr-FR');
          
          return `${index + 1}. TÂCHE: ${todo.description}
   STATUT: ${todo.status}
   PRIORITÉ: ${priority}
   PARTICIPANTS: ${participants}
   ÉCHÉANCE: ${dueDate}
   CRÉÉE LE: ${createdDate}`;
        }).join('\n\n');
        contextBuilder += `CONTEXTE TÂCHES COMPLÈTES (${databaseContext.todos.length} tâches):\n${todosContext}\n\n`;
      }

      if (databaseContext.participants?.length > 0) {
        const participantsContext = databaseContext.participants.slice(0, 10).map((participant: any) => {
          return `Participant: ${participant.name}\nEmail: ${participant.email}`;
        }).join('\n\n---\n\n');
        contextBuilder += `CONTEXTE PARTICIPANTS:\n${participantsContext}\n\n`;
      }
    }

    // NOUVEAU : Intégration des résultats de préparation de réunion
    if (meetingPreparationResult) {
      console.log('[SYNTHESIS] 📝 Intégration résultats préparation réunion');
      
      let preparationContext = `GESTION PRÉPARATION RÉUNION:\n`;
      preparationContext += `Action effectuée: ${meetingPreparationResult.action}\n`;
      preparationContext += `Succès: ${meetingPreparationResult.success}\n`;
      preparationContext += `Message: ${meetingPreparationResult.message}\n`;
      
      if (meetingPreparationResult.points?.length > 0) {
        preparationContext += `\nPOINTS ACTUELS DE L'ORDRE DU JOUR (${meetingPreparationResult.points.length}):\n`;
        meetingPreparationResult.points.forEach((point: any, index: number) => {
          const creatorName = point.users?.name || 'Utilisateur inconnu';
          preparationContext += `${index + 1}. ${point.point_text} (ajouté par ${creatorName})\n`;
        });
      } else {
        preparationContext += `\nAucun point dans l'ordre du jour actuellement.\n`;
      }
      
      contextBuilder += `${preparationContext}\n\n`;
    }

    if (taskContext?.currentTasks?.length > 0 || taskContext?.taskCreated) {
      console.log('[SYNTHESIS] 📋 Utilisation des données tâches');
      
      let tasksContext = 'CONTEXTE GESTION TÂCHES:\n';
      if (taskContext.taskCreated) {
        tasksContext += `Nouvelle tâche créée: ${taskContext.taskCreated}\n`;
      }
      if (taskContext.currentTasks?.length > 0) {
        tasksContext += `Tâches pertinentes trouvées: ${taskContext.currentTasks.length}\n`;
        // CORRECTION : Afficher TOUTES les tâches pertinentes
        taskContext.currentTasks.forEach((task: any, index: number) => {
          const participants = task.participants?.map((tp: any) => tp.participant?.name).join(', ') || 'Aucun';
          const priority = task.priority || 'Non définie';
          const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('fr-FR') : 'Pas d\'échéance';
          
          tasksContext += `${index + 1}. ${task.description} (${task.status}) - Priorité: ${priority} - Participants: ${participants} - Échéance: ${dueDate}\n`;
        });
      }
      contextBuilder += `${tasksContext}\n\n`;
    }

    // NOUVEAU : Intégration du contexte internet
    if (internetContext?.hasContent && internetContext.content) {
      console.log('[SYNTHESIS] 🌐 Intégration contexte internet');
      contextBuilder += `CONTEXTE RECHERCHE INTERNET:\n${internetContext.content}\n\n`;
      primarySource = 'internet';
    }

    console.log('[SYNTHESIS] 🚀 Envoi du prompt enrichi avec contexte RENFORCÉ');

    const prompt = `Tu es OphtaCare, l'assistant IA spécialisé du cabinet d'ophtalmologie Dr Tabibian à Genève.

RÔLE ET EXPERTISE :
- Tu es l'assistant principal du cabinet d'ophtalmologie Dr Tabibian
- Tu connais parfaitement l'organisation, les participants, les tâches et les documents du cabinet
- Tu peux gérer les tâches, consulter les documents et aider à la préparation des réunions
- Tu as accès aux transcripts des réunions, aux tâches en cours et aux documents du cabinet
- Tu peux effectuer des recherches internet pour trouver des informations complémentaires

INSTRUCTIONS IMPÉRATIVES POUR LES RÉPONSES :
🔥 RÉPONSES COMPLÈTES OBLIGATOIRES :
- Quand on te demande les tâches en cours, tu DOIS afficher TOUTES les tâches trouvées avec leurs détails complets (statut, participants, priorité, échéances)
- Pour les recherches internet, tu dois donner une réponse IMMÉDIATE et COMPLÈTE, JAMAIS dire "Un instant, s'il vous plaît"
- Sois DÉTAILLÉ et EXHAUSTIF dans tes réponses
- Utilise des listes à puces pour organiser les informations
- Inclus TOUS les détails disponibles (dates, participants, statuts, priorités, etc.)

CAPACITÉS SPÉCIALES :
- Recherche dans les documents vectorisés du cabinet
- Gestion des tâches (création, suivi, attribution)
- Accès aux informations des réunions et participants
- Gestion des points de préparation de réunion (ajout, suppression, liste)
- Recherche internet pour informations complémentaires (contacts, fournisseurs, etc.)

GESTION DES POINTS DE PRÉPARATION DE RÉUNION :
- Si on te demande d'ajouter un point : confirme l'ajout et liste les points actuels
- Si on te demande de supprimer un point : confirme la suppression et explique ce qui reste
- Si on te demande la liste des points : présente-les de manière claire et organisée
- Utilise des formats visuels avec des puces pour une meilleure lisibilité

HISTORIQUE DE CONVERSATION RÉCENT :
${conversationContext}

CONTEXTE DISPONIBLE :
${contextBuilder}

ANALYSE DE LA REQUÊTE :
- Type: ${analysis.queryType || 'général'}
- Priorité: ${analysis.priority || 'générale'}
- Référence précédente: ${isReferencingPrevious ? 'Oui' : 'Non'}
- Continuation: ${isContinuation ? 'Oui' : 'Non'}
- Source principale: ${primarySource}

INSTRUCTIONS SPÉCIALES SELON LE CONTEXTE :
${this.getSpecialInstructions(userMessage, taskContext, internetContext, meetingPreparationResult)}

Question de l'utilisateur: "${userMessage}"

Réponds en tant qu'OphtaCare, l'assistant du cabinet Dr Tabibian avec une réponse COMPLÈTE et DÉTAILLÉE :`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 16384,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur OpenAI: ${response.status}`);
      }

      const data = await response.json();
      let finalResponse = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse appropriée.';

      // Nettoyage de la réponse
      finalResponse = finalResponse
        .replace(/\[ACTION_TACHE:[^\]]*\]/gs, '')
        .replace(/\s*CONTEXT_PARTICIPANTS:.*$/gi, '')
        .replace(/\s*CONTEXT_UTILISATEURS:.*$/gi, '')
        .trim();

      console.log('[SYNTHESIS] ✅ Réponse générée et nettoyée');
      return finalResponse;

    } catch (error) {
      console.error('[SYNTHESIS] ❌ Erreur lors de la synthèse:', error);
      return 'Je rencontre actuellement un problème technique. Pouvez-vous reformuler votre demande ?';
    }
  }

  private getSpecialInstructions(userMessage: string, taskContext: any, internetContext: any, meetingPreparationResult: any): string {
    const lowerMessage = userMessage.toLowerCase();
    let instructions = '';

    // Instructions pour les tâches
    if (lowerMessage.includes('tâche') || lowerMessage.includes('todo') || lowerMessage.includes('en cours')) {
      instructions += `
🔥 AFFICHAGE TÂCHES OBLIGATOIRE :
- Affiche TOUTES les tâches trouvées (${taskContext?.currentTasks?.length || 0} tâches)
- Inclus pour chaque tâche : description, statut, participants, priorité, échéance, date de création
- Utilise une numérotation claire et des puces pour l'organisation
- Sois exhaustif, ne limite jamais l'affichage`;
    }

    // Instructions pour la recherche internet
    if (internetContext?.hasContent || lowerMessage.includes('recherche') || lowerMessage.includes('internet') || lowerMessage.includes('contact') || lowerMessage.includes('fournisseur')) {
      instructions += `
🌐 RECHERCHE INTERNET :
- Donne une réponse IMMÉDIATE avec les informations trouvées
- Ne dis JAMAIS "Un instant, s'il vous plaît" ou "Je reviens avec des informations"
- Présente directement les résultats de recherche avec contacts, coordonnées, liens
- Formate les informations de manière claire avec des puces
- Inclus les sources et liens trouvés`;
    }

    // Instructions pour les points de réunion
    if (meetingPreparationResult) {
      instructions += `
📝 GESTION POINTS RÉUNION :
- Confirme l'action effectuée (${meetingPreparationResult.action})
- Affiche la liste complète et mise à jour des points
- Utilise une numérotation claire pour les points d'ordre du jour`;
    }

    return instructions;
  }

  private detectReferencePattern(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase().trim();
    
    // Mots clés qui indiquent une référence au contexte précédent (RENFORCÉS)
    const referenceKeywords = [
      'ça', 'cela', 'cette', 'celui', 'celle', 'ceci', 'celui-ci', 'celle-ci',
      'la même', 'le même', 'les mêmes', 'comme ça', 'pareille', 'similaire',
      'pour ça', 'avec ça', 'de ça', 'du premier', 'le premier', 'la première',
      'premier que', 'mentionné', 'dit', 'parlé', 'évoqué', 'discuté',
      'précédent', 'précédente', 'avant', 'tantôt', 'plus haut', 'ci-dessus'
    ];

    return referenceKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private detectContinuation(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase().trim();
    
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

    return continuationKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private analyzeContextType(userMessage: string, conversationHistory: any[]): any {
    if (!conversationHistory || conversationHistory.length === 0) {
      return { 
        isReferencingPrevious: false, 
        isContinuation: false,
        context: '',
        continuationType: 'none',
        previousSubject: null
      };
    }

    const lowerMessage = userMessage.toLowerCase().trim();
    
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

  private extractPreviousSubject(conversationHistory: any[]): string | null {
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

  private formatConversationHistory(conversationHistory: any[]): string {
    if (!conversationHistory || conversationHistory.length === 0) return '';

    let formattedHistory = '';
    conversationHistory.forEach((msg: any, index: number) => {
      const role = msg.isUser ? '👤 UTILISATEUR' : '🤖 ASSISTANT';
      const timestamp = new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      formattedHistory += `[${index + 1}] ${role} [${timestamp}]: "${msg.content}"\n\n`;
    });

    return formattedHistory;
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
