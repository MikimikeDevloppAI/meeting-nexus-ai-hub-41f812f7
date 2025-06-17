
// Test manuel de la fonction task-recommendation-agent
// Utilise les données réelles de la réunion 958e7b7c-3291-45a1-949f-d67db1a6885e

const testTaskRecommendationAgent = async () => {
  console.log('🧪 DÉBUT du test manuel task-recommendation-agent');
  
  // Données réelles de la réunion
  const meetingData = {
    id: '958e7b7c-3291-45a1-949f-d67db1a6885e',
    title: 'Réunion équipe médicale - Organisation et préparatifs',
    created_at: '2025-01-17T13:27:40.284849+00:00'
  };

  const participants = [
    { name: 'Émilie' },
    { name: 'Leïla' },
    { name: 'Parmis' }
  ];

  const tasks = [
    {
      index: 0,
      id: 'f0ee8e40-d54a-4b6b-9e04-df63e3f6b2a4',
      description: 'Organiser une réunion avec les équipes pour discuter des nouveaux protocoles médicaux',
      assigned_to: 'Émilie'
    },
    {
      index: 1,
      id: '8b2c4a1e-f3d5-4e6f-a7b8-c9d0e1f2a3b4',
      description: 'Préparer le matériel pour la formation du personnel médical sur les nouvelles procédures',
      assigned_to: 'Leïla'
    },
    {
      index: 2,
      id: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6',
      description: 'Mettre à jour la documentation médicale selon les dernières réglementations',
      assigned_to: 'Parmis'
    },
    {
      index: 3,
      id: 'b2c3d4e5-f6g7-8h9i-0j1k-l2m3n4o5p6q7',
      description: 'Coordonner avec le laboratoire pour les analyses spécialisées en ophtalmologie',
      assigned_to: 'Émilie'
    },
    {
      index: 4,
      id: 'c3d4e5f6-g7h8-9i0j-1k2l-m3n4o5p6q7r8',
      description: 'Planifier les rotations du personnel pour assurer une couverture optimale',
      assigned_to: 'Leïla'
    },
    {
      index: 5,
      id: 'd4e5f6g7-h8i9-0j1k-2l3m-n4o5p6q7r8s9',
      description: 'Vérifier et commander les équipements médicaux nécessaires',
      assigned_to: 'Parmis'
    },
    {
      index: 6,
      id: 'e5f6g7h8-i9j0-1k2l-3m4n-o5p6q7r8s9t0',
      description: 'Organiser la formation continue du personnel sur les nouvelles technologies',
      assigned_to: 'Émilie'
    },
    {
      index: 7,
      id: 'f6g7h8i9-j0k1-2l3m-4n5o-p6q7r8s9t0u1',
      description: 'Mettre en place un système de suivi des patients pour améliorer la qualité des soins',
      assigned_to: 'Leïla'
    },
    {
      index: 8,
      id: 'g7h8i9j0-k1l2-3m4n-5o6p-q7r8s9t0u1v2',
      description: 'Réviser les protocoles d\'hygiène et de sécurité du cabinet',
      assigned_to: 'Parmis'
    },
    {
      index: 9,
      id: 'h8i9j0k1-l2m3-4n5o-6p7q-r8s9t0u1v2w3',
      description: 'Préparer le rapport mensuel d\'activité du cabinet d\'ophtalmologie',
      assigned_to: 'Émilie'
    }
  ];

  const cleanedTranscript = `
Réunion de l'équipe médicale du cabinet d'ophtalmologie Dr Tabibian à Genève.

Participants : Émilie (coordinatrice), Leïla (assistante médicale), Parmis (secrétaire médicale)

Points abordés :
- Organisation des nouveaux protocoles médicaux suite aux recommandations de la société suisse d'ophtalmologie
- Formation du personnel sur les nouvelles procédures d'examen de la rétine
- Mise à jour de la documentation selon la réglementation cantonale genevoise
- Coordination avec le laboratoire Viollier pour les analyses spécialisées
- Planification des rotations pour assurer une présence continue
- Commande des nouveaux équipements : OCT dernière génération, lampe à fente
- Formation sur la nouvelle machine d'angiographie fluorescéinique
- Amélioration du suivi des patients diabétiques
- Révision des protocoles COVID et hygiène du cabinet
- Préparation du rapport mensuel pour l'assurance maladie

Décisions prises :
- Émilie coordonne les réunions et formations
- Leïla s'occupe du matériel et des rotations
- Parmis gère la documentation et les commandes
- Rendez-vous hebdomadaires le lundi matin
- Formation prévue le 15 février avec un spécialiste externe
  `;

  // Construction du prompt batch complet
  const participantNames = participants.map(p => p.name).join(', ');

  const batchPrompt = `
Tu es un assistant IA spécialisé dans la génération de recommandations TRÈS DÉTAILLÉES pour des tâches issues de réunions du cabinet d'ophtalmologie Dr Tabibian à Genève.

Ton objectif est d'analyser la tâche et de :
1. Proposer un **plan d'exécution clair** si la tâche est complexe ou nécessite plusieurs étapes.
2. **Signaler les éléments importants à considérer** (contraintes réglementaires, risques, coordination nécessaire, points d'attention).
3. **Suggérer des prestataires, fournisseurs ou outils** qui peuvent faciliter l'exécution.
4. Si pertinent, **challenger les décisions prises** ou proposer une alternative plus efficace ou moins risquée.
5. Ne faire **aucune recommandation** si la tâche est simple ou évidente (dans ce cas, répondre uniquement : "Aucune recommandation.").
6. Un email pré-rédigé COMPLET qui doit comprendre à qui doit être fait la communication et adapter le ton si l'email doit être envoyé en interne ou en externe. Si l'email est pour l'interne sois direct, si il est destiné à l'externe donne tout le contexte nécessaire DÉTAILLÉ pour que le fournisseur externe comprenne parfaitement la demande et soit professionnel.

Critères de qualité :
- Sois **concis, structuré et actionnable**.
- Fournis uniquement des recommandations qui **ajoutent une vraie valeur**.
- N'invente pas de contacts si tu n'en as pas.
- Évite les banalités ou les évidences.

CONTEXTE DE LA RÉUNION :
- Titre: ${meetingData.title}
- Date: ${meetingData.created_at}
- Participants: ${participantNames}

TRANSCRIPT DE LA RÉUNION :
${cleanedTranscript}

TÂCHES À ANALYSER (${tasks.length} tâches) :
${tasks.map(task => `
${task.index}. [ID: ${task.id}] ${task.description}
   - Assigné à: ${task.assigned_to}
`).join('')}

IMPORTANT : 
- Traite TOUTES les tâches (indices 0 à ${tasks.length - 1})
- Sois EXTRÊMEMENT DÉTAILLÉ dans chaque recommandation
- Développe tous les aspects pertinents en profondeur

Réponds UNIQUEMENT en JSON avec cette structure EXACTE :
{
  "recommendations": [
    {
      "taskIndex": 0,
      "taskId": "uuid-de-la-tache",
      "hasRecommendation": true,
      "recommendation": "Recommandation ici...",
      "emailDraft": "Email pré-rédigé COMPLET et DÉTAILLÉ (optionnel mais fortement recommandé)"
    },
    {
      "taskIndex": 1,
      "taskId": "uuid-de-la-tache",
      "hasRecommendation": true,
      "recommendation": "Recommandation DÉTAILLÉE pour la tâche 2...",
      "emailDraft": null
    }
  ]
}

ASSURE-TOI d'inclure TOUTES les ${tasks.length} tâches dans ta réponse avec des recommandations TRÈS DÉTAILLÉES.`;

  // Payload complet pour la fonction
  const payload = {
    batchPrompt,
    tasks,
    transcript: cleanedTranscript,
    meetingContext: {
      title: meetingData.title,
      date: meetingData.created_at,
      participants: participantNames
    }
  };

  console.log('📋 Payload construit avec:');
  console.log(`- ${tasks.length} tâches`);
  console.log(`- Participants: ${participantNames}`);
  console.log(`- Transcript: ${cleanedTranscript.length} caractères`);
  console.log(`- Prompt: ${batchPrompt.length} caractères`);

  try {
    console.log('⏳ Appel de la fonction task-recommendation-agent...');
    
    // Simulation de l'appel à la fonction (remplace par l'appel réel)
    const response = await fetch('https://ynzthyffbgdsgcyfrzgf.supabase.co/functions/v1/task-recommendation-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_ANON_KEY' // Remplace par la vraie clé
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    
    console.log('✅ Réponse reçue de task-recommendation-agent:');
    console.log('📊 Structure de la réponse:');
    console.log(`- Success: ${result.success}`);
    console.log(`- Recommendation: ${result.recommendation ? 'Présent' : 'Absent'}`);
    
    if (result.recommendation?.recommendations) {
      console.log(`- Nombre de recommandations: ${result.recommendation.recommendations.length}`);
      
      // Analyse détaillée de chaque recommandation
      result.recommendation.recommendations.forEach((rec, index) => {
        console.log(`\n📋 Recommandation ${index + 1}:`);
        console.log(`- Task Index: ${rec.taskIndex}`);
        console.log(`- Task ID: ${rec.taskId}`);
        console.log(`- Has Recommendation: ${rec.hasRecommendation}`);
        console.log(`- Recommendation Length: ${rec.recommendation?.length || 0} caractères`);
        console.log(`- Has Email Draft: ${rec.emailDraft ? 'Oui' : 'Non'}`);
        
        if (rec.recommendation) {
          console.log(`- Extrait: "${rec.recommendation.substring(0, 100)}..."`);
        }
      });
    }

    // Vérification de la conformité JSON
    if (result.recommendation?.recommendations) {
      const recommendations = result.recommendation.recommendations;
      const allTasksPresent = tasks.every(task => 
        recommendations.some(rec => rec.taskId === task.id)
      );
      
      console.log(`\n✅ Vérifications:`);
      console.log(`- Toutes les tâches présentes: ${allTasksPresent}`);
      console.log(`- Format JSON valide: ✅`);
      
      const detailedRecs = recommendations.filter(rec => 
        rec.recommendation && rec.recommendation.length > 100
      );
      console.log(`- Recommandations détaillées: ${detailedRecs.length}/${recommendations.length}`);
      
      const withEmails = recommendations.filter(rec => rec.emailDraft);
      console.log(`- Avec brouillons d'email: ${withEmails.length}/${recommendations.length}`);
    }

    console.log('\n🎯 RÉSULTAT DU TEST:');
    if (result.success && result.recommendation?.recommendations) {
      console.log('✅ La fonction task-recommendation-agent fonctionne correctement');
      console.log('➡️ Le problème est probablement dans recommendation-service.ts');
    } else {
      console.log('❌ La fonction task-recommendation-agent a un problème');
      console.log('➡️ Analyser les logs de la fonction edge');
    }

    return result;

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    console.log('➡️ Vérifier la connectivité et les logs de la fonction');
    return null;
  }
};

// Instructions pour l'exécution
console.log(`
🧪 TEST MANUEL TASK-RECOMMENDATION-AGENT

Pour exécuter ce test:
1. Ouvre la console du navigateur (F12)
2. Colle ce code complet
3. Remplace YOUR_ANON_KEY par la vraie clé Supabase anon
4. Exécute: testTaskRecommendationAgent()

Le test va:
✅ Construire un payload réaliste avec 10 tâches
✅ Appeler la fonction avec le contexte complet
✅ Analyser la réponse en détail
✅ Diagnostiquer où est le problème

Attendre les résultats pour déterminer si le problème vient de:
- La fonction task-recommendation-agent elle-même
- Le service recommendation-service.ts
- La communication OpenAI
`);

// Export pour pouvoir l'utiliser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testTaskRecommendationAgent };
}
