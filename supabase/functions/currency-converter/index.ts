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
    
    console.log(`Converting ${amount} ${currency} to CHF for date ${date}`)

    // Si la devise est déjà CHF, pas besoin de conversion
    if (currency === 'CHF') {
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
      throw new Error('EXCHANGERATE_API_KEY not configured')
    }

    // Appeler l'API exchangerate.host
    const apiUrl = `https://api.exchangerate.host/${date}?base=${currency}&symbols=CHF&access_key=${apiKey}`
    console.log(`Calling exchangerate API: ${apiUrl}`)

    const exchangeResponse = await fetch(apiUrl)
    
    if (!exchangeResponse.ok) {
      throw new Error(`Exchange rate API error: ${exchangeResponse.status} ${exchangeResponse.statusText}`)
    }

    const exchangeData = await exchangeResponse.json()
    console.log('Exchange rate response:', exchangeData)

    // Vérifier si l'API a retourné une erreur
    if (!exchangeData.success) {
      throw new Error(`Exchange rate API error: ${exchangeData.error?.info || 'Unknown error'}`)
    }

    // Récupérer le taux de change CHF
    const exchangeRate = exchangeData.rates?.CHF
    if (!exchangeRate) {
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

    console.log(`Conversion successful: ${amount} ${currency} = ${response.converted_amount} CHF (rate: ${exchangeRate})`)

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Currency conversion error:', error)
    
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