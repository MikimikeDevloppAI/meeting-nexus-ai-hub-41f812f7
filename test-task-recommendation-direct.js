
// Test direct de la fonction task-recommendation-agent
// Ce script teste les deux modes : individuel et batch

const SUPABASE_URL = 'https://ecziljpkvshvapjsxaty.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk';

async function testTaskRecommendationAgent() {
  console.log('🧪 [TEST] Début du test de task-recommendation-agent');
  console.log('=' .repeat(60));
  
  // Test 1: Mode individuel
  console.log('\n🔸 TEST 1: Mode individuel');
  console.log('-' .repeat(30));
  
  try {
    const individualPayload = {
      task: {
        id: 'test-task-1',
        description: 'Appeler le fournisseur pour confirmer la livraison'
      },
      transcript: 'Réunion de coordination. Discussion sur les livraisons en cours. Il faut contacter le fournisseur principal pour confirmer les délais.',
      meetingContext: {
        title: 'Réunion de test',
        date: '2024-01-15',
        participants: 'David, Leila, Emilie'
      },
      participants: [
        { id: '1', name: 'David', email: 'david@test.com' },
        { id: '2', name: 'Leila', email: 'leila@test.com' }
      ]
    };

    console.log('📤 Envoi de la requête individuelle...');
    console.log('📋 Payload:', JSON.stringify(individualPayload, null, 2));
    
    const individualResponse = await fetch(`${SUPABASE_URL}/functions/v1/task-recommendation-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(individualPayload)
    });

    console.log(`📊 Status: ${individualResponse.status} ${individualResponse.statusText}`);
    
    if (!individualResponse.ok) {
      const errorText = await individualResponse.text();
      console.error('❌ Erreur réponse individuelle:', errorText);
    } else {
      const individualResult = await individualResponse.json();
      console.log('✅ Réponse individuelle reçue:');
      console.log(JSON.stringify(individualResult, null, 2));
    }

  } catch (error) {
    console.error('❌ Erreur test individuel:', error);
  }

  // Test 2: Mode batch
  console.log('\n🔸 TEST 2: Mode batch');
  console.log('-' .repeat(30));
  
  try {
    const tasks = [
      {
        index: 0,
        id: 'test-task-batch-1',
        description: 'Organiser la réunion avec l\'équipe marketing',
        assigned_to: 'David'
      },
      {
        index: 1,
        id: 'test-task-batch-2', 
        description: 'Préparer le rapport mensuel',
        assigned_to: 'Leila'
      },
      {
        index: 2,
        id: 'test-task-batch-3',
        description: 'Contacter le client pour feedback',
        assigned_to: 'Emilie'
      }
    ];

    const batchPrompt = `Tu es un assistant IA spécialisé dans la génération de recommandations pour des tâches issues de réunions.

CONTEXTE DE LA RÉUNION :
- Titre: Réunion de test batch
- Date: 2024-01-15
- Participants: David, Leila, Emilie

TRANSCRIPT DE LA RÉUNION :
Réunion d'équipe pour faire le point sur les projets en cours. Discussion sur l'organisation d'une réunion marketing, la préparation du rapport mensuel et le suivi client.

TÂCHES À ANALYSER (3 tâches) :
0. [ID: test-task-batch-1] Organiser la réunion avec l'équipe marketing
   - Assigné à: David

1. [ID: test-task-batch-2] Préparer le rapport mensuel  
   - Assigné à: Leila

2. [ID: test-task-batch-3] Contacter le client pour feedback
   - Assigné à: Emilie

Réponds UNIQUEMENT en JSON avec cette structure EXACTE :
{
  "recommendations": [
    {
      "taskIndex": 0,
      "taskId": "test-task-batch-1",
      "hasRecommendation": true,
      "recommendation": "Recommandation détaillée...",
      "emailDraft": "Email pré-rédigé (optionnel)"
    },
    {
      "taskIndex": 1,
      "taskId": "test-task-batch-2", 
      "hasRecommendation": true,
      "recommendation": "Recommandation détaillée...",
      "emailDraft": null
    },
    {
      "taskIndex": 2,
      "taskId": "test-task-batch-3",
      "hasRecommendation": true,
      "recommendation": "Recommandation détaillée...",
      "emailDraft": "Email pré-rédigé (optionnel)"
    }
  ]
}`;

    const batchPayload = {
      batchPrompt,
      tasks,
      transcript: 'Réunion d\'équipe pour faire le point sur les projets en cours. Discussion sur l\'organisation d\'une réunion marketing, la préparation du rapport mensuel et le suivi client.',
      meetingContext: {
        title: 'Réunion de test batch',
        date: '2024-01-15',
        participants: 'David, Leila, Emilie'
      }
    };

    console.log('📤 Envoi de la requête batch...');
    console.log('📏 Prompt length:', batchPrompt.length);
    console.log('📋 Tasks count:', tasks.length);
    
    const batchResponse = await fetch(`${SUPABASE_URL}/functions/v1/task-recommendation-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(batchPayload)
    });

    console.log(`📊 Status: ${batchResponse.status} ${batchResponse.statusText}`);
    
    if (!batchResponse.ok) {
      const errorText = await batchResponse.text();
      console.error('❌ Erreur réponse batch:', errorText);
    } else {
      const batchResult = await batchResponse.json();
      console.log('✅ Réponse batch reçue:');
      console.log(JSON.stringify(batchResult, null, 2));
      
      // Analyser les recommandations
      const recommendations = batchResult?.recommendation?.recommendations || [];
      console.log(`\n📊 Analyse: ${recommendations.length} recommandations reçues pour ${tasks.length} tâches`);
      
      if (recommendations.length > 0) {
        recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. Task ${rec.taskId}: ${rec.hasRecommendation ? 'Oui' : 'Non'}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Erreur test batch:', error);
  }

  // Test 3: Vérifier la connectivité de base
  console.log('\n🔸 TEST 3: Connectivité de base');
  console.log('-' .repeat(30));
  
  try {
    const pingResponse = await fetch(`${SUPABASE_URL}/functions/v1/task-recommendation-agent`, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
    
    console.log(`📊 CORS/Options Status: ${pingResponse.status}`);
    
    if (pingResponse.status === 200) {
      console.log('✅ Fonction accessible (CORS OK)');
    } else {
      console.log('⚠️ Problème de connectivité');
    }
    
  } catch (error) {
    console.error('❌ Erreur connectivité:', error);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 [TEST] Fin du test de task-recommendation-agent');
}

// Exécuter le test
testTaskRecommendationAgent().catch(console.error);
