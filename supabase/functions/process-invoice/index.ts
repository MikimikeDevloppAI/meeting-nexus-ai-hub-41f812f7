
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

// Function to generate a safe filename from supplier name and date
const generateSafeFilename = (supplierName: string, invoiceDate: string, originalExtension: string, sequenceNumber: number = 1): string => {
  const date = invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  
  const cleanSupplier = supplierName
    ? supplierName
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[ñ]/g, 'n')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 30)
    : 'Inconnu';

  const sequenceSuffix = sequenceNumber > 1 ? `_${sequenceNumber}` : '';
  return `${date}_${cleanSupplier}${sequenceSuffix}${originalExtension}`;
};

// Function to check if filename exists and get next available sequence number
const getNextAvailableFilename = async (supabaseClient: any, baseName: string, extension: string): Promise<string> => {
  let sequenceNumber = 1;
  let testFilename = `${baseName}${extension}`;
  
  while (true) {
    // Check if this filename already exists in storage
    const { data: existingFiles } = await supabaseClient.storage
      .from('invoices')
      .list('', { search: testFilename });
    
    if (!existingFiles || existingFiles.length === 0) {
      return testFilename;
    }
    
    sequenceNumber++;
    testFilename = `${baseName}_${sequenceNumber}${extension}`;
  }
};

