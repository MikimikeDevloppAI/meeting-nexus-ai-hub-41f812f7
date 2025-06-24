
export async function generateEnrichmentQuestions(
  todoDescription: string,
  userContext: string,
  openAIKey: string
): Promise<string[]> {
  console.log('🤖 Génération des questions d\'enrichissement polyvalentes');
  
  const prompt = `Tu es un assistant intelligent spécialisé dans l'optimisation de recherches web.

TÂCHE : "${todoDescription}"
CONTEXTE : "${userContext}"

Génère exactement 5 questions d'enrichissement SPÉCIFIQUES ET PRATIQUES pour optimiser une recherche web intelligente.

Adapte les questions selon le TYPE DE DEMANDE :

🎯 **PLAN D'ACTION** - Questions sur objectifs, étapes, ressources, délais, contraintes
🔍 **RECHERCHE SPÉCIALISÉE** - Questions sur scope, critères, sources, profondeur d'analyse
🛒 **RECHERCHE COMMERCIALE** - Questions sur budget, fournisseurs, localisation, spécifications
📊 **ANALYSE COMPARATIVE** - Questions sur critères de comparaison, priorités, alternatives
💡 **CONSEIL/RECOMMANDATION** - Questions sur contraintes, préférences, contexte d'usage

EXEMPLES DE BONNES QUESTIONS SELON LE TYPE :

**Plan d'action :**
- Quel est l'objectif principal à atteindre et dans quel délai ?
- Quelles sont vos ressources disponibles (budget, équipe, outils) ?
- Quelles contraintes ou limitations faut-il prendre en compte ?

**Recherche spécialisée :**
- Quel niveau de détail technique souhaitez-vous ?
- Y a-t-il des sources ou références spécifiques à privilégier ?
- Dans quel contexte ces informations seront-elles utilisées ?

**Recherche commerciale :**
- Quel est votre budget maximum pour cette acquisition ?
- Préférez-vous des fournisseurs locaux ou acceptez-vous l'international ?
- Avez-vous des contraintes d'installation ou techniques spécifiques ?

**Analyse comparative :**
- Quels sont vos critères de choix prioritaires ?
- Y a-t-il des solutions que vous avez déjà évaluées ?
- Quels sont les facteurs décisifs pour votre décision ?

**Conseil/Recommandation :**
- Quel est votre niveau d'expérience dans ce domaine ?
- Quelles sont vos préférences ou priorités principales ?
- Y a-t-il des contraintes spécifiques à respecter ?

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

  console.log('✅ Questions générées par ChatGPT:', questions.length);
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
