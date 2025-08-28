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

    // Créer une URL signée pour le fichier (valide 5 minutes)
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from('invoices')
      .createSignedUrl(invoice.file_path, 60 * 5);

    if (signedError || !signedUrlData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signedError?.message}`);
    }

    console.log('Created signed URL for file:', signedUrlData.signedUrl);

    // Détecter si c'est un PDF et le convertir si nécessaire
    const isPdf = invoice.file_path.toLowerCase().endsWith('.pdf') || 
                  invoice.content_type === 'application/pdf';
    
    let imageUrlsForAnalysis = [signedUrlData.signedUrl];
    
    if (isPdf) {
      console.log('PDF detected, converting to image(s) for OpenAI analysis...');
      
      try {
        // Appeler la fonction de conversion PDF vers image
        const conversionResponse = await supabase.functions.invoke('convert-pdf-to-image', {
          body: { pdfUrl: signedUrlData.signedUrl }
        });

        if (conversionResponse.error) {
          throw new Error(`PDF conversion failed: ${conversionResponse.error.message}`);
        }

        const conversionData = conversionResponse.data;
        if (!conversionData?.success || !conversionData?.imageUrls || !Array.isArray(conversionData.imageUrls)) {
          throw new Error('PDF conversion did not return valid image URLs');
        }

        imageUrlsForAnalysis = conversionData.imageUrls;
        console.log(`PDF successfully converted to ${imageUrlsForAnalysis.length} image(s) for analysis`);
        
      } catch (conversionError) {
        console.error('PDF conversion error:', conversionError);
        throw new Error(`Failed to convert PDF for analysis: ${conversionError.message}`);
      }
    }

    // Récupérer les fournisseurs existants
    const { data: suppliers } = await supabase
      .from('invoices')
      .select('supplier_name')
      .not('supplier_name', 'is', null)
      .not('supplier_name', 'eq', '');

    const existingSuppliers = [...new Set(suppliers?.map(s => s.supplier_name) || [])];

    // Récupérer les catégories disponibles (valeurs autorisées par la contrainte)
    const categories = [
      "assurance/cotisations sociales",
      "contactologie",
      "déplacement/formation",
      "équipement médicaux",
      "fourniture de bureau",
      "fourniture injections intra-vitréennes",
      "fourniture médicales",
      "frais bancaires/financiers",
      "frais de locaux",
      "frais de véhicule",
      "informatique/logiciel",
      "investissement/amortissement",
      "marketing/communication",
      "nourritures",
      "télécommunication",
      "non assigné"
    ];

    // Construire le prompt pour OpenAI
    const prompt = `Analyze ${imageUrlsForAnalysis.length === 1 ? 'this invoice/receipt image' : `these ${imageUrlsForAnalysis.length} pages of invoice/receipt images`} and extract information for ALL invoices/receipts visible across ${imageUrlsForAnalysis.length === 1 ? 'the document' : 'all pages'}.

IMPORTANT: ${imageUrlsForAnalysis.length > 1 ? `You are analyzing ${imageUrlsForAnalysis.length} pages of the same document. Look across ALL pages to find invoices/receipts.` : ''} If there are multiple invoices/receipts in this document, return an array with one object for each invoice. If there's only one invoice, still return an array with one object.

EXISTING SUPPLIERS (use exact match if similar):
${existingSuppliers.map(s => `- "${s}"`).join('\n')}

AVAILABLE INVOICE TYPES (choose the most appropriate category):
${categories.map(c => `- "${c}"`).join('\n')}

EXTRACTION RULES (for each invoice found):
1. supplier_name: Match exactly with existing suppliers if similar, otherwise create new name
2. payment_date:
   - If receipt: use the date shown on the receipt
   - If invoice: if no handwritten payment date is present, use today's date (YYYY-MM-DD)
   - IMPORTANT: All dates must be in 2025 or later. If year is missing or unclear, use current year (2025)
   - If extracted date is before 2025, assume current year (2025)
3. total_amount: Total amount including tax (TTC/TTC)
4. currency: Default to "CHF" unless you see clear indication of another currency
5. invoice_type: MANDATORY - You MUST choose one of the specific categories from the available invoice types above based on:
   - The supplier name (e.g., medical suppliers → medical categories, IT companies → informatique/logiciel)
   - The items/services being invoiced (analyze line items, descriptions, product names)
   - Context clues from the invoice content
   - DO NOT use "non assigné" - always select the most relevant specific category even if it's an approximation
6. compte: Look for handwritten "Commun", "David", "perso", "personnel", "personal" or similar handwritten text, then:
   - If you see handwritten "Commun" → return "Commun"
   - Otherwise (no handwritten mention or David/perso mentions) → return "David Tabibian"
7. is_receipt: true if this is a receipt, false if it's an invoice

