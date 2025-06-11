
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

    // Prompt complètement remanié avec logique intelligente
    const prompt = `Tu es un assistant IA spécialisé pour un cabinet d'ophtalmologie à Genève dirigé par le Dr Tabibian.

TÂCHE À ANALYSER: "${task.description}"

CONTEXTE RÉUNION:
- Titre: ${meetingContext.title}
- Date: ${meetingContext.date}
- Participants: ${meetingContext.participants}

PARTICIPANTS DISPONIBLES: ${participants.map(p => p.name).join(', ')}

RÈGLES STRICTES DE VALEUR AJOUTÉE :
1. Ne génère une recommandation QUE si elle apporte une vraie valeur ajoutée
2. NE REFORMULE PAS bêtement la tâche
3. Fournir des conseils pratiques et actionables uniquement
4. Si la tâche est simple et claire, ne pas donner de recommandation

TYPES DE TÂCHES ET LOGIQUE SPÉCIALISÉE :

🏥 **CONTACT FOURNISSEUR/PRESTATAIRE** (matériel médical, services, équipements) :
- Tips essentiels pour négocier avec des fournisseurs médicaux
- Points d'attention spécifiques à l'ophtalmologie
- Éléments techniques à ne pas oublier dans les specifications
- Critères de sélection pour fournisseurs médicaux en Suisse
- Questions clés à poser (certifications, maintenance, formation)
- Aspects réglementaires suisses (Swissmedic, etc.)

🔍 **RECHERCHE/RENSEIGNEMENT** (technologies, formations, procédures) :
- Méthodologie de recherche pour le domaine médical
- Sources fiables spécialisées en ophtalmologie
- Questions structurées à poser aux experts
- Critères d'évaluation pertinents
- Checklist de points à couvrir

📧 **COMMUNICATION INTERNE** (emails équipe, rappels, coordination) :
- Générer uniquement un email pré-rédigé professionnel
- Ton approprié selon le destinataire
- Structure claire et actionnable

⚙️ **ACTION COMPLEXE** (mise en place processus, formation équipe, etc.) :
- Plan d'action détaillé avec étapes logiques
- Ressources nécessaires et responsabilités
- Timeline réaliste avec jalons
- Risques potentiels et mitigations

CONTEXTE MÉDICAL SPÉCIALISÉ :
- Cabinet ophtalmologie Genève, Dr Tabibian
- Réglementations suisses santé (LAMal, LPTh, Swissmedic)
- Équipements spécialisés : OCT, campimètre, lampe à fente, rétinographe
- Fournisseurs courants : Zeiss, Heidelberg, Topcon, Haag-Streit
- Normes qualité : ISO 13485, MDD, MDR
- Formation continue : SOG (Société Suisse d'Ophtalmologie)

EXEMPLES DE SITUATIONS :
- "Contacter fournisseur OCT" → Tips négociation, specs techniques, questions maintenance
- "Se renseigner sur nouvelle technique laser" → Sources spécialisées, critères évaluation, questions experts
- "Informer équipe changement planning" → Email pré-rédigé uniquement
- "Former équipe nouveau protocole" → Plan formation détaillé étapes par étapes

RETOURNE UNIQUEMENT ce JSON :
{
  "hasRecommendation": boolean,
  "recommendationType": "supplier_tips|research_guide|action_plan|internal_communication|null",
  "recommendation": "conseils pratiques détaillés OU null si pas de valeur ajoutée",
  "estimatedCost": "estimation si pertinent OU null",
  "contacts": [{"name": "string", "phone": "string", "email": "string", "website": "string", "address": "string"}],
  "needsEmail": boolean,
  "emailDraft": "email formaté OU null",
  "valueAddedReason": "pourquoi cette recommandation apporte de la valeur OU null"
}`;

    console.log('[TASK-AGENT] 🧠 Appel OpenAI avec nouveau prompt intelligent...');
    
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

CRITÈRES STRICTS POUR RECOMMANDATIONS :
- UNIQUEMENT si valeur ajoutée claire et mesurable
- Conseils PRATIQUES et ACTIONABLES
- Expertise spécialisée ophtalmologie/Suisse
- NE PAS reformuler bêtement

Pour emails internes, utilise ce format professionnel :

Objet: [Sujet clair]

Bonjour [Nom/Équipe],

[Message structuré avec points clairs]

- Point 1
- Point 2
- Action attendue avec délai

Merci pour votre attention.

Cordialement,
Dr. Tabibian
Cabinet d'Ophtalmologie - Genève`
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
      
      // Validation stricte de la structure
      if (typeof recommendation.hasRecommendation !== 'boolean') {
        throw new Error('Structure invalide');
      }

      // Validation de la valeur ajoutée - si pas de raison claire, rejeter
      if (recommendation.hasRecommendation && !recommendation.valueAddedReason) {
        console.log('[TASK-AGENT] ⚠️ Recommandation rejetée - pas de valeur ajoutée claire');
        recommendation.hasRecommendation = false;
        recommendation.recommendation = null;
        recommendation.recommendationType = null;
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

      // Valider le type de recommandation
      const validTypes = ['supplier_tips', 'research_guide', 'action_plan', 'internal_communication'];
      if (recommendation.recommendationType && !validTypes.includes(recommendation.recommendationType)) {
        console.log('[TASK-AGENT] ⚠️ Type de recommandation invalide:', recommendation.recommendationType);
        recommendation.recommendationType = null;
      }
      
    } catch (parseError) {
      console.error('[TASK-AGENT] ❌ Erreur parsing:', parseError);
      
      // Retour par défaut en cas d'erreur
      recommendation = {
        hasRecommendation: false,
        recommendationType: null,
        recommendation: null,
        estimatedCost: null,
        contacts: [],
        needsEmail: false,
        emailDraft: null,
        valueAddedReason: null
      };
    }

    // Log pour debugging
    console.log('[TASK-AGENT] ✅ Recommandation générée:', {
      hasRec: recommendation.hasRecommendation,
      type: recommendation.recommendationType,
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
        hasRecommendation: false,
        recommendationType: null,
        recommendation: null,
        estimatedCost: null,
        contacts: [],
        needsEmail: false,
        emailDraft: null,
        valueAddedReason: null
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
