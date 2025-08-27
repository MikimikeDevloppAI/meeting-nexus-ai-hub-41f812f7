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

    // Récupérer les catégories disponibles
    const categories = [
      "assurance/cotisations sociales",
      "contactologie", 
      "entretien/nettoyage",
      "formation", 
      "fourniture injections intra-vitréennes",
      "fourniture médicales",
      "frais bancaires/financiers",
      "frais de locaux",
      "frais de véhicule", 
      "informatique/logiciel",
      "investissement/amortissement",
      "marketing/communication",
      "prestations extérieures",
      "télécommunication"
    ];

    // Construire le prompt pour OpenAI
    const prompt = `Analyze this invoice/receipt image and extract the following information in JSON format:

EXISTING SUPPLIERS (use exact match if similar):
${existingSuppliers.map(s => `- "${s}"`).join('\n')}

AVAILABLE CATEGORIES (choose one):
${categories.map(c => `- "${c}"`).join('\n')}

EXTRACTION RULES:
1. supplier_name: Match exactly with existing suppliers if similar, otherwise create new name
2. payment_date: 
   - If receipt: use the date shown on the receipt
   - If invoice: look for handwritten "date de paiement" or payment date, otherwise null
3. total_amount: Total amount including tax (TTC/TTC)
4. currency: Default to "CHF" unless you see clear indication of another currency
5. purchase_category: Choose from the available categories above
6. compte: Look for handwritten "Commun" or "David", otherwise leave empty
7. document_type: "invoice" or "receipt" based on document characteristics

Return ONLY valid JSON in this exact format:
{
  "supplier_name": "",
  "payment_date": "YYYY-MM-DD or null",
  "total_amount": number,
  "currency": "",
  "purchase_category": "",
  "compte": "",
  "document_type": ""
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

    // Mettre à jour la facture avec les données extraites
    const updateData = {
      supplier_name: extractedData.supplier_name || null,
      payment_date: extractedData.payment_date || null,
      total_amount: extractedData.total_amount || null,
      currency: extractedData.currency || 'CHF',
      purchase_category: extractedData.purchase_category || null,
      compte: extractedData.compte || null,
      invoice_type: extractedData.document_type || 'non assigné',
      exchange_rate: finalExchangeRate,
      original_amount_chf: originalAmountChf,
      status: 'processed',
      processed_at: new Date().toISOString()
    };

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