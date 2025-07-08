import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConversionRequest {
  currency: string;
  amount: number;
  date: string; // Format: YYYY-MM-DD
}

interface ConversionResponse {
  exchange_rate: number;
  converted_amount: number;
  original_amount: number;
  original_currency: string;
  target_currency: string;
  conversion_date: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { currency, amount, date }: ConversionRequest = await req.json()
    
    console.log(`[currency-converter] Starting conversion: ${amount} ${currency} to CHF for date ${date}`)

    // Si la devise est déjà CHF, pas besoin de conversion
    if (currency === 'CHF') {
      console.log(`[currency-converter] Currency is already CHF, returning 1:1 conversion`)
      const response: ConversionResponse = {
        exchange_rate: 1,
        converted_amount: amount,
        original_amount: amount,
        original_currency: currency,
        target_currency: 'CHF',
        conversion_date: date
      }
      
      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Récupérer la clé API
    const apiKey = Deno.env.get('EXCHANGERATE_API_KEY')
    if (!apiKey) {
      console.error('[currency-converter] EXCHANGERATE_API_KEY not configured')
      throw new Error('EXCHANGERATE_API_KEY not configured')
    }
    console.log(`[currency-converter] API key found: ${apiKey.substring(0, 8)}...`)

    // Construire l'URL selon la documentation exchangerate.host
    // Pour les données historiques: https://api.exchangerate.host/historical?access_key=KEY&date=YYYY-MM-DD&source=EUR&currencies=CHF
    const apiUrl = `https://api.exchangerate.host/historical?access_key=${apiKey}&date=${date}&source=${currency}&currencies=CHF`
    console.log(`[currency-converter] Calling exchangerate API: ${apiUrl.replace(apiKey, 'REDACTED')}`)

    const exchangeResponse = await fetch(apiUrl)
    console.log(`[currency-converter] API response status: ${exchangeResponse.status} ${exchangeResponse.statusText}`)
    
    if (!exchangeResponse.ok) {
      const errorText = await exchangeResponse.text()
      console.error(`[currency-converter] Exchange rate API error: ${exchangeResponse.status} - ${errorText}`)
      throw new Error(`Exchange rate API error: ${exchangeResponse.status} ${exchangeResponse.statusText} - ${errorText}`)
    }

    const exchangeData = await exchangeResponse.json()
    console.log('[currency-converter] Exchange rate response:', JSON.stringify(exchangeData, null, 2))

    // Vérifier si l'API a retourné une erreur
    if (!exchangeData.success) {
      const errorInfo = exchangeData.error?.info || 'Unknown error'
      console.error(`[currency-converter] API returned error: ${errorInfo}`)
      throw new Error(`Exchange rate API error: ${errorInfo}`)
    }

    // Récupérer le taux de change CHF depuis les quotes
    // Le format est: quotes: { "EURCHF": 0.95 } pour EUR vers CHF
    const quotePair = `${currency}CHF`
    const exchangeRate = exchangeData.quotes?.[quotePair]
    
    console.log(`[currency-converter] Looking for quote pair: ${quotePair}`)
    console.log(`[currency-converter] Available quotes:`, Object.keys(exchangeData.quotes || {}))
    
    if (!exchangeRate) {
      console.error(`[currency-converter] No exchange rate found for ${quotePair}`)
      throw new Error(`No exchange rate found for ${currency} to CHF on ${date}`)
    }

    // Calculer le montant converti
    const convertedAmount = amount * exchangeRate

    const response: ConversionResponse = {
      exchange_rate: exchangeRate,
      converted_amount: Math.round(convertedAmount * 100) / 100, // Arrondir à 2 décimales
      original_amount: amount,
      original_currency: currency,
      target_currency: 'CHF',
      conversion_date: date
    }

    console.log(`[currency-converter] Conversion successful: ${amount} ${currency} = ${response.converted_amount} CHF (rate: ${exchangeRate})`)

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('[currency-converter] Currency conversion error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: `Currency conversion failed: ${error.message}`,
        exchange_rate: null,
        converted_amount: null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})