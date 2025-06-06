
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

    // Construction du contexte pour l'IA
    let contextData = '';
    
    // HISTORIQUE DE CONVERSATION AMÉLIORÉ - Section prioritaire
    if (conversationHistory && conversationHistory.length > 0) {
      contextData += `\n\n=== CONTEXTE CONVERSATIONNEL CRUCIAL ===\n`;
      contextData += `INSTRUCTIONS: UTILISE CET HISTORIQUE POUR COMPRENDRE LE CONTEXTE, LES RÉFÉRENCES ET LA CONTINUITÉ DE LA CONVERSATION.\n`;
      contextData += `Les messages récents te donnent le contexte nécessaire pour répondre de manière cohérente.\n\n`;
      
      contextData += `DERNIERS ÉCHANGES DE LA CONVERSATION:\n`;
      conversationHistory.slice(-6).forEach((msg: any, index: number) => {
        const role = msg.isUser ? '👤 UTILISATEUR' : '🤖 ASSISTANT';
        const timestamp = new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        contextData += `[${timestamp}] ${role}: ${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}\n\n`;
      });
      
      contextData += `=== FIN CONTEXTE CONVERSATIONNEL ===\n\n`;
    }
    
    // Ajouter le contexte des tâches si disponible
    if (taskContext.hasTaskContext && taskContext.currentTasks.length > 0) {
      contextData += `\n\nTÂCHES EN COURS (${taskContext.currentTasks.length}):\n`;
      taskContext.currentTasks.forEach((task: any, index: number) => {
        contextData += `${index + 1}. ${task.description} (ID: ${task.id}, Statut: ${task.status})\n`;
      });
    }

    // Ajouter le contexte des embeddings si disponible
    if (embeddingContext.hasRelevantContext) {
      console.log('[SYNTHESIS] 🎯 Utilisation des données embeddings disponibles');
      contextData += `\n\nCONTEXTE DOCUMENTAIRE CABINET (${embeddingContext.chunks.length} éléments):\n`;
      embeddingContext.chunks.slice(0, 5).forEach((chunk: any, index: number) => {
        contextData += `${index + 1}. ${chunk.chunk_text.substring(0, 200)}...\n`;
      });
    }

    // Ajouter le contexte internet si disponible
    if (internetContext.hasContent) {
      console.log('[SYNTHESIS] 🌐 Utilisation des données Internet disponibles');
      contextData += `\n\nINFORMATIONS INTERNET ENRICHIES:\n${internetContext.content.substring(0, 1000)}...\n`;
    }

    // Ajouter le contexte de base de données
    if (databaseContext.meetings?.length > 0) {
      contextData += `\n\nRÉUNIONS RÉCENTES (${databaseContext.meetings.length}):\n`;
      databaseContext.meetings.slice(0, 3).forEach((meeting: any, index: number) => {
        contextData += `${index + 1}. ${meeting.title} (${meeting.meeting_date})\n`;
      });
    }

    // Construction du prompt pour l'IA avec emphasis sur l'historique
    const systemPrompt = `Tu es l'assistant IA spécialisé du cabinet d'ophtalmologie Dr Tabibian à Genève, Suisse.

MISSION: Fournir une assistance administrative et médicale experte avec un ton professionnel et bienveillant.

⚠️ INSTRUCTION CRITIQUE: UTILISE ABSOLUMENT L'HISTORIQUE DE CONVERSATION FOURNI pour maintenir la continuité et comprendre les références. 
L'utilisateur peut faire référence à des éléments mentionnés précédemment - tu DOIS en tenir compte.

CONTEXTE CABINET:
- Cabinet d'ophtalmologie Dr David Tabibian
- Situé à Genève, Suisse 
- Spécialisé en ophtalmologie et chirurgie oculaire
- Équipe administrative et médicale

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
- 🔥 MAINTENIR LE CONTEXTE CONVERSATIONNEL - utilise l'historique pour comprendre les références
- Si l'utilisateur donne juste un nom ou une réponse courte, regarde l'historique pour comprendre le contexte

GESTION DES TÂCHES:
- Quand on te demande de créer une tâche, utilise cette syntaxe à la fin de ta réponse:
  [ACTION_TACHE: TYPE=create, description="description de la tâche", assigned_to="id_participant"]
- Pour les autres actions: TYPE=update|delete|complete avec les paramètres appropriés
- Toujours confirmer la création/modification des tâches
- Si pas d'assignation précisée, demander à qui assigner la tâche

${contextData ? `CONTEXTE DISPONIBLE:${contextData}` : ''}

QUESTION/DEMANDE ACTUELLE: ${message}`;

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

  private async getAssignedName(assignedId: string | null): Promise<string | null> {
    if (!assignedId) return null;
    
    // Cette méthode devrait récupérer le nom du participant depuis la base de données
    // Pour l'instant, on retourne l'ID - peut être amélioré plus tard
    return assignedId;
  }
}
