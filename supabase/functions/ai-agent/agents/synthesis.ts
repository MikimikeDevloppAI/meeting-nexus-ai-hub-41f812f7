
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
    console.log('[SYNTHESIS] Synthèse OPTIMISÉE OphtaCare');

    const contextSummary = this.buildContextSummary(databaseContext, embeddingContext, internetContext, taskContext);
    
    let systemPrompt = `Tu es l'assistant IA spécialisé OphtaCare du Dr Tabibian à Genève.

MISSION : Fournir des réponses précises, utiles et contextuelles pour le cabinet d'ophtalmologie.

RÈGLES DE RÉPONSE :
1. **Réponses concises et pratiques** - Évite les longs préambules
2. **Utilise les données OphtaCare** quand disponibles
3. **Recommandations générales intelligentes** sans inventer de liens produits
4. **Gestion des tâches avec actions structurées**

CONTEXTE DISPONIBLE :
${contextSummary}

ACTIONS TÂCHES (si création/modification nécessaire) :
- Pour CRÉER : [ACTION_TACHE:TYPE=create,description="Description précise",assigned_to="Nom personne"]
- Pour MODIFIER : [ACTION_TACHE:TYPE=update,id="ID",description="Nouvelle description"] 
- Pour TERMINER : [ACTION_TACHE:TYPE=complete,id="ID"]
- Pour SUPPRIMER : [ACTION_TACHE:TYPE=delete,id="ID"]

STYLE :
- Professionnel mais accessible
- Spécialisé ophtalmologie
- Recommandations pratiques basées sur l'expérience
- Utilise les émojis médicaux appropriés : 👁️ 🏥 📋 💊`;

    if (analysis.queryType === 'task') {
      systemPrompt += `\n\nCONTEXTE TÂCHES SPÉCIAL :
- L'utilisateur demande une gestion de tâches
- Génère l'action appropriée avec la syntaxe [ACTION_TACHE:...]
- Confirme l'action dans ta réponse`;
    }

    const conversationContext = conversationHistory.slice(-5).map(msg => 
      `${msg.isUser ? 'Utilisateur' : 'Assistant'}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`
    ).join('\n');

    const userPrompt = `QUESTION : "${originalQuery}"

${conversationHistory.length > 0 ? `CONTEXTE CONVERSATION :\n${conversationContext}\n` : ''}

${taskContext.hasTaskContext ? `
TÂCHES EN COURS (${taskContext.currentTasks.length}) :
${taskContext.currentTasks.slice(0, 5).map(task => `- ${task.description} (${task.status})`).join('\n')}
` : ''}

INSTRUCTIONS :
- Réponds directement à la question
- Utilise le contexte OphtaCare disponible
- Si création de tâche demandée, génère l'action [ACTION_TACHE:...]
- Recommandations générales sans liens inventés
- Sois concis et pratique`;

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
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      const finalResponse = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu traiter votre demande.';

      console.log('[SYNTHESIS] ✅ Réponse optimisée générée');
      return finalResponse;

    } catch (error) {
      console.error('[SYNTHESIS] ❌ Erreur:', error);
      return 'Désolé, je rencontre un problème technique temporaire. Veuillez réessayer.';
    }
  }

  private buildContextSummary(databaseContext: any, embeddingContext: any, internetContext: any, taskContext: any): string {
    const parts = [];

    if (taskContext.hasTaskContext) {
      parts.push(`📋 Tâches: ${taskContext.currentTasks.length} en cours`);
    }

    if (databaseContext.meetings?.length > 0 || databaseContext.documents?.length > 0) {
      parts.push(`🗄️ Base: ${databaseContext.meetings.length} réunions, ${databaseContext.documents.length} documents`);
    }

    if (embeddingContext.hasRelevantContext) {
      parts.push(`🎯 Données: ${embeddingContext.chunks.length} éléments pertinents`);
    }

    if (internetContext.hasContent) {
      parts.push(`🌐 Internet: Informations complémentaires disponibles`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'Données de base OphtaCare disponibles';
  }
}
