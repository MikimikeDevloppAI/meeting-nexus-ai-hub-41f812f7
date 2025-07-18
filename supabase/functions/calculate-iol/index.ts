import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    console.log("Received IOL calculation request:", requestData);

    const { gender, top_fields, right_eye, left_eye } = requestData;

    // Validate required data
    if (!right_eye || !left_eye) {
      return new Response(
        JSON.stringify({ error: "Missing eye data" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Perform IOL calculations (simplified example)
    const calculateIOLPower = (eyeData: any) => {
      try {
        // Extract axial length (AL) and keratometry values
        const AL = parseFloat(eyeData.AL);
        const K1_match = eyeData.K1?.match(/([0-9.]+)/);
        const K1 = K1_match ? parseFloat(K1_match[1]) : 43.0;
        
        // Simple SRK/T formula approximation
        // This is a simplified calculation - in practice you'd use more sophisticated formulas
        const A_constant = 118.7; // Default A-constant for many IOLs
        const target_refraction = 0.0; // Target emmetropia
        
        const iol_power = A_constant - (2.5 * AL) - (0.9 * K1) + target_refraction;
        
        return {
          recommended_power: Math.round(iol_power * 2) / 2, // Round to nearest 0.5D
          formula: "SRK/T",
          A_constant: A_constant,
          target_refraction: target_refraction
        };
      } catch (error) {
        console.error("Error calculating IOL power:", error);
        return {
          recommended_power: null,
          error: "Calculation error"
        };
      }
    };

    // Calculate for both eyes
    const right_calculation = calculateIOLPower(right_eye);
    const left_calculation = calculateIOLPower(left_eye);

    const result = {
      patient_info: top_fields,
      right_eye: {
        measurements: right_eye,
        calculation: right_calculation
      },
      left_eye: {
        measurements: left_eye,
        calculation: left_calculation
      },
      timestamp: new Date().toISOString()
    };

    console.log("IOL calculation result:", result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error("Error in calculate-iol function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});