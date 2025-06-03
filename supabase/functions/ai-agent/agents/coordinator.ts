
export interface QueryAnalysis {
  requiresDatabase: boolean;
  requiresEmbeddings: boolean;
  requiresInternet: boolean;
  queryType: 'meeting' | 'document' | 'task' | 'general' | 'mixed';
  specificEntities: string[];
  timeContext?: string;
  priority: 'database' | 'embeddings' | 'internet';
}

export class CoordinatorAgent {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  async analyzeQuery(message: string, conversationHistory: any[]): Promise<QueryAnalysis> {
    console.log('[COORDINATOR] Analyzing query:', message.substring(0, 100));

    const analysisPrompt = `Tu es un coordinateur intelligent pour OphtaCare (cabinet d'ophtalmologie du Dr Tabibian).
Analyse cette question et détermine la stratégie optimale de recherche :

QUESTION: "${message}"

HISTORIQUE RÉCENT: ${conversationHistory.slice(-3).map(h => `${h.isUser ? 'USER' : 'ASSISTANT'}: ${h.content.substring(0, 200)}`).join('\n')}

Réponds UNIQUEMENT avec un JSON valide suivant cette structure exacte :
{
  "requiresDatabase": boolean,
  "requiresEmbeddings": boolean, 
  "requiresInternet": boolean,
  "queryType": "meeting|document|task|general|mixed",
  "specificEntities": ["entité1", "entité2"],
  "timeContext": "dernière|récent|specific_date|null",
  "priority": "database|embeddings|internet"
}

RÈGLES D'ANALYSE :
- Si question sur "dernière réunion", "dernier meeting" : database d'abord, puis embeddings
- Si question sur document spécifique : database puis embeddings
- Si question générale médicale sans contexte OphtaCare : internet
- Si question sur tâches/todos : database
- Si question nécessite info récente non dans docs : internet`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      const analysisText = data.choices[0]?.message?.content || '';
      
      console.log('[COORDINATOR] Raw analysis:', analysisText);
      
      // Extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log('[COORDINATOR] ✅ Analysis result:', analysis);
        return analysis;
      }
      
      // Fallback analysis
      console.log('[COORDINATOR] ⚠️ Using fallback analysis');
      return this.getFallbackAnalysis(message);
      
    } catch (error) {
      console.error('[COORDINATOR] ❌ Analysis error:', error);
      return this.getFallbackAnalysis(message);
    }
  }

  private getFallbackAnalysis(message: string): QueryAnalysis {
    const lowerMessage = message.toLowerCase();
    
    return {
      requiresDatabase: lowerMessage.includes('dernière') || lowerMessage.includes('récent') || lowerMessage.includes('tâche'),
      requiresEmbeddings: lowerMessage.includes('réunion') || lowerMessage.includes('meeting') || lowerMessage.includes('document'),
      requiresInternet: lowerMessage.includes('nouveau') || lowerMessage.includes('actualité') || lowerMessage.includes('2024') || lowerMessage.includes('2025'),
      queryType: lowerMessage.includes('réunion') ? 'meeting' : lowerMessage.includes('document') ? 'document' : 'general',
      specificEntities: [],
      timeContext: lowerMessage.includes('dernière') || lowerMessage.includes('récent') ? 'récent' : null,
      priority: lowerMessage.includes('dernière') ? 'database' : 'embeddings'
    };
  }
}
