
export class SynthesisAgent {
  constructor(private apiKey: string) {}

  async synthesizeResponse(
    message: string,
    conversationHistory: any[],
    databaseContext: any,
    embeddingsResult: any,
    internetContext: any,
    analysis: any,
    taskContext: any,
    meetingPreparationResult: any = null
  ): Promise<string> {
    console.log('[SYNTHESIS] 🏥 Synthèse INTELLIGENTE Cabinet Dr Tabibian');

    // Analyse contextuelle approfondie
    const contextAnalysis = this.analyzeContext(message, conversationHistory);
    console.log(`[SYNTHESIS] 🧠 Analyse du contexte APPROFONDIE: ${JSON.stringify(contextAnalysis)}`);

    const previousSubject = contextAnalysis.previousSubject;
    console.log(`[SYNTHESIS] 🎯 Sujet principal détecté: ${previousSubject}`);

    // Formatage de l'historique pour continuité maximale
    console.log('[SYNTHESIS] 📜 Formatage de l\'historique pour continuité MAXIMALE');
    const formattedHistory = conversationHistory.slice(-10).map((msg: any) => 
      `${msg.isUser ? 'Utilisateur' : 'Assistant'}: ${msg.content}`
    ).join('\n');

    // Construction du contexte enrichi avec données d'embeddings
    let contextContent = '';
    if (embeddingsResult.chunks && embeddingsResult.chunks.length > 0) {
      console.log('[SYNTHESIS] 🎯 Utilisation des données embeddings disponibles');
      contextContent += '\n\nCONTEXTE DOCUMENTAIRE PERTINENT:\n';
      contextContent += embeddingsResult.chunks.slice(0, 5).map((chunk: any, index: number) => 
        `Document: ${chunk.document_name || 'Document'}\nContenu: ${chunk.chunk_text}`
      ).join('\n\n---\n\n');
    }

    // Intégration des données de la base de données
    if (databaseContext.meetings && databaseContext.meetings.length > 0) {
      console.log('[SYNTHESIS] 🗄️ Utilisation des données base de données');
      contextContent += '\n\nRÉUNIONS PERTINENTES:\n';
      contextContent += databaseContext.meetings.map((meeting: any) => 
        `- ${meeting.title} (${new Date(meeting.created_at).toLocaleDateString('fr-FR')})`
      ).join('\n');
    }

    // Intégration des résultats de préparation de réunion
    if (meetingPreparationResult) {
      console.log('[SYNTHESIS] 📝 Intégration résultats préparation réunion');
      contextContent += `\n\nPRÉPARATION RÉUNION:\n${meetingPreparationResult.message || 'Action effectuée'}`;
    }

    // Contexte des tâches
    if (taskContext && taskContext.currentTasks && taskContext.currentTasks.length > 0) {
      console.log('[SYNTHESIS] 📋 Utilisation des données tâches');
      contextContent += '\n\nTÂCHES EN COURS:\n';
      contextContent += taskContext.currentTasks.map((task: any) => 
        `- ${task.description} (${task.status})`
      ).join('\n');
    }

    // Construction du prompt enrichi
    const enrichedPrompt = `Tu es l'assistant IA spécialisé OphtaCare pour le cabinet d'ophtalmologie Dr Tabibian à Genève.

CONTEXTE CABINET:
- Cabinet d'ophtalmologie dirigé par le Dr David Tabibian
- Équipe comprenant Leïla, Émilie, Parmis et d'autres collaborateurs
- Spécialisé en consultations ophtalmologiques, chirurgie de la cataracte, contactologie

HISTORIQUE RÉCENT DE LA CONVERSATION:
${formattedHistory}

${contextContent}

CONTEXTE INTERNET:
${internetContext.hasContent ? internetContext.content : 'Aucune recherche internet effectuée'}

INSTRUCTIONS IMPORTANTES:
- Réponds de manière professionnelle et utile en te basant sur le contexte fourni
- Ne mentionne JAMAIS les identifiants techniques des documents (Document ID, UUID, etc.)
- Réfère-toi aux documents uniquement par leur nom ou titre
- Si tu proposes de créer une tâche ou d'ajouter un point à l'ordre du jour, utilise le format [ACTION_TACHE:description] ou [ACTION_REUNION:description]

Question de l'utilisateur: "${message}"

Réponds en français de manière claire et professionnelle.`;

    console.log('[SYNTHESIS] 🚀 Envoi du prompt enrichi avec contexte RENFORCÉ');

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5',
          messages: [{ role: 'user', content: enrichedPrompt }],
          temperature: 0.7,
          max_tokens: 16384,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';
      } else {
        console.error('[SYNTHESIS] ❌ Erreur OpenAI:', await response.text());
        return 'Désolé, une erreur est survenue lors de la génération de la réponse.';
      }
    } catch (error) {
      console.error('[SYNTHESIS] ❌ Erreur réseau:', error);
      return 'Désolé, une erreur de connexion est survenue.';
    }
  }

  private analyzeContext(message: string, history: any[]): any {
    const lowerMessage = message.toLowerCase();
    
    // Détection de références temporelles et de continuité
    const isReferencingPrevious = lowerMessage.includes('précédent') || 
                                 lowerMessage.includes('dernier') || 
                                 lowerMessage.includes('avant') ||
                                 lowerMessage.includes('ce dont on parlait') ||
                                 lowerMessage.includes('sujet');

    const isContinuation = history.length > 0 && (
      lowerMessage.includes('continue') ||
      lowerMessage.includes('aussi') ||
      lowerMessage.includes('également') ||
      lowerMessage.includes('en plus')
    );

    // Extraction du sujet principal du dernier échange
    let previousSubject = null;
    if (history.length > 0) {
      const lastAssistantMessage = history.slice().reverse().find(msg => !msg.isUser);
      if (lastAssistantMessage) {
        const content = lastAssistantMessage.content.toLowerCase();
        if (content.includes('tâche') || content.includes('todo')) {
          previousSubject = 'task_management';
        } else if (content.includes('réunion') || content.includes('ordre')) {
          previousSubject = 'meeting_preparation';
        } else if (content.includes('document') || content.includes('fichier')) {
          previousSubject = 'document_search';
        }
      }
    }

    return {
      isReferencingPrevious,
      isContinuation,
      context: history.length > 0 ? history[history.length - 1]?.content || '' : '',
      continuationType: isContinuation ? 'extend' : isReferencingPrevious ? 'reference' : 'none',
      previousSubject
    };
  }
}
