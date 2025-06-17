// test-task-recommendation-agent.js
const fetch = require('node-fetch');
require('dotenv').config();

const FUNCTION_URL = process.env.SUPABASE_FUNCTION_TASK_RECOMMENDATION_AGENT_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!FUNCTION_URL) {
  console.error('❌ Erreur: Variable d\'environnement SUPABASE_FUNCTION_TASK_RECOMMENDATION_AGENT_URL non définie.');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Erreur: Variable d\'environnement SUPABASE_ANON_KEY non définie.');
  process.exit(1);
}

async function testTaskRecommendationAgent() {
  console.log('🚀 DÉBUT DU TEST MANUEL - Task Recommendation Agent');
  console.log('=' .repeat(60));
  
  try {
    // Payload de test avec toutes les tâches réelles
    const testPayload = {
      batchPrompt: `Tu es un assistant IA spécialisé dans la génération de recommandations TRÈS DÉTAILLÉES pour des tâches issues de réunions du cabinet d'ophtalmologie Dr Tabibian à Genève.

Ton objectif est d'analyser la tâche et de :
1. Proposer un **plan d'exécution clair** si la tâche est complexe ou nécessite plusieurs étapes.
2. **Signaler les éléments importants à considérer** (contraintes réglementaires, risques, coordination nécessaire, points d'attention).
3. **Suggérer des prestataires, fournisseurs ou outils** qui peuvent faciliter l'exécution.
4. Si pertinent, **challenger les décisions prises** ou proposer une alternative plus efficace ou moins risquée.
5. Ne faire **aucune recommandation** si la tâche est simple ou évidente (dans ce cas, répondre uniquement : "Aucune recommandation.").
6. Un email pré-rédigé COMPLET qui doit comprendre à qui doit être fait la communication et adapter le ton si l'email doit être envoyé en interne ou en externe.

Critères de qualité :
- Sois **concis, structuré et actionnable**.
- Fournis uniquement des recommandations qui **ajoutent une vraie valeur**.
- N'invente pas de contacts si tu n'en as pas.
- Évite les banalités ou les évidences.

CONTEXTE DE LA RÉUNION :
- Titre: Réunion hebdomadaire du cabinet Dr Tabibian
- Date: 2025-06-17
- Participants: Émilie, Leïla, Parmis

TRANSCRIPT DE LA RÉUNION :
Réunion hebdomadaire concernant l'organisation du cabinet, la gestion des stocks de matériel médical, et la coordination des rendez-vous patients. Discussion sur les nouvelles procédures administratives et les améliorations à apporter au service client.

TÂCHES À ANALYSER (10 tâches) :
0. [ID: 3eedc900-7f3b-4257-a7c4-e975dc550a40] Effectuer le suivi des stocks de matériel médical
   - Assigné à: Émilie

1. [ID: 59bfd784-9e47-4820-bf2c-5d282b118165] Organiser la formation du personnel sur les nouvelles procédures
   - Assigné à: Leïla

2. [ID: dcd2c427-85a0-42dc-ab70-3f0626ace471] Mettre à jour le système de prise de rendez-vous
   - Assigné à: Parmis

3. [ID: 020dcf06-c7c9-46ef-858e-25282d7c2b55] Réviser les protocoles de nettoyage et désinfection
   - Assigné à: Émilie

4. [ID: 4bb2c6c2-adf1-4633-ab7e-7779be92c6d9] Coordonner avec les fournisseurs pour les commandes urgentes
   - Assigné à: Leïla

5. [ID: eb1e518e-0e00-44bf-8fb4-3e57451c6f9f] Optimiser l'accueil et l'orientation des patients
   - Assigné à: Parmis

6. [ID: ba0bda6e-1b30-4ae3-92ec-592bfe380e26] Planifier la maintenance préventive des équipements
   - Assigné à: Émilie

7. [ID: bebd1289-ad9b-4fc1-8cdc-216d08468855] Analyser la satisfaction patient et proposer des améliorations
   - Assigné à: Leïla

8. [ID: d380d446-dba2-4f35-8d5f-028f5b8f67ef] Gérer les relations avec les laboratoires partenaires
   - Assigné à: Parmis

9. [ID: a1c9d7f8-63e2-44d2-90d3-d6b2b445f835] Mettre en place un système de rappel automatique pour les patients
   - Assigné à: Émilie

IMPORTANT : 
- Traite TOUTES les tâches (indices 0 à 9)
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

ASSURE-TOI d'inclure TOUTES les 10 tâches dans ta réponse avec des recommandations TRÈS DÉTAILLÉES.`,
      
      tasks: [
        {
          index: 0,
          id: "3eedc900-7f3b-4257-a7c4-e975dc550a40",
          description: "Effectuer le suivi des stocks de matériel médical",
          assigned_to: "Émilie"
        },
        {
          index: 1,
          id: "59bfd784-9e47-4820-bf2c-5d282b118165", 
          description: "Organiser la formation du personnel sur les nouvelles procédures",
          assigned_to: "Leïla"
        },
        {
          index: 2,
          id: "dcd2c427-85a0-42dc-ab70-3f0626ace471",
          description: "Mettre à jour le système de prise de rendez-vous", 
          assigned_to: "Parmis"
        },
        {
          index: 3,
          id: "020dcf06-c7c9-46ef-858e-25282d7c2b55",
          description: "Réviser les protocoles de nettoyage et désinfection",
          assigned_to: "Émilie"
        },
        {
          index: 4,
          id: "4bb2c6c2-adf1-4633-ab7e-7779be92c6d9",
          description: "Coordonner avec les fournisseurs pour les commandes urgentes",
          assigned_to: "Leïla"
        },
        {
          index: 5,
          id: "eb1e518e-0e00-44bf-8fb4-3e57451c6f9f",
          description: "Optimiser l'accueil et l'orientation des patients",
          assigned_to: "Parmis"
        },
        {
          index: 6,
          id: "ba0bda6e-1b30-4ae3-92ec-592bfe380e26",
          description: "Planifier la maintenance préventive des équipements",
          assigned_to: "Émilie"
        },
        {
          index: 7,
          id: "bebd1289-ad9b-4fc1-8cdc-216d08468855",
          description: "Analyser la satisfaction patient et proposer des améliorations",
          assigned_to: "Leïla"
        },
        {
          index: 8,
          id: "d380d446-dba2-4f35-8d5f-028f5b8f67ef",
          description: "Gérer les relations avec les laboratoires partenaires",
          assigned_to: "Parmis"
        },
        {
          index: 9,
          id: "a1c9d7f8-63e2-44d2-90d3-d6b2b445f835",
          description: "Mettre en place un système de rappel automatique pour les patients",
          assigned_to: "Émilie"
        }
      ],
      transcript: "Réunion hebdomadaire concernant l'organisation du cabinet, la gestion des stocks de matériel médical, et la coordination des rendez-vous patients. Discussion sur les nouvelles procédures administratives et les améliorations à apporter au service client.",
      meetingContext: {
        title: "Réunion hebdomadaire du cabinet Dr Tabibian",
        date: "2025-06-17T12:00:00.000Z",
        participants: "Émilie, Leïla, Parmis"
      }
    };

    console.log('📤 Envoi de la requête à task-recommendation-agent...');
    console.log(`📊 Nombre de tâches: ${testPayload.tasks.length}`);
    console.log(`📝 Taille du prompt: ${testPayload.batchPrompt.length} caractères`);
    console.log();

    const startTime = Date.now();
    
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(testPayload)
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ Durée de la requête: ${duration}ms`);
    console.log(`📡 Status HTTP: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur HTTP:', response.status, response.statusText);
      console.error('❌ Détails:', errorText);
      return;
    }

    const result = await response.json();
    console.log('\n📥 RÉPONSE REÇUE:');
    console.log('=' .repeat(50));
    
    if (result.error) {
      console.error('❌ Erreur dans la réponse:', result.error);
      return;
    }

    if (result.success && result.recommendation) {
      console.log('✅ Réponse reçue avec succès');
      
      const recommendations = result.recommendation.recommendations;
      if (recommendations && Array.isArray(recommendations)) {
        console.log(`📊 Nombre de recommandations reçues: ${recommendations.length}`);
        console.log();
        
        // Analyser chaque recommandation
        for (let i = 0; i < recommendations.length; i++) {
          const rec = recommendations[i];
          console.log(`📋 RECOMMANDATION ${i + 1}/10:`);
          console.log(`   Task ID: ${rec.taskId}`);
          console.log(`   Task Index: ${rec.taskIndex}`);
          console.log(`   Has Recommendation: ${rec.hasRecommendation}`);
          
          if (rec.recommendation) {
            const recLength = rec.recommendation.length;
            console.log(`   Recommandation (${recLength} chars): ${rec.recommendation.substring(0, 100)}...`);
          }
          
          if (rec.emailDraft) {
            const emailLength = rec.emailDraft.length;
            console.log(`   Email Draft (${emailLength} chars): ${rec.emailDraft.substring(0, 100)}...`);
          }
          console.log();
        }
        
        // Vérifications de qualité
        console.log('🔍 VÉRIFICATIONS DE QUALITÉ:');
        console.log('=' .repeat(50));
        
        const allTasksProcessed = recommendations.length === 10;
        console.log(`✅ Toutes les tâches traitées: ${allTasksProcessed ? 'OUI' : 'NON'}`);
        
        const allHaveRecommendations = recommendations.every(r => r.hasRecommendation);
        console.log(`✅ Toutes ont des recommandations: ${allHaveRecommendations ? 'OUI' : 'NON'}`);
        
        const avgRecommendationLength = recommendations
          .map(r => r.recommendation?.length || 0)
          .reduce((a, b) => a + b, 0) / recommendations.length;
        console.log(`📏 Longueur moyenne recommandations: ${Math.round(avgRecommendationLength)} chars`);
        
        const emailDraftsCount = recommendations.filter(r => r.emailDraft).length;
        console.log(`📧 Nombre d'emails pré-rédigés: ${emailDraftsCount}/10`);
        
        // Afficher une recommandation complète en exemple
        if (recommendations.length > 0) {
          console.log('\n📄 EXEMPLE DE RECOMMANDATION COMPLÈTE:');
          console.log('=' .repeat(50));
          const firstRec = recommendations[0];
          console.log('Tâche:', testPayload.tasks[0].description);
          console.log('Recommandation:');
          console.log(firstRec.recommendation);
          if (firstRec.emailDraft) {
            console.log('\nEmail pré-rédigé:');
            console.log(firstRec.emailDraft);
          }
        }

      } else {
        console.error('❌ Format de réponse inattendu - pas de tableau de recommandations');
        console.log('Structure reçue:', JSON.stringify(result, null, 2));
      }
    } else {
      console.error('❌ Réponse sans succès ou recommandation');
      console.log('Réponse complète:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ ERREUR DURANT LE TEST:', error);
    console.error('Stack trace:', error.stack);
  }
  
  console.log('\n🏁 FIN DU TEST MANUEL');
  console.log('=' .repeat(60));
}

// Exécution du test
testTaskRecommendationAgent();
