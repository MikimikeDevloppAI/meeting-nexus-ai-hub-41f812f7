
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface Task {
  id: string;
  description: string;
  meeting_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { tasks } = await req.json();

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ tasks: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Préparer le prompt pour OpenAI
    const tasksForPrompt = tasks.map((task: Task, index: number) => 
      `${index + 1}. ${task.description} (Créée le: ${new Date(task.created_at).toLocaleDateString('fr-FR')}, Échéance: ${task.due_date ? new Date(task.due_date).toLocaleDateString('fr-FR') : 'Non définie'})`
    ).join('\n');

    const prompt = `Tu es un assistant spécialisé dans la gestion des priorités pour un cabinet professionnel.

Voici une liste de tâches en cours :

${tasksForPrompt}

Pour chaque tâche, attribue un score de priorité de 1 à 10 (10 = très urgent/important pour le cabinet) en tenant compte de :
- L'urgence temporelle (échéances)
- L'impact sur l'activité du cabinet
- Les conséquences si la tâche n'est pas réalisée
- L'importance pour les clients
- Les aspects réglementaires ou légaux

Réponds UNIQUEMENT avec un JSON valide au format :
{
  "tasks": [
    {
      "index": 0,
      "priority_score": 8,
      "priority_reason": "Raison concise (max 50 caractères)"
    },
    ...
  ]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parser la réponse JSON
    const prioritizedData = JSON.parse(content);

    // Combiner les tâches avec leurs scores de priorité
    const tasksWithPriority = tasks.map((task: Task, index: number) => {
      const priorityInfo = prioritizedData.tasks.find((p: any) => p.index === index);
      return {
        ...task,
        priority_score: priorityInfo?.priority_score || 5,
        priority_reason: priorityInfo?.priority_reason || 'Non classée'
      };
    });

    // Trier par score de priorité (décroissant)
    tasksWithPriority.sort((a: any, b: any) => b.priority_score - a.priority_score);

    return new Response(JSON.stringify({ tasks: tasksWithPriority }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in task-priority-classifier:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      tasks: []
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