Return ONLY valid JSON array in this exact format (even for single invoice):
[
  {
    "supplier_name": "",
    "payment_date": "YYYY-MM-DD or null",
    "total_amount": number,
    "currency": "",
    "invoice_type": "",
    "compte": "",
    "is_receipt": boolean
  }
]`;

    // Construire le contenu avec toutes les images
    const messageContent = [
      {
        type: 'text',
        text: prompt
      },
      ...imageUrlsForAnalysis.map(url => ({
        type: 'image_url',
        image_url: {
          url: url
        }
      }))
    ];

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
            content: messageContent
          }
        ],
        max_tokens: 1500,
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
    let extractedDataArray;
    try {
      // Nettoyer la réponse pour extraire le JSON
      const cleaned = (extractedText || '').replace(/```json|```/g, '').trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/) || cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in OpenAI response');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      // Si c'est un objet unique, le convertir en array
      extractedDataArray = Array.isArray(parsed) ? parsed : [parsed];
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', extractedText);
      throw new Error(`Failed to parse extraction result: ${parseError.message}`);
    }

    console.log(`Found ${extractedDataArray.length} invoice(s) in the document`);

    // Traiter chaque facture
    const processedInvoices = [];
    const errors = [];

    for (let i = 0; i < extractedDataArray.length; i++) {
      const extractedData = extractedDataArray[i];
      try {
        console.log(`Processing invoice ${i + 1}/${extractedDataArray.length}:`, extractedData);

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
      'assurance/cotisations sociales',
      'contactologie',
      'déplacement/formation',
      'équipement médicaux',
      'fourniture de bureau',
      'fourniture injections intra-vitréennes',
      'fourniture médicales',
      'frais bancaires/financiers',
      'frais de locaux',
      'frais de véhicule',
      'informatique/logiciel',
      'investissement/amortissement',
      'marketing/communication',
      'nourritures',
      'télécommunication',
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

      // En dernier recours, choisir la catégorie la plus générique appropriée
      return 'fourniture de bureau';
    }

        const invoiceType = normalizeInvoiceType(extractedData.invoice_type);
        
        // Résoudre la date de paiement: si facture (pas un reçu) et aucune date manuscrite, utiliser la date du jour
        const resolvedPaymentDate = (!extractedData?.is_receipt && (!extractedData?.payment_date || extractedData?.payment_date === 'null'))
          ? new Date().toISOString().split('T')[0]
          : (extractedData?.payment_date || null);
        
        console.log(`DETAILED Invoice type validation for invoice ${i + 1}:`);
        console.log(`- Original: "${extractedData.invoice_type}"`);
        console.log(`- Final: "${invoiceType}"`);
        console.log(`- Is valid: ${validInvoiceTypes.includes(invoiceType)}`);

        // Normaliser "compte" et s'assurer qu'une chaîne vide devient "David Tabibian"
        let processedCompte = typeof extractedData.compte === 'string' ? extractedData.compte.trim() : extractedData.compte;
        
        // Si le compte est vide ou undefined, utiliser "David Tabibian" par défaut
        if (!processedCompte || processedCompte === '') {
          processedCompte = 'David Tabibian';
        }

        const updateData = {
          supplier_name: extractedData.supplier_name || null,
          payment_date: resolvedPaymentDate,
          total_amount: extractedData.total_amount || null,
          currency: extractedData.currency || 'CHF',
          compte: processedCompte,
          invoice_type: invoiceType,
          exchange_rate: finalExchangeRate,
          original_amount_chf: originalAmountChf,
          status: 'completed',
          processed_at: new Date().toISOString()
        };

        console.log(`Invoice ${i + 1} - Compte extracted (raw):`, JSON.stringify(extractedData.compte));
        console.log(`Invoice ${i + 1} - Compte after processing:`, JSON.stringify(processedCompte));

        // Pour la première facture, mettre à jour l'enregistrement existant
        if (i === 0) {
          const { error: updateError } = await supabase
            .from('invoices')
            .update(updateData)
            .eq('id', invoiceId);

          if (updateError) {
            throw new Error(`Failed to update invoice 1: ${updateError.message}`);
          }
          processedInvoices.push({ ...updateData, id: invoiceId, isNew: false });
        } else {
          // Pour les factures supplémentaires, créer de nouveaux enregistrements
          const newInvoiceData = {
            ...updateData,
            file_path: invoice.file_path,
            original_filename: invoice.original_filename,
            content_type: invoice.content_type,
            file_size: invoice.file_size,
            created_by: invoice.created_by
          };

          const { data: newInvoice, error: insertError } = await supabase
            .from('invoices')
            .insert(newInvoiceData)
            .select()
            .single();

          if (insertError) {
            throw new Error(`Failed to create invoice ${i + 1}: ${insertError.message}`);
          }
          processedInvoices.push({ ...newInvoice, isNew: true });
        }

        console.log(`Successfully processed invoice ${i + 1}/${extractedDataArray.length}`);

      } catch (invoiceError) {
        console.error(`Error processing invoice ${i + 1}:`, invoiceError);
        errors.push({
          index: i + 1,
          error: invoiceError.message,
          data: extractedData
        });
      }
    }

    // Si toutes les factures ont échoué, lever une erreur
    if (processedInvoices.length === 0) {
      throw new Error(`Failed to process any invoices. Errors: ${errors.map(e => `Invoice ${e.index}: ${e.error}`).join('; ')}`);
    }

    const message = processedInvoices.length === 1 
      ? 'Facture traitée avec succès'
      : `${processedInvoices.length} factures traitées avec succès${errors.length > 0 ? ` (${errors.length} échecs)` : ''}`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        processedCount: processedInvoices.length,
        errorCount: errors.length,
        data: processedInvoices,
        errors: errors.length > 0 ? errors : undefined
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