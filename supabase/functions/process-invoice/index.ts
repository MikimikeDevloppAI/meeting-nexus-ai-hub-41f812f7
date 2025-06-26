
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Maximum file size in bytes (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Simple base64 conversion using native Deno methods
const convertToBase64 = async (fileData: Blob): Promise<string> => {
  console.log(`Converting file to base64, size: ${fileData.size} bytes`);
  
  if (fileData.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${fileData.size} bytes. Maximum allowed: ${MAX_FILE_SIZE} bytes`);
  }
  
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { invoiceId } = body

    console.log('Processing invoice:', invoiceId)

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

    // Call Mindee API
    console.log('Calling Mindee API...');
    const mindeeResponse = await fetch('https://api.mindee.net/v1/products/mindee/invoices/v4/predict', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${Deno.env.get('MINDEE_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document: base64Data
      })
    });

    if (!mindeeResponse.ok) {
      const errorText = await mindeeResponse.text();
      throw new Error(`Mindee API error: ${mindeeResponse.status} ${mindeeResponse.statusText} - ${errorText}`)
    }

    const mindeeData = await mindeeResponse.json()
    console.log('Mindee response received successfully');

    // Extract data from Mindee response
    const prediction = mindeeData.document?.inference?.prediction
    if (!prediction) {
      throw new Error('No prediction data from Mindee')
    }

    const extractedData = {
      invoice_number: prediction.invoice_number?.value || '',
      invoice_date: prediction.invoice_date?.value || null,
      due_date: prediction.due_date?.value || null,
      total_amount: prediction.total_amount?.value || 0,
      total_net: prediction.total_net?.value || 0,
      total_tax: prediction.total_tax?.value || 0,
      currency: prediction.locale?.currency || 'EUR',
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

    // Update invoice with extracted data
    const { error: updateError } = await supabaseClient
      .from('invoices')
      .update({
        ...extractedData,
        status: 'completed',
        processed_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', invoiceId)

    if (updateError) {
      throw new Error(`Failed to update invoice: ${updateError.message}`)
    }

    console.log('Invoice processing completed successfully')

    return new Response(
      JSON.stringify({ success: true, message: 'Invoice processed successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error processing invoice:', error)
    
    // Try to update invoice status to error if we have the invoiceId
    const body = await req.json().catch(() => ({}));
    if (body.invoiceId) {
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
