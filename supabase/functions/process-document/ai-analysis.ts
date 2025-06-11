
// AI analysis utilities

export interface DocumentAnalysis {
  suggestedName: string;
  summary: string;
  taxonomy: {
    category: string;
    subcategory: string;
    keywords: string[];
    documentType: string;
  };
}

export async function generateDocumentAnalysis(
  text: string, 
  document: any, 
  openaiApiKey: string
): Promise<DocumentAnalysis> {
  console.log('🤖 Calling OpenAI for document analysis...');
  
  // Récupérer les mots-clés existants du système pour éviter les synonymes
  const existingKeywords = await getExistingKeywords();
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en analyse de documents médicaux. 

IMPORTANT pour les mots-clés :
- Voici les mots-clés déjà utilisés dans le système : ${existingKeywords.join(', ')}
- RÉUTILISE ces mots-clés existants quand ils correspondent au document
- Ne crée de NOUVEAUX mots-clés que si aucun existant ne convient
- Évite les synonymes (ex: si "chirurgie" existe, n'utilise pas "opération")
- Privilégie les termes précis et médicaux
- Évite les termes génériques ("document", "fichier", "information")
- Maximum 4 mots-clés par document

Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "suggestedName": "nom descriptif et professionnel du document",
  "summary": "résumé détaillé en 3-4 phrases décrivant le contenu principal",
  "taxonomy": {
    "category": "catégorie principale du document",
    "subcategory": "sous-catégorie spécifique",
    "keywords": ["mot-clé1", "mot-clé2", "mot-clé3", "mot-clé4"],
    "documentType": "type précis du document"
  }
}`
        },
        {
          role: 'user',
          content: `Analysez ce document:

Nom du fichier: ${document.original_name}
Type de fichier: ${document.content_type}

Contenu du document:
${text.substring(0, 4000)}${text.length > 4000 ? '...' : ''}

Retournez UNIQUEMENT le JSON de l'analyse.`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', errorText);
    throw new Error(`AI analysis failed: ${response.status} ${response.statusText}`);
  }

  const aiData = await response.json();
  const content = aiData.choices[0].message.content.trim();
  
  console.log('OpenAI response content:', content);

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;
    
    const parsed = JSON.parse(jsonString);
    
    if (!parsed.suggestedName || !parsed.summary || !parsed.taxonomy) {
      throw new Error('Invalid AI response structure');
    }
    
    console.log('✅ AI analysis completed successfully');
    return parsed;
  } catch (e) {
    console.error('AI response parsing failed:', e, 'Content:', content);
    throw new Error('AI response parsing failed');
  }
}

async function getExistingKeywords(): Promise<string[]> {
  try {
    // Cette fonction sera appelée dans le contexte de l'edge function
    // où nous avons accès au client Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.4');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: documents } = await supabase
      .from('uploaded_documents')
      .select('taxonomy')
      .not('taxonomy', 'is', null);

    const keywordsSet = new Set<string>();
    documents?.forEach(doc => {
      if (doc.taxonomy?.keywords) {
        doc.taxonomy.keywords.forEach((keyword: string) => {
          keywordsSet.add(keyword);
        });
      }
    });

    return Array.from(keywordsSet).sort();
  } catch (error) {
    console.error('Error fetching existing keywords:', error);
    return [];
  }
}

export function createFallbackAnalysis(document: any): DocumentAnalysis {
  return {
    suggestedName: document.original_name.replace(/\.[^/.]+$/, ""),
    summary: "Document traité automatiquement - analyse détaillée non disponible",
    taxonomy: {
      category: "Document",
      subcategory: "Fichier",
      keywords: ["document", "fichier"],
      documentType: "Fichier uploadé"
    }
  };
}
