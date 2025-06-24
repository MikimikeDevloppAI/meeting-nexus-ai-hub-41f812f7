export async function generateEnrichmentQuestions(
  todoDescription: string,
  userContext: string,
  openAIKey: string
): Promise<string[]> {
  console.log('🤖 Génération des questions d\'enrichissement pour le cabinet ophtalmologique');
  
  const prompt = `Tu es un assistant intelligent au service du cabinet ophtalmologique du Dr Tabibian à Genève. Ton rôle est d'aider à formuler 5 questions simples et claires pour mieux cadrer une recherche approfondie que l'utilisateur souhaite lancer. Ces questions doivent :

Être faciles à comprendre et rapides à répondre

Aider à mieux cibler la recherche en évitant des résultats trop larges

Être adaptées à un contexte administratif, logistique ou organisationnel

Se concentrer sur des éléments comme le budget, les délais, les critères de sélection, les besoins spécifiques ou la région géographique

Voici la tâche à effectuer : ${todoDescription}
Voici les éléments de contexte ajoutés par l'utilisateur : ${userContext}

Génère maintenant 5 questions claires et pertinentes à poser à l'utilisateur pour mieux cibler la recherche.

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
      temperature: 0.4,
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

  console.log('✅ Questions générées par ChatGPT pour le cabinet ophtalmologique:', questions.length);
  return questions;
}

export async function rewriteUserContext(
  todoDescription: string,
  userContext: string,
  enrichmentAnswers: any[],
  openAIKey: string
): Promise<string> {
  console.log('🤖 Réécriture du contexte pour recherche web polyvalente');
  
  const enrichmentText = enrichmentAnswers.length > 0 
    ? '\n\nINFORMATIONS COMPLÉMENTAIRES:\n' + 
      enrichmentAnswers.map((answer: any, index: number) => 
        `• ${answer.question}\n  → ${answer.answer}`
      ).join('\n\n')
    : '';

  const prompt = `Tu optimises des contextes pour des recherches web intelligentes et polyvalentes.

TÂCHE ORIGINALE : "${todoDescription}"
CONTEXTE INITIAL : "${userContext}"${enrichmentText}

**MISSION :** Réécrire ce contexte pour maximiser l'efficacité d'une recherche web Jina AI ciblée.

**OBJECTIFS DE RECHERCHE WEB POSSIBLES :**

🎯 **PLAN D'ACTION** - Méthodologies, étapes, ressources, timeline
🔍 **RECHERCHE SPÉCIALISÉE** - Informations techniques, analyses, études
🛒 **SOLUTIONS COMMERCIALES** - Fournisseurs, produits, services, prix
📊 **ANALYSES COMPARATIVES** - Alternatives, benchmarks, évaluations
💡 **RECOMMANDATIONS** - Meilleures pratiques, conseils d'experts
📋 **GUIDES PRATIQUES** - Tutoriels, procédures, check-lists

**STRUCTURE OPTIMISÉE POUR RECHERCHE WEB :**

**OBJECTIF PRINCIPAL :** [Reformuler clairement la demande]

**TYPE DE RECHERCHE :** [Plan d'action / Recherche spécialisée / Solutions commerciales / etc.]

**CONTEXTE D'USAGE :** [Situation, environnement, contraintes]

**CRITÈRES SPÉCIFIQUES :**
- Priorité géographique : [si applicable]
- Budget/Ressources : [si mentionné]
- Délais/Timeline : [si mentionné]  
- Contraintes techniques : [si applicable]
- Niveau de détail souhaité : [selon le type]

**MOTS-CLÉS DE RECHERCHE :** [Termes principaux + synonymes techniques]

**RÉSULTATS ATTENDUS :** [Type d'informations, format, niveau de détail]

Écris un contexte enrichi et structuré en français, optimisé pour une recherche web intelligente et polyvalente.`;

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
