
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

    // Prompt modifié pour garantir la génération systématique de recommandations
    const prompt = `Tu es un assistant IA spécialisé pour un cabinet d'ophtalmologie à Genève dirigé par le Dr Tabibian.

TÂCHE À ANALYSER: "${task.description}"

CONTEXTE RÉUNION:
- Titre: ${meetingContext.title}
- Date: ${meetingContext.date}
- Participants: ${meetingContext.participants}

PARTICIPANTS DISPONIBLES: ${participants.map(p => p.name).join(', ')}

🔍 **OBLIGATION : Tu DOIS systématiquement générer une recommandation utile pour CHAQUE tâche, sans exception.**

**Pour chaque tâche, tu dois OBLIGATOIREMENT :**
1. Donner des **tips pratiques ou des alertes** sur ce à quoi il faut faire attention (technique, administratif, juridique, logistique…).
2. Proposer des **options ou choix concrets**, avec leurs avantages/inconvénients (ex. : deux types de fontaines à eau, ou trois options de bureaux ergonomiques).
3. Suggérer des **outils numériques, prestataires ou intégrations utiles** (ex. : plugin Outlook, service de réservation, site pour commander…).
4. Alerter sur les **risques ou oublis fréquents** liés à cette tâche, même s'ils ne sont pas explicitement mentionnés.
5. Être **bref, structuré et pertinent**, en apportant toujours une valeur ajoutée.

📧 **EMAILS PRÉ-RÉDIGÉS** (génération systématique si pertinent) :

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

RÈGLES STRICTES :
- Tu DOIS TOUJOURS générer une recommandation, même pour les tâches qui semblent simples
- Chaque recommandation doit apporter une valeur ajoutée concrète
- Si la tâche semble évidente, trouve des angles d'optimisation, de prévention ou d'amélioration
- Génère un email pré-rédigé dès que cela peut faciliter la communication
- JAMAIS de réponse vide ou sans recommandation

TRANSCRIPT DE LA RÉUNION (pour contexte supplémentaire si nécessaire) :
"${transcript}"

RETOURNE UNIQUEMENT ce JSON :
{
  "hasRecommendation": true,
  "recommendation": "conseils pratiques détaillés OBLIGATOIRES",
  "estimatedCost": "estimation OU null",
  "contacts": [{"name": "string", "phone": "string", "email": "string", "website": "string", "address": "string"}],
  "needsEmail": boolean,
  "emailDraft": "email formaté selon type (interne/externe) OU null",
  "valueAddedReason": "pourquoi cette recommandation apporte de la valeur OBLIGATOIRE"
}`;

    console.log('[TASK-AGENT] 🧠 Appel OpenAI avec prompt renforcé...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Changé de gpt-4o-mini à gpt-4o
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en gestion de cabinet médical spécialisé en ophtalmologie. 

OBJECTIF PRINCIPAL : Générer OBLIGATOIREMENT des recommandations utiles et actionables pour CHAQUE tâche, sans exception.

CRITÈRES STRICTS POUR RECOMMANDATIONS :
- TOUJOURS apporter une valeur ajoutée mesurable
- Conseils PRATIQUES et ACTIONABLES
- Expertise spécialisée ophtalmologie/Suisse
- Insights professionnels basés sur l'expérience
- JAMAIS de réponse vide ou générique

RÈGLE ABSOLUE : Chaque tâche doit recevoir une recommandation personnalisée, même si elle semble simple.

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
        temperature: 0.5, // Changé de 0.5 à 0.5 (déjà correct)
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    console.log('[TASK-AGENT] ✅ Réponse OpenAI reçue');

    // Parsing JSON robuste avec validation renforcée
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
      
      // Validation stricte et forçage de génération
      if (!recommendation.hasRecommendation || !recommendation.recommendation || recommendation.recommendation.trim().length < 10) {
        console.log('[TASK-AGENT] ⚠️ Forçage OBLIGATOIRE de génération de recommandation');
        recommendation.hasRecommendation = true;
        
        // Générer une recommandation basique mais utile selon le type de tâche
        const taskLower = task.description.toLowerCase();
        let fallbackRecommendation = "";
        
        if (taskLower.includes('acheter') || taskLower.includes('commander') || taskLower.includes('équipement')) {
          fallbackRecommendation = "💡 **Points d'attention pour cet achat :**\n\n• Vérifier la compatibilité avec les équipements existants\n• Comparer au moins 3 devis de fournisseurs\n• Prévoir les coûts de maintenance et formation\n• Vérifier les délais de livraison et garanties\n• S'assurer de la conformité aux normes suisses";
        } else if (taskLower.includes('contacter') || taskLower.includes('appeler') || taskLower.includes('email')) {
          fallbackRecommendation = "📞 **Optimisation de la communication :**\n\n• Préparer les points clés à aborder avant l'appel\n• Documenter les échanges dans le CRM\n• Prévoir un suivi avec délai défini\n• Avoir les références du cabinet à portée de main\n• Confirmer par email les accords verbaux";
        } else if (taskLower.includes('organiser') || taskLower.includes('planifier') || taskLower.includes('réunion')) {
          fallbackRecommendation = "📅 **Bonnes pratiques d'organisation :**\n\n• Définir un agenda précis avec créneaux horaires\n• Envoyer les invitations 48h à l'avance minimum\n• Préparer les documents nécessaires en amont\n• Prévoir une salle adaptée au nombre de participants\n• Planifier un récapitulatif post-réunion";
        } else {
          fallbackRecommendation = `🎯 **Recommandations pour optimiser cette tâche :**\n\n• Définir des étapes claires et un planning\n• Identifier les ressources nécessaires\n• Prévoir des points de contrôle intermédiaires\n• Documenter le processus pour les fois suivantes\n• Évaluer les risques potentiels et solutions de contournement`;
        }
        
        recommendation.recommendation = fallbackRecommendation;
        recommendation.valueAddedReason = "Structuration et optimisation systématique de la tâche pour éviter les oublis et améliorer l'efficacité.";
      }

      // Forcer hasRecommendation à true
      recommendation.hasRecommendation = true;

      // Vérifier que valueAddedReason existe
      if (!recommendation.valueAddedReason || recommendation.valueAddedReason.trim().length < 5) {
        recommendation.valueAddedReason = "Optimisation et sécurisation du processus avec expertise métier spécialisée.";
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
      console.error('[TASK-AGENT] ❌ Erreur parsing, génération recommandation de secours:', parseError);
      
      // Recommandation de secours OBLIGATOIRE
      recommendation = {
        hasRecommendation: true,
        recommendation: `🔧 **Recommandations générales pour : "${task.description}"**\n\n• Documenter les étapes clés de réalisation\n• Identifier les intervenants et responsabilités\n• Définir un délai réaliste avec marge de sécurité\n• Prévoir un point de validation intermédiaire\n• Capitaliser sur cette expérience pour les prochaines fois`,
        estimatedCost: null,
        contacts: [],
        needsEmail: false,
        emailDraft: null,
        valueAddedReason: "Approche méthodique et professionnelle pour assurer le succès de la tâche et éviter les écueils courants."
      };
    }

    // Log pour debugging
    console.log('[TASK-AGENT] ✅ Recommandation GARANTIE générée:', {
      hasRec: recommendation.hasRecommendation,
      recLength: recommendation.recommendation?.length || 0,
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
        recommendation: "🚨 **Erreur lors de l'analyse - Recommandations de base :**\n\n• Vérifier que tous les éléments nécessaires sont disponibles\n• Planifier la tâche avec des étapes intermédiaires\n• Prévoir un suivi régulier de l'avancement\n• Documenter les actions entreprises\n• Solliciter de l'aide si nécessaire",
        estimatedCost: null,
        contacts: [],
        needsEmail: false,
        emailDraft: null,
        valueAddedReason: "Approche structurée minimale pour assurer un suivi professionnel même en cas de problème technique."
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
