
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
  detectedLanguage?: string;
}

export async function generateDocumentAnalysis(
  text: string, 
  document: any, 
  openaiApiKey: string
): Promise<DocumentAnalysis> {
  console.log('🤖 Calling OpenAI for document analysis...');
  
  // Récupérer les mots-clés existants du système pour éviter les synonymes
  const existingKeywords = await getExistingKeywords();
  
  // Détecter si c'est un fichier Excel pour adapter le prompt
  const isExcelFile = document.content_type === 'application/vnd.ms-excel' || 
                     document.content_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  
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
          content: `Tu es un expert en analyse de documents médicaux et administratifs${isExcelFile ? ', avec une spécialisation dans l\'analyse de données Excel et tableaux' : ''}. 

DÉTECTION DE LANGUE OBLIGATOIRE :
- Tu DOIS d'abord identifier la langue principale du document
- Si le document N'EST PAS en français, tu DOIS :
  1. Inclure la langue détectée dans le nom suggéré : "[LANGUE] - Nom du document"
  2. Mentionner la langue dans le résumé : "Document rédigé en [langue]. [reste du résumé]"
- Langues possibles : français, anglais, allemand, italien, espagnol, portugais, néerlandais, etc.

CATÉGORIES OBLIGATOIRES - Tu DOIS choisir parmi ces catégories uniquement :
- "Administratif" : Documents officiels, formulaires, autorisations, courriers administratifs${isExcelFile ? ', budgets, plannings, rapports de gestion, données administratives en tableau' : ''}
- "Marketing" : UNIQUEMENT contenu marketing spécifique du cabinet du Dr Tabibian (contenu site web, publicités réseaux sociaux, brochures promotionnelles du cabinet, matériel publicitaire du cabinet)${isExcelFile ? ', données de campagnes marketing, analyses de performance marketing du cabinet' : ''}
- "Contrat" : Contrats, accords, conventions, documents juridiques${isExcelFile ? ', tableaux de tarifs, conditions contractuelles sous forme tabulaire' : ''}
- "Information médicale" : Comptes-rendus médicaux, prescriptions, résultats d'examens, dossiers patients${isExcelFile ? ', données patients en tableau, statistiques médicales, plannings de consultation' : ''}
- "Fiche Technique Materiel" : Spécifications techniques, manuels d'utilisation, fiches produits${isExcelFile ? ', inventaires d\'équipements, tableaux de spécifications techniques' : ''}
- "Contact" : Listes de contacts, annuaires, informations de contact${isExcelFile ? ', listes de contacts patients, annuaires de fournisseurs, répertoires professionnels' : ''}

${isExcelFile ? `
ANALYSE SPÉCIALE POUR LES FICHIERS EXCEL :
- Identifie le type de données : listes de contacts, budgets, plannings, inventaires, statistiques
- Détermine si c'est un tableau de suivi (patients, matériel, contacts)
- Regarde les en-têtes de colonnes pour comprendre la structure
- Privilégie "Contact" pour les listes de personnes/entreprises
- Privilégie "Administratif" pour les budgets, plannings, données de gestion
- Privilégie "Information médicale" pour les données patients ou statistiques médicales
- Privilégie "Fiche Technique Materiel" pour les inventaires d'équipements
` : ''}

ATTENTION SPÉCIALE POUR LA CATÉGORIE "Marketing" :
- N'utilise "Marketing" QUE si le document concerne spécifiquement le marketing du cabinet du Dr Tabibian
- Exemples VALIDES pour "Marketing" : contenu pour le site web du cabinet, publicités pour les réseaux sociaux du cabinet, brochures promotionnelles du cabinet
- Exemples INVALIDES pour "Marketing" : brochures commerciales de fournisseurs, publicités de laboratoires, matériel promotionnel d'autres entreprises
- En cas de doute, privilégie "Administratif" ou "Information médicale"

IMPORTANT pour les mots-clés :
- Voici les mots-clés déjà utilisés dans le système : ${existingKeywords.join(', ')}
- RÉUTILISE ces mots-clés existants quand ils correspondent au document
- Ne crée de NOUVEAUX mots-clés que si aucun existant ne convient
- Évite les synonymes (ex: si "chirurgie" existe, n'utilise pas "opération")
- Privilégie les termes précis et médicaux${isExcelFile ? ' ou techniques pour les tableaux' : ''}
- Évite les termes génériques ("document", "fichier", "information"${isExcelFile ? ', "tableau", "données"' : ''})
- Maximum 4 mots-clés par document
${isExcelFile ? '- Pour Excel : utilise des mots-clés spécifiques au contenu (ex: "planning", "budget", "inventaire", "contacts")' : ''}

Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "suggestedName": "nom descriptif et professionnel du document (avec préfixe langue si non-français)",
  "summary": "résumé détaillé en 3-4 phrases décrivant le contenu principal${isExcelFile ? ' et la structure des données' : ''} (avec mention de langue si non-français)",
  "taxonomy": {
    "category": "UNE DES 6 CATÉGORIES OBLIGATOIRES CI-DESSUS",
    "subcategory": "sous-catégorie spécifique",
    "keywords": ["mot-clé1", "mot-clé2", "mot-clé3", "mot-clé4"],
    "documentType": "type précis du document${isExcelFile ? ' (ex: tableau Excel, base de données, planning)' : ''}"
  },
  "detectedLanguage": "langue détectée (français, anglais, allemand, etc.)"
}`
        },
        {
          role: 'user',
          content: `Analysez ce document en détectant d'abord sa langue principale:

Nom du fichier: ${document.original_name}
Type de fichier: ${document.content_type}${isExcelFile ? ' (Fichier Excel - données tabulaires)' : ''}

Contenu du document:
${text.substring(0, 4000)}${text.length > 4000 ? '...' : ''}

${isExcelFile ? 'ATTENTION: Ce fichier Excel contient des données structurées en tableau. Analyse le contenu pour déterminer s\'il s\'agit de contacts, planning, budget, inventaire, etc.' : ''}

IMPORTANT: Détecte d'abord la langue du document et adapte le nom et résumé en conséquence si ce n'est pas du français.

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
    
    // Vérifier que la catégorie est valide
    const validCategories = [
      "Administratif", 
      "Marketing", 
      "Contrat", 
      "Information médicale", 
      "Fiche Technique Materiel", 
      "Contact"
    ];
    
    if (!validCategories.includes(parsed.taxonomy.category)) {
      console.warn(`Catégorie invalide détectée: ${parsed.taxonomy.category}, utilisation de "Administratif" par défaut`);
      parsed.taxonomy.category = "Administratif";
    }
    
    // Log de la langue détectée
    if (parsed.detectedLanguage && parsed.detectedLanguage.toLowerCase() !== 'français') {
      console.log(`🌐 Document en ${parsed.detectedLanguage} détecté`);
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
  const isExcelFile = document.content_type === 'application/vnd.ms-excel' || 
                     document.content_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  
  return {
    suggestedName: document.original_name.replace(/\.[^/.]+$/, ""),
    summary: `Document ${isExcelFile ? 'Excel ' : ''}traité automatiquement - analyse détaillée non disponible`,
    taxonomy: {
      category: "Administratif",
      subcategory: isExcelFile ? "Données tabulaires" : "Document général",
      keywords: [isExcelFile ? "tableau" : "document"],
      documentType: isExcelFile ? "Fichier Excel" : "Fichier uploadé"
    },
    detectedLanguage: "français"
  };
}
