
export async function generateEnrichmentQuestions(
  todoDescription: string,
  userContext: string,
  openAIKey: string
): Promise<string[]> {
  console.log('🤖 Génération des questions avec ChatGPT 4.1');
  
  const prompt = `Tu es un assistant spécialisé pour le cabinet d'ophtalmologie du Dr Tabibian à Genève.

Une tâche a été créée : "${todoDescription}"
L'utilisateur souhaite approfondir avec ce contexte : "${userContext}"

Génère exactement 4 questions d'enrichissement PRATIQUES ET FACILES À RÉPONDRE qui permettront d'affiner la recherche. Ces questions doivent être :

1. **SIMPLES et DIRECTES** - L'utilisateur ne doit pas faire de recherches pour répondre
2. **PRATIQUES** - Focalisées sur les aspects opérationnels et budgétaires
3. **SPÉCIFIQUES au contexte médical/administratif** d'un cabinet d'ophtalmologie à Genève
4. **ORIENTÉES ACTION** - Pour aider à prendre des décisions concrètes

Exemples de questions pertinentes :
- Quel est le budget approximatif disponible pour cette tâche ?
- Dans quel délai cette tâche doit-elle être réalisée ?
- Quelle est la priorité de cette tâche (urgente, importante, normale) ?
- Combien de temps pouvez-vous y consacrer par semaine ?
- Avez-vous des contraintes particulières à respecter ?
- Quel niveau de complexité acceptez-vous (simple, intermédiaire, avancé) ?

Adapte ces exemples au contexte spécifique de la tâche demandée.

Format ta réponse UNIQUEMENT avec les 4 questions, une par ligne, sans numérotation ni formatage spécial.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
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
  const questions = questionsText.split('\n').filter(q => q.trim().length > 0).slice(0, 4);

  console.log('✅ Questions générées par ChatGPT:', questions.length);
  return questions;
}

export async function rewriteUserContext(
  todoDescription: string,
  userContext: string,
  enrichmentAnswers: any[],
  openAIKey: string
): Promise<string> {
  console.log('🤖 Réécriture du contexte avec ChatGPT 4.1');
  
  const enrichmentText = enrichmentAnswers.length > 0 
    ? '\n\nRÉPONSES AUX QUESTIONS D\'ENRICHISSEMENT:\n' + 
      enrichmentAnswers.map((answer: any, index: number) => 
        `${index + 1}. ${answer.question}\nRéponse: ${answer.answer}`
      ).join('\n\n')
    : '';

  const prompt = `Tu es un assistant spécialisé pour le cabinet d'ophtalmologie du Dr Tabibian à Genève.

Une tâche a été créée : "${todoDescription}"
Contexte utilisateur original : "${userContext}"${enrichmentText}

Ton rôle est de réécrire et structurer ce contexte pour optimiser la recherche qui va suivre avec Perplexity Sonar Pro.

Réécris le contexte en :
1. **CLARIFIANT** les objectifs et enjeux de la tâche
2. **STRUCTURANT** l'information de manière logique
3. **AJOUTANT** le contexte spécifique du cabinet d'ophtalmologie genevois
4. **PRÉCISANT** les contraintes et attentes
5. **ORIENTANT** vers une recherche actionnable

Le contexte réécrit doit permettre à Sonar Pro de comprendre parfaitement :
- Quel est le problème à résoudre
- Dans quel contexte (cabinet médical, Genève, Suisse)
- Quelles sont les contraintes pratiques
- Quel type de réponse est attendu

Écris un contexte enrichi et structuré en français, adapté pour une recherche efficace.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
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
