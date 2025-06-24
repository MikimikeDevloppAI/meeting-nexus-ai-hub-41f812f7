
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MindeeResponse {
  api_request: {
    status: string;
    status_code: number;
  };
  document: {
    id: string;
    inference: {
      prediction: {
        invoice_number: { value: string };
        invoice_date: { value: string };
        due_date: { value: string };
        total_net: { value: number };
        total_amount: { value: number };
        total_tax: { value: number };
        locale: { currency: string };
        supplier_name: { value: string };
        supplier_address: { value: string };
        supplier_company_registrations: Array<{ value: string }>;
        supplier_tax_ids: Array<{ value: string }>;
        supplier_website: { value: string };
        supplier_email: { value: string };
        supplier_phone_number: { value: string };
        customer_name: { value: string };
        customer_address: { value: string };
        customer_company_registrations: Array<{ value: string }>;
        customer_tax_ids: Array<{ value: string }>;
        payment_details: Array<{ account_number: string; iban: string; routing_number: string }>;
      };
    };
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { invoiceId } = await req.json();
    console.log('Processing invoice:', invoiceId);

    // Get invoice from database
    const { data: invoice, error: fetchError } = await supabaseClient
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      console.error('Error fetching invoice:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    await supabaseClient
      .from('invoices')
      .update({ status: 'processing' })
      .eq('id', invoiceId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('invoices')
      .download(invoice.file_path);

    if (downloadError || !fileData) {
      console.error('Error downloading file:', downloadError);
      await supabaseClient
        .from('invoices')
        .update({ 
          status: 'error', 
          error_message: 'Failed to download file',
          processed_at: new Date().toISOString()
        })
        .eq('id', invoiceId);
      return new Response(
        JSON.stringify({ error: 'Failed to download file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare file for Mindee API
    const formData = new FormData();
    formData.append('document', fileData, invoice.original_filename);

    // Call Mindee API
    const mindeeResponse = await fetch('https://api.mindee.net/v1/products/mindee/invoices/v4/predict', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${Deno.env.get('MINDEE_API_KEY')}`,
      },
      body: formData,
    });

    if (!mindeeResponse.ok) {
      const errorText = await mindeeResponse.text();
      console.error('Mindee API error:', errorText);
      await supabaseClient
        .from('invoices')
        .update({ 
          status: 'error', 
          error_message: `Mindee API error: ${errorText}`,
          processed_at: new Date().toISOString()
        })
        .eq('id', invoiceId);
      return new Response(
        JSON.stringify({ error: 'Mindee API error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mindeeData: MindeeResponse = await mindeeResponse.json();
    console.log('Mindee response received');

    // Extract relevant data
    const prediction = mindeeData.document.inference.prediction;
    
    const extractedData = {
      invoice_number: prediction.invoice_number?.value || null,
      invoice_date: prediction.invoice_date?.value || null,
      due_date: prediction.due_date?.value || null,
      total_net: prediction.total_net?.value || null,
      total_amount: prediction.total_amount?.value || null,
      total_tax: prediction.total_tax?.value || null,
      currency: prediction.locale?.currency || null,
      supplier_name: prediction.supplier_name?.value || null,
      supplier_address: prediction.supplier_address?.value || null,
      supplier_company_registration: prediction.supplier_company_registrations?.[0]?.value || null,
      supplier_vat_number: prediction.supplier_tax_ids?.[0]?.value || null,
      supplier_website: prediction.supplier_website?.value || null,
      supplier_email: prediction.supplier_email?.value || null,
      supplier_phone_number: prediction.supplier_phone_number?.value || null,
      customer_name: prediction.customer_name?.value || null,
      customer_address: prediction.customer_address?.value || null,
      customer_company_registration: prediction.customer_company_registrations?.[0]?.value || null,
      customer_vat_number: prediction.customer_tax_ids?.[0]?.value || null,
      payment_details: prediction.payment_details?.map(p => 
        [p.account_number, p.iban, p.routing_number].filter(Boolean).join(', ')
      ).join('; ') || null,
      mindee_raw_response: mindeeData,
      status: 'completed',
      processed_at: new Date().toISOString()
    };

    // Update invoice with extracted data
    const { error: updateError } = await supabaseClient
      .from('invoices')
      .update(extractedData)
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update invoice' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Invoice processed successfully');

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
