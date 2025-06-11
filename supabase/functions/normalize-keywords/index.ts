
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer tous les documents existants
    const { data: documents, error: fetchError } = await supabase
      .from('uploaded_documents')
      .select('id, taxonomy, ai_generated_name, original_name')
      .not('taxonomy', 'is', null);

    if (fetchError) throw fetchError;

    // Extraire tous les mots-clés existants
    const allKeywords = new Set<string>();
    documents?.forEach(doc => {
      if (doc.taxonomy?.keywords) {
        doc.taxonomy.keywords.forEach((keyword: string) => {
          allKeywords.add(keyword.toLowerCase().trim());
        });
      }
    });

    console.log(`📊 Found ${allKeywords.size} unique keywords across ${documents?.length} documents`);

    // Créer un dictionnaire normalisé avec l'IA
    const keywordsList = Array.from(allKeywords);
    const normalizedDictionary = await createNormalizedDictionary(keywordsList, openaiApiKey);
    
    console.log(`🎯 Created normalized dictionary with ${Object.keys(normalizedDictionary).length} canonical terms`);

    // Définir les catégories valides
    const validCategories = [
      "Administratif", 
      "Marketing", 
      "Contrat", 
      "Information médicale", 
      "Fiche Technique Materiel", 
      "Contact"
    ];

    // Retraiter tous les documents avec le nouveau dictionnaire et les catégories
    let processedCount = 0;
    
    for (const document of documents || []) {
      if (document.taxonomy) {
        let updated = false;
        const updatedTaxonomy = { ...document.taxonomy };

        // Normaliser les mots-clés
        if (document.taxonomy.keywords) {
          const normalizedKeywords = normalizeKeywords(document.taxonomy.keywords, normalizedDictionary);
          
          if (JSON.stringify(normalizedKeywords.sort()) !== JSON.stringify(document.taxonomy.keywords.sort())) {
            updatedTaxonomy.keywords = normalizedKeywords;
            updated = true;
          }
        }

        // Vérifier et corriger la catégorie si nécessaire
        if (!validCategories.includes(document.taxonomy.category)) {
          console.log(`📝 Updating invalid category "${document.taxonomy.category}" to "Administratif" for: ${document.ai_generated_name || document.original_name}`);
          updatedTaxonomy.category = "Administratif";
          updated = true;
        }

        // Mettre à jour uniquement si des changements ont été effectués
        if (updated) {
          const { error: updateError } = await supabase
            .from('uploaded_documents')
            .update({ taxonomy: updatedTaxonomy })
            .eq('id', document.id);

          if (updateError) {
            console.error(`❌ Error updating document ${document.id}:`, updateError);
          } else {
            processedCount++;
            console.log(`✅ Updated document: ${document.ai_generated_name || document.original_name}`);
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processedDocuments: processedCount,
      totalDocuments: documents?.length || 0,
      dictionarySize: Object.keys(normalizedDictionary).length,
      categoriesNormalized: true,
      message: `Processed ${processedCount} documents with normalized keywords and categories`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createNormalizedDictionary(keywords: string[], openaiApiKey: string): Promise<Record<string, string>> {
  const prompt = `Tu es un expert en normalisation de mots-clés pour un système de gestion documentaire médical.

Analyse cette liste de mots-clés et crée un dictionnaire de normalisation pour éliminer les synonymes et variantes :

${keywords.join(', ')}

RÈGLES STRICTES :
1. Groupe les synonymes sous UN SEUL terme canonique (le plus précis et professionnel)
2. Élimine les termes trop génériques (ex: "document", "fichier", "information")
3. Privilégie les termes médicaux/techniques précis
4. Garde uniquement les mots-clés utiles pour la recherche documentaire
5. Utilise la forme singulier et française
6. Harmonise avec les catégories : Administratif, Marketing, Contrat, Information médicale, Fiche Technique Materiel, Contact

Retourne UNIQUEMENT un JSON avec cette structure :
{
  "mot_original": "terme_canonique",
  "autre_mot": "terme_canonique",
  "synonyme": "terme_canonique"
}

Exemple de normalisation :
- "chirurgie", "opération", "intervention" → "chirurgie"
- "oeil", "œil", "yeux" → "œil" 
- "laser", "lasik" → selon le contexte spécifique`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    return {};
  }
}

function normalizeKeywords(keywords: string[], dictionary: Record<string, string>): string[] {
  const normalized = keywords
    .map(keyword => {
      const lowercaseKeyword = keyword.toLowerCase().trim();
      return dictionary[lowercaseKeyword] || keyword;
    })
    .filter((keyword, index, array) => array.indexOf(keyword) === index) // Supprimer les doublons
    .filter(keyword => keyword.length > 2) // Supprimer les mots trop courts
    .sort();

  return normalized;
}
