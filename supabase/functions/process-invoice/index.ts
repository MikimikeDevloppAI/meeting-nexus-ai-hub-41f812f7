
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Maximum file size in bytes (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Improved base64 conversion
const convertToBase64 = async (fileData: Blob): Promise<string> => {
  console.log(`Converting file to base64, size: ${fileData.size} bytes`);
  
  if (fileData.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${fileData.size} bytes. Maximum allowed: ${MAX_FILE_SIZE} bytes`);
  }
  
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 1024;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64 = btoa(binary);
    console.log('Base64 conversion successful');
    return base64;
  } catch (error) {
    console.error('Error converting to base64:', error);
    throw new Error(`Failed to convert file to base64: ${error.message}`);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    console.error('Error parsing request body:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }

  try {
    // Verify API key is available
    const mindeeApiKey = Deno.env.get('MINDEE_API_KEY');
    if (!mindeeApiKey) {
      throw new Error('MINDEE_API_KEY is not configured in environment variables');
    }
    console.log('Mindee API key found and configured');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { invoiceId, documentType = 'invoice' } = body;

    console.log('Processing document:', invoiceId, 'as', documentType)

    if (!invoiceId) {
      throw new Error('Missing invoiceId parameter');
    }

    // Get invoice from database
    const { data: invoice, error: fetchError } = await supabaseClient
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (fetchError || !invoice) {
      throw new Error(`Invoice not found: ${fetchError?.message}`)
    }

    // Update status to processing
    await supabaseClient
      .from('invoices')
      .update({ status: 'processing' })
      .eq('id', invoiceId)

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('invoices')
      .download(invoice.file_path)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`)
    }

    console.log(`File downloaded successfully: ${invoice.file_path}, size: ${fileData.size} bytes`);

    // Convert to base64
    const base64Data = await convertToBase64(fileData);

    // Choose the appropriate Mindee API endpoint based on document type
    const apiEndpoint = documentType === 'receipt' 
      ? 'https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict'
      : 'https://api.mindee.net/v1/products/mindee/invoices/v4/predict';

    // Call Mindee API with improved error handling
    console.log(`Calling Mindee API for ${documentType} at endpoint: ${apiEndpoint}`);
    
    const mindeeResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${mindeeApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document: base64Data
      })
    });

    console.log(`Mindee API response status: ${mindeeResponse.status} ${mindeeResponse.statusText}`);

    if (!mindeeResponse.ok) {
      const errorText = await mindeeResponse.text();
      console.error(`Mindee API error details: ${errorText}`);
      throw new Error(`Mindee API error: ${mindeeResponse.status} ${mindeeResponse.statusText} - ${errorText}`)
    }

    const mindeeData = await mindeeResponse.json()
    console.log('Mindee response received successfully');

    // Extract data from Mindee response
    const prediction = mindeeData.document?.inference?.prediction
    if (!prediction) {
      throw new Error('No prediction data from Mindee')
    }

    // Log currency confidence for debugging
    const currencyConfidence = prediction.locale?.confidence;
    const originalCurrency = prediction.locale?.currency;
    console.log(`Currency confidence: ${currencyConfidence}, Original currency: ${originalCurrency}`);
    
    if (!currencyConfidence || currencyConfidence < 0.8) {
      console.log(`Low currency confidence (${currencyConfidence}), forcing CHF instead of ${originalCurrency}`);
    } else {
      console.log(`Good currency confidence (${currencyConfidence}), using detected currency: ${originalCurrency}`);
    }

    // Extract data based on document type
    let extractedData;
    
    if (documentType === 'receipt') {
      // Receipt-specific data extraction
      extractedData = {
        invoice_number: prediction.receipt_number?.value || '',
        invoice_date: prediction.date?.value || null,
        due_date: null, // Receipts typically don't have due dates
        total_amount: prediction.total_amount?.value || 0,
        total_net: prediction.total_net?.value || 0,
        total_tax: prediction.total_tax?.value || 0,
        currency: (prediction.locale?.confidence && prediction.locale.confidence >= 0.8) 
          ? prediction.locale.currency 
          : 'CHF',
        supplier_name: prediction.supplier_name?.value || '',
        supplier_address: prediction.supplier_address?.value || '',
        supplier_email: '',
        supplier_phone_number: prediction.supplier_phone_number?.value || '',
        supplier_iban: '',
        supplier_website: '',
        supplier_company_registration: '',
        supplier_vat_number: '',
        customer_name: '',
        customer_address: '',
        customer_company_registration: '',
        customer_vat_number: '',
        payment_details: '',
        purchase_category: prediction.category?.value || null,
        purchase_subcategory: prediction.subcategory?.value || null,
        line_items: prediction.line_items ? prediction.line_items.map((item: any) => ({
          description: item.description || '',
          quantity: item.quantity || null,
          unit_price: item.unit_price || null,
          total_amount: item.total_amount || null,
          tax_rate: item.tax_rate || null
        })) : [],
        mindee_raw_response: mindeeData,
        compte: invoice.compte || 'Commun'
      };
    } else {
      // Invoice-specific data extraction with proper category handling
      extractedData = {
        invoice_number: prediction.invoice_number?.value || '',
        invoice_date: prediction.date?.value || null,
        due_date: prediction.due_date?.value || null,
        total_amount: prediction.total_amount?.value || 0,
        total_net: prediction.total_net?.value || 0,
        total_tax: prediction.total_tax?.value || 0,
        currency: (prediction.locale?.confidence && prediction.locale.confidence >= 0.8) 
          ? prediction.locale.currency 
          : 'CHF',
        supplier_name: prediction.supplier_name?.value || '',
        supplier_address: prediction.supplier_address?.value || '',
        supplier_email: prediction.supplier_email?.value || '',
        supplier_phone_number: prediction.supplier_phone_number?.value || '',
        supplier_iban: prediction.supplier_payment_details?.iban || '',
        supplier_website: prediction.supplier_website?.value || '',
        supplier_company_registration: prediction.supplier_company_registrations?.[0]?.value || '',
        supplier_vat_number: prediction.supplier_tax_id?.value || '',
        customer_name: prediction.customer_name?.value || '',
        customer_address: prediction.customer_address?.value || '',
        customer_company_registration: prediction.customer_company_registrations?.[0]?.value || '',
        customer_vat_number: prediction.customer_tax_id?.value || '',
        payment_details: prediction.payment_details?.value || '',
        purchase_category: prediction.category?.value || null,
        purchase_subcategory: prediction.subcategory?.value || null,
        line_items: prediction.line_items ? prediction.line_items.map((item: any) => ({
          description: item.description || '',
          quantity: item.quantity || null,
          unit_price: item.unit_price || null,
          total_amount: item.total_amount || null,
          tax_rate: item.tax_rate || null
        })) : [],
        mindee_raw_response: mindeeData,
        compte: invoice.compte || 'Commun'
      };
    }

    // Fallback: si invoice_date est null mais due_date ne l'est pas, utiliser due_date
    if (!extractedData.invoice_date && extractedData.due_date) {
      extractedData.invoice_date = extractedData.due_date;
      console.log(`Invoice date was null, using due_date as fallback: ${extractedData.invoice_date}`);
    }

    // Convert currency if needed
    let currencyData = {};
    if (extractedData.currency !== 'CHF' && extractedData.total_amount) {
      try {
        const conversionDate = extractedData.invoice_date 
          ? new Date(extractedData.invoice_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const { data: conversionResult, error: conversionError } = await supabaseClient.functions.invoke('currency-converter', {
          body: {
            currency: extractedData.currency,
            amount: extractedData.total_amount,
            date: conversionDate
          }
        });

        if (!conversionError && conversionResult) {
          currencyData = {
            exchange_rate: conversionResult.exchange_rate,
            original_amount_chf: conversionResult.converted_amount
          };
          console.log(`Currency conversion: ${extractedData.total_amount} ${extractedData.currency} = ${conversionResult.converted_amount} CHF`);
        } else {
          console.warn('Currency conversion failed:', conversionError);
        }
      } catch (error) {
        console.warn('Currency conversion error:', error);
      }
    } else if (extractedData.currency === 'CHF') {
      currencyData = {
        exchange_rate: 1,
        original_amount_chf: extractedData.total_amount
      };
    }

    // Update invoice with extracted data
    const { error: updateError } = await supabaseClient
      .from('invoices')
      .update({
        ...extractedData,
        ...currencyData,
        status: 'completed',
        processed_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', invoiceId)

    if (updateError) {
      throw new Error(`Failed to update invoice: ${updateError.message}`)
    }

    console.log(`${documentType} processing completed successfully`)

    return new Response(
      JSON.stringify({ success: true, message: `${documentType} processed successfully` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error(`Error processing document:`, error)
    
    // Try to update invoice status to error if we have the invoiceId
    if (body?.invoiceId) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabaseClient
        .from('invoices')
        .update({ 
          status: 'error', 
          error_message: error.message,
          processed_at: new Date().toISOString()
        })
        .eq('id', body.invoiceId);
    }

    return new Response(
      JSON.stringify({ error: `Processing error: ${error.message}` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