// Function to get Mindee API endpoint based on document type
const getMindeeEndpoint = (documentType: string): string => {
  switch (documentType) {
    case 'receipt':
      return 'https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict';
    case 'invoice':
    default:
      return 'https://api.mindee.net/v1/products/mindee/invoices/v4/predict';
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
    const { invoiceId, invoiceIds, documentType = 'invoice', isGrouped = false } = body

    console.log('Processing request:', { invoiceId, invoiceIds, documentType, isGrouped })

    if (isGrouped && invoiceIds) {
      // Traitement groupé
      return await processGroupedInvoices(supabaseClient, invoiceIds, documentType);
    } else if (invoiceId) {
      // Traitement individuel
      return await processSingleInvoice(supabaseClient, invoiceId, documentType);
    } else {
      throw new Error('Missing invoiceId or invoiceIds parameter');
    }

  } catch (error) {
    console.error('Error processing invoice:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

async function processSingleInvoice(supabaseClient: any, invoiceId: string, documentType: string) {
  console.log('Processing single invoice:', invoiceId)

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

  // Process with Mindee
  const extractedData = await callMindeeAPI(fileData, documentType);

  // Generate new filename based on supplier and date
  const originalExtension = invoice.original_filename.split('.').pop() || '.pdf';
  const supplierName = cleanUtf8Text(extractedData.supplier_name || '');
  const invoiceDate = extractedData.invoice_date;

  if (supplierName) {
    try {
      const baseName = `${invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}_${supplierName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').substring(0, 30)}`;
      const newFilename = await getNextAvailableFilename(supabaseClient, baseName, `.${originalExtension}`);
      
      // Copy file to new location with new name
      const { data: copyData, error: copyError } = await supabaseClient.storage
        .from('invoices')
        .copy(invoice.file_path, newFilename);
      
      if (!copyError) {
        // Delete old file
        await supabaseClient.storage
          .from('invoices')
          .remove([invoice.file_path]);
        
        // Update file_path in database
        extractedData.file_path = newFilename;
        console.log(`File renamed from ${invoice.file_path} to ${newFilename}`);
      }
    } catch (renameError) {
      console.warn('File renaming failed, keeping original name:', renameError);
    }
  }

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

  console.log('Single invoice processing completed successfully')

  return new Response(
    JSON.stringify({ success: true, message: 'Invoice processed successfully' }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    },
  )
}

async function processGroupedInvoices(supabaseClient: any, invoiceIds: string[], documentType: string) {
  console.log('Processing grouped invoices:', invoiceIds)

  // Get all invoices from database
  const { data: invoices, error: fetchError } = await supabaseClient
    .from('invoices')
    .select('*')
    .in('id', invoiceIds)

  if (fetchError || !invoices || invoices.length === 0) {
    throw new Error(`Invoices not found: ${fetchError?.message}`)
  }

  // Update all statuses to processing
  await supabaseClient
    .from('invoices')
    .update({ status: 'processing' })
    .in('id', invoiceIds)

  // Download all files and combine them for Mindee API
  const fileDataArray = [];
  for (const invoice of invoices) {
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('invoices')
      .download(invoice.file_path)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file ${invoice.file_path}: ${downloadError?.message}`)
    }

    fileDataArray.push({ fileData, invoice });
  }

  // For grouped processing, we'll process the first file with Mindee and apply results to all
  const primaryFileData = fileDataArray[0];
  const extractedData = await callMindeeAPI(primaryFileData.fileData, documentType);

  // Apply extracted data to all invoices in the group
  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];
    const currentData = { ...extractedData };

    // Generate new filename for each file
    const originalExtension = invoice.original_filename.split('.').pop() || '.pdf';
    const supplierName = cleanUtf8Text(extractedData.supplier_name || '');
    const invoiceDate = extractedData.invoice_date;

    if (supplierName) {
      try {
        const baseName = `${invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}_${supplierName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').substring(0, 30)}`;
        const newFilename = await getNextAvailableFilename(supabaseClient, baseName, `.${originalExtension}`);
        
        // Copy file to new location with new name
        const { data: copyData, error: copyError } = await supabaseClient.storage
          .from('invoices')
          .copy(invoice.file_path, newFilename);
        
        if (!copyError) {
          // Delete old file
          await supabaseClient.storage
            .from('invoices')
            .remove([invoice.file_path]);
          
          // Update file_path for this invoice
          currentData.file_path = newFilename;
          console.log(`File renamed from ${invoice.file_path} to ${newFilename}`);
        }
      } catch (renameError) {
        console.warn(`File renaming failed for ${invoice.file_path}, keeping original name:`, renameError);
      }
    }

    // Update each invoice
    const { error: updateError } = await supabaseClient
      .from('invoices')
      .update({
        ...currentData,
        status: 'completed',
        processed_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', invoice.id)

    if (updateError) {
      console.error(`Failed to update invoice ${invoice.id}:`, updateError);
    }
  }

  console.log('Grouped invoice processing completed successfully')

  return new Response(
    JSON.stringify({ success: true, message: 'Grouped invoices processed successfully' }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    },
  )
}

async function callMindeeAPI(fileData: Blob, documentType: string) {
  // Convert file to base64 for Mindee API
  const arrayBuffer = await fileData.arrayBuffer()
  const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

  const mindeeEndpoint = getMindeeEndpoint(documentType);
  console.log(`Calling Mindee API: ${mindeeEndpoint} for document type: ${documentType}`);

  // Call Mindee API
  const mindeeResponse = await fetch(mindeeEndpoint, {
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
  console.log('Mindee response received for document type:', documentType)

  // Extract and clean data from Mindee response
  const prediction = mindeeData.document?.inference?.prediction
  if (!prediction) {
    throw new Error('No prediction data from Mindee')
  }

  // Extract data based on document type
  let extractedData;
  if (documentType === 'receipt') {
    extractedData = extractReceiptData(prediction);
  } else {
    extractedData = extractInvoiceData(prediction);
  }

  // Add raw response and set default compte
  extractedData.mindee_raw_response = mindeeData;
  extractedData.compte = extractedData.compte || 'Commun';

  return extractedData;
}

function extractInvoiceData(prediction: any) {
  return {
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
    line_items: prediction.line_items ? prediction.line_items.map((item: any) => ({
      description: cleanUtf8Text(item.description || ''),
      quantity: item.quantity || null,
      unit_price: item.unit_price || null,
      total_amount: item.total_amount || null,
      tax_rate: item.tax_rate || null
    })) : []
  };
}

function extractReceiptData(prediction: any) {
  // Receipt API has different field structure
  return {
    invoice_number: cleanUtf8Text(prediction.receipt_number?.value || ''),
    invoice_date: prediction.date?.value || null,
    due_date: null, // Receipts typically don't have due dates
    total_amount: prediction.total_amount?.value || 0,
    total_net: prediction.total_net?.value || prediction.total_amount?.value || 0,
    total_tax: prediction.total_tax?.value || 0,
    currency: cleanUtf8Text(prediction.locale?.currency || 'EUR'),
    supplier_name: cleanUtf8Text(prediction.supplier_name?.value || ''),
    supplier_address: cleanUtf8Text(prediction.supplier_address?.value || ''),
    supplier_email: cleanUtf8Text(prediction.supplier_email?.value || ''),
    supplier_phone_number: cleanUtf8Text(prediction.supplier_phone_number?.value || ''),
    supplier_iban: '',
    supplier_website: '',
    supplier_company_registration: cleanUtf8Text(prediction.supplier_company_registrations?.[0]?.value || ''),
    supplier_vat_number: cleanUtf8Text(prediction.supplier_tax_id?.value || ''),
    customer_name: '',
    customer_address: '',
    customer_company_registration: '',
    customer_vat_number: '',
    payment_details: '',
    line_items: prediction.line_items ? prediction.line_items.map((item: any) => ({
      description: cleanUtf8Text(item.description || ''),
      quantity: item.quantity || null,
      unit_price: item.unit_price || null,
      total_amount: item.total_amount || null,
      tax_rate: item.tax_rate || null
    })) : []
  };
}
