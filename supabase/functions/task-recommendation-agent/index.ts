
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task, transcript, meetingContext, participants } = await req.json();
    console.log('[TASK-AGENT] 🎯 Analyse intelligente:', task.description.substring(0, 50));

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Prompt modifié pour générer systématiquement des recommandations
    const prompt = `Tu es un assistant IA spécialisé pour un cabinet d'ophtalmologie à Genève dirigé par le Dr Tabibian.

TÂCHE À ANALYSER: "${task.description}"

CONTEXTE RÉUNION:
- Titre: ${meetingContext.title}
- Date: ${meetingContext.date}
- Participants: ${meetingContext.participants}

PARTICIPANTS DISPONIBLES: ${participants.map(p => p.name).join(', ')}

🔍 **Pour chaque tâche, tu dois systématiquement :**
1. Donner des **tips pratiques ou des alertes** sur ce à quoi il faut faire attention (technique, administratif, juridique, logistique…).
2. Proposer des **options ou choix concrets**, avec leurs avantages/inconvénients (ex. : deux types de fontaines à eau, ou trois options de bureaux ergonomiques).
3. Suggérer des **outils numériques, prestataires ou intégrations utiles** (ex. : plugin Outlook, service de réservation, site pour commander…).
4. Alerter sur les **risques ou oublis fréquents** liés à cette tâche, même s'ils ne sont pas explicitement mentionnés.
5. Être **bref, structuré et pertinent**, en apportant toujours une valeur ajoutée.

📧 **EMAILS PRÉ-RÉDIGÉS** (si nécessaire) :

**EMAILS INTERNES** (équipe cabinet) :
- Contexte minimal, droit au but
- Ton familier mais professionnel
- Instructions claires et directes
- Format court et actionnable

**EMAILS EXTERNES** (fournisseurs, partenaires, patients) :
- Contexte complet et précis
- Ton formel et professionnel
- Présentation du cabinet et du contexte
- Demandes détaillées et structurées
- Formules de politesse appropriées

CONTEXTE CABINET : Cabinet d'ophtalmologie Dr Tabibian, Genève, équipements spécialisés (OCT, campimètre, lampe à fente), fournisseurs courants (Zeiss, Heidelberg, Topcon, Haag-Streit), normes suisses (LAMal, Swissmedic).

RÈGLES :
- Génère toujours une recommandation utile et actionnable
- Fournir des conseils pratiques pour chaque tâche
- Apporter systématiquement de la valeur ajoutée avec des insights spécialisés

TRANSCRIPT DE LA RÉUNION (pour contexte supplémentaire si nécessaire) :
"${transcript}"

RETOURNE UNIQUEMENT ce JSON :
{
  "hasRecommendation": boolean,
  "recommendation": "conseils pratiques détaillés",
  "estimatedCost": "estimation OU null",
  "contacts": [{"name": "string", "phone": "string", "email": "string", "website": "string", "address": "string"}],
  "needsEmail": boolean,
  "emailDraft": "email formaté selon type (interne/externe) OU null",
  "valueAddedReason": "pourquoi cette recommandation apporte de la valeur"
}`;

    console.log('[TASK-AGENT] 🧠 Appel OpenAI avec prompt modifié...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en gestion de cabinet médical spécialisé en ophtalmologie. 

OBJECTIF : Générer systématiquement des recommandations utiles et actionables pour chaque tâche.

CRITÈRES POUR RECOMMANDATIONS :
- Toujours apporter une valeur ajoutée mesurable
- Conseils PRATIQUES et ACTIONABLES
- Expertise spécialisée ophtalmologie/Suisse
- Insights professionnels basés sur l'expérience

Pour emails internes, utilise ce format direct :

Objet: [Sujet clair]

Bonjour [Nom/Équipe],

[Message direct avec points clairs]

- Point 1
- Point 2
- Action attendue avec délai

Merci.

Dr. Tabibian

Pour emails externes, utilise ce format professionnel :

Objet: [Sujet détaillé]

Madame, Monsieur,

Je vous contacte au nom du Cabinet d'Ophtalmologie Dr Tabibian à Genève concernant [contexte détaillé].

[Description précise de la demande avec contexte]

Dans l'attente de votre retour, je vous prie d'agréer mes salutations distinguées.

Dr. Tabibian
Cabinet d'Ophtalmologie - Genève
[coordonnées si pertinent]`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    console.log('[TASK-AGENT] ✅ Réponse OpenAI reçue');

    // Parsing JSON robuste avec validation
    let recommendation;
    try {
      // Nettoyer le contenu
      let cleanContent = content;
      
      // Retirer les blocs markdown
      cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Chercher le JSON
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }
      
      recommendation = JSON.parse(cleanContent);
      
      // Validation de la structure
      if (typeof recommendation.hasRecommendation !== 'boolean') {
        throw new Error('Structure invalide');
      }

      // Forcer la génération de recommandations - plus de filtrage strict
      if (!recommendation.hasRecommendation || !recommendation.recommendation) {
        console.log('[TASK-AGENT] ⚠️ Forçage de génération de recommandation');
        recommendation.hasRecommendation = true;
        recommendation.recommendation = recommendation.recommendation || "Tâche identifiée - recommandation en cours d'analyse.";
        recommendation.valueAddedReason = recommendation.valueAddedReason || "Suivi et documentation systématique de la tâche.";
      }

      // Nettoyer et formater l'email si présent
      if (recommendation.needsEmail && recommendation.emailDraft) {
        let emailContent = recommendation.emailDraft;
        
        // Remplacer les \\n par de vrais retours à la ligne
        emailContent = emailContent.replace(/\\n/g, '\n');
        
        // S'assurer qu'il y a des retours à la ligne entre les sections
        emailContent = emailContent.replace(/([.!?])\s*([A-Z][a-z])/g, '$1\n\n$2');
        
        // Nettoyer les espaces multiples
        emailContent = emailContent.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        recommendation.emailDraft = emailContent.trim();
      }
      
    } catch (parseError) {
      console.error('[TASK-AGENT] ❌ Erreur parsing:', parseError);
      
      // Retour par défaut avec recommandation basique
      recommendation = {
        hasRecommendation: true,
        recommendation: "Tâche enregistrée - suivi recommandé pour assurer la bonne exécution.",
        estimatedCost: null,
        contacts: [],
        needsEmail: false,
        emailDraft: null,
        valueAddedReason: "Suivi systématique et documentation de la tâche pour éviter les oublis."
      };
    }

    // Log pour debugging
    console.log('[TASK-AGENT] ✅ Recommandation générée:', {
      hasRec: recommendation.hasRecommendation,
      needsEmail: recommendation.needsEmail,
      valueAdded: recommendation.valueAddedReason ? 'Oui' : 'Non'
    });

    return new Response(JSON.stringify({
      success: true,
      recommendation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TASK-AGENT] ❌ Erreur:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      recommendation: {
        hasRecommendation: true,
        recommendation: "Erreur lors de l'analyse - tâche nécessite un suivi manuel.",
        estimatedCost: null,
        contacts: [],
        needsEmail: false,
        emailDraft: null,
        valueAddedReason: "Fallback pour assurer un suivi minimal de la tâche."
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
