import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Début de la conversion Word vers PDF')
    
    // Récupérer la clé API ConvertAPI depuis les secrets
    const convertApiKey = Deno.env.get('CONVERTAPI_SECRET')
    if (!convertApiKey) {
      throw new Error('CONVERTAPI_SECRET non configuré')
    }

    // Récupérer le fichier Word depuis la requête
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      throw new Error('Aucun fichier fourni')
    }

    console.log(`📁 Fichier reçu: ${file.name}, taille: ${file.size}`)

    // Préparer la requête pour ConvertAPI
    const convertFormData = new FormData()
    convertFormData.append('File', file)

    console.log('🔄 Envoi vers ConvertAPI...')
    
    // Appeler ConvertAPI pour convertir DOCX vers PDF
    const convertResponse = await fetch(`https://v2.convertapi.com/convert/docx/to/pdf?Secret=${convertApiKey}`, {
      method: 'POST',
      body: convertFormData,
    })

    if (!convertResponse.ok) {
      const errorText = await convertResponse.text()
      console.error('❌ Erreur ConvertAPI:', convertResponse.status, errorText)
      throw new Error(`Erreur ConvertAPI: ${convertResponse.status} - ${errorText}`)
    }

    const result = await convertResponse.json()
    console.log('✅ Conversion réussie, résultat:', result)

    if (!result.Files || result.Files.length === 0) {
      throw new Error('Aucun fichier PDF généré')
    }

    // Télécharger le PDF généré
    const pdfUrl = result.Files[0].Url
    console.log('🔄 Téléchargement du PDF depuis:', pdfUrl)
    
    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      throw new Error(`Erreur lors du téléchargement du PDF: ${pdfResponse.status}`)
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()
    console.log('✅ PDF téléchargé, taille:', pdfBuffer.byteLength)

    // Retourner le PDF
    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    })

  } catch (error) {
    console.error('❌ Erreur lors de la conversion:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})