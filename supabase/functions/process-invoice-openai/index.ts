import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey) {
    return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let invoiceId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    invoiceId = body?.invoiceId;
    if (!invoiceId) {
      throw new Error('invoiceId is required');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log(`Processing invoice with OpenAI Vision: ${invoiceId}`);

    // Récupérer les informations de la facture
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message}`);
    }

    // Créer une URL signée pour l'image (valide 5 minutes)
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from('invoices')
      .createSignedUrl(invoice.file_path, 60 * 5);

    if (signedError || !signedUrlData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signedError?.message}`);
    }

    console.log('Created signed URL for image:', signedUrlData.signedUrl);

    // Récupérer les fournisseurs existants
    const { data: suppliers } = await supabase
      .from('invoices')
      .select('supplier_name')
      .not('supplier_name', 'is', null)
      .not('supplier_name', 'eq', '');

    const existingSuppliers = [...new Set(suppliers?.map(s => s.supplier_name) || [])];

    // Récupérer les catégories disponibles (valeurs autorisées par la contrainte)
    const categories = [
      "équipement médicaux",
      "fourniture médicales",
      "fourniture injections intra-vitréennes",
      "fourniture de bureau",
      "informatique/logiciel",
      "télécommunication",
      "assurance/cotisations sociales",
      "marketing/communication",
      "déplacement/formation",
      "frais bancaires/financiers",
      "investissement/amortissement",
      "nourritures",
      "non assigné"
    ];

    // Construire le prompt pour OpenAI
    const prompt = `Analyze this invoice/receipt image and extract the following information in JSON format:

EXISTING SUPPLIERS (use exact match if similar):
${existingSuppliers.map(s => `- "${s}"`).join('\n')}

AVAILABLE INVOICE TYPES (choose the most appropriate category):
${categories.map(c => `- "${c}"`).join('\n')}

EXTRACTION RULES:
1. supplier_name: Match exactly with existing suppliers if similar, otherwise create new name
2. payment_date:
   - If receipt: use the date shown on the receipt
   - If invoice: if no handwritten payment date is present, use today's date (YYYY-MM-DD)
3. total_amount: Total amount including tax (TTC/TTC)
4. currency: Default to "CHF" unless you see clear indication of another currency
5. invoice_type: Choose the most appropriate category from the available invoice types above based on what was purchased
6. compte: Look for handwritten "Commun", "David", "perso", "personnel", "personal" or similar handwritten text, then:
   - If "Commun" → return "Commun"
   - If "David", "perso", "personnel", "personal" or similar → return "David Tabibian"
   - Otherwise leave empty
7. is_receipt: true if this is a receipt, false if it's an invoice

Return ONLY valid JSON in this exact format:
{
  "supplier_name": "",
  "payment_date": "YYYY-MM-DD or null",
  "total_amount": number,
  "currency": "",
  "invoice_type": "",
  "compte": "",
  "is_receipt": boolean
}`;

    // Appeler OpenAI Vision API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: signedUrlData.signedUrl
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      throw new Error(`OpenAI API error: ${openAIResponse.status} ${errorText}`);
    }

    const openAIResult = await openAIResponse.json();
    const extractedText = openAIResult.choices[0].message.content;
    
    console.log('OpenAI extracted text:', extractedText);

    // Parser la réponse JSON
    let extractedData;
    try {
      // Nettoyer la réponse pour extraire le JSON
      const cleaned = (extractedText || '').replace(/```json|```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in OpenAI response');
      }
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', extractedText);
      throw new Error(`Failed to parse extraction result: ${parseError.message}`);
    }

    // Convertir la devise si nécessaire (utiliser la fonction existante)
    let finalExchangeRate = 1;
    let originalAmountChf = extractedData.total_amount;

    if (extractedData.currency !== 'CHF') {
      try {
        const conversionResponse = await fetch(`${supabaseUrl}/functions/v1/currency-converter`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currency: extractedData.currency,
            amount: extractedData.total_amount,
            date: extractedData.payment_date || new Date().toISOString().split('T')[0]
          }),
        });

        if (conversionResponse.ok) {
          const conversionResult = await conversionResponse.json();
          finalExchangeRate = conversionResult.exchange_rate || 1;
          originalAmountChf = extractedData.total_amount * finalExchangeRate;
        }
      } catch (conversionError) {
        console.error('Currency conversion failed:', conversionError);
      }
    }

    // Valider et nettoyer invoice_type pour respecter la contrainte EXACTE
    const validInvoiceTypes = [
      'équipement médicaux',
      'fourniture médicales',
      'fourniture injections intra-vitréennes',
      'fourniture de bureau',
      'informatique/logiciel',
      'télécommunication',
      'assurance/cotisations sociales',
      'marketing/communication',
      'déplacement/formation',
      'frais bancaires/financiers',
      'investissement/amortissement',
      'nourritures',
      'non assigné'
    ];

    // Fonction de normalisation pour gérer les variations
    function normalizeInvoiceType(input) {
      if (!input || typeof input !== 'string') return 'non assigné';
      
      // Nettoyer et normaliser
      const normalized = input.toLowerCase().trim()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/\s+/g, ' ');

      // Mapping des synonymes et variantes courantes
      const mappings = {
        'informatique': 'informatique/logiciel',
        'logiciel': 'informatique/logiciel',
        'software': 'informatique/logiciel',
        'ordinateur': 'informatique/logiciel',
        'materiel medical': 'équipement médicaux',
        'equipement medical': 'équipement médicaux',
        'medical': 'fourniture médicales',
        'injection': 'fourniture injections intra-vitréennes',
        'bureau': 'fourniture de bureau',
        'telecommunication': 'télécommunication',
        'assurance': 'assurance/cotisations sociales',
        'marketing': 'marketing/communication',
        'formation': 'déplacement/formation',
        'deplacement': 'déplacement/formation',
        'bancaire': 'frais bancaires/financiers',
        'financier': 'frais bancaires/financiers',
        'investissement': 'investissement/amortissement',
        'nourriture': 'nourritures',
        'alimentation': 'nourritures',
        'restaurant': 'nourritures'
      };

      // Chercher une correspondance exacte d'abord
      for (const validType of validInvoiceTypes) {
        if (validType.toLowerCase() === normalized) {
          return validType;
        }
      }

      // Chercher dans les mappings
      for (const [key, value] of Object.entries(mappings)) {
        if (normalized.includes(key)) {
          return value;
        }
      }

      return 'non assigné';
    }

    const invoiceType = normalizeInvoiceType(extractedData.invoice_type);
    
    // Résoudre la date de paiement: si facture (pas un reçu) et aucune date manuscrite, utiliser la date du jour
    const resolvedPaymentDate = (!extractedData?.is_receipt && (!extractedData?.payment_date || extractedData?.payment_date === 'null'))
      ? new Date().toISOString().split('T')[0]
      : (extractedData?.payment_date || null);
    
    console.log(`DETAILED Invoice type validation:`);
    console.log(`- Original: "${extractedData.invoice_type}"`);
    console.log(`- Final: "${invoiceType}"`);
    console.log(`- Is valid: ${validInvoiceTypes.includes(invoiceType)}`);

    // Mettre à jour la facture avec les données extraites
    // Normaliser "compte" sans changer la valeur sémantique (trim uniquement)
    const rawCompte = typeof extractedData.compte === 'string' ? extractedData.compte.trim() : extractedData.compte;

    const updateData = {
      supplier_name: extractedData.supplier_name || null,
      payment_date: resolvedPaymentDate,
      total_amount: extractedData.total_amount || null,
      currency: extractedData.currency || 'CHF',
      compte: rawCompte !== undefined ? rawCompte : null,
      invoice_type: invoiceType,
      exchange_rate: finalExchangeRate,
      original_amount_chf: originalAmountChf,
      status: 'completed',
      processed_at: new Date().toISOString()
    };

    console.log('Compte extracted (raw):', JSON.stringify(extractedData.compte));
    console.log('Compte after trim:', JSON.stringify(rawCompte));
    const { error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId);

    if (updateError) {
      throw new Error(`Failed to update invoice: ${updateError.message}`);
    }

    console.log(`Successfully processed invoice ${invoiceId} with OpenAI`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Facture traitée avec succès',
        data: updateData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-invoice-openai:', error);
    
    // Marquer la facture comme erreur sans relire le body
    try {
      if (invoiceId) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('invoices')
          .update({ 
            status: 'error', 
            error_message: String((error as any)?.message || error),
            processed_at: new Date().toISOString()
          })
          .eq('id', invoiceId);
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors du traitement de la facture', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});