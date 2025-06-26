
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to properly handle UTF-8 encoding
const cleanUtf8Text = (text: string): string => {
  if (!text) return text;
  
  try {
    // First, ensure we're working with properly encoded UTF-8
    const bytes = new TextEncoder().encode(text);
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    
    // Clean up any remaining encoding artifacts
    return decoded
      .replace(/Ã©/g, 'é')
      .replace(/Ã¨/g, 'è')
      .replace(/Ã /g, 'à')
      .replace(/Ã§/g, 'ç')
      .replace(/Ã´/g, 'ô')
      .replace(/Ã¢/g, 'â')
      .replace(/Ã¯/g, 'ï')
      .replace(/Ã«/g, 'ë')
      .replace(/Ã¹/g, 'ù')
      .replace(/Ã»/g, 'û')
      .replace(/Ã®/g, 'î')
      .replace(/Ãª/g, 'ê')
      .replace(/Ã\u00A0/g, 'à')
      .replace(/Ã\u00A8/g, 'è')
      .replace(/Ã\u00A9/g, 'é')
      .replace(/\uFFFD/g, '') // Remove replacement characters
      .trim();
  } catch (error) {
    console.error('Error cleaning UTF-8 text:', error);
    return text;
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

    const { invoiceId } = await req.json()
    console.log('Processing invoice:', invoiceId)

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

    // Convert file to base64 for Mindee API
    const arrayBuffer = await fileData.arrayBuffer()
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Call Mindee API for invoice parsing
    const mindeeResponse = await fetch('https://api.mindee.net/v1/products/mindee/invoices/v4/predict', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${Deno.env.get('MINDEE_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document: base64Data
      })
    })

    if (!mindeeResponse.ok) {
      throw new Error(`Mindee API error: ${mindeeResponse.statusText}`)
    }

    const mindeeData = await mindeeResponse.json()
    console.log('Mindee response received')

    // Extract and clean data from Mindee response
    const prediction = mindeeData.document?.inference?.prediction
    if (!prediction) {
      throw new Error('No prediction data from Mindee')
    }

    // Clean all text fields to ensure proper UTF-8 encoding
    const extractedData = {
      invoice_number: cleanUtf8Text(prediction.invoice_number?.value || ''),
      invoice_date: prediction.invoice_date?.value || null,
      due_date: prediction.due_date?.value || null,
      total_amount: prediction.total_amount?.value || 0,
      total_net: prediction.total_net?.value || 0,
      total_tax: prediction.total_tax?.value || 0,
      currency: cleanUtf8Text(prediction.locale?.currency || 'EUR'),
      supplier_name: cleanUtf8Text(prediction.supplier_name?.value || ''),
      supplier_address: cleanUtf8Text(prediction.supplier_address?.value || ''),
      supplier_email: cleanUtf8Text(prediction.supplier_email?.value || ''),
      supplier_phone_number: cleanUtf8Text(prediction.supplier_phone_number?.value || ''),
      supplier_iban: cleanUtf8Text(prediction.supplier_payment_details?.iban || ''),
      supplier_website: cleanUtf8Text(prediction.supplier_website?.value || ''),
      supplier_company_registration: cleanUtf8Text(prediction.supplier_company_registrations?.[0]?.value || ''),
      supplier_vat_number: cleanUtf8Text(prediction.supplier_tax_id?.value || ''),
      customer_name: cleanUtf8Text(prediction.customer_name?.value || ''),
      customer_address: cleanUtf8Text(prediction.customer_address?.value || ''),
      customer_company_registration: cleanUtf8Text(prediction.customer_company_registrations?.[0]?.value || ''),
      customer_vat_number: cleanUtf8Text(prediction.customer_tax_id?.value || ''),
      payment_details: cleanUtf8Text(prediction.payment_details?.value || ''),
    }

    // Process line items if available
    let lineItems = []
    if (prediction.line_items && Array.isArray(prediction.line_items)) {
      lineItems = prediction.line_items.map((item: any) => ({
        description: cleanUtf8Text(item.description || ''),
        quantity: item.quantity || null,
        unit_price: item.unit_price || null,
        total_amount: item.total_amount || null,
        tax_rate: item.tax_rate || null
      }))
    }

    console.log('Extracted supplier name:', extractedData.supplier_name)

    // Set default compte value to "Commun"
    const compte = 'Commun'

    // Update invoice with extracted data
    const { error: updateError } = await supabaseClient
      .from('invoices')
      .update({
        ...extractedData,
        line_items: lineItems,
        compte: compte,
        status: 'completed',
        processed_at: new Date().toISOString(),
        mindee_raw_response: mindeeData,
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

    // Update invoice status to error
    if (req.body) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        const { invoiceId } = await req.json()
        await supabaseClient
          .from('invoices')
          .update({ 
            status: 'error',
            error_message: error.message 
          })
          .eq('id', invoiceId)
      } catch (updateError) {
        console.error('Failed to update error status:', updateError)
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
