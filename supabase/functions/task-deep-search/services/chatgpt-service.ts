
export async function generateEnrichmentQuestions(
  todoDescription: string,
  userContext: string,
  openAIKey: string
): Promise<string[]> {
  console.log('🤖 Génération des questions avec ChatGPT optimisé');
  
  const prompt = `Tu es un assistant spécialisé pour un cabinet d'ophtalmologie à Genève.

TÂCHE : "${todoDescription}"
CONTEXTE : "${userContext}"

Génère exactement 5 questions d'enrichissement SPÉCIFIQUES ET PRATIQUES pour optimiser une recherche commerciale.

Ces questions doivent être :

1. **COMMERCIALES** - Focus sur fournisseurs, prix, conditions de vente
2. **GÉOGRAPHIQUES** - Préférence locale (Genève) vs internationale
3. **BUDGÉTAIRES** - Contraintes financières et options de paiement
4. **TECHNIQUES** - Spécifications requises pour un cabinet médical
5. **TEMPORELLES** - Urgence, délais, planning

EXEMPLES DE BONNES QUESTIONS :
- Quel est votre budget maximum pour cette acquisition ?
- Préférez-vous un fournisseur local genevois ou acceptez-vous l'international ?
- Avez-vous des contraintes d'installation ou d'espace spécifiques ?
- Dans quel délai cette solution doit-elle être opérationnelle ?
- Souhaitez-vous inclure la maintenance ou la gérer séparément ?

RÉPONSE : Uniquement les 5 questions, une par ligne, sans numérotation.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Erreur ChatGPT génération questions:', response.status, errorText);
    throw new Error(`Erreur ChatGPT API: ${response.status}`);
  }

  const data = await response.json();
  const questionsText = data.choices?.[0]?.message?.content || '';
  const questions = questionsText.split('\n').filter(q => q.trim().length > 0).slice(0, 5);

  console.log('✅ Questions générées par ChatGPT:', questions.length);
  return questions;
}

export async function rewriteUserContext(
  todoDescription: string,
  userContext: string,
  enrichmentAnswers: any[],
  openAIKey: string
): Promise<string> {
  console.log('🤖 Réécriture du contexte avec ChatGPT optimisé');
  
  const enrichmentText = enrichmentAnswers.length > 0 
    ? '\n\nINFORMATIONS COMPLÉMENTAIRES:\n' + 
      enrichmentAnswers.map((answer: any, index: number) => 
        `• ${answer.question}\n  → ${answer.answer}`
      ).join('\n\n')
    : '';

  const prompt = `Tu optimises des contextes pour des recherches commerciales B2B.

TÂCHE ORIGINALE : "${todoDescription}"
CONTEXTE INITIAL : "${userContext}"${enrichmentText}

**MISSION :** Réécrire ce contexte pour maximiser l'efficacité d'une recherche Perplexity ciblée sur :

🎯 **FOURNISSEURS & DISTRIBUTEURS**
🎯 **INFORMATIONS COMMERCIALES** (prix, conditions, délais)
🎯 **SOLUTIONS LOCALES** (Genève/Suisse prioritaire)
🎯 **SPÉCIFICATIONS TECHNIQUES**

**STRUCTURE OPTIMISÉE :**

**CONTEXTE :** Cabinet d'ophtalmologie Dr Tabibian, Genève, Suisse

**BESOIN SPÉCIFIQUE :** [Reformuler clairement la demande]

**CRITÈRES DE RECHERCHE :**
- Fournisseurs prioritaires : Genève → Suisse → Europe
- Budget : [indiquer si mentionné, sinon "à définir"]
- Délais : [indiquer si mentionné, sinon "flexible"]
- Contraintes techniques : [spécifier pour usage médical]

**MOTS-CLÉS COMMERCIAUX :** [Ajouter synonymes et termes techniques]

**RÉSULTATS ATTENDUS :** Coordonnées fournisseurs, tarifs, conditions, alternatives

Écris un contexte enrichi et structuré en français, optimisé pour une recherche commerciale efficace.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Erreur ChatGPT réécriture contexte:', response.status, errorText);
    throw new Error(`Erreur ChatGPT API: ${response.status}`);
  }

  const data = await response.json();
  const rewrittenContext = data.choices?.[0]?.message?.content || userContext;

  console.log('✅ Contexte réécrit par ChatGPT:', rewrittenContext.length, 'caractères');
  return rewrittenContext;
}
